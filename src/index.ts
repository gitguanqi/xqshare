import { XqShare } from './core';
import { setDetectedIconBase } from './icons';

/*
 * UMD entry. `document.currentScript` still points at the <script> tag while the
 * IIFE runs, so the bundle can locate its own `lib/img/` without configuration.
 * No `import.meta` may appear here: that would break the IIFE build.
 */
if (typeof document !== 'undefined') {
  const script = document.currentScript as HTMLScriptElement | null;
  if (script && script.src) {
    try {
      setDetectedIconBase(new URL('../img/', script.src).href);
    } catch {
      // Older engines without the URL constructor keep the CDN fallback.
    }
  }
}

export { XqShare } from './core';
export { XqShareError } from './errors';
export {
  DEFAULT_TARGETS,
  SHARE_TARGETS,
  buildShareUrl,
  getShareTarget,
  isShareTargetName,
} from './share-url';
export { ICON_CDN_BASE } from './icons';
export { VERSION } from './version';
export type * from './types';

export default XqShare;
