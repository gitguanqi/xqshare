/**
 * Resolves the host once per instance. A selector that matches nothing used to
 * fall back to `document.documentElement`, which silently produced a widget whose
 * listeners could never fire; now it throws with a stable code.
 */
export declare function resolveHost(el: string | Element, doc: Document): HTMLElement;
/** Every listener an instance owns, so `destroy()` can remove all of them. */
export declare class ListenerBag {
    private entries;
    add(target: EventTarget, type: string, handler: EventListener, options?: boolean | AddEventListenerOptions): void;
    clear(): void;
    get size(): number;
}
export declare function lockBodyScroll(doc: Document): void;
export declare function unlockBodyScroll(doc: Document): void;
