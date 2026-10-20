import type { CopyMethod } from './types';
/**
 * Writes text to the clipboard, preferring the async Clipboard API and falling
 * back to the legacy `execCommand` path. `document.execCommand` is deprecated
 * and missing in some environments, so it is only ever a fallback — the previous
 * implementation relied on it exclusively.
 */
export declare function writeText(text: string, doc: Document): Promise<CopyMethod>;
