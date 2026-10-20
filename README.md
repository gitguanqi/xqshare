# xqshare

A tiny browser share widget with three layouts — inline bar (`default`), centred
dialog (`pop`) and edge tab (`slide`) — shipped as a UMD global, an ES module and
a Vue 2 / Vue 3 component. Icons are bundled with the package, so it works
offline and never depends on a third-party CDN at runtime.

[中文文档](./zh.md) · [Changelog](./CHANGELOG.md)

## Install

```sh
npm i xqshare
```

Or drop the UMD bundle (and stylesheet) from a CDN / your own host:

```html
<link rel="stylesheet" href="https://your-cdn.com/xqshare/css/xqshare.min.css">
<script src="https://your-cdn.com/xqshare/js/xqshare.min.js"></script>
```

## Usage

### Browser (UMD global)

```html
<div id="shareHost"></div>
<script src="https://your-cdn.com/xqshare/js/xqshare.min.js"></script>
<script>
  const widget = new XqShare({
    el: '#shareHost',
    type: 'default',
    url: location.href,
    title: document.title,
  });
</script>
```

### Browser (ES module)

```html
<div id="shareHost"></div>
<script type="module">
  import xqshare, { XqShare, buildShareUrl } from 'https://your-cdn.com/xqshare/js/xqshare-esm.min.js';
  const widget = new XqShare({ el: '#shareHost', type: 'pop' });
</script>
```

`import xqshare from ...` and `import { XqShare } from ...` resolve to the **same**
constructor.

### Vue 2 / Vue 3

```js
// main.js (Vue 3)
import { createApp } from 'vue';
import xqshare from 'xqshare/vue';
import 'xqshare/css/xqshare.min.css';

createApp(App).use(xqshare).mount('#app');
```

```html
<template>
  <xq-share v-model="showShare" type="pop" :url="pageUrl" :title="pageTitle" />
  <button @click="showShare = true">Share</button>
</template>
```

The component is registered as `<xq-share>`. It supports `v-model` (Vue 3) and
the legacy `:show` prop (Vue 2); both bind visibility and emit
`update:modelValue` / `update:show`.

## API

### Constructor

```ts
new XqShare(options: XqShareOptions)
```

| Option        | Type                                  | Default                 | Notes |
|---------------|---------------------------------------|-------------------------|-------|
| `el`          | `string \| Element`                   | —                       | **Required.** Host node or selector. A missing host throws `XqShareError('host-missing')`. |
| `type`        | `'default' \| 'pop' \| 'slide'`       | `'default'`             | Layout. `pop` starts hidden. |
| `url`         | `string`                              | `location.href`         | Shared page URL. Always `encodeURIComponent`-encoded. |
| `title`       | `string`                              | `document.title`        | Share title. |
| `desc`        | `string`                              | `<meta name="description">` | Share description, surfaced in the QZone URL. |
| `targets`     | `ShareTargetName[]`                   | all targets             | Subset / order of `qq, qzone, weibo, douban, tieba, wechat`. Unknown names throw. |
| `iconBase`    | `string`                              | package `lib/img/`      | Directory (trailing slash) of the `share_*.png` icons. |
| `visible`     | `boolean`                             | `type !== 'pop'`        | Initial visibility. |
| `closeOnMask` | `boolean`                             | `true`                  | `pop` closes when the backdrop is clicked. |
| `onShare`     | `(r: ShareResult) => void`            | noop                    | Fired after a destination is triggered. |
| `onCopy`      | `(r: CopyResult) => void`             | noop                    | Fired after a clipboard write. |
| `onToggle`    | `(visible: boolean) => void`          | noop                    | Fired on open / close. |
| `onError`     | `(e: XqShareError) => void`           | noop                    | Recoverable problems (e.g. blocked popup). |

### Instance

| Member              | Kind            | Description |
|---------------------|-----------------|-------------|
| `element`           | getter          | The root `.xqshare` node (or `null` after `destroy()`). |
| `visible`           | getter          | Current visibility. |
| `mode`              | getter          | The resolved `type`. |
| `options`           | getter          | The resolved options (read-only). |
| `show()`            | method          | Show the widget (chainable). |
| `hide()`            | method          | Hide it. `pop` releases the body scroll lock. |
| `toggle()`          | method          | Show / hide. |
| `share(type, url?, title?, desc?)` | method | Open a destination. Unknown `type` is reported via `onError` instead of throwing; `wechat` copies the link instead of opening a blank tab. |
| `copy(target?)`     | method          | Copy `'url'` (default) or `'iframe'` to the clipboard. Returns `Promise<CopyResult>`; prefers `navigator.clipboard`, falls back to `execCommand`. |
| `setUrl(url, title?)` | method        | Replace the shared URL / title and sync the copy fields. |
| `update(patch)`     | method          | Re-resolve options and rebuild the markup on the same instance. |
| `destroy()`         | method          | Remove the markup and **unbind every listener** (safe for SPA remounts). |

### Pure helpers (ES module only)

`buildShareUrl(type, payload)`, `getShareTarget(name)`, `isShareTargetName(value)`,
`DEFAULT_TARGETS`, `SHARE_TARGETS` are exported from the ESM build for consumers
who only need the URL logic.

## Browser support

The bundles target **ES2018**. They use `classList`, `dataset`, object spread and
template literals and **do not support Internet Explorer**.

| Browser | Minimum version |
|---------|-----------------|
| Chrome  | 63+ |
| Edge    | 79+ (Chromium) |
| Firefox | 58+ |
| Safari  | 12+ |

## Local development & self-checks

```sh
npm run build              # rebuild lib/ with esbuild
npm test                  # node --test: unit + bundle + package + vue + page checks
npm run typecheck         # tsc --noEmit
npm run test:browser      # serve test/ on http://127.0.0.1:4173
npm run test:browser:check# headless Chrome/Edge run of the 4 test pages
npm run verify            # typecheck + node tests + browser checks
```

`test/browser.html`, `test/esm.html`, `test/vue2.html` and `test/vue3.html` are
self-contained and report PASS / FAIL inline.

## Migrating from 0.0.x

`0.1.0` is a breaking release (still pre-`1.0`):

- `package.json#main` now points at the real UMD build, so `require('xqshare')`
  and the default unpkg file both work.
- The Vue component is registered as `xqShare` (`<xq-share>`). The old deep path
  `xqshare/lib/vue/index.vue` is redirected to `lib/vue/xqshare.vue` via
  `exports`; webpack 4 users importing the raw `.vue` may need to adjust.
- The widget no longer emits fixed `id`s — it uses `data-*` attributes scoped to
  each instance, so multiple widgets on one page no longer collide, and
  `copy('#previewUrl')` copies the correct instance.
- URLs and titles are now encoded. `share('wechat')` copies the link instead of
  opening a blank tab; unknown targets are reported rather than thrown.
- Icons ship inside the package (`lib/img/`) and load locally by default; pass
  `iconBase` to override.

## License

MIT
