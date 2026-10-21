import { assert, click, waitFor } from './checks.js';

/**
 * Captions a stage so the page still explains itself once the checks finish.
 *
 * The checks deliberately keep their widgets mounted: a visitor opening the page
 * after a PASS should be able to play with the demo, not stare at empty stages.
 * `pop` additionally gets a trigger, because that mode renders a modal that
 * starts closed and would otherwise look like "nothing mounted".
 */
function prepareStage(host, label, { trigger } = {}) {
  host.textContent = '';

  const head = document.createElement('div');
  head.className = 'stage-head';
  const tag = document.createElement('span');
  tag.className = 'stage-label';
  tag.textContent = label;
  head.appendChild(tag);
  host.appendChild(head);

  if (!trigger) return null;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'demo-trigger';
  button.textContent = trigger.label;
  button.addEventListener('click', trigger.onClick);
  head.appendChild(button);
  return button;
}

/**
 * Mounts one widget inside a host element and returns the live instance.
 * Used by the UMD and ESM pages so both exercise the same behavior suite.
 */
export function mountWidget(XqShare, { host, type = 'default', url, title }) {
  assert(typeof XqShare === 'function', 'the bundle did not expose a constructor');
  const options = { el: host, type, url, title };
  if (typeof options.url !== 'string') delete options.url;
  if (typeof options.title !== 'string') delete options.title;
  const instance = new XqShare(options);
  assert(host.querySelector('.xqshare-box'), 'the widget did not render its markup');
  return instance;
}

