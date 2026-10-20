/**
 * Icons are shipped inside the package (`lib/img/`). The original build loaded
 * them from a third-party CDN, which meant a broken widget offline and an
 * unusable demo page.
 */
export const ICON_CDN_BASE = 'https://xqgj.cc/xqcdn/libs/xqshare/img/';

let detectedBase = '';

function normalize(base: string): string {
  return base.endsWith('/') ? base : `${base}/`;
}

/**
 * Set by each entry point from its own script URL, so `lib/js/xqshare.min.js`
 * resolves `lib/img/` without configuration.
 */
export function setDetectedIconBase(base: string | null | undefined): void {
  if (base) detectedBase = normalize(base);
}

export function resolveIconBase(explicit?: string): string {
  const value = (explicit ?? '').trim();
  if (value) return normalize(value);
  return detectedBase || ICON_CDN_BASE;
}

export function isCdnIconBase(base: string): boolean {
  return normalize(base) === ICON_CDN_BASE;
}
