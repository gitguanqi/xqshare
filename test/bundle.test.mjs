import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { createEnvironment, createSandbox } from '../test-support/dom-env.mjs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

const PAGE = '<html><body><div id="host"></div><div id="second"></div></body></html>';

/**
 * Loads the *committed* UMD bundle in a stub DOM. Parsing the bundle proves
 * nothing; executing it is what catches a broken constructor or a listener that
 * throws on click.
 */
function load(file = 'lib/js/xqshare.min.js', options = {}) {
  const env = createEnvironment({ html: PAGE, ...options });
  const context = vm.createContext(createSandbox(env));
  vm.runInContext(read(file), context, { filename: file });
  assert.equal(typeof context.XqShare, 'function', `${file} must expose the global XqShare`);
  return { env, XqShare: context.XqShare };
}

function mount(options = {}, file) {
  const loaded = load(file, options.env);
  const widget = new loaded.XqShare({ el: '#host', ...options.props });
  const host = loaded.env.document.querySelector('#host');
  return { ...loaded, widget, host };
}

test('the UMD bundle constructs and injects markup without any id attribute', () => {
  const { widget, host } = mount();
  assert.equal(host.querySelectorAll('.xqshare-box').length, 1);
  assert.equal(host.querySelectorAll('.xqshare-item').length, 5);
  assert.equal(host.querySelectorAll('[id]').length, 0, 'ids would collide across instances');
  assert.ok(host.querySelector('.xqshare-box').classList.contains('default'));
  widget.destroy();
});

test('options are defaulted field by field, not only when the argument is absent', () => {
  const { widget, host } = mount({ props: { title: 'Hello' } });
  assert.equal(widget.options.type, 'default');
  assert.equal(widget.options.url, 'https://example.com/page?a=1&b=2');
  assert.equal(widget.options.title, 'Hello');
  assert.equal(host.querySelector('.xqshare').hidden, false);
  widget.destroy();
});

test('a selector that matches nothing fails loudly instead of silently appending to <html>', () => {
  const { XqShare, env } = load();
  assert.throws(
    () => new XqShare({ el: '#missing' }),
    (error) => error.code === 'host-missing' && /#missing/.test(error.message),
  );
  assert.equal(env.document.documentElement.querySelectorAll('.xqshare').length, 0);
});

test('an unknown mode and an unknown target of targets are rejected with codes', () => {
  const { XqShare } = load();
  assert.throws(() => new XqShare({ el: '#host', type: 'modal' }), (error) => error.code === 'bad-mode');
  assert.throws(
    () => new XqShare({ el: '#host', targets: ['qq', 'myspace'] }),
    (error) => error.code === 'bad-target',
  );
});

test('clicking a share item opens the destination with encoded parameters', () => {
  const { widget, host, env } = mount();
  host.querySelector('[data-share="qq"]').click();

  assert.equal(env.opened.length, 1);
  const opened = new URL(env.opened[0]);
  assert.equal(opened.searchParams.get('url'), 'https://example.com/page?a=1&b=2');
  assert.match(env.opened[0], /^https:\/\/connect\.qq\.com\//);
  widget.destroy();
});

test('clicking the icon inside a share item still resolves the destination', () => {
  const { widget, host, env } = mount();
  host.querySelector('[data-share="weibo"] img').click();

  assert.equal(env.opened.length, 1);
  assert.match(env.opened[0], /service\.weibo\.com/);
  widget.destroy();
});

test('an unknown destination reports an error and opens nothing', () => {
  const errors = [];
  const { widget, env } = mount({ props: { onError: (error) => errors.push(error) } });

  const result = widget.share('nope');
  assert.equal(result.opened, false);
  assert.equal(result.copy, null);
  assert.equal(env.opened.length, 0);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, 'bad-target');
  widget.destroy();
});

test('wechat copies the link instead of opening a blank tab', async () => {
  const copies = [];
  const { widget, env } = mount({ props: { onCopy: (result) => copies.push(result) } });

  const result = widget.share('wechat');
  assert.equal(result.opened, false);
  assert.equal(env.opened.length, 0, 'the old build opened about:blank for wechat');

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(copies.length, 1);
  assert.equal(copies[0].text, 'https://example.com/page?a=1&b=2');
  assert.equal(copies[0].ok, true);
  widget.destroy();
});

