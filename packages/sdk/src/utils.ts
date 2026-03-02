import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { chmod, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { arch, homedir, platform } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { BinaryNotFoundError } from "./errors.js";

const BINARY_NAME = process.platform === "win32" ? "trustchain-node.exe" : "trustchain-node";
const GITHUB_REPO = "viftode4/trustchain";

/**
 * Map current platform to GitHub release artifact name.
 */
function platformArtifact(): string {
	const os = platform();
	const machine = arch();

	const archMap: Record<string, string> = {
		x64: "x64",
		arm64: "arm64",
	};
	const archName = archMap[machine];
	if (!archName) throw new BinaryNotFoundError(`Unsupported architecture: ${machine}`);

	if (os === "linux") return `trustchain-node-linux-${archName}.tar.gz`;
	if (os === "darwin") return `trustchain-node-macos-${archName}.tar.gz`;
	if (os === "win32") return `trustchain-node-windows-${archName}.zip`;
	throw new BinaryNotFoundError(`Unsupported platform: ${os}`);
}

/**
 * Download the trustchain-node binary from GitHub Releases.
 * Uses only Node 20+ built-ins (fetch, fs, zlib).
 */
export async function ensureBinary(explicitPath?: string): Promise<string> {
	// Try synchronous lookup first
	try {
		return findBinary(explicitPath);
	} catch {
		// Not found — fall through to download
	}

	const artifact = platformArtifact();
	const binDir = join(homedir(), ".trustchain", "bin");
	mkdirSync(binDir, { recursive: true });
	const dest = join(binDir, BINARY_NAME);

	console.log(`[trustchain] Downloading binary for ${platform()}-${arch()}...`);

	// Fetch latest release info
	const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
	const releaseResp = await fetch(apiUrl, {
		headers: {
			Accept: "application/vnd.github+json",
			"User-Agent": "trustchain-js",
		},
	});
	if (!releaseResp.ok) {
		throw new BinaryNotFoundError(`Failed to fetch release info: ${releaseResp.statusText}`);
	}
	const release = (await releaseResp.json()) as {
		tag_name: string;
		assets: Array<{ name: string; browser_download_url: string }>;
	};

	const version = release.tag_name ?? "unknown";
	const asset = release.assets.find((a) => a.name === artifact);
	if (!asset) {
		const available = release.assets.map((a) => a.name);
		throw new BinaryNotFoundError(
			`No release artifact '${artifact}' in ${version}. Available: ${available.join(", ")}`,
		);
	}

	// Download the archive
	const dlResp = await fetch(asset.browser_download_url, {
		headers: { "User-Agent": "trustchain-js" },
	});
	if (!dlResp.ok || !dlResp.body) {
		throw new BinaryNotFoundError(`Failed to download: ${dlResp.statusText}`);
	}

	const arrayBuf = await dlResp.arrayBuffer();
	const buffer = Buffer.from(arrayBuf);

	// Extract based on file type
	if (artifact.endsWith(".tar.gz")) {
		// Use tar module (Node built-in as of v22, but we extract manually)
		// Simple approach: decompress with zlib, then parse tar
		const decompressed = await decompressGzip(buffer);
		const binaryData = extractFromTar(decompressed, "trustchain-node");
		await writeFile(dest, binaryData);
		await chmod(dest, 0o755);
	} else if (artifact.endsWith(".zip")) {
		// Simple ZIP extraction for single-file archives
		const binaryData = extractFromZip(buffer, "trustchain-node.exe");
		await writeFile(dest, binaryData);
	}

	console.log(`[trustchain] Downloaded ${version} → ${dest}`);
	return dest;
}

/** Decompress gzip buffer. */
function decompressGzip(buf: Buffer): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const gunzip = createGunzip();
		const chunks: Buffer[] = [];
		gunzip.on("data", (chunk: Buffer) => chunks.push(chunk));
		gunzip.on("end", () => resolve(Buffer.concat(chunks)));
		gunzip.on("error", reject);
		gunzip.end(buf);
	});
}

/** Extract a file from a tar buffer (simplified — looks for filename match). */
function extractFromTar(buf: Buffer, filename: string): Buffer {
	// TAR format: 512-byte headers + file data padded to 512-byte blocks
	let offset = 0;
	while (offset < buf.length - 512) {
		const header = buf.subarray(offset, offset + 512);
		// Check for empty block (end of archive)
		if (header.every((b) => b === 0)) break;

		const name = header.subarray(0, 100).toString("utf8").replace(/\0/g, "");
		const sizeStr = header.subarray(124, 136).toString("utf8").replace(/\0/g, "").trim();
		const size = Number.parseInt(sizeStr, 8);

		offset += 512; // Move past header

		if (name.endsWith(filename) && size > 0) {
			return buf.subarray(offset, offset + size);
		}

		// Skip file data (padded to 512-byte boundary)
		offset += Math.ceil(size / 512) * 512;
	}
	throw new BinaryNotFoundError(`${filename} not found in tar archive`);
}

