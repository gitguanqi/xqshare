import type { XqShareError } from './errors';
/** Layout of the widget: inline bar, centred dialog, or edge tab. */
export type ShareMode = 'default' | 'pop' | 'slide';
/** Built-in share destinations. `wechat` has no web endpoint, it copies the link. */
export type ShareTargetName = 'qq' | 'qzone' | 'weibo' | 'douban' | 'tieba' | 'wechat';
/** Which field the copy button writes to the clipboard. */
export type CopyTarget = 'url' | 'iframe';
/** How the last clipboard write succeeded. */
export type CopyMethod = 'clipboard' | 'execCommand' | 'failed';
export interface CopyResult {
    ok: boolean;
    method: CopyMethod;
    target: CopyTarget;
    text: string;
}
export interface SharePayload {
    type: string;
    url: string;
    title: string;
    desc: string;
}
export interface ShareResult extends SharePayload {
    /** True when a share window was opened. `wechat` never opens one. */
    opened: boolean;
    /** Set when the destination is `wechat`: the clipboard result for the copied link. */
    copy: CopyResult | null;
}
export interface XqShareOptions {
    /** Host element or a selector for it. Required. */
    el: string | Element;
    /** Widget layout. Defaults to `default`. */
    type?: ShareMode;
    /** Page address being shared. Defaults to `location.href`. */
    url?: string;
    /** Share title. Defaults to `document.title`. */
    title?: string;
    /** Share description. Defaults to `meta[name="description"]`, else empty. */
    desc?: string;
    /** Subset and order of the built-in destinations. Defaults to all of them. */
    targets?: readonly ShareTargetName[];
    /** Directory holding `share_*.png`. Defaults to the package's own `lib/img/`. */
    iconBase?: string;
    /**
     * Initial visibility. `pop` starts hidden, `default` and `slide` start visible.
     */
    visible?: boolean;
    /** Close the `pop` overlay when the mask is clicked. Defaults to true. */
    closeOnMask?: boolean;
    /** Called after a destination was triggered. */
    onShare?: (result: ShareResult) => void;
    /** Called after a clipboard write finished. */
    onCopy?: (result: CopyResult) => void;
    /** Called whenever the widget opens or closes. */
    onToggle?: (visible: boolean) => void;
    /** Called for recoverable problems such as a blocked popup. */
    onError?: (error: XqShareError) => void;
}
/** Options after defaults are applied. Everything except `el` is present. */
export interface ResolvedOptions {
    el: string | Element;
    type: ShareMode;
    url: string;
    title: string;
    desc: string;
    targets: readonly ShareTargetName[];
    iconBase: string;
    visible: boolean;
    closeOnMask: boolean;
    onShare: (result: ShareResult) => void;
    onCopy: (result: CopyResult) => void;
    onToggle: (visible: boolean) => void;
    onError: (error: XqShareError) => void;
}
export type XqShareErrorCode = 'bad-el' | 'host-missing' | 'bad-mode' | 'bad-target' | 'popup-blocked';
/** Minimal structural view of a Vue 2 / Vue 3 app, so the package keeps no Vue import. */
export interface VueApp {
    component(name: string, definition: unknown): unknown;
}
export interface XqShareVuePlugin {
    install(app: VueApp): void;
}
