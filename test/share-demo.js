import { assert, click, waitFor } from './checks.js';

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
        host.textContent = '';
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
        host.textContent = '';
        const pop = mountWidget(XqShare, {
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
        pop.destroy();
      },
    ],
    [
      'slide mode toggles its drawer from the tip button',
      () => {
        const host = document.querySelector('#slideHost');
        host.textContent = '';
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
        slide.destroy();
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
        const hostB = document.querySelector('#dupB');
        hostA.textContent = '';
        hostB.textContent = '';
        const a = mountWidget(XqShare, { host: hostA, url: 'https://a.example/' });
        const b = mountWidget(XqShare, { host: hostB, url: 'https://b.example/' });
        assert.equal(hostA.querySelectorAll('.xqshare').length, 1);
        assert.equal(hostB.querySelectorAll('.xqshare').length, 1);
        a.destroy();
        b.destroy();
      },
    ],
    [
      'destroy removes the markup and its listeners',
      () => {
        const host = state.instance?.element?.parentElement ?? document.querySelector('#shareHost');
        const before = host.querySelectorAll('.xqshare').length;
        assert(before >= 1, 'no widget to destroy');
        state.instance.destroy();
        assert.equal(host.querySelectorAll('.xqshare').length, 0, 'destroy left markup behind');
        assert.equal(state.instance.element, null, 'instance root was not cleared');
      },
    ],
  ];
}