/** Extract a file from a ZIP buffer (simplified — looks for filename match). */
function extractFromZip(buf: Buffer, filename: string): Buffer {
	// Find End of Central Directory
	let eocdOffset = buf.length - 22;
	while (eocdOffset >= 0 && buf.readUInt32LE(eocdOffset) !== 0x06054b50) {
		eocdOffset--;
	}
	if (eocdOffset < 0) throw new BinaryNotFoundError("Invalid ZIP archive");

	const cdOffset = buf.readUInt32LE(eocdOffset + 16);
	const cdEntries = buf.readUInt16LE(eocdOffset + 10);

	let pos = cdOffset;
	for (let i = 0; i < cdEntries; i++) {
		if (buf.readUInt32LE(pos) !== 0x02014b50) break;

		const compMethod = buf.readUInt16LE(pos + 10);
		const compSize = buf.readUInt32LE(pos + 20);
		const uncompSize = buf.readUInt32LE(pos + 24);
		const nameLen = buf.readUInt16LE(pos + 28);
		const extraLen = buf.readUInt16LE(pos + 30);
		const commentLen = buf.readUInt16LE(pos + 32);
		const localHeaderOffset = buf.readUInt32LE(pos + 42);
		const name = buf.subarray(pos + 46, pos + 46 + nameLen).toString("utf8");

		if (name.endsWith(filename)) {
			// Read from local file header
			const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
			const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
			const dataOffset = localHeaderOffset + 30 + localNameLen + localExtraLen;

			if (compMethod === 0) {
				// Stored (no compression)
				return buf.subarray(dataOffset, dataOffset + uncompSize);
			}
			throw new BinaryNotFoundError(
				`ZIP entry '${name}' uses compression method ${compMethod} (only stored supported)`,
			);
		}

		pos += 46 + nameLen + extraLen + commentLen;
	}
	throw new BinaryNotFoundError(`${filename} not found in ZIP archive`);
}

/**
 * Discover the trustchain-node binary location (synchronous).
 * Search order: explicit path → PATH lookup → ~/.trustchain/bin/
 */
export function findBinary(explicitPath?: string): string {
	if (explicitPath) {
		if (existsSync(explicitPath)) return explicitPath;
		throw new BinaryNotFoundError(`Binary not found at: ${explicitPath}`);
	}

	// Check PATH via which-like lookup
	const pathBinary = whichSync(BINARY_NAME);
	if (pathBinary) return pathBinary;

	// Check ~/.trustchain/bin/
	const homeBinary = join(homedir(), ".trustchain", "bin", BINARY_NAME);
	if (existsSync(homeBinary)) return homeBinary;

	throw new BinaryNotFoundError(
		`${BINARY_NAME} not found in PATH or ~/.trustchain/bin/. Download from https://github.com/viftode4/trustchain/releases`,
	);
}

/** Simple synchronous which — checks PATH for an executable. */
function whichSync(name: string): string | null {
	const pathEnv = process.env.PATH ?? "";
	const sep = process.platform === "win32" ? ";" : ":";
	const dirs = pathEnv.split(sep);
	const extensions = process.platform === "win32" ? ["", ".exe", ".cmd", ".bat"] : [""];

	for (const dir of dirs) {
		for (const ext of extensions) {
			const full = join(dir, name + ext);
			if (existsSync(full)) return full;
		}
	}
	return null;
}

/** Port layout: base+0=QUIC, base+1=reserved, base+2=HTTP, base+3=proxy */
export const PORT_HTTP_OFFSET = 2;
export const PORT_PROXY_OFFSET = 3;
export const PORTS_NEEDED = 4;

/**
 * Find a base port where PORTS_NEEDED consecutive ports are free.
 * Scans 18200-19000 in steps of 4 (randomized order).
 */
export async function findFreePortBase(): Promise<number> {
	const candidates: number[] = [];
	for (let p = 18200; p < 19000; p += PORTS_NEEDED) {
		candidates.push(p);
	}
	// Shuffle
	for (let i = candidates.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[candidates[i], candidates[j]] = [candidates[j], candidates[i]];
	}

	for (const base of candidates) {
		const allFree = await checkPortsFree(base, PORTS_NEEDED);
		if (allFree) return base;
	}

	throw new Error("No free port range found in 18200-19000");
}

async function checkPortsFree(base: number, count: number): Promise<boolean> {
	const checks = Array.from({ length: count }, (_, i) => isPortFree(base + i));
	const results = await Promise.all(checks);
	return results.every(Boolean);
}

function isPortFree(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const server = createServer();
		server.once("error", () => resolve(false));
		server.listen(port, "127.0.0.1", () => {
			server.close(() => resolve(true));
		});
	});
}
