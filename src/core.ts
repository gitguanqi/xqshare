import { writeText } from './clipboard';
import { ListenerBag, lockBodyScroll, resolveHost, unlockBodyScroll } from './dom';
import { XqShareError } from './errors';
import { ICON_CDN_BASE, isCdnIconBase } from './icons';
import { resolveOptions } from './options';
import { buildShareUrl, getShareTarget } from './share-url';
import { buildIframeSnippet, renderMarkup } from './template';
import type {
  CopyResult,
  CopyTarget,
  ResolvedOptions,
  SharePayload,
  ShareResult,
  XqShareOptions,
} from './types';
import { VERSION } from './version';

/**
 * Maps the old internal ids onto the current copy targets, so code written
 * against `copy('#previewUrl')` keeps working.
 */
export function normalizeCopyTarget(target: CopyTarget | string): CopyTarget {
  if (
    target === 'iframe' ||
    target === 'code' ||
    target === '#iframeUrl' ||
    target === '#copyIframe' ||
    target === '#iframe-url'
  ) {
    return 'iframe';
  }
  return 'url';
}

/**
 * The share widget.
 *
 * All state lives on the instance: the markup is rendered once per instance,
 * every lookup is scoped to `this.root`, and every listener is owned by
 * `this.bag`. That is what makes several instances on one page safe.
 */
export class XqShare {
  static readonly version: string = VERSION;

  private raw: XqShareOptions;
  private settings: ResolvedOptions;
  private readonly doc: Document;
  private root: HTMLElement | null = null;
  private box: HTMLElement | null = null;
  private tip: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private fields: Partial<Record<CopyTarget, HTMLInputElement>> = {};
  private readonly bag = new ListenerBag();
  private statusTimer: ReturnType<typeof setTimeout> | null = null;
  private scrollLocked = false;
  private lastTrigger: HTMLElement | null = null;
  private disposed = false;

  constructor(options: XqShareOptions) {
    if (typeof document === 'undefined') {
      throw new XqShareError('bad-el', 'XqShare needs a DOM (document is undefined)');
    }
    this.raw = options;
    this.doc = document;
    this.settings = resolveOptions(options, this.doc);
    this.attach(this.settings);
    this.applyVisibility(this.settings.visible, true);
  }

  /* ---------------------------------------------------------------- public */

  get element(): HTMLElement | null {
    return this.root;
  }

  get mode(): 'default' | 'pop' | 'slide' {
    return this.settings.type;
  }

  get options(): Readonly<ResolvedOptions> {
    return this.settings;
  }

  get visible(): boolean {
    if (!this.root || !this.box) return false;
    if (this.settings.type === 'pop') return this.box.classList.contains('active');
    return !this.root.hidden;
  }

  show(): this {
    if (!this.visible) this.applyVisibility(true);
    return this;
  }

  hide(): this {
    if (this.visible) this.applyVisibility(false);
    return this;
  }

  toggle(): this {
    return this.visible ? this.hide() : this.show();
  }

  /**
   * Opens a destination. `wechat` has no web endpoint, so it copies the link and
   * reports through `onCopy` instead of opening a blank tab.
   */
  share(type: string, url?: string, title?: string, desc?: string): ShareResult {
    const payload: SharePayload = {
      type,
      url: url ?? this.settings.url,
      title: title ?? this.settings.title,
      desc: desc ?? this.settings.desc,
    };

    const target = getShareTarget(type);
    if (!target) {
      this.report(new XqShareError('bad-target', `unknown share target "${String(type)}"`));
      return { ...payload, opened: false, copy: null };
    }

    if (!target.build) {
      void this.copy('url');
      const copied: ShareResult = { ...payload, opened: false, copy: null };
      this.settings.onShare(copied);
      this.emit('xqshare:share', copied);
      return copied;
    }

    const shareUrl = buildShareUrl(type, payload);
    let opened = false;
    if (shareUrl) {
      try {
        const win = typeof window === 'undefined' ? null : window.open(shareUrl, '_blank');
        if (win) {
          try {
            win.opener = null;
          } catch {
            // Cross-origin windows may reject the assignment; harmless.
          }
          opened = true;
        } else {
          this.report(new XqShareError('popup-blocked', 'the share window was blocked'));
        }
      } catch (error) {
        this.report(
          new XqShareError(
            'popup-blocked',
            error instanceof Error ? error.message : 'the share window could not be opened',
          ),
        );
      }
    }

    const result: ShareResult = { ...payload, opened, copy: null };
    this.settings.onShare(result);
    this.emit('xqshare:share', result);
    return result;
  }

