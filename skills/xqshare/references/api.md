# xqshare API reference

Source of truth: `lib/types/index.d.ts` (mirrors `src/types.ts`), `src/core.ts`,
`src/share-url.ts`. Everything below is the shipped runtime surface.

## Entries

| Field / subpath | File | Shape |
|---|---|---|
| `main` (CJS) | `lib/js/xqshare.js` | UMD; `module.exports` **is** the class |
| `module` | `lib/js/xqshare-esm.mjs` | ESM default + named `XqShare` |
| `browser` / `unpkg` / `jsdelivr` | `lib/js/xqshare.min.js` | UMD global `XqShare` |
| `types` | `lib/types/index.d.ts` | UMD declarations |
| `exports['.']` | `types` → `import` → `require` → `default` | conditional |
| `xqshare/vue` | `lib/vue/index.js` | plugin + named `component` |
| `xqshare/lib/vue/index.vue` | `lib/vue/xqshare.vue` | redirected raw SFC |
| `xqshare/css/xqshare.css`, `xqshare/css/xqshare.min.css` | `lib/css/*` | stylesheet |

Cloudflare-style ESM mirrors also exist: `xqshare-esm.js` and `xqshare-esm.min.js`.

## Constructor

```ts
new XqShare(options: XqShareOptions)
```

`XqShare.version` — static string equal to the package version.

Throws `XqShareError` synchronously (never through `onError`) when:

- `document` is `undefined` → code `bad-el`
- `el` is an empty/whitespace selector, or is neither a string nor an element
  (`nodeType !== 1`) → code `bad-el`
- a selector matches nothing → code `host-missing`
- `type` is not one of the three modes → code `bad-mode`
- `targets` is not an array or holds an unknown name → code `bad-target`

An element passed directly is used as-is, even if it is still detached; a
selector is resolved with `querySelector`, so the host must already be in the
document.

## Options

| Option | Type | Default | Behaviour |
|---|---|---|---|
| `el` | `string \| Element` | — (required) | Host node; the widget appends `.xqshare` to it |
| `type` | `'default' \| 'pop' \| 'slide'` | `'default'` | Layout; `pop` also renders the copy fields |
| `url` | `string` | `location.href` | Trimmed; empty string falls back to the default |
| `title` | `string` | `document.title` | Trimmed; empty string falls back |
| `desc` | `string` | `meta[name="description"]` | Trimmed; empty string falls back, then `''` |
| `targets` | `readonly ShareTargetName[]` | `DEFAULT_TARGETS` | Order kept, duplicates dropped; unknown name throws |
| `iconBase` | `string` | detected script dir, else CDN | Trailing slash normalised in |
| `visible` | `boolean` | `type !== 'pop'` | See visibility semantics below |
| `closeOnMask` | `boolean` | `true` | `pop` only |
| `onShare` | `(result: ShareResult) => void` | noop | Every trigger, including `opened: false` |
| `onCopy` | `(result: CopyResult) => void` | noop | Every clipboard write |
| `onToggle` | `(visible: boolean) => void` | noop | `show` / `hide` / `update` — not the first mount |
| `onError` | `(error: XqShareError) => void` | noop | Also `console.warn`ed |

Defaults are applied **per field**, so `{ el: '#host' }` alone is valid.

Visibility semantics:

- `default` — `root.hidden` mirrors `visible`; no toggle control is rendered.
- `slide` — `root.hidden` mirrors `visible` (root visible by default) while the
  drawer starts collapsed; the tab toggles `box.active` without changing
  `visible`.
- `pop` — `root.hidden` stays `false`; `visible` is `box.classList.contains('active')`.
  Closed state is guarded with inline `opacity/visibility/pointer-events`, removed
  on open so the CSS transition can run; re-applied 260 ms after a user-driven
  close, immediately on the initial silent mount.
  Opening locks `body.style.overflow`, focuses `.xqshare-close`; closing restores
  both the overflow and the previously focused element. `Esc` closes it. The lock
  is reference-counted per document, so two open overlays do not unlock each
  other and the original inline `overflow` is restored exactly once.

## Instance

| Member | Kind | Notes |
|---|---|---|
| `element` | getter `HTMLElement \| null` | Root `.xqshare`; `null` after `destroy()` |
| `visible` | getter `boolean` | Current visibility (mode-aware) |
| `mode` | getter `ShareMode` | Resolved `type` |
| `options` | getter `Readonly<ResolvedOptions>` | Resolved options; mutation has no effect |
| `show()` | method | Chainable; no-op when already visible |
| `hide()` | method | Chainable; releases the `pop` scroll lock |
| `toggle()` | method | `visible ? hide() : show()` |
| `share(type, url?, title?, desc?)` | method | Returns `ShareResult`; never throws |
| `copy(target?)` | method | `Promise<CopyResult>`; never rejects |
| `setUrl(url, title?)` | method | Updates settings + `data-field` inputs; keeps markup |
| `update(patch)` | method | Re-resolve + rebuild on the same instance; throws `bad-el` after `destroy()` |
| `destroy()` | method | Removes markup, listeners, timers, scroll lock; idempotent |

### `share()`

`target` may be any string. Resolution:

