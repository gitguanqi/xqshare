import component from './xqshare.vue';
import type { XqShareVuePlugin } from '../types';
/**
 * Works with `Vue.use()` (Vue 2) and `app.use()` (Vue 3): both expose a
 * `component(name, definition)` method, so one plugin entry serves both majors.
 */
declare const plugin: XqShareVuePlugin;
export { component };
export default plugin;
