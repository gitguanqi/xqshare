# Vue 2 / Vue 3 integration

The Vue layer is a thin host: one `XqShare` instance per component, props in,
events out, teardown on unmount. It ships as `xqshare/vue` (ESM plugin) and
`xqshare/lib/vue/index.vue` (raw SFC, for toolchains that compile SFCs
themselves).

## Install

```js
// Vue 3 — main.js
import { createApp } from 'vue';
import xqshare from 'xqshare/vue';
import 'xqshare/css/xqshare.min.css';

createApp(App).use(xqshare).mount('#app');
```

```js
// Vue 2 — main.js
import Vue from 'vue';
import xqshare from 'xqshare/vue';
import 'xqshare/css/xqshare.min.css';

Vue.use(xqshare);
```

`install(app)` calls `app.component('xqShare', component)`, which works for both
majors because both expose `component(name, definition)`. The tag is
`<xq-share>`; slot syntax `<xqShare>` also resolves.

The SFC carries an unscoped `<style>@import '../style/xqshare.css'</style>`, so a
toolchain that processes SFC styles injects the CSS automatically. Import
`xqshare/css/xqshare.min.css` as well when the styles are extracted, deferred, or
when you consume the prebuilt `lib/vue/index.js` with a custom SFC pipeline —
missing CSS leaves the bar/slide layouts unstyled (`pop` still hides correctly).

## Props

| Prop | Type | Default | Mapping |
|---|---|---|---|
| `type` | `String` | `'default'` | `XqShareOptions.type` |
| `url` | `String` | `''` | `url`; empty string means "use `location.href`" |
| `title` | `String` | `''` | `title`; empty string means "use `document.title`" |
| `desc` | `String` | `''` | `desc`; empty means meta description |
| `targets` | `Array` | `null` | Ignored unless a non-empty array |
| `iconBase` | `String` | `''` | Ignored when empty (keeps auto-detection) |
| `closeOnMask` | `Boolean` | `true` | `closeOnMask` |
| `show` | `Boolean` | `undefined` | Legacy visibility prop (Vue 2 style) |
| `modelValue` | `Boolean` | `undefined` | `v-model` visibility |

`show` and `modelValue` default to `undefined` on purpose: a plain `Boolean` prop
defaults to `false`, which would erase the "pop starts hidden, bar/slide start
visible" rule. Precedence: `modelValue` → `show` → `type !== 'pop'`.

Prop changes (`type`, `url`, `title`, `desc`, `targets`, `iconBase`,
`closeOnMask`, visibility) are watched and applied with `instance.update(...)`,
which rebuilds the markup in place — never edit the widget's DOM by hand.

## Events

| Event | Payload | When |
|---|---|---|
| `update:modelValue` | `boolean` | Visibility changed (for `v-model`) |
| `update:show` | `boolean` | Same value, legacy name |
| `toggle` | `boolean` | Same value, semantic name |
| `share` | `ShareResult` | A destination was triggered |
| `copy` | `CopyResult` | A clipboard write finished |

`onShare` / `onCopy` / `onToggle` / `onError` are **not** props. They are wired
internally to these events; `onError` is not forwarded, so a blocked popup shows
up as `@share` with `result.opened === false`. There is no `error` event — use
the core class directly if you need `onError`.

## Usage

```html
<template>
  <button type="button" @click="shareOpen = true">Share</button>
  <xq-share
    v-model="shareOpen"
    type="pop"
    :url="pageUrl"
    :title="pageTitle"
    :targets="['qq', 'qzone', 'weibo', 'wechat']"
    @share="onShare"
    @copy="onCopy"
  />
</template>

<script>
export default {
  data: () => ({ shareOpen: false, pageUrl: location.href, pageTitle: document.title }),
  methods: {
    onShare(result) {
      // `opened` is false for wechat and for a blocked popup.
      if (result.type === 'wechat') return;
      if (result.opened) this.shareOpen = false;
    },
    onCopy(result) {
      this.$message?.(result.ok ? 'Link copied' : 'Copy failed');
    },
  },
};
</script>
```

Notes that change behaviour:

- `v-model` calls `update({ visible })`, which rebuilds the markup. Bind it to a
  boolean you change on real user actions, not on every render tick.
- Neither `share` nor `copy` closes the dialog — close it yourself in `@share`
  when that is the desired flow.
- The component's `XqShare` instance is internal. To change the URL/title, change
  the props; to open/close, change the model value. `setUrl()` and `destroy()` are
  managed for you.
- Unmount (`beforeUnmount` on Vue 3, `beforeDestroy` on Vue 2) destroys the
  instance, so `<keep-alive>` deactivation alone does not remove the markup —
  reactivate with fresh props and it re-renders.

## Verify

1. Vue 2.7 and Vue 3 both mount `<xq-share>` (the package's own checks pin
   2.7.16 and 3.5.13).
2. `v-model` opens and closes `pop`; `Esc`, backdrop and the close button write
   back to the same value.
3. Changing `url` at runtime updates the shared link and the copy fields.
4. Navigating away removes exactly one `.xqshare` node from the host.
