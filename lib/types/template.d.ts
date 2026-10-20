import type { ResolvedOptions } from './types';
/** Escapes text that is interpolated into markup or into an attribute value. */
export declare function escapeHtml(value: string): string;
/**
 * The snippet a consumer embeds elsewhere. It is copied as text, so it only has
 * to survive being escaped once into the `value` attribute.
 */
export declare function buildIframeSnippet(url: string): string;
/**
 * Renders the widget markup.
 *
 * Two rules are load-bearing:
 * - no `id` attributes, because a page may host several instances;
 * - every hook is a `data-*` attribute resolved with `closest()` from the click
 *   target, so the markup is never queried globally.
 */
export declare function renderMarkup(options: ResolvedOptions): string;
