import { describe, expect, it } from "bun:test";
import { BinaryNotFoundError } from "../src/errors.js";
import { TrustChainSidecar } from "../src/sidecar.js";
import {
	PORTS_NEEDED,
	PORT_HTTP_OFFSET,
	PORT_PROXY_OFFSET,
	findBinary,
	findFreePortBase,
} from "../src/utils.js";

describe("findBinary", () => {
	it("throws BinaryNotFoundError for explicit nonexistent path", () => {
		expect(() => findBinary("/nonexistent/trustchain-node")).toThrow(BinaryNotFoundError);
	});

	it("throws BinaryNotFoundError when not in PATH or home dir", () => {
		// Save and clear PATH to ensure binary is not found
		const origPath = process.env.PATH;
		process.env.PATH = "";
		try {
			expect(() => findBinary()).toThrow(BinaryNotFoundError);
		} finally {
			process.env.PATH = origPath;
		}
	});
});

describe("port allocation", () => {
	it("port offsets are correct", () => {
		expect(PORT_HTTP_OFFSET).toBe(2);
		expect(PORT_PROXY_OFFSET).toBe(3);
		expect(PORTS_NEEDED).toBe(4);
	});

	it("findFreePortBase returns a port in range", async () => {
		const base = await findFreePortBase();
		expect(base).toBeGreaterThanOrEqual(18200);
		expect(base).toBeLessThan(19000);
		expect(base % 4).toBe(0); // aligned to step of 4
	});
});

describe("TrustChainSidecar", () => {
	it("throws when accessing client before start", () => {
		const sidecar = new TrustChainSidecar();
		expect(() => sidecar.client).toThrow("Sidecar not started");
	});

	it("throws when accessing httpUrl before start", () => {
		const sidecar = new TrustChainSidecar();
		expect(() => sidecar.httpUrl).toThrow("Sidecar not started");
	});

	it("throws when accessing proxyUrl before start", () => {
		const sidecar = new TrustChainSidecar();
		expect(() => sidecar.proxyUrl).toThrow("Sidecar not started");
	});

	it("isRunning is false initially", () => {
		const sidecar = new TrustChainSidecar();
		expect(sidecar.isRunning).toBe(false);
	});

	it("pubkey is null initially", () => {
		const sidecar = new TrustChainSidecar();
		expect(sidecar.pubkey).toBeNull();
	});

	it("supports Symbol.dispose", () => {
		const sidecar = new TrustChainSidecar();
		expect(typeof sidecar[Symbol.dispose]).toBe("function");
	});

	it("stop() is safe to call when not started", () => {
		const sidecar = new TrustChainSidecar();
		expect(() => sidecar.stop()).not.toThrow();
	});
});
