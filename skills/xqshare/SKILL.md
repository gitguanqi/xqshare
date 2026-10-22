---
name: xqshare
description: Integrate the xqshare share widget (inline bar, pop dialog, slide tab, or Vue 2/3 component) into a page or app, and diagnose its runtime failures - missing host, blocked popup, clipboard fallback, broken icon paths, duplicated instances in SPA remounts. Load when adding share buttons, or when an existing xqshare widget renders wrong, opens nothing, or breaks after a route change.
---

# xqshare integration

`xqshare` renders a fixed share UI for six Chinese destinations (`qq`, `qzone`,
`weibo`, `douban`, `tieba`, `wechat`) from `url` + `title` + `desc`. One
TypeScript core is bundled four ways; pick the entry that matches the host, then
follow the order below. The runtime API is a class with exact options in
[references/api.md](references/api.md); the framework path is in
[references/vue.md](references/vue.md).

## 1. Choose the entry point

| Host | Load | Notes |
|---|---|---|
| Plain page, no build | `<script src=".../lib/js/xqshare.min.js">` | Global `XqShare`; also `require()`-able |
| Bundler (webpack/vite/rollup) | `import XqShare from 'xqshare'` | ESM entry, `import.meta` icon detection |
| CDN ES module | `import xqshare, { XqShare } from '.../xqshare-esm.min.js'` | Default and named export are the same class |
| Vue 2 / Vue 3 | `import xqshare from 'xqshare/vue'` + `app.use(xqshare)` | Registers `<xq-share>`; see the Vue reference |
| URL logic only | `import { buildShareUrl } from 'xqshare'` | Never touches the DOM |

Do not bundle the UMD file into an app and also load the global script: two copies
of the class mean `instanceof` checks and event names diverge.

## 2. Mount after the host exists

`el` is required and must already be in the document. Construction throws
synchronously (it does not call `onError`) for a missing host, a bad `type`, an
unknown name in `targets`, or a server-side render with no `document`:

```js
// Vue/React: mount hooks only, never setup/module scope
mounted() { this.widget = new XqShare({ el: this.$refs.host, type: 'pop' }); }
```

Load the stylesheet once. `pop` hides its closed state with inline styles so it
never flashes, but the bar/slide layout, transitions and icon sizing exist only
in `xqshare.css` (`xqshare/css/xqshare.min.css`).

## 3. Decide visibility by mode

- `default` — inline bar, always open, no toggle button. `visible: false` hides
  the whole root.
- `pop` — centred dialog, **starts hidden** (`visible` defaults to
  `type !== 'pop'`). Open it from your own button with `show()` (or `v-model` in
  Vue). It renders the URL / iframe copy fields, locks body scroll, traps focus on
  the close button, closes on `Esc` and on backdrop click (`closeOnMask: false`
  opts out).
- `slide` — edge tab, root visible but the drawer is collapsed; the tab toggles
  `.active` itself and keeps `aria-expanded` in sync.

## 4. Wire the data and the callbacks

Pass `url` / `title` / `desc` explicitly for anything that is not the current
page; the defaults are `location.href`, `document.title` and
`meta[name="description"]`. Later updates go through `setUrl(url, title?)` (fields
only) or `update(patch)` (full re-resolve, rebuilds in place).

`onShare` fires for every trigger, including the two cases that open nothing:
`wechat` (no web endpoint — the link is copied, result has `opened: false` and
`copy: null`, with the clipboard result arriving through `onCopy`) and a blocked
popup (reported as `onError` with code `popup-blocked`). Call `share(type)` from a
real click handler so `window.open` survives the popup blocker.

## 5. Keep icons resolvable

The icon directory is resolved as: explicit `iconBase` → directory next to the
loaded script/module → `ICON_CDN_BASE`. A failed image retries the CDN once, then
is marked `data-icon-failed`. Under a bundler the detected directory is usually a
hashed asset path, so either copy `node_modules/xqshare/lib/img/` into a public
directory and pass that `iconBase`, or accept the CDN fallback. Do not point
`iconBase` at a path without the trailing slash; it is appended verbatim.

## 6. Tear down on unmount

`destroy()` removes the markup, the root listeners, the document `keydown`
listener and the body scroll lock, and is idempotent. In an SPA, call it in
`beforeUnmount` / route change, then construct a new instance on the next mount.
Never call `update()` after `destroy()` — it throws `bad-el`.

Multiple instances on one page are supported: markup uses no `id` attributes and
every lookup is scoped to the instance root, so a copy button always copies its
own instance's URL.

## Failure modes worth recognising

| Symptom | Cause | Fix |
|---|---|---|
| `XqShare Error: ... host-missing` on load | constructor ran before the node existed | move construction into a mount hook |
| `document is undefined` | SSR | guard on `typeof document` and construct client-side |
| Clicking a destination does nothing | popup blocked, or `onShare` never checked `opened` | read `result.opened`, surface `onError` |
| WeChat "does nothing" | expected: it copies the link | show `onCopy` feedback |
| `copy()` resolves `ok: false` | clipboard denied and `execCommand` refused | keep it inside a user gesture |
| Broken images | bundler rewrote the module URL | set `iconBase` or rely on the CDN retry |
| Two widgets appear in an SPA, or the dialog opens twice | instance leaked on remount | `destroy()` in the unmount hook |
| Widget unstyled | stylesheet missing | import `xqshare/css/xqshare.min.css` |

## Verify before finishing

1. In a browser: open each mode, click every rendered destination, confirm the
   URL carries the encoded page address.
2. `pop`: backdrop click, `Esc`, close button, and that the page regains scroll.
3. One instance per host node; unmount/remount leaves no extra `.xqshare` node.
4. Icons load from the intended base (check the `src` of a `share_*.png`).
5. `onShare` / `onCopy` / `onToggle` / `onError` each fired once per action.

Read [references/api.md](references/api.md) for exact option defaults, instance
methods, error codes, DOM hooks and CSS classes; read
[references/vue.md](references/vue.md) for props, events and the Vue 2 vs Vue 3
`v-model` split.
