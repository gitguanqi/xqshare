import type { SharePayload, ShareTargetName } from './types';
export interface ShareTargetDefinition {
    readonly name: ShareTargetName;
    /** Visible label under the icon. */
    readonly label: string;
    /** File name inside the icon directory. */
    readonly icon: string;
    /**
     * `null` means the destination has no web endpoint and the caller has to copy
     * the link instead of opening a window (that is the case for WeChat).
     */
    readonly build: ((payload: SharePayload) => string) | null;
}
/**
 * The single source of truth for every destination. Each `build` receives an
 * already-trimmed payload and returns a fully encoded URL, so callers never
 * concatenate parameters by hand.
 */
export declare const SHARE_TARGETS: readonly ShareTargetDefinition[];
/**
 * Rendered when `targets` is omitted: the five destinations the widget has
 * always shown. `wechat` stays available but opt-in, because it copies the link
 * instead of opening a share page.
 */
export declare const DEFAULT_TARGETS: readonly ShareTargetName[];
export declare function getShareTarget(name: string): ShareTargetDefinition | null;
export declare function isShareTargetName(name: unknown): name is ShareTargetName;
/**
 * Builds the destination URL, or returns `null` when the destination has no
 * endpoint (`wechat`) or is not a known target. It never throws: an unknown
 * name used to crash the click handler.
 */
export declare function buildShareUrl(type: string, payload: SharePayload): string | null;
