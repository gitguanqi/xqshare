import component from './xqshare.vue';
import type { VueApp, XqShareVuePlugin } from '../types';

/**
 * Works with `Vue.use()` (Vue 2) and `app.use()` (Vue 3): both expose a
 * `component(name, definition)` method, so one plugin entry serves both majors.
 */
const plugin: XqShareVuePlugin = {
  install(app: VueApp): void {
    app.component('xqShare', component);
  },
};

export { component };
export default plugin;