| Case | `opened` | Side effect |
|---|---|---|
| Known target with a web endpoint | `true` when `window.open` succeeded | Opens `_blank`, `win.opener = null` |
| Popup blocked | `false` | `onError('popup-blocked')`, `console.warn` |
| `wechat` (no endpoint) | `false` | Copies the URL; `copy` field stays `null`, clipboard result arrives via `onCopy` |
| Unknown name | `false` | `onError('bad-target')`, nothing opened |

`onShare` runs before the returned value, then the bubbling event
`xqshare:share` is dispatched on the root with the result as `detail`.

### `copy()`

`target` accepts `'url'` (default) and `'iframe'`, plus the legacy ids
`'code'`, `'#previewUrl'`, `'#copyIframe'`, `'#iframe-url'` (mapped to
`'iframe'`).

- Text comes from the rendered `data-field` input when present, otherwise from
  `options.url` / the generated iframe snippet — so `copy()` works in every mode,
  even though only `pop` renders the fields.
- Prefers `navigator.clipboard.writeText`; falls back to a hidden textarea plus
  `document.execCommand('copy')`.
- Resolves `{ ok: method !== 'failed', method, target, text }`; a failure is
  `method: 'failed'`, not a rejection.
- Writes a status line (`.xqshare-status`, Chinese: `已复制` /
  `复制失败，请手动选择`) that clears after 2 s. The text is not configurable.

### `update()` vs `setUrl()`

`update(patch)` merges into the original raw options, re-runs the resolver (so a
patched `targets` / `type` / `iconBase` rebuilds the markup) and preserves
visibility unless `patch.visible` is given. Event listeners are re-owned, not
stacked. `setUrl()` is the cheap path: no rebuild, fields resynced.

## Types

| Type | Value |
|---|---|
| `ShareMode` | `'default' \| 'pop' \| 'slide'` |
| `ShareTargetName` | `'qq' \| 'qzone' \| 'weibo' \| 'douban' \| 'tieba' \| 'wechat'` |
| `CopyTarget` | `'url' \| 'iframe'` |
| `CopyMethod` | `'clipboard' \| 'execCommand' \| 'failed'` |
| `CopyResult` | `{ ok: boolean; method: CopyMethod; target: CopyTarget; text: string }` |
| `SharePayload` | `{ type: string; url: string; title: string; desc: string }` |
| `ShareResult` | `SharePayload & { opened: boolean; copy: CopyResult \| null }` |
| `XqShareErrorCode` | `'bad-el' \| 'host-missing' \| 'bad-mode' \| 'bad-target' \| 'popup-blocked'` |
| `ResolvedOptions` | `XqShareOptions` with every field except `el` present |
| `VueApp` / `XqShareVuePlugin` | structural app shape plus `install(app)` |

`XqShareError` sets `name = 'XqShareError'`, prefixes the message with
`XqShare Error: ` and exposes `code`. Match on `code`.

## Targets

| Name | Label | Endpoint |
|---|---|---|
| `qq` | QQ | `connect.qq.com/widget/shareqq/iframe_index.html` (`url`, `title`, `desc`) |
| `qzone` | 空间 | `sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey` (`url`, `title`, `desc`, `summary`, `site`) |
| `weibo` | 微博 | `service.weibo.com/share/share.php` (`url`, `title`, `language=zh_cn`) |
| `douban` | 豆瓣 | `shuo.douban.com/!service/share` (`href`, `name`) |
| `tieba` | 贴吧 | `tieba.baidu.com/f/commit/share/openShareApi` (`title`, `url`) |
| `wechat` | 微信 | none — `build: null`, the link is copied |

`buildShareUrl` encodes through `URLSearchParams` and drops empty values;
`DEFAULT_TARGETS` excludes `wechat` because it copies instead of navigating.

## DOM contract

Markup is injected as `innerHTML` inside the host and contains **no `id`**:

```
.xqshare[hidden?]
└── .xqshare-box.<mode>[data-mode][role=dialog aria-modal aria-label]  ← pop only attrs
    └── .xqshare-inner
        ├── .xqshare-title > .xqshare-close[data-action="close"]        ← pop only
        ├── span.xqshare-tip                                            ← default
        ├── button.xqshare-tip[data-action="toggle"][aria-expanded]      ← slide
        ├── ul.xqshare-ls > li > button.xqshare-item[data-share="<name>"]
        │                            > img[data-icon] + span
        ├── .xqshare-urls > .xqshare-url-row > .xqshare-url-label
        │        + input.xqshare-input[data-field="url"|"iframe"]
        │        + button.xqshare-copy[data-copy="url"|"iframe"]         ← pop only
        └── p.xqshare-status[role=status][aria-live=polite]
```

Custom events (bubbling, dispatched on `.xqshare`):

| Event | `detail` |
|---|---|
| `xqshare:share` | `ShareResult` |
| `xqshare:copy` | `CopyResult` |

Listen on the host element or `document` — the events bubble.

Images carry `data-icon="share_x.png"`; on `error` the widget swaps to
`ICON_CDN_BASE` once (`data-icon-retry="cdn"`) and then marks
`data-icon-failed` instead of looping. `ICON_CDN_BASE` is
`https://xqgj.cc/xqcdn/libs/xqshare/img/`.

Restyling: the widget exposes only these class names; overriding them is a
breaking-change risk, so prefer wrapping the host in your own container.
