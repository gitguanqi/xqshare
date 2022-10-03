# xqshare

这是一个JS分享库。

[查看英文文档](./README.md)

## 安装

**游览器端**:

引入cdn

```html
<!-- 样式 -->
<link rel="stylesheet" href="https://unpkg.com/xqshare/lib/css/xqshare.min.css">
<!-- 游览器es5 -->
<script src="https://unpkg.com/xqshare/lib/js/xqshare.min.js"></script>
<!-- es6模块 -->
<script type="module">
    import xqshare from './lib/js/xqshare-esm.min.js';
</script>
```

## 使用

### 游览器端

+ html

```html
<div>
    <button id="openBtn">分享到</button>
</div>
<div id="defaultShare"></div>
<div id="popShare"></div>
<div id="slideShare"></div>
```

+ call

```js
// 1.默认模式
let defaultShare = new XqShare({
    el: '#defaultShare',
    type: 'default',
});

// 2.弹出框模式
let popShare = new XqShare({
    el: '#popShare',
    type: 'pop',
});

let openBtn = document.querySelector('#openBtn');
openBtn.addEventListener('click', showShare, false);
function showShare () {  
    popShare.show();
}

// 3.悬浮模式
let slideShare = new XqShare({
    el: '#slideShare',
    type: 'slide',
});
```

### Vue

```sh
npm i xqshare
```

```js
// main.js
import xqshare from 'xqshare/lib/vue/index';
Vue.use(xqshare);
```

```html
<!-- xqshare start -->
<xq-share :type="type" :show="show" :title="title" :url="url"></xq-share>
<!-- xqshare end -->
```

```js
export default {
    name: 'Demo',
    data() {
        return {
            type: 'default', // 必填: default slide pop
            show: true, // 必填： (pop是false, 其他是true)
            title: '', // 可选
            url: '', // 可选
        }
    }
}
```

## 查看示例

运行这个脚本查看展示案例：`npm run test:browser`。

+ [点击体验](https://unpkg.com/xqshare/test/browser.html)

## 提问题

[提出问题](https://github.com/gitguanqi/xqshare/issues/new)

## 作者

[@gitguanqi](https://github.com/gitguanqi)
