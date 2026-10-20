import type { XqShareErrorCode } from './types';

/**
 * Every recoverable failure is reported with a stable `code`, so callers do not
 * have to match on message text.
 */
export class XqShareError extends Error {
  readonly code: XqShareErrorCode;

  constructor(code: XqShareErrorCode, message: string) {
    super(`XqShare Error: ${message}`);
    this.name = 'XqShareError';
    this.code = code;
  }
}