test('pop mode starts hidden, opens on show(), and locks body scroll while open', () => {
  const { widget, host, env } = mount({ props: { type: 'pop' } });
  const box = host.querySelector('.xqshare-box');

  assert.equal(widget.visible, false);
  assert.equal(box.classList.contains('active'), false);

  widget.show();
  assert.equal(widget.visible, true);
  assert.equal(box.classList.contains('active'), true);
  assert.equal(env.document.body.style.overflow, 'hidden');

  widget.hide();
  assert.equal(widget.visible, false);
  assert.equal(env.document.body.style.overflow, '');
  widget.destroy();
});

test('pop mode closes from the close button, the mask and Escape', () => {
  const { widget, host, env } = mount({ props: { type: 'pop' } });
  const box = host.querySelector('.xqshare-box');

  widget.show();
  host.querySelector('[data-action="close"]').click();
  assert.equal(widget.visible, false);

  widget.show();
  box.click();
  assert.equal(widget.visible, false, 'clicking the mask closes the dialog');

  widget.show();
  env.document.dispatchEvent({ type: 'keydown', key: 'Escape' });
  assert.equal(widget.visible, false);

  // Clicks inside the panel must not close it.
  widget.show();
  host.querySelector('.xqshare-inner').click();
  assert.equal(widget.visible, true);
  widget.destroy();
});

test('pop mode can opt out of closing on mask click', () => {
  const { widget, host } = mount({ props: { type: 'pop', closeOnMask: false } });
  widget.show();
  host.querySelector('.xqshare-box').click();
  assert.equal(widget.visible, true);
  widget.destroy();
});

test('slide mode toggles its drawer and keeps aria-expanded in sync', () => {
  const { widget, host } = mount({ props: { type: 'slide' } });
  const box = host.querySelector('.xqshare-box');
  const tip = host.querySelector('[data-action="toggle"]');

  assert.equal(box.classList.contains('active'), false);
  tip.click();
  assert.equal(box.classList.contains('active'), true);
  assert.equal(tip.getAttribute('aria-expanded'), 'true');

  tip.click();
  assert.equal(box.classList.contains('active'), false);
  assert.equal(tip.getAttribute('aria-expanded'), 'false');
  widget.destroy();
});

test('the inline bar has no dead toggle button', () => {
  const { widget, host } = mount({ props: { type: 'default' } });
  assert.equal(host.querySelectorAll('[data-action="toggle"]').length, 0);
  assert.ok(host.querySelector('.xqshare-tip'));
  widget.destroy();
});

test('copy prefers the async clipboard and reports through a status line, not alert()', async () => {
  const { widget, host, env } = mount({ props: { type: 'pop' } });
  const result = await widget.copy('url');

  assert.equal(result.method, 'clipboard');
  assert.equal(result.ok, true);
  assert.equal(env.navigator.clipboard.text, 'https://example.com/page?a=1&b=2');
  assert.equal(host.querySelector('.xqshare-status').textContent, '已复制');
  widget.destroy();
});

test('copy falls back to the legacy path when the clipboard API is unavailable', async () => {
  const { widget, env } = mount({ props: { type: 'pop' }, env: { clipboard: null } });
  const result = await widget.copy('url');

  assert.equal(result.method, 'execCommand');
  assert.equal(result.ok, true);
  assert.equal(env.document.clipboardText, 'https://example.com/page?a=1&b=2');
  widget.destroy();
});

test('copy reports failure instead of pretending it worked', async () => {
  const { widget, env } = mount({ props: { type: 'pop' }, env: { clipboard: null } });
  env.document.execCommandResult = false;
  const result = await widget.copy('iframe');

  assert.equal(result.ok, false);
  assert.equal(result.method, 'failed');
  widget.destroy();
});

