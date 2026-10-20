import { assert, createCheckRunner, waitFor } from './checks.js';

const major = Number(document.body.dataset.vueMajor);
const runtime = globalThis.Vue;
const runner = createCheckRunner({ page: `vue-${major}` });

async function mountVue() {
  assert(runtime, 'Vue runtime is not available');
  assert(typeof window.createXqShareComponent === 'function', 'the CDN component helper is missing');

  let instance = null;
  const component = window.createXqShareComponent(window.XqShare, {
    options: { type: 'default', url: 'https://example.com/vue', title: 'Vue share' },
    onReady: (created) => {
      instance = created;
    },
  });

  const target = document.createElement('div');
  document.querySelector('#app').append(target);

  const context = { vm: null, app: null, instance: null, target };
  if (major === 2) {
    runtime.config.productionTip = false;
    context.vm = new runtime({ render: function () { return this.$createElement(component); } }).$mount(target);
  } else {
    // Vue 3 does not provide `this.$createElement`; the global build exposes `h`.
    context.app = runtime.createApp({ render: () => runtime.h(component) });
    context.vm = context.app.mount(target);
  }

  await runtime.nextTick();
  await waitFor(
    () => instance !== null,
    'the Vue component did not create a share instance',
  );
  context.instance = instance;
  context.box = document.querySelector('.xqshare');
  return context;
}

async function teardown(context) {
  if (major === 2) {
    context.vm.$destroy();
  } else {
    context.app.unmount();
  }
  await runtime.nextTick();
}

await runner.run([
  [
    'loads the expected Vue major',
    () => {
      assert(runtime, 'Vue runtime is not available');
      assert(
        String(runtime.version).startsWith(`${major}.`),
        `expected Vue ${major}, received ${runtime.version}`,
      );
    },
  ],
  [
    'mounts one widget and tears it down through the active Vue hook',
    async () => {
      const context = await mountVue();
      assert(document.querySelectorAll('.xqshare').length === 1, 'expected one widget');
      assert(document.querySelectorAll('.xqshare-item').length === 5, 'expected five targets');
      const widget = document.querySelector('.xqshare');
      assert(
        widget.querySelectorAll('[id]').length === 0,
        'the widget must not introduce any ids',
      );
      assert(context.instance instanceof window.XqShare, 'the core instance was not created');

      await teardown(context);
      assert(document.querySelectorAll('.xqshare').length === 0, 'teardown left widget markup');
    },
  ],
  [
    're-mounts cleanly after teardown (no leaked listeners)',
    async () => {
      const context = await mountVue();
      assert(document.querySelectorAll('.xqshare').length === 1, 'expected one widget');
      await teardown(context);
      assert(document.querySelectorAll('.xqshare').length === 0, 'second teardown leaked markup');
    },
  ],
]);
