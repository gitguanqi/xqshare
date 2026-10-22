import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const at = (...parts) => join(root, ...parts);
const read = (file) => readFile(at(file), 'utf8');

const pkg = JSON.parse(await read('package.json'));
const SKILL = 'skills/xqshare/SKILL.md';

/** npm publishes a path when it equals a `files` entry or lives under one. */
function isPublished(relative, files = pkg.files) {
  return files.some((entry) => {
    const clean = entry.replace(/^\.\//, '').replace(/\/+$/, '');
    return relative === clean || relative.startsWith(`${clean}/`);
  });
}

function frontmatter(source, file) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(source);
  assert.ok(match, `${file} must start with YAML frontmatter`);
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([a-z][a-z0-9-]*):\s*(.+)$/.exec(line);
    if (pair) fields[pair[1]] = pair[2].trim();
  }
  return fields;
}

/** Public members of the class, read from source so the docs cannot drift. */
async function publicMembers() {
  const source = await read('src/core.ts');
  const start = source.indexOf('/* ---------------------------------------------------------------- public */');
  const end = source.indexOf('/* --------------------------------------------------------------- private */');
  assert.ok(start !== -1 && end > start, 'src/core.ts lost its public/private markers');
  const block = source.slice(start, end);
  const names = [...block.matchAll(/^ {2}(?:get\s+|static\s+)?(\w+)\s*[(:]/gm)].map((m) => m[1]);
  assert.ok(names.includes('destroy') && names.includes('share'), 'public member scan failed');
  return [...new Set(names)];
}

async function optionNames() {
  const source = await read('src/types.ts');
  const block = /export interface XqShareOptions \{([\s\S]*?)\n\}/.exec(source);
  assert.ok(block, 'XqShareOptions is missing from src/types.ts');
  return [...block[1].matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]);
}

async function errorCodes() {
  const source = await read('src/types.ts');
  const block = /export type XqShareErrorCode =([\s\S]*?);/.exec(source);
  assert.ok(block, 'XqShareErrorCode is missing from src/types.ts');
  return [...block[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
}

function assertMentions(text, names, file, label) {
  const missing = names.filter((name) => !text.includes(name));
  assert.deepEqual(missing, [], `${file} must document every ${label}: ${missing.join(', ')}`);
}

test('the agent metadata points at shipped files', async () => {
  assert.equal(pkg.llms, './llms.txt');
  assert.equal(pkg.agents, `./${SKILL}`);

  for (const [field, relative] of [
    ['llms', pkg.llms],
    ['agents', pkg.agents],
  ]) {
    assert.match(relative, /^\.\//, `package.json#${field} must be relative to the package root`);
    await access(at(relative.slice(2)));
    assert.ok(isPublished(relative.slice(2)), `package.json#files must include ${relative}`);
  }

  assert.ok(isPublished('skills/xqshare/references/api.md'), 'the skill references must ship');
  assert.ok(isPublished('skills/xqshare/references/vue.md'), 'the skill references must ship');
  // Everything the skill links to must be inside the published tree.
  assert.ok(isPublished(SKILL.split('/').slice(0, -1).join('/') + '/references/api.md'));
});

test('adding metadata did not change any runtime entry point', () => {
  assert.equal(pkg.main, 'lib/js/xqshare.js');
  assert.equal(pkg.module, 'lib/js/xqshare-esm.mjs');
  assert.equal(pkg.types, 'lib/types/index.d.ts');
  assert.equal(pkg.exports['.'].import, './lib/js/xqshare-esm.mjs');
  assert.equal(pkg.exports['.'].require, './lib/js/xqshare.js');
  assert.equal(pkg.exports['./vue'].import, './lib/vue/index.js');
  assert.equal(pkg.sideEffects, undefined, 'no sideEffects flag was introduced');
});

test('llms.txt documents every runtime export of the ESM bundle', async () => {
  const module = await import('../lib/js/xqshare-esm.mjs');
  const llms = await read('llms.txt');

  const exports = Object.keys(module).filter((name) => name !== 'default');
  assert.ok(exports.includes('buildShareUrl') && exports.includes('VERSION'));
  assertMentions(llms, exports, 'llms.txt', 'runtime export');
  assert.match(llms, /XqShare/, 'llms.txt must name the default export');
});

test('llms.txt documents every option, instance member and error code', async () => {
  const llms = await read('llms.txt');

  assertMentions(llms, await optionNames(), 'llms.txt', 'XqShareOptions field');
  assertMentions(llms, await publicMembers(), 'llms.txt', 'instance member');
  assertMentions(llms, await errorCodes(), 'llms.txt', 'error code');

  for (const snippet of ['require(', 'import ', 'xqshare/vue', 'xqshare/css/']) {
    assert.ok(llms.includes(snippet), `llms.txt must show an import form containing "${snippet}"`);
  }
});

test('the skill frontmatter is portable and matches its directory', async () => {
  const skill = await read(SKILL);
  const fields = frontmatter(skill, SKILL);

  assert.equal(fields.name, 'xqshare', 'the skill name must match skills/xqshare');
  assert.match(fields.name, /^[a-z][a-z0-9-]*$/, 'the skill name must be lowercase-hyphenated');
  assert.ok(fields.description && fields.description.length > 40, 'the description must say when to load');
  assert.match(fields.description, /\b(load|when)\b/i, 'the description must state the trigger');
  assert.doesNotMatch(fields.description, /TODO|TBD|FIXME/i);
});

test('every local link in the skill resolves inside the shipped skill', async () => {
  const skill = await read(SKILL);

  const links = [...skill.matchAll(/\]\((?!https?:)([^)#]+)\)/g)].map((m) => m[1]);
  assert.ok(links.length >= 2, 'SKILL.md should link its references');
  assert.ok(links.some((link) => link.includes('references/api.md')));
  assert.ok(links.some((link) => link.includes('references/vue.md')));

  for (const link of links) {
    const target = resolve(dirname(at(SKILL)), link);
    assert.ok(target.startsWith(resolve(root, 'skills/xqshare')), `${link} escapes the skill directory`);
    await access(target);
  }
});

test('the skill explains integration order, lifecycle and the framework path', async () => {
  const skill = await read(SKILL);

  for (const heading of ['Choose the entry point', 'Mount', 'Tear down']) {
    assert.match(skill, new RegExp(`##\\s+\\d\\.\\s*${heading}`, 'i'), `missing section: ${heading}`);
  }
  assert.match(skill, /destroy\(\)/, 'the skill must cover SPA teardown');
  assert.match(skill, /xqshare\/vue/, 'the skill must cover the Vue entry');
  assert.match(skill, /iconBase/, 'the skill must cover the icon base constraint');
  assert.match(skill, /popup-blocked/, 'the skill must cover blocked popups');
  assert.doesNotMatch(skill, /TODO|TBD|FIXME|placeholder/i, 'no unfinished placeholders may ship');

  const llms = await read('llms.txt');
  assert.doesNotMatch(llms, /TODO|TBD|FIXME|placeholder/i);
});

test('llms.txt stays a concise summary instead of a second manual', async () => {
  const llms = await read('llms.txt');
  const lines = llms.split(/\r?\n/).length;

  assert.ok(lines <= 200, `llms.txt grew to ${lines} lines; trim it and push detail into the skill`);
  assert.match(llms, /^#\s+xqshare/m, 'llms.txt starts with the package name');
  for (const heading of ['Install', 'Imports', 'Exported API', 'Constraints']) {
    assert.match(llms, new RegExp(`^##\\s+${heading}`, 'm'), `llms.txt is missing the ${heading} section`);
  }
});

test('the Vue reference stays in sync with the shipped SFC', async () => {
  const [vue, sfc] = await Promise.all([
    read('skills/xqshare/references/vue.md'),
    read('src/vue/xqshare.vue'),
  ]);

  const props = [...sfc.matchAll(/^ {8}(\w+):\s*\{/gm)].map((m) => m[1]);
  assert.ok(props.includes('modelValue') && props.includes('closeOnMask'));
  assertMentions(vue, props, 'references/vue.md', 'component prop');

  const emits = /emits:\s*\[([^\]]+)\]/.exec(sfc);
  assert.ok(emits, 'the SFC lost its emits list');
  const events = [...emits[1].matchAll(/'([\w:]+)'/g)].map((m) => m[1]);
  assertMentions(vue, events, 'references/vue.md', 'component event');
});
