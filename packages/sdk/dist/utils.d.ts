/**
 * Discover the trustchain-node binary location.
 * Search order: explicit path → PATH lookup → ~/.trustchain/bin/
 */
export declare function findBinary(explicitPath?: string): string;
/** Port layout: base+0=QUIC, base+1=reserved, base+2=HTTP, base+3=proxy */
export declare const PORT_HTTP_OFFSET = 2;
export declare const PORT_PROXY_OFFSET = 3;
export declare const PORTS_NEEDED = 4;
/**
 * Find a base port where PORTS_NEEDED consecutive ports are free.
 * Scans 18200-19000 in steps of 4 (randomized order).
 */
export declare function findFreePortBase(): Promise<number>;
//# sourceMappingURL=utils.d.ts.map