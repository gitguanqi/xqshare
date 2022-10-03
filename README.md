# xqshare

This is a js share libiary.

[View Chinese documents](./zh.md)

## Install

**Browser**:

import cdn

```html
<!-- style -->
<link rel="stylesheet" href="https://unpkg.com/xqshare/lib/css/xqshare.min.css">
<!-- browser -->
<script src="https://unpkg.com/xqshare/lib/js/xqshare.min.js"></script>
<!-- es module -->
<script type="module">
    import xqshare from '../lib/js/xqshare-esm.min.js';
</script>
```

## Usage

### Browser

+ html

```html
<div>
    <button id="openBtn">share</button>
</div>
<div id="defaultShare"></div>
<div id="popShare"></div>
<div id="slideShare"></div>
```

+ call

```js
// 1.default mode
let defaultShare = new XqShare({
    el: '#defaultShare',
    type: 'default',
});

// 2.pop mode
let popShare = new XqShare({
    el: '#popShare',
    type: 'pop',
});

let openBtn = document.querySelector('#openBtn');
openBtn.addEventListener('click', showShare, false);
function showShare () {  
    popShare.show();
}

// 3.slide mode
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
            type: 'default', // must value: default slide pop
            show: true, // must (pop is false, another is true)
            title: '', // optional 
            url: '', // optional
        }
    }
}
```

## View xqshare

Run this script to view the demonstration case: `npm run test:browser`.

+ [demo](https://unpkg.com/xqshare/test/browser.html)

## ask questions

[submit your question](https://github.com/gitguanqi/xqshare/issues/new)

## Author

[@gitguanqi](https://github.com/gitguanqi)
