/**
 * Icons are shipped inside the package (`lib/img/`). The original build loaded
 * them from a third-party CDN, which meant a broken widget offline and an
 * unusable demo page.
 */
export declare const ICON_CDN_BASE = "https://xqgj.cc/xqcdn/libs/xqshare/img/";
/**
 * Set by each entry point from its own script URL, so `lib/js/xqshare.min.js`
 * resolves `lib/img/` without configuration.
 */
export declare function setDetectedIconBase(base: string | null | undefined): void;
export declare function resolveIconBase(explicit?: string): string;
export declare function isCdnIconBase(base: string): boolean;
