/**
 * Core delegation validation logic.
 *
 * These checks are enforced client-side before any HTTP call so that
 * privilege-escalation bugs are caught early and with clear error messages,
 * mirroring the same constraints enforced in the Rust node.
 */
/** 30-day maximum delegation TTL in milliseconds. */
export declare const MAX_DELEGATION_TTL_MS: number;
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
export declare function validateSubDelegationScope(
	parentScope: string[],
	childScope: string[],
): void;
/**
 * Validate that a TTL in milliseconds does not exceed the 30-day maximum.
 *
 * @param ttlMs  TTL in milliseconds.
 * @throws {Error} if ttlMs exceeds MAX_DELEGATION_TTL_MS.
 */
export declare function validateDelegationTtlMs(ttlMs: number): void;
/**
 * Validate that a TTL in seconds does not exceed the 30-day maximum.
 *
 * @param ttlSeconds  TTL in seconds.
 * @throws {Error} if the equivalent milliseconds exceed MAX_DELEGATION_TTL_MS.
 */
export declare function validateDelegationTtlSeconds(ttlSeconds: number): void;
//# sourceMappingURL=delegation.d.ts.map
