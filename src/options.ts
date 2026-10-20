import { XqShareError } from './errors';
import { resolveIconBase } from './icons';
import { DEFAULT_TARGETS, isShareTargetName } from './share-url';
import type {
  ResolvedOptions,
  ShareMode,
  ShareTargetName,
  XqShareOptions,
} from './types';

const MODES: readonly ShareMode[] = ['default', 'pop', 'slide'];

function noop(): void {
  /* default callback */
}

function currentUrl(doc?: Document): string {
  const href = doc ? doc.defaultView?.location?.href : undefined;
  if (typeof href === 'string' && href) return href;
  return typeof location !== 'undefined' ? location.href : '';
}

function currentTitle(doc?: Document): string {
  if (doc && typeof doc.title === 'string') return doc.title;
  return typeof document !== 'undefined' ? document.title : '';
}

function metaDescription(doc?: Document): string {
  const meta = doc?.querySelector('meta[name="description"]');
  return (meta?.getAttribute('content') ?? '').trim();
}

function normalizeTargets(
  input: readonly ShareTargetName[] | undefined,
): readonly ShareTargetName[] {
  if (input === undefined) return DEFAULT_TARGETS;
  if (!Array.isArray(input)) {
    throw new XqShareError('bad-target', 'targets must be an array of share target names');
  }
  const seen = new Set<ShareTargetName>();
  for (const name of input) {
    if (!isShareTargetName(name)) {
      throw new XqShareError('bad-target', `unknown share target "${String(name)}"`);
    }
    seen.add(name);
  }
  return [...seen];
}

/**
 * Applies defaults field by field.
 *
 * The previous constructor used a default *parameter* object, which only applied
 * when the argument was `undefined` — so `new XqShare({ el: '#a' })` threw. Here
 * every field falls back independently.
 */
export function resolveOptions(input: XqShareOptions, doc?: Document): ResolvedOptions {
  if (!input || typeof input !== 'object') {
    throw new XqShareError('bad-el', 'an options object is required');
  }
  if (input.el === undefined || input.el === null) {
    throw new XqShareError('bad-el', 'el is required');
  }

  const type = input.type ?? 'default';
  if (MODES.indexOf(type) === -1) {
    throw new XqShareError(
      'bad-mode',
      `type must be "default", "pop" or "slide" (got "${String(type)}")`,
    );
  }

  return {
    el: input.el,
    type,
    url: (input.url ?? '').trim() || currentUrl(doc),
    title: (input.title ?? '').trim() || currentTitle(doc),
    desc: (input.desc ?? '').trim() || metaDescription(doc),
    targets: normalizeTargets(input.targets),
    iconBase: resolveIconBase(input.iconBase),
    visible: input.visible ?? (type !== 'pop'),
    closeOnMask: input.closeOnMask ?? true,
    onShare: input.onShare ?? noop,
    onCopy: input.onCopy ?? noop,
    onToggle: input.onToggle ?? noop,
    onError: input.onError ?? noop,
  };
}
