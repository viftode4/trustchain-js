import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";
import { BinaryNotFoundError } from "./errors.js";

const BINARY_NAME = process.platform === "win32" ? "trustchain-node.exe" : "trustchain-node";

/**
 * Discover the trustchain-node binary location.
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
		`${BINARY_NAME} not found in PATH or ~/.trustchain/bin/. ` +
			"Download from https://github.com/viftode4/trustchain/releases",
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
