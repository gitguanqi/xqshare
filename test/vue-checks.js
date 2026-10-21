import { assert, createCheckRunner, waitFor } from './checks.js';

const major = Number(document.body.dataset.vueMajor);
const runtime = globalThis.Vue;
const runner = createCheckRunner({ page: `vue-${major}` });
const appRoot = document.querySelector('#app');

const SLIDE_NOTE =
  '该模式固定在浏览器窗口右缘（中上），看本页右侧的红色“分享至”标签，点它可展开/收起。';

/**
 * Builds one captioned stage inside #app and returns its pieces, mirroring the
 * UMD / ESM pages so every consumption path demos the same three modes.
 */
function buildStage(label, { note } = {}) {
  const stage = document.createElement('div');
  stage.className = 'test-stage';

  const head = document.createElement('div');
  head.className = 'stage-head';
  const tag = document.createElement('span');
  tag.className = 'stage-label';
  tag.textContent = label;
  head.appendChild(tag);
  stage.appendChild(head);

  if (note) {
    const tip = document.createElement('p');
    tip.className = 'stage-note';
    tip.textContent = note;
    stage.appendChild(tip);
  }

  const host = document.createElement('div');
  stage.appendChild(host);
  appRoot.appendChild(stage);

  return { head, host };
}

/**
 * Mounts one XqShare component (owning exactly one core instance) into `host`.
 * `type` reaches the component as a prop; `onReady` receives the live instance.
 */
async function mountComponent(type, host, { onReady } = {}) {
  assert(runtime, 'Vue runtime is not available');
  assert(
    typeof window.createXqShareComponent === 'function',
    'the CDN component helper is missing',
  );

  let instance = null;
  const component = window.createXqShareComponent(window.XqShare, {
    options: { type, url: `https://example.com/vue-${type}`, title: 'Vue share' },
    onReady: (created) => {
      instance = created;
      if (onReady) onReady(created);
    },
  });

  const target = document.createElement('div');
  host.appendChild(target);

  if (major === 2) {
    runtime.config.productionTip = false;
    const vm = new runtime({
      render: function () {
        return this.$createElement(component, { props: { type } });
      },
    }).$mount(target);
    await runtime.nextTick();
    return {
      teardown: () => vm.$destroy(),
      getInstance: () => instance,
    };
  }

  // Vue 3 does not provide `this.$createElement`; the global build exposes `h`.
  const app = runtime.createApp({ render: () => runtime.h(component, { type }) });
  app.mount(target);
  await runtime.nextTick();
  return {
    teardown: () => app.unmount(),
    getInstance: () => instance,
  };
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
      const mounted = await mountComponent('default', appRoot);
      await waitFor(
        () => mounted.getInstance() !== null,
        'the Vue component did not create a share instance',
      );
      assert(document.querySelectorAll('.xqshare').length === 1, 'expected one widget');
      assert(document.querySelectorAll('.xqshare-item').length === 5, 'expected five targets');
      const widget = document.querySelector('.xqshare');
      assert(
        widget.querySelectorAll('[id]').length === 0,
        'the widget must not introduce any ids',
      );

      await mounted.teardown();
      await runtime.nextTick();
      assert(document.querySelectorAll('.xqshare').length === 0, 'teardown left widget markup');
    },
  ],
  [
    're-mounts cleanly after teardown (no leaked listeners)',
    async () => {
      const mounted = await mountComponent('default', appRoot);
      await waitFor(
        () => mounted.getInstance() !== null,
        'the Vue component did not re-mount',
      );
      await mounted.teardown();
      await runtime.nextTick();
      assert(document.querySelectorAll('.xqshare').length === 0, 'second teardown leaked markup');
    },
  ],
  [
    // Same completeness as the UMD / ESM pages: inline, modal and sidebar modes
    // all stay mounted so a visitor after a PASS can play with each one.
    'keeps the full demo mounted (default, pop, slide)',
    async () => {
      appRoot.textContent = '';

      await mountComponent('default', buildStage('default').host);

      const pop = buildStage('pop', {
        note: '点“打开弹窗”体验弹框模式，Esc 或遮罩可关闭。',
      });
      let popInstance = null;
      await mountComponent('pop', pop.host, { onReady: (i) => (popInstance = i) });
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'demo-trigger';
      trigger.textContent = '打开弹窗';
      trigger.addEventListener('click', () => popInstance?.show());
      pop.head.appendChild(trigger);

      const slideStage = buildStage('slide', { note: SLIDE_NOTE });
      let slideInstance = null;
      await mountComponent('slide', slideStage.host, { onReady: (i) => (slideInstance = i) });

      await waitFor(
        () => document.querySelectorAll('.xqshare').length === 3,
        'the full demo did not mount three widgets',
      );
      assert(popInstance && popInstance.visible === false, 'pop should start hidden');
      assert(slideInstance && slideInstance.visible === true, 'slide should mount visible');
      // No teardown: this is the page's live demo.
    },
  ],
]);
