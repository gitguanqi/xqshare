import type { CopyMethod } from './types';

/**
 * Writes text to the clipboard, preferring the async Clipboard API and falling
 * back to the legacy `execCommand` path. `document.execCommand` is deprecated
 * and missing in some environments, so it is only ever a fallback — the previous
 * implementation relied on it exclusively.
 */
export async function writeText(text: string, doc: Document): Promise<CopyMethod> {
  if (!text) return 'failed';

  const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
  if (clipboard && typeof clipboard.writeText === 'function') {
    try {
      await clipboard.writeText(text);
      return 'clipboard';
    } catch {
      // Permission denied, insecure context, or no focus: try the legacy path.
    }
  }

  return legacyCopy(text, doc) ? 'execCommand' : 'failed';
}

function legacyCopy(text: string, doc: Document): boolean {
  const body = doc.body;
  if (!body) return false;

  const area = doc.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', 'readonly');
  // Fixed positioning keeps the temporary node from scrolling the page, which
  // the old implementation did by appending a plain input to the body.
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.left = '-9999px';
  area.style.opacity = '0';

  const active = doc.activeElement as HTMLElement | null;
  body.appendChild(area);

  try {
    area.select();
    if (typeof area.setSelectionRange === 'function') {
      area.setSelectionRange(0, text.length);
    }
    return typeof doc.execCommand === 'function' ? Boolean(doc.execCommand('copy')) : false;
  } catch {
    return false;
  } finally {
    area.remove();
    if (active && typeof active.focus === 'function') active.focus();
  }
}
