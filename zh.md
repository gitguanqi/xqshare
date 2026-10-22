# xqshare

一个轻量的浏览器分享小组件，提供三种布局：行内分享条（`default`）、居中弹窗（`pop`）、侧边抽屉（`slide`）。
以 UMD 全局变量、ES 模块、以及 Vue 2 / Vue 3 组件三种形式发布。图标随包内置，离线可用，运行时不再依赖第三方 CDN。

[English docs](./README.md) · [更新日志](./CHANGELOG.md)

## 安装

```sh
npm i xqshare
```

也可以直接从 CDN / 自己的静态服务器引入 UMD 产物与样式：

```html
<link rel="stylesheet" href="https://your-cdn.com/xqshare/css/xqshare.min.css">
<script src="https://your-cdn.com/xqshare/js/xqshare.min.js"></script>
```

## 使用

### 浏览器端（UMD 全局变量）

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

### 浏览器端（ES 模块）

```html
<div id="shareHost"></div>
<script type="module">
  import xqshare, { XqShare, buildShareUrl } from 'https://your-cdn.com/xqshare/js/xqshare-esm.min.js';
  const widget = new XqShare({ el: '#shareHost', type: 'pop' });
</script>
```

`import xqshare from ...` 与 `import { XqShare } from ...` 指向**同一个**构造函数。

### Vue 2 / Vue 3

```js
// main.js（Vue 3）
import { createApp } from 'vue';
import xqshare from 'xqshare/vue';
import 'xqshare/css/xqshare.min.css';

createApp(App).use(xqshare).mount('#app');
```

```html
<template>
  <xq-share v-model="showShare" type="pop" :url="pageUrl" :title="pageTitle" />
  <button @click="showShare = true">分享</button>
</template>
```

组件注册名为 `<xq-share>`。支持 `v-model`（Vue 3）以及旧的 `:show` 属性（Vue 2），
二者都绑定显隐状态并派发 `update:modelValue` / `update:show` 事件。

## API

### 构造函数

```ts
new XqShare(options: XqShareOptions)
```

| 选项           | 类型                                  | 默认值                    | 说明 |
|----------------|---------------------------------------|---------------------------|------|
| `el`           | `string \| Element`                   | —                         | **必填。** 挂载节点或选择器；找不到宿主会抛出 `XqShareError('host-missing')`。 |
| `type`         | `'default' \| 'pop' \| 'slide'`       | `'default'`               | 布局。`pop` 默认隐藏。 |
| `url`          | `string`                              | `location.href`           | 分享页面地址，始终经过 `encodeURIComponent` 编码。 |
| `title`        | `string`                              | `document.title`          | 分享标题。 |
| `desc`         | `string`                              | `<meta name="description">` | 分享描述，用于 QQ 空间链接。 |
| `targets`      | `ShareTargetName[]`                   | 全部目标                  | `qq, qzone, weibo, douban, tieba, wechat` 的子集 / 顺序；非法名称会抛错。 |
| `iconBase`     | `string`                              | 包内 `lib/img/`           | 图标目录（需以 `/` 结尾）。 |
| `visible`      | `boolean`                             | `type !== 'pop'`          | 初始显隐。 |
| `closeOnMask`  | `boolean`                             | `true`                    | `pop` 点击遮罩关闭。 |
| `onShare`      | `(r: ShareResult) => void`            | 空函数                    | 触发某渠道后回调。 |
| `onCopy`       | `(r: CopyResult) => void`             | 空函数                    | 复制完成后回调。 |
| `onToggle`     | `(visible: boolean) => void`          | 空函数                    | 显隐变化时回调。 |
| `onError`      | `(e: XqShareError) => void`           | 空函数                    | 可恢复错误（如弹窗被拦截）。 |

### 实例