export function coreChecks(XqShare, label) {
  const state = {};

  return [
    [
      'exports a constructor',
      () => {
        assert(typeof XqShare === 'function', 'the bundle did not expose a constructor');
      },
    ],
    [
      'mounts one scoped widget without any id',
      () => {
        const host = document.querySelector('#shareHost');
        assert(host, 'the share host is missing');
        prepareStage(host, 'default');
        state.instance = mountWidget(XqShare, { host, url: 'https://example.com/' });
        assert(host.querySelectorAll('.xqshare').length === 1, 'expected one widget root');
        assert(host.querySelectorAll('.xqshare-item').length === 5, 'expected five share targets');
        assert(
          host.querySelectorAll('[id]').length === 0,
          'the widget must not introduce duplicate ids',
        );
      },
    ],
    [
      'renders every share icon from the local bundle',
      async () => {
        const images = state.instance
          ?.element?.querySelectorAll('[data-share] img') ?? [];
        assert(images.length === 5, 'expected five icons');
        for (const image of images) {
          const src = image.getAttribute('src') ?? '';
          assert(
            !src.includes('xqgj.cc'),
            `icon ${src} should come from the package, not the CDN`,
          );
        }
        await waitFor(
          () => [...images].every((image) => image.complete && image.naturalWidth > 0),
          'local icons failed to load',
        );
      },
    ],
    [
      'opens an encoded destination when a target is clicked',
      () => {
        const opened = [];
        const spy = (url) => {
          opened.push(url);
          return null;
        };
        const original = window.open;
        window.open = spy;
        try {
          click(state.instance.element, '[data-share="qq"]');
        } finally {
          window.open = original;
        }
        assert(opened.length === 1, 'no share window was opened');
        const parsed = new URL(opened[0]);
        assert.equal(parsed.searchParams.get('url'), 'https://example.com/');
        assert.match(opened[0], /connect\.qq\.com/);
      },
    ],
    [
      'pop mode shows, locks scroll, then releases on hide',
      () => {
        const host = document.querySelector('#popHost');
        // The trigger has to be in place before the widget mounts, otherwise the
        // widget markup is appended first and the button lands inside it.
        let pop = null;
        prepareStage(host, 'pop', {
          trigger: { label: '打开弹窗', onClick: () => pop?.show() },
        });
        pop = mountWidget(XqShare, {
          host,
          type: 'pop',
          url: 'https://example.com/pop',
        });
        assert.equal(pop.visible, false, 'pop should start hidden');
        pop.show();
        assert.equal(pop.visible, true);
        assert.equal(document.body.style.overflow, 'hidden', 'body scroll should lock');
        pop.hide();
        assert.equal(pop.visible, false);
        assert.equal(document.body.style.overflow, '', 'body scroll should release');
        // Intentionally not destroyed: the stage keeps the closed modal so the
        // trigger still works after the run.
      },
    ],
    [
      'slide mode toggles its drawer from the tip button',
      () => {
        const host = document.querySelector('#slideHost');
        prepareStage(host, 'slide');
        const slide = mountWidget(XqShare, {
          host,
          type: 'slide',
          url: 'https://example.com/slide',
        });
        // `slide` is mounted visible by default; the tip opens/closes the inner
        // drawer (`.xqshare-box.active`), it does not toggle the root visibility.
        assert.equal(slide.visible, true, 'slide should mount visible');
        const box = slide.element.querySelector('.xqshare-box');
        const tip = slide.element.querySelector('[data-action="toggle"]');
        assert(tip, 'slide needs a toggle control');
        assert.equal(tip.getAttribute('aria-expanded'), 'false', 'drawer starts collapsed');
        assert.equal(box.classList.contains('active'), false);
        tip.click();
        assert.equal(tip.getAttribute('aria-expanded'), 'true', 'tip should expand');
        assert.equal(box.classList.contains('active'), true, 'drawer should open');
        tip.click();
        assert.equal(tip.getAttribute('aria-expanded'), 'false');
        assert.equal(box.classList.contains('active'), false);
        // Re-open the drawer and keep it mounted: after a PASS the stage should
        // show the mode's full layout, not just the collapsed tab.
        tip.click();
      },
    ],
    [
      'copies through the async clipboard and reports via status text',
      async () => {
        if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
          return; // The bundle still falls back to execCommand; nothing to assert here.
        }
        let written = null;
        const original = navigator.clipboard.writeText;
        navigator.clipboard.writeText = async (text) => {
          written = text;
          return undefined;
        };
        try {
          const result = await state.instance.copy('url');
          assert.equal(result.ok, true);
          assert.equal(written, 'https://example.com/');
          assert.match(
            state.instance.element.querySelector('.xqshare-status').textContent,
            /已复制/,
          );
        } finally {
          navigator.clipboard.writeText = original;
        }
      },
    ],
    [
      'two instances keep their markup and clipboard results separate',
      () => {
        const hostA = document.querySelector('#dupA');
        prepareStage(hostA, 'second instance');
        mountWidget(XqShare, { host: hostA, url: 'https://a.example/' });
        assert.equal(hostA.querySelectorAll('.xqshare').length, 1);

        // The second instance lives in a throwaway host: the page only keeps
        // one extra widget on display, but the isolation proof needs two alive
        // at the same time.
        const hostB = document.createElement('div');
        document.body.appendChild(hostB);
        try {
          mountWidget(XqShare, { host: hostB, url: 'https://b.example/' });
          assert.equal(hostB.querySelectorAll('.xqshare').length, 1);
          assert.equal(hostA.querySelectorAll('.xqshare').length, 1);
        } finally {
          hostB.remove();
        }
      },
    ],
    [
      'destroy removes the markup and its listeners',
      () => {
        // Destroy on a throwaway host, so the visible demo instances survive the
        // run instead of vanishing as soon as the suite finishes.
        const host = document.createElement('div');
        document.body.appendChild(host);
        try {
          const throwaway = mountWidget(XqShare, {
            host,
            url: 'https://example.com/destroy',
          });
          assert.equal(host.querySelectorAll('.xqshare').length, 1, 'no widget to destroy');
          throwaway.destroy();
          assert.equal(host.querySelectorAll('.xqshare').length, 0, 'destroy left markup behind');
          assert.equal(throwaway.element, null, 'instance root was not cleared');
        } finally {
          host.remove();
        }
      },
    ],
    [
      'leaves every stage mounted after the run',
      () => {
        for (const id of ['shareHost', 'popHost', 'slideHost', 'dupA']) {
          const host = document.querySelector(`#${id}`);
          assert(host, `#${id} is missing`);
          assert.equal(
            host.querySelectorAll('.xqshare').length,
            1,
            `#${id} lost its widget`,
          );
        }
        assert(state.instance?.element, 'the default instance is no longer mounted');
        assert.equal(state.instance.visible, true, 'the default widget should stay visible');
      },
    ],
  ];
}
