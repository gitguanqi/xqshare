import type { ResolvedOptions, XqShareOptions } from './types';
/**
 * Applies defaults field by field.
 *
 * The previous constructor used a default *parameter* object, which only applied
 * when the argument was `undefined` — so `new XqShare({ el: '#a' })` threw. Here
 * every field falls back independently.
 */
export declare function resolveOptions(input: XqShareOptions, doc?: Document): ResolvedOptions;