test('copy keeps accepting the ids the old markup used', async () => {
  const { widget, env } = mount({ props: { type: 'pop' } });

  const url = await widget.copy('#previewUrl');
  assert.equal(url.target, 'url');
  assert.equal(env.navigator.clipboard.text, 'https://example.com/page?a=1&b=2');

  const iframe = await widget.copy('#iframeUrl');
  assert.equal(iframe.target, 'iframe');
  assert.match(env.navigator.clipboard.text, /^<iframe src="https:\/\/example\.com/);
  widget.destroy();
});

test('two instances on one page never share nodes, urls or clipboard results', async () => {
  const { XqShare, env } = load();
  const first = new XqShare({ el: '#host', type: 'pop', url: 'https://one.example/a' });
  const second = new XqShare({ el: '#second', type: 'pop', url: 'https://two.example/b' });

  const firstHost = env.document.querySelector('#host');
  const secondHost = env.document.querySelector('#second');
  assert.equal(firstHost.querySelectorAll('.xqshare-box').length, 1);
  assert.equal(secondHost.querySelectorAll('.xqshare-box').length, 1);

  await second.copy('url');
  assert.equal(env.navigator.clipboard.text, 'https://two.example/b');
  await first.copy('url');
  assert.equal(env.navigator.clipboard.text, 'https://one.example/a');

  first.hide();
  assert.equal(first.visible, false);
  assert.equal(second.visible, false);

  first.show();
  assert.equal(first.visible, true);
  assert.equal(second.visible, false, 'show() must not open the other instance');

  first.destroy();
  second.destroy();
});

test('update() rebuilds in place without duplicating markup or listeners', async () => {
  const { widget, host, env } = mount({ props: { type: 'pop' } });

  widget.update({ url: 'https://next.example/x' });
  widget.update({ title: 'next' });

  assert.equal(host.querySelectorAll('.xqshare-box').length, 1);
  assert.equal(env.document.listenerCount('keydown'), 1, 'listeners are re-owned, not stacked');
  assert.equal(widget.options.url, 'https://next.example/x');
  assert.equal(host.querySelector('[data-field="url"]').value, 'https://next.example/x');

  await widget.copy('url');
  assert.equal(env.navigator.clipboard.text, 'https://next.example/x');
  widget.destroy();
});

test('setUrl refreshes the fields that the dialog shows', () => {
  const { widget, host } = mount({ props: { type: 'pop' } });
  widget.setUrl('https://moved.example/y', 'moved');

  assert.equal(host.querySelector('[data-field="url"]').value, 'https://moved.example/y');
  assert.match(host.querySelector('[data-field="iframe"]').value, /moved\.example/);
  assert.equal(widget.options.title, 'moved');
  widget.destroy();
});

test('destroy() removes the markup, the document listener and the scroll lock', () => {
  const { widget, host, env } = mount({ props: { type: 'pop' } });
  widget.show();
  assert.equal(env.document.listenerCount('keydown'), 1);
  assert.equal(env.document.body.style.overflow, 'hidden');

  widget.destroy();
  assert.equal(host.querySelectorAll('.xqshare').length, 0);
  assert.equal(env.document.listenerCount('keydown'), 0);
  assert.equal(env.document.body.style.overflow, '');
  assert.equal(widget.element, null);

  widget.destroy(); // idempotent
});

test('a local icon that fails falls back to the CDN exactly once', () => {
  const { widget, host } = mount({ props: { iconBase: '/broken/' } });
  const image = host.querySelector('[data-share="qq"] img');
  assert.match(image.getAttribute('src'), /^\/broken\/share_qq\.png$/);

  image.dispatchEvent({ type: 'error', bubbles: false });
  assert.match(image.getAttribute('src'), /^https:\/\/xqgj\.cc\/xqcdn\/libs\/xqshare\/img\/share_qq\.png$/);
  assert.equal(image.getAttribute('data-icon-retry'), 'cdn');

  image.dispatchEvent({ type: 'error', bubbles: false });
  assert.equal(image.getAttribute('data-icon-failed'), '', 'a second failure is marked, not retried');
  widget.destroy();
});

test('the readable UMD build behaves like the minified one', () => {
  const { widget, host } = mount({}, 'lib/js/xqshare.js');
  assert.equal(host.querySelectorAll('.xqshare-item').length, 5);
  assert.equal(host.querySelectorAll('[id]').length, 0);
  widget.destroy();
});

test('the UMD bundles contain no import.meta and still export the global', () => {
  for (const file of ['lib/js/xqshare.js', 'lib/js/xqshare.min.js']) {
    const source = read(file);
    assert.equal(source.includes('import.meta'), false, `${file} must parse as a classic script`);
    assert.match(source, /root\.XqShare = factory\(\)/, `${file} keeps the documented global`);
  }
});

test('the ESM bundle exposes one constructor as both default and named export', async () => {
  const env = createEnvironment({ html: PAGE });
  globalThis.document = env.document;
  globalThis.window = env.window;
  try {
    const module = await import('../lib/js/xqshare-esm.mjs');
    assert.equal(module.default, module.XqShare);
    assert.equal(typeof module.buildShareUrl, 'function');

    const widget = new module.default({ el: '#host', type: 'default' });
    assert.equal(env.document.querySelectorAll('.xqshare-item').length, 5);
    widget.destroy();
  } finally {
    delete globalThis.document;
    delete globalThis.window;
  }
});