  copy(target: CopyTarget | string = 'url'): Promise<CopyResult> {
    const resolved = normalizeCopyTarget(target);
    const text = this.fieldText(resolved);
    return writeText(text, this.doc).then((method) => {
      const result: CopyResult = { ok: method !== 'failed', method, target: resolved, text };
      this.setStatus(result.ok ? '已复制' : '复制失败，请手动选择');
      this.settings.onCopy(result);
      this.emit('xqshare:copy', result);
      return result;
    });
  }

  setUrl(url: string, title?: string): this {
    const nextTitle = title ?? this.settings.title;
    this.settings = { ...this.settings, url, title: nextTitle };
    this.raw = { ...this.raw, url, title: nextTitle };
    this.syncFields();
    return this;
  }

  /** Re-resolves the options and rebuilds the markup on the same instance. */
  update(patch: Partial<XqShareOptions>): this {
    if (this.disposed) {
      throw new XqShareError('bad-el', 'this instance has been destroyed');
    }
    const wasVisible = this.visible;
    this.teardown();
    this.raw = { ...this.raw, ...patch };
    this.settings = resolveOptions(this.raw, this.doc);
    this.attach(this.settings);
    this.applyVisibility(patch.visible ?? wasVisible, true);
    return this;
  }

  destroy(): void {
    if (this.disposed) return;
    this.teardown();
    this.disposed = true;
  }

  /* --------------------------------------------------------------- private */

  private attach(settings: ResolvedOptions): void {
    const host = resolveHost(settings.el, this.doc);
    const root = this.doc.createElement('div');
    root.className = 'xqshare';
    root.innerHTML = renderMarkup(settings);
    host.appendChild(root);

    this.root = root;
    this.box = root.querySelector('.xqshare-box') as HTMLElement | null;
    this.tip = root.querySelector('.xqshare-tip') as HTMLElement | null;
    this.statusEl = root.querySelector('.xqshare-status') as HTMLElement | null;

    const urlField = root.querySelector('[data-field="url"]') as HTMLInputElement | null;
    const iframeField = root.querySelector('[data-field="iframe"]') as HTMLInputElement | null;
    this.fields = {};
    if (urlField) this.fields.url = urlField;
    if (iframeField) this.fields.iframe = iframeField;

    this.bag.add(root, 'click', this.onClick);
    this.bag.add(root, 'error', this.onIconError, true);
    this.bag.add(this.doc, 'keydown', this.onKeydown);

    // Populate the copy fields explicitly. Relying on the `value` attribute from
    // `renderMarkup` would work in a real browser but not in every DOM
    // implementation, so the source of truth (settings) is written here.
    this.syncFields();
  }

