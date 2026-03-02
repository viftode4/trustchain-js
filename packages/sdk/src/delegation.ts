/**
 * Core delegation validation logic.
 *
 * These checks are enforced client-side before any HTTP call so that
 * privilege-escalation bugs are caught early and with clear error messages,
 * mirroring the same constraints enforced in the Rust node.
 */

/** 30-day maximum delegation TTL in milliseconds. */
export const MAX_DELEGATION_TTL_MS = 30 * 24 * 3600 * 1000; // 2_592_000_000

/**
 * Validate that a child (sub-)delegation scope does not escalate privileges
 * beyond what the parent delegation permits.
 *
 * Rules (mirroring Rust `create_sub_delegation`):
 *   - If parent scope is unrestricted (empty array) → any child scope is fine.
 *   - If parent scope is restricted (non-empty):
 *       - Child scope MUST NOT be empty (empty = unrestricted = superset of any
 *         restricted scope = privilege escalation).
 *       - Every capability in the child scope must appear in the parent scope.
 *
 * @param parentScope  Scope from the parent DelegationRecord.  Empty = unrestricted.
 * @param childScope   Requested scope for the sub-delegation.  Empty = unrestricted.
 * @throws {Error} if the child scope would escalate privileges.
 */
export function validateSubDelegationScope(parentScope: string[], childScope: string[]): void {
	// Parent is unrestricted → child can do anything.
	if (parentScope.length === 0) return;

	// Parent is restricted → child must not be unrestricted.
	if (childScope.length === 0) {
		throw new Error(
			"Sub-delegation scope must not be unrestricted when parent scope is restricted",
		);
	}

	// Every capability requested by the child must be covered by the parent.
	for (const cap of childScope) {
		if (!parentScope.includes(cap)) {
			throw new Error(
				`Sub-delegation scope escalation: capability "${cap}" is not in parent scope [${parentScope.join(", ")}]`,
			);
		}
	}
}

/**
 * Validate that a TTL in milliseconds does not exceed the 30-day maximum.
 *
 * @param ttlMs  TTL in milliseconds.
 * @throws {Error} if ttlMs exceeds MAX_DELEGATION_TTL_MS.
 */
export function validateDelegationTtlMs(ttlMs: number): void {
	if (ttlMs > MAX_DELEGATION_TTL_MS) {
		throw new Error(`ttl_ms ${ttlMs} exceeds maximum of 30 days (${MAX_DELEGATION_TTL_MS} ms)`);
	}
}

/**
 * Validate that a TTL in seconds does not exceed the 30-day maximum.
 *
 * @param ttlSeconds  TTL in seconds.
 * @throws {Error} if the equivalent milliseconds exceed MAX_DELEGATION_TTL_MS.
 */
export function validateDelegationTtlSeconds(ttlSeconds: number): void {
	validateDelegationTtlMs(ttlSeconds * 1000);
}
