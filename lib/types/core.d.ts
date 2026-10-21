import type { CopyResult, CopyTarget, ResolvedOptions, ShareResult, XqShareOptions } from './types';
/**
 * Maps the old internal ids onto the current copy targets, so code written
 * against `copy('#previewUrl')` keeps working.
 */
export declare function normalizeCopyTarget(target: CopyTarget | string): CopyTarget;
/**
 * The share widget.
 *
 * All state lives on the instance: the markup is rendered once per instance,
 * every lookup is scoped to `this.root`, and every listener is owned by
 * `this.bag`. That is what makes several instances on one page safe.
 */
export declare class XqShare {
    static readonly version: string;
    private raw;
    private settings;
    private readonly doc;
    private root;
    private box;
    private tip;
    private statusEl;
    private fields;
    private readonly bag;
    private statusTimer;
    private popHiddenTimer;
    private scrollLocked;
    private lastTrigger;
    private disposed;
    constructor(options: XqShareOptions);
    get element(): HTMLElement | null;
    get mode(): 'default' | 'pop' | 'slide';
    get options(): Readonly<ResolvedOptions>;
    get visible(): boolean;
    show(): this;
    hide(): this;
    toggle(): this;
    /**
     * Opens a destination. `wechat` has no web endpoint, so it copies the link and
     * reports through `onCopy` instead of opening a blank tab.
     */
    share(type: string, url?: string, title?: string, desc?: string): ShareResult;
    copy(target?: CopyTarget | string): Promise<CopyResult>;
    setUrl(url: string, title?: string): this;
    /** Re-resolves the options and rebuilds the markup on the same instance. */
    update(patch: Partial<XqShareOptions>): this;
    destroy(): void;
    private attach;
    private teardown;
    private applyVisibility;
    /**
     * Reveals the pop modal.
     *
     * The closed state is guarded by *inline* styles (see `closePop`) so the panel
     * can never flash visible before `xqshare.css` is applied. Those inline guards
     * are dropped here so the stylesheet's `.pop` / `.pop.active` rules take over;
     * because `display` stays `flex`, the browser has already painted the hidden
     * frame, so the fade + lift transitions animate from a real "from" state.
     */
    private openPop;
    /**
     * Hides the pop modal.
     *
     * The hard hidden state is enforced with inline styles rather than the
     * stylesheet so an unstyled modal (CSS not yet parsed) can never paint for a
     * frame on initial load — that "flash then hide" was the reported regression.
     * On the very first paint (`immediate`) the guards go on right away; on a
     * user-driven close they are re-applied only after the transition finishes so
     * the fade-out still plays.
     */
    private closePop;
    private toggleDrawer;
    private onClick;
    private onKeydown;
    /**
     * Icons are local by default. If one still fails (for example a consumer
     * overrides `iconBase` with a wrong path), fall back to the CDN once and mark
     * the image so the error does not loop.
     */
    private onIconError;
    private fieldText;
    private syncFields;
    private setStatus;
    private acquireScroll;
    private releaseScroll;
    private focusDialog;
    private restoreFocus;
    private report;
    private emit;
}
