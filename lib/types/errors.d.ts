import type { XqShareErrorCode } from './types';
/**
 * Every recoverable failure is reported with a stable `code`, so callers do not
 * have to match on message text.
 */
export declare class XqShareError extends Error {
    readonly code: XqShareErrorCode;
    constructor(code: XqShareErrorCode, message: string);
}
