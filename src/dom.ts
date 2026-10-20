import { XqShareError } from './errors';

/**
 * Resolves the host once per instance. A selector that matches nothing used to
 * fall back to `document.documentElement`, which silently produced a widget whose
 * listeners could never fire; now it throws with a stable code.
 */
export function resolveHost(el: string | Element, doc: Document): HTMLElement {
  if (typeof el === 'string') {
    const selector = el.trim();
    if (!selector) {
      throw new XqShareError('bad-el', 'el must be a non-empty selector or an element');
    }
    const found = doc.querySelector(selector);
    if (!found) {
      throw new XqShareError('host-missing', `no element matches "${selector}"`);
    }
    return found as HTMLElement;
  }
  if (el && (el as Element).nodeType === 1) {
    return el as HTMLElement;
  }
  throw new XqShareError('bad-el', 'el must be a selector string or an element');
}

interface ListenerEntry {
  target: EventTarget;
  type: string;
  handler: EventListener;
  options?: boolean | AddEventListenerOptions;
}

/** Every listener an instance owns, so `destroy()` can remove all of them. */
export class ListenerBag {
  private entries: ListenerEntry[] = [];

  add(
    target: EventTarget,
    type: string,
    handler: EventListener,
    options?: boolean | AddEventListenerOptions,
  ): void {
    target.addEventListener(type, handler, options);
    this.entries.push({ target, type, handler, options });
  }

  clear(): void {
    for (const entry of this.entries) {
      entry.target.removeEventListener(entry.type, entry.handler, entry.options);
    }
    this.entries.length = 0;
  }

  get size(): number {
    return this.entries.length;
  }
}

/**
 * Body scroll is locked with a reference count, so two open overlays do not
 * unlock each other and the original inline style is restored exactly once.
 */
const scrollLocks = new WeakMap<Document, { count: number; overflow: string }>();

export function lockBodyScroll(doc: Document): void {
  const body = doc.body;
  if (!body) return;
  const existing = scrollLocks.get(doc);
  if (existing) {
    existing.count += 1;
    return;
  }
  scrollLocks.set(doc, { count: 1, overflow: body.style.overflow });
  body.style.overflow = 'hidden';
}

export function unlockBodyScroll(doc: Document): void {
  const state = scrollLocks.get(doc);
  if (!state) return;
  state.count -= 1;
  if (state.count > 0) return;
  scrollLocks.delete(doc);
  const body = doc.body;
  if (body) body.style.overflow = state.overflow;
}
