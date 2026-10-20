import { XqShare } from './core';
import { setDetectedIconBase } from './icons';

/*
 * ESM entry. The module URL is the only reliable way to find `lib/img/` from a
 * bundler-consumed module, and `import.meta` is legal here because this file is
 * only ever built as ESM.
 */
try {
  setDetectedIconBase(new URL('../img/', import.meta.url).href);
} catch {
  // Non-standard module loaders keep the CDN fallback.
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
