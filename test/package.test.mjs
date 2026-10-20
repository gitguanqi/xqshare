import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createEnvironment } from '../test-support/dom-env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const at = (...parts) => join(root, ...parts);
const require = createRequire(import.meta.url);
const pkg = JSON.parse(await readFile(at('package.json'), 'utf8'));

async function loadEsm(file) {
  return import(pathToFileURL(at(file)).href);
}

test('publishes every documented runtime and type entry', async () => {
  assert.equal(pkg.main, 'lib/js/xqshare.js');
  assert.equal(pkg.module, 'lib/js/xqshare-esm.mjs');
  assert.equal(pkg.types, 'lib/types/index.d.ts');
  assert.equal(pkg.exports['.'].types, './lib/types/index.d.ts');
  assert.equal(pkg.exports['.'].import, './lib/js/xqshare-esm.mjs');
  assert.equal(pkg.exports['.'].require, './lib/js/xqshare.js');
  assert.equal(pkg.exports['./vue'].types, './lib/types/vue/index.d.ts');
  assert.equal(pkg.exports['./vue'].import, './lib/vue/index.js');
  assert.equal(pkg.exports['./lib/vue/index.vue'], './lib/vue/xqshare.vue');
  assert.equal(pkg.exports['./lib/*'], './lib/*');

  const files = [
    pkg.main,
    pkg.module,
    pkg.unpkg,
    'lib/js/xqshare.min.js',
    'lib/js/xqshare-esm.js',
    'lib/js/xqshare-esm.min.js',
    'lib/js/xqshare-esm.min.mjs',
    'lib/css/xqshare.css',
    'lib/css/xqshare.min.css',
    'lib/vue/index.js',
    'lib/vue/xqshare.vue',
    'lib/types/index.d.ts',
    'lib/types/vue/index.d.ts',
    'lib/types/vue/xqshare.vue.d.ts',
    'lib/img/share_qq.png',
    'lib/img/share_qzone.png',
    'lib/img/share_weibo.png',
    'lib/img/share_douban.png',
    'lib/img/share_tieba.png',
    'lib/img/share_wechat.png',
  ];
  await Promise.all(files.map((file) => access(at(file))));
});

test('the CommonJS entry exposes the constructor on both UMD builds', () => {
  const readable = require(at('lib/js/xqshare.js'));
  const minified = require(at('lib/js/xqshare.min.js'));

  assert.equal(typeof readable, 'function');
  assert.equal(readable.name, 'XqShare');
  assert.equal(typeof readable.prototype.share, 'function');
  assert.equal(typeof readable.prototype.copy, 'function');
  assert.equal(typeof readable.prototype.destroy, 'function');

  assert.equal(typeof minified, 'function');
  assert.equal(typeof minified.prototype.share, 'function');
  assert.equal(typeof minified.prototype.copy, 'function');
});

test('the ESM default and named exports are the same constructor', async () => {
  for (const file of ['lib/js/xqshare-esm.mjs', 'lib/js/xqshare-esm.min.mjs']) {
    const module = await loadEsm(file);
    assert.equal(module.default, module.XqShare, file);
  }
});

test('the UMD constructor works against a stubbed DOM', () => {
  const env = createEnvironment({
    html: '<!doctype html><html><body><div id="share"></div></body></html>',
  });
  const document = env.document;
  globalThis.document = document;
  const UmdXqShare = require(at('lib/js/xqshare.min.js'));
  const widget = new UmdXqShare({
    el: '#share',
    url: 'https://example.com/',
    title: 'bundle',
  });

  assert.equal(widget.options.url, 'https://example.com/');
  assert.equal(widget.options.title, 'bundle');
  assert.equal(document.querySelector('#share').querySelectorAll('.xqshare-item').length, 5);
  widget.share('qq');
  widget.destroy();
  assert.equal(document.querySelector('#share').querySelectorAll('.xqshare').length, 0);
  delete globalThis.document;
});

test('the Vue wrapper keeps the contract in shipped files', async () => {
  const [plugin, sfc] = await Promise.all([
    readFile(at('lib/vue/index.js'), 'utf8'),
    readFile(at('lib/vue/xqshare.vue'), 'utf8'),
  ]);

  assert.match(plugin, /app\.component\("xqShare", component\)/);
  assert.match(sfc, /from '\.\.\/js\/xqshare-esm\.js'/);
  assert.doesNotMatch(sfc, /from '\.\.\/core'/);
  assert.match(sfc, /modelValue/);
  assert.match(sfc, /beforeUnmount\(\)/);
  assert.match(sfc, /beforeDestroy\(\)/);
  assert.equal((sfc.match(/new XqShare\(/g) ?? []).length, 1);
});

test('the published scripts cover build, type, node and browser checks', () => {
  assert.match(pkg.scripts.pretest, /build/);
  assert.match(pkg.scripts.test, /package\.test\.mjs/);
  assert.match(pkg.scripts.test, /share-url\.test\.mjs/);
  assert.match(pkg.scripts.test, /bundle\.test\.mjs/);
  assert.match(pkg.scripts.test, /vue\.test\.mjs/);
  assert.match(pkg.scripts.test, /browser-pages\.test\.mjs/);
  assert.equal(pkg.scripts.typecheck, 'tsc --noEmit');
  assert.equal(pkg.scripts['test:browser:check'], 'node scripts/test-browser.mjs');
});
