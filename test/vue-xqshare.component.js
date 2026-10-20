/*
 * Loaded as a classic script on the Vue 2 / Vue 3 test pages. It exposes a
 * single Options-API component that owns exactly one XqShare instance and tears
 * it down through the lifecycle hook available in each Vue major.
 *
 * It is written with a `render` function rather than a `template` string so the
 * same file works with both the full and the runtime-only Vue builds (the Vue 3
 * vendor shipped here is runtime-only and has no template compiler).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.createXqShareComponent = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createXqShareComponent(XqShare, config) {
    var settings = config || {};
    var options = settings.options || {};
    var onReady = typeof settings.onReady === 'function' ? settings.onReady : null;

    if (typeof XqShare !== 'function') {
      throw new Error('createXqShareComponent needs the XqShare constructor.');
    }

    return {
      name: 'XqShareCdnDemo',
      props: {
        type: { type: String, default: options.type || 'default' },
        url: { type: String, default: options.url || '' },
        title: { type: String, default: options.title || '' },
      },
      emits: ['ready', 'toggle'],
      data: function () {
        return { visible: false, status: '' };
      },
      mounted: function () {
        var self = this;
        this.$nextTick(function () {
          self.createShare();
        });
      },
      beforeDestroy: function () {
        this.destroyShare();
      },
      unmounted: function () {
        this.destroyShare();
      },
      methods: {
        createShare: function () {
          if (this._xqshare) return this._xqshare;
          if (!this.$refs.host) {
            this.status = 'The component host ref is not ready.';
            return null;
          }
          var self = this;
          var instanceOptions = Object.assign({}, options, {
            el: this.$refs.host,
            type: this.type,
            visible: this.type === 'pop' ? false : true,
            onToggle: function (visible) {
              self.visible = visible;
              self.$emit('toggle', visible);
            },
          });
          if (this.url) instanceOptions.url = this.url;
          if (this.title) instanceOptions.title = this.title;

          this._xqshare = new XqShare(instanceOptions);
          this.status = 'XqShare mounted.';
          this.$emit('ready', this._xqshare);
          if (onReady) onReady(this._xqshare);
          return this._xqshare;
        },
        toggleWidget: function () {
          if (!this._xqshare) this.createShare();
          if (this._xqshare) this._xqshare.toggle();
        },
        getInstance: function () {
          return this._xqshare || null;
        },
        destroyShare: function () {
          if (this._xqshare) {
            this._xqshare.destroy();
            this._xqshare = null;
          }
        },
      },
      render: function () {
        // Vue 2 exposes `this.$createElement`; Vue 3 removes it and the global
        // build exposes `Vue.h`. Pick whichever is available.
        var h =
          typeof this.$createElement === 'function'
            ? this.$createElement
            : globalThis.Vue && globalThis.Vue.h;
        if (typeof h !== 'function') {
          throw new Error('no render function factory (this.$createElement / Vue.h) available');
        }
        var self = this;
        return h('section', { class: 'test-vue-shell' }, [
          h('div', { class: 'test-vue-actions' }, [
            h(
              'button',
              {
                class: 'is-primary',
                on: {
                  click: function () {
                    self.toggleWidget();
                  },
                },
              },
              'Toggle',
            ),
          ]),
          h('div', { class: 'test-vue-layout' }, [
            h('div', { class: 'test-stage' }, [h('div', { ref: 'host', class: 'share-host' })]),
            h('aside', {}, [
              h(
                'div',
                { class: 'test-status', attrs: { role: 'status', 'aria-live': 'polite' } },
                [h('span', {}, self.status)],
              ),
            ]),
          ]),
        ]);
      },
    };
  }

  return createXqShareComponent;
});
