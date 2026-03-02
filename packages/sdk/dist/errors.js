export class TrustChainError extends Error {
    constructor(message) {
        super(message);
        this.name = "TrustChainError";
    }
}
export class HttpError extends TrustChainError {
    status;
    body;
    constructor(status, body) {
        super(`HTTP ${status}: ${body}`);
        this.status = status;
        this.body = body;
        this.name = "HttpError";
    }
}
export class ConnectionError extends TrustChainError {
    cause;
    constructor(message, cause) {
        super(message);
        this.cause = cause;
        this.name = "ConnectionError";
    }
}
export class TimeoutError extends TrustChainError {
    constructor(message = "Request timed out") {
        super(message);
        this.name = "TimeoutError";
    }
}
export class BinaryNotFoundError extends TrustChainError {
    constructor(message = "trustchain-node binary not found") {
        super(message);
        this.name = "BinaryNotFoundError";
    }
}
export class SidecarError extends TrustChainError {
    constructor(message) {
        super(message);
        this.name = "SidecarError";
    }
}
//# sourceMappingURL=errors.js.map