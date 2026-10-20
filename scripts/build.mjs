import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const at = (...parts) => resolve(root, ...parts);

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * esbuild has no UMD output, so its IIFE is wrapped in the classic UMD shell.
 * The global name stays `XqShare` because the documented browser usage is
 * `new XqShare(...)`; `define(factory)` (not `define(factory())`) keeps AMD lazy.
 */
const UMD_HEADER = `(function (root, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') module.exports = factory();
    else if (typeof define === 'function' && define.amd) define(factory);
    else if (typeof define === 'function' && define.cmd) define(function (require, exports, module) { module.exports = factory(); });
    else root.XqShare = factory();
})(typeof self !== 'undefined' ? self : this, function () {
"use strict";
`;
const UMD_FOOTER = `
return __xqshareUmd__.default || __xqshareUmd__;
});
`;

const BUNDLES = [
  { outfile: 'lib/js/xqshare.js', entry: 'src/index.ts', format: 'iife', umd: true, minify: false },
  { outfile: 'lib/js/xqshare.min.js', entry: 'src/index.ts', format: 'iife', umd: true, minify: true },
  { outfile: 'lib/js/xqshare-esm.js', entry: 'src/index.esm.ts', format: 'esm', umd: false, minify: false },
  { outfile: 'lib/js/xqshare-esm.min.js', entry: 'src/index.esm.ts', format: 'esm', umd: false, minify: true },
  // `.mjs` mirrors let Node import the package entry without guessing the module type.
  { outfile: 'lib/js/xqshare-esm.mjs', entry: 'src/index.esm.ts', format: 'esm', umd: false, minify: false },
  { outfile: 'lib/js/xqshare-esm.min.mjs', entry: 'src/index.esm.ts', format: 'esm', umd: false, minify: true },
];

async function prepareDirectories() {
  for (const dir of ['lib/js', 'lib/css', 'lib/style', 'lib/img', 'lib/vue', 'lib/types']) {
    await mkdir(at(dir), { recursive: true });
  }
  // `lib/vue/index.vue` shipped a raw SFC through the package root until 0.1.0.
  // The file is gone now; `exports` redirects the old path to lib/vue/xqshare.vue.
  await rm(at('lib/vue/index.vue'), { force: true });
}

async function checkVersion() {
  const pkg = JSON.parse(await readFile(at('package.json'), 'utf8'));
  const source = await readFile(at('src/version.ts'), 'utf8');
  const match = /VERSION = '([^']+)'/.exec(source);
  if (!match || match[1] !== pkg.version) {
    throw new Error(
      `src/version.ts (${match ? match[1] : 'missing'}) does not match package.json (${pkg.version})`,
    );
  }
  return pkg.version;
}

async function buildBundles() {
  for (const bundle of BUNDLES) {
    await build({
      entryPoints: [at(bundle.entry)],
      outfile: at(bundle.outfile),
      bundle: true,
      format: bundle.format,
      target: ['es2018'],
      minify: bundle.minify,
      charset: 'utf8',
      legalComments: 'none',
      logLevel: 'warning',
      ...(bundle.umd
        ? {
            globalName: '__xqshareUmd__',
            banner: { js: UMD_HEADER },
            footer: { js: UMD_FOOTER },
          }
        : {
            // es2018 predates `import.meta`; without this esbuild rewrites it to a
            // `{}` shim and the icon-base detection silently degrades to the CDN.
            supported: { 'import-meta': true },
          }),
    });
  }
}

async function buildVue() {
  await build({
    entryPoints: [at('src/vue/index.ts')],
    outfile: at('lib/vue/index.js'),
    bundle: true,
    format: 'esm',
    // The SFC is compiled by the consumer's own Vue toolchain.
    external: ['./xqshare.vue'],
    target: ['es2018'],
    charset: 'utf8',
    logLevel: 'warning',
  });

  const sfc = await readFile(at('src/vue/xqshare.vue'), 'utf8');
  const rewritten = sfc
    .split("from '../core'")
    .join("from '../js/xqshare-esm.js'");
  if (rewritten.includes("from '../core'")) {
    throw new Error('lib/vue/xqshare.vue still imports the source tree');
  }
  await writeFile(at('lib/vue/xqshare.vue'), rewritten);
}

async function buildStyles() {
  const css = await readFile(at('src/style/xqshare.css'), 'utf8');
  await writeFile(at('lib/css/xqshare.css'), css);
  await writeFile(at('lib/style/xqshare.css'), css);

  await build({
    stdin: { contents: css, resolveDir: at('src/style'), loader: 'css' },
    outfile: at('lib/css/xqshare.min.css'),
    minify: true,
    charset: 'utf8',
    logLevel: 'warning',
  });
}

async function buildIcons() {
  const source = at('assets/img');
  const entries = (await readdir(source)).filter((name) => name.endsWith('.png')).sort();
  if (entries.length === 0) {
    throw new Error('assets/img has no PNG icons; the widget would render broken images');
  }
  for (const name of entries) {
    const file = at('assets/img', name);
    const buffer = await readFile(file);
    if (!buffer.subarray(0, 8).equals(PNG_MAGIC)) {
      throw new Error(`${name} is not a PNG file`);
    }
    await copyFile(file, at('lib/img', name));
  }
  return entries;
}

function resolveTsc() {
  try {
    return require.resolve('typescript/bin/tsc');
  } catch {
    return resolve(dirname(require.resolve('typescript')), 'tsc.js');
  }
}

async function buildTypes() {
  execFileSync(process.execPath, [resolveTsc(), '-p', 'tsconfig.build.json'], {
    cwd: root,
    stdio: 'inherit',
  });
  // Resolves the `./xqshare.vue` import inside the emitted plugin declaration.
  await writeFile(
    at('lib/types/vue/xqshare.vue.d.ts'),
    'declare const component: unknown;\nexport default component;\n',
  );
}

async function assertBundles() {
  const umd = await readFile(at('lib/js/xqshare.js'), 'utf8');
  const umdMin = await readFile(at('lib/js/xqshare.min.js'), 'utf8');
  const esm = await readFile(at('lib/js/xqshare-esm.js'), 'utf8');

  if (umd.includes('import.meta') || umdMin.includes('import.meta')) {
    throw new Error('the UMD bundle contains import.meta and will not parse as a classic script');
  }
  if (!esm.includes('import.meta.url')) {
    throw new Error('the ESM bundle lost its import.meta icon-base detection');
  }
  if (!umd.includes('root.XqShare = factory()')) {
    throw new Error('the UMD bundle does not export the documented global XqShare');
  }
  if (!esm.includes('export {')) {
    throw new Error('the ESM bundle has no named exports');
  }
}

async function report(version, icons) {
  const files = ['lib/js/xqshare.js', 'lib/js/xqshare.min.js', 'lib/css/xqshare.min.css'];
  const sizes = [];
  for (const file of files) {
    const { size } = await stat(at(file));
    sizes.push(`${file.replace(/^lib\//, '')} ${size} B`);
  }
  console.log(`xqshare ${version}: build finished (${icons.length} icons, ${sizes.join(', ')})`);
}

const version = await checkVersion();
await prepareDirectories();
await buildBundles();
await buildVue();
await buildStyles();
const icons = await buildIcons();
await buildTypes();
await assertBundles();
await report(version, icons);