  private teardown(): void {
    this.bag.clear();
    this.releaseScroll();
    if (this.statusTimer !== null) {
      clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
    if (this.root) this.root.remove();
    this.root = null;
    this.box = null;
    this.tip = null;
    this.statusEl = null;
    this.fields = {};
    this.lastTrigger = null;
  }

  private applyVisibility(visible: boolean, silent = false): void {
    const { root, box } = this;
    if (!root || !box) return;

    if (this.settings.type === 'pop') {
      root.hidden = false;
      box.classList.toggle('active', visible);
      if (visible) {
        this.acquireScroll();
        this.focusDialog();
      } else {
        this.releaseScroll();
        this.restoreFocus();
      }
    } else {
      root.hidden = !visible;
    }

    if (!silent) this.settings.onToggle(visible);
  }

  private toggleDrawer(): void {
    if (!this.box || this.settings.type !== 'slide') return;
    const open = this.box.classList.toggle('active');
    this.tip?.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  private onClick = (event: Event): void => {
    const node = event.target as Element | null;
    if (!node || typeof node.closest !== 'function') return;

    const shareTrigger = node.closest('[data-share]');
    if (shareTrigger) {
      this.share(shareTrigger.getAttribute('data-share') ?? '');
      return;
    }

    const action = node.closest('[data-action]');
    if (action) {
      const name = action.getAttribute('data-action');
      if (name === 'close') {
        this.hide();
        return;
      }
      if (name === 'toggle') {
        this.toggleDrawer();
        return;
      }
    }

    const copyTrigger = node.closest('[data-copy]');
    if (copyTrigger) {
      void this.copy(copyTrigger.getAttribute('data-copy') ?? 'url');
      return;
    }

    if (this.settings.closeOnMask && this.settings.type === 'pop' && node === this.box) {
      this.hide();
    }
  };

  private onKeydown = (event: Event): void => {
    const keyboard = event as KeyboardEvent;
    if (keyboard.key !== 'Escape') return;
    if (this.settings.type === 'pop' && this.visible) this.hide();
  };

  /**
   * Icons are local by default. If one still fails (for example a consumer
   * overrides `iconBase` with a wrong path), fall back to the CDN once and mark
   * the image so the error does not loop.
   */
  private onIconError = (event: Event): void => {
    const node = event.target as HTMLImageElement | null;
    if (!node || node.tagName !== 'IMG' || !node.hasAttribute('data-icon')) return;
    if (node.getAttribute('data-icon-retry') === 'cdn') {
      node.setAttribute('data-icon-failed', '');
      return;
    }
    if (isCdnIconBase(this.settings.iconBase)) {
      node.setAttribute('data-icon-failed', '');
      return;
    }
    node.setAttribute('data-icon-retry', 'cdn');
    node.src = `${ICON_CDN_BASE}${node.getAttribute('data-icon') ?? ''}`;
  };

  private fieldText(target: CopyTarget): string {
    const field = this.fields[target];
    if (field && field.value) return field.value;
    return target === 'url' ? this.settings.url : buildIframeSnippet(this.settings.url);
  }

  private syncFields(): void {
    const urlField = this.fields.url;
    if (urlField) urlField.value = this.settings.url;
    const iframeField = this.fields.iframe;
    if (iframeField) iframeField.value = buildIframeSnippet(this.settings.url);
  }

  private setStatus(text: string): void {
    const element = this.statusEl;
    if (!element) return;
    element.textContent = text;
    element.classList.toggle('is-visible', Boolean(text));
    if (this.statusTimer !== null) clearTimeout(this.statusTimer);
    this.statusTimer = setTimeout(() => {
      this.statusTimer = null;
      const target = this.statusEl;
      if (!target) return;
      target.textContent = '';
      target.classList.remove('is-visible');
    }, 2000);
  }

  private acquireScroll(): void {
    if (this.scrollLocked) return;
    lockBodyScroll(this.doc);
    this.scrollLocked = true;
  }

  private releaseScroll(): void {
    if (!this.scrollLocked) return;
    unlockBodyScroll(this.doc);
    this.scrollLocked = false;
  }

  private focusDialog(): void {
    const active = this.doc.activeElement as HTMLElement | null;
    if (active && active !== this.doc.body) this.lastTrigger = active;
    const close = this.box?.querySelector('.xqshare-close') as HTMLElement | null;
    if (close && typeof close.focus === 'function') close.focus();
  }

  private restoreFocus(): void {
    const trigger = this.lastTrigger;
    this.lastTrigger = null;
    if (trigger && typeof trigger.focus === 'function') trigger.focus();
  }

  private report(error: XqShareError): void {
    this.settings.onError(error);
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn(error.message);
    }
  }

  private emit(name: string, detail: unknown): void {
    const root = this.root;
    if (!root || typeof CustomEvent !== 'function') return;
    root.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  }
}
