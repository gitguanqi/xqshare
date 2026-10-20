import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const at = (...parts) => join(root, ...parts);
const read = (file) => readFile(at(file), 'utf8');

test('the published Vue plugin registers the documented component name', async () => {
  const plugin = await read('lib/vue/index.js');
  assert.match(plugin, /app\.component\("xqShare", component\)/);
  assert.match(plugin, /export\s*\{/);
  assert.match(plugin, /index_default as default/);
});

test('the shipped SFC hosts the core without a duplicate implementation', async () => {
  const sfc = await read('lib/vue/xqshare.vue');

  assert.match(sfc, /from '\.\.\/js\/xqshare-esm\.js'/);
  assert.doesNotMatch(sfc, /from '\.\.\/core'/);
  assert.doesNotMatch(sfc, /<style scoped>/);
  assert.match(sfc, /modelValue/);
  assert.match(sfc, /model:\s*\{/);
  assert.match(sfc, /beforeUnmount\(\)/);
  assert.match(sfc, /beforeDestroy\(\)/);
  assert.equal((sfc.match(/new XqShare\(/g) ?? []).length, 1, 'the SFC must own exactly one core instance');
});

test('the Vue type declarations expose the plugin shape', async () => {
  const types = await read('lib/types/vue/index.d.ts');
  assert.match(types, /plugin/);
});