| 成员                | 类型     | 说明 |
|---------------------|----------|------|
| `element`           | getter   | 根节点 `.xqshare`（销毁后为 `null`）。 |
| `visible`           | getter   | 当前是否可见。 |
| `mode`              | getter   | 解析后的 `type`。 |
| `options`           | getter   | 解析后的选项（只读）。 |
| `show()`            | 方法     | 显示（可链式调用）。 |
| `hide()`            | 方法     | 隐藏；`pop` 会释放 body 滚动锁。 |
| `toggle()`          | 方法     | 显隐切换。 |
| `share(type, url?, title?, desc?)` | 方法 | 打开目标链接。未知 `type` 通过 `onError` 上报而非抛错；`wechat` 改为复制链接，不再打开空白页。 |
| `copy(target?)`     | 方法     | 复制 `'url'`（默认）或 `'iframe'` 到剪贴板。返回 `Promise<CopyResult>`，优先 `navigator.clipboard`，失败回退 `execCommand`。 |
| `setUrl(url, title?)` | 方法   | 替换分享地址 / 标题并同步复制框。 |
| `update(patch)`     | 方法     | 用新选项在同一实例上重建 DOM。 |
| `destroy()`         | 方法     | 移除 DOM 并**解绑所有监听**（适合 SPA 反复挂载）。 |

### 纯函数（仅 ESM 导出）

`buildShareUrl(type, payload)`、`getShareTarget(name)`、`isShareTargetName(value)`、
`DEFAULT_TARGETS`、`SHARE_TARGETS` 从 ESM 构建中导出，供只需要链接逻辑的场景使用。

## 浏览器支持

构建目标为 **ES2018**，使用了 `classList`、`dataset`、对象展开与模板字符串，
**不支持 IE**。

| 浏览器 | 最低版本 |
|--------|----------|
| Chrome | 63+ |
| Edge   | 79+（Chromium 版） |
| Firefox| 58+ |
| Safari | 12+ |

## 本地开发与自检

```sh
npm run build               # 用 esbuild 重新生成 lib/
npm test                   # node --test：单元 + 构建产物 + 包 + Vue + 页面检查
npm run typecheck          # tsc --noEmit
npm run test:browser       # 在 http://127.0.0.1:4173 提供 test/ 页面
npm run test:browser:check # headless Chrome/Edge 跑过 4 个测试页
npm run verify             # 类型检查 + node 测试 + 浏览器检查
```

`test/browser.html`、`test/esm.html`、`test/vue2.html`、`test/vue3.html` 都是自包含的，
页面内会直接显示 PASS / FAIL。

## 面向 AI 智能体的文档

发布包里除了上面的 API，还带有两份给智能体读的文档：

| 文件 | 用途 |
|------|------|
| `llms.txt`（`package.json#llms`） | 精简 API 摘要：导入方式、运行时导出、选项默认值、实例方法、约束。先读这个。 |
| `skills/xqshare/SKILL.md`（`package.json#agents`） | 可移植的集成技能：入口选择、挂载顺序、三种模式语义、图标与样式前提、SPA 销毁、常见故障表。 |
| `skills/xqshare/references/api.md` | 完整选项表、实例成员、类型、错误码、DOM 钩子与事件。 |
| `skills/xqshare/references/vue.md` | Vue 2 / Vue 3 的 props、事件、`v-model` 差异与注意事项。 |

`npm test` 会跑 `test/agents.test.mjs`：一旦有导出、选项、错误码、prop 或事件
在文档里缺失，或技能内的链接失效、元数据指向未被打包的文件，测试就会失败。

## 从 0.0.x 迁移

`0.1.0` 是破坏性版本（仍处于 `0.x`）：

- `package.json#main` 现在指向真实的 UMD 构建，因此 `require('xqshare')` 与 unpkg 默认文件均可工作。
- Vue 组件注册名为 `xqShare`（标签 `<xq-share>`）。旧深路径 `xqshare/lib/vue/index.vue`
  已通过 `exports` 重定向到 `lib/vue/xqshare.vue`（webpack 4 直接 import 原始 `.vue` 的情况可能需要调整）。
- 组件不再输出固定 `id`，改用每个实例作用域内的 `data-*` 属性；同一页面多个组件不再冲突，
  `copy('#previewUrl')` 也会复制到正确的实例。
- URL 与标题现已编码；`share('wechat')` 改为复制链接而非打开空白页；未知渠道改为上报而非抛错。
- 图标随包内置（`lib/img/`）并默认本地加载，可用 `iconBase` 覆盖。

## 许可

MIT
