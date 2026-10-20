import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const at = (...parts) => join(root, ...parts);
const read = (file) => readFile(at(file), 'utf8');

const pages = ['browser.html', 'esm.html', 'vue2.html', 'vue3.html'];

test('the test index links every public consumption path', async () => {
  const html = await read('test/index.html');

  for (const page of pages) {
    assert.match(html, new RegExp(`href="\\./${page.replace('.', '\\.')}"`));
  }
  assert.match(html, /UMD/);
  assert.match(html, /ESM/);
  assert.match(html, /Vue 2/);
  assert.match(html, /Vue 3/);
});

test('every test page uses the shared shell and visible check list', async () => {
  for (const page of pages) {
    const html = await read(`test/${page}`);
    assert.match(html, /<link rel="icon" href="\.\/icon\.svg" type="image\/svg\+xml">/, page);
    assert.match(html, /href="\.\/demo\.css"/, page);
    assert.match(html, /aria-live="polite"/, page);
    assert.match(html, /id="checks"/, page);
    assert.match(html, /id="summary"/, page);
  }
});

test('the UMD page loads the committed browser bundle', async () => {
  const html = await read('test/browser.html');

  assert.match(html, /<script src="\.\.\/lib\/js\/xqshare\.min\.js"><\/script>/);
  assert.match(html, /from '\.\/share-demo\.js'/);
  assert.doesNotMatch(html, /xqshare-esm\.min\.js/);
});

test('the ESM page imports both exports from the committed module bundle', async () => {
  const html = await read('test/esm.html');

  assert.match(html, /<script type="module">/);
  assert.match(
    html,
    /import xqshare, \{ XqShare as NamedXqShare \} from '\.\.\/lib\/js\/xqshare-esm\.min\.js';/,
  );
  assert.doesNotMatch(html, /<script src="\.\.\/lib\/js\/xqshare\.min\.js"><\/script>/);
});

test('the Vue pages use pinned local runtimes and the shared component helper', async () => {
  const vue2 = await read('test/vue2.html');
  const vue3 = await read('test/vue3.html');

  assert.match(vue2, /src="\.\/vendor\/vue-2\.7\.16\.min\.js"/);
  assert.match(vue3, /src="\.\/vendor\/vue-3\.5\.13\.global\.prod\.js"/);
  assert.match(vue2, /data-vue-major="2"/);
  assert.match(vue3, /data-vue-major="3"/);
  assert.match(vue2, /src="\.\/vue-xqshare\.component\.js"/);
  assert.match(vue3, /src="\.\/vue-xqshare\.component\.js"/);
  assert.match(vue2, /import '\.\/vue-checks\.js'/);
  assert.match(vue3, /import '\.\/vue-checks\.js'/);
});

test('shared browser checks expose machine-readable results', async () => {
  const [runner, demo, vue] = await Promise.all([
    read('test/checks.js'),
    read('test/share-demo.js'),
    read('test/vue-checks.js'),
  ]);

  assert.match(runner, /window\.__XQSHARE_TEST__/);
  assert.match(runner, /is-pass/);
  assert.match(runner, /is-fail/);
  assert.match(demo, /coreChecks/);
  assert.match(vue, /mountVue/);
});

test('third-party test runtimes are pinned locally with license notices', async () => {
  const [vue2, vue3, license2, license3] = await Promise.all([
    read('test/vendor/vue-2.7.16.min.js'),
    read('test/vendor/vue-3.5.13.global.prod.js'),
    read('test/vendor/LICENSE-VUE-2.7.16'),
    read('test/vendor/LICENSE-VUE-3.5.13'),
  ]);

  assert.match(vue2, /Vue\.js v2\.7\.16/);
  assert.match(vue3, /vue v3\.5\.13/);
  assert.match(license2, /MIT License/);
  assert.match(license3, /MIT License/);
  await Promise.all([
    access(at('test/vendor/vue-2.7.16.min.js')),
    access(at('test/vendor/vue-3.5.13.global.prod.js')),
  ]);
});
