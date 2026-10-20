/**
 * A small DOM stand-in, sized for this package rather than for the whole spec.
 *
 * It exists so `npm test` can execute the *built* bundles without a browser or a
 * jsdom dependency: `node --test` must stay runnable on a clean checkout. What it
 * supports is exactly what the widget touches — attribute selectors, descendant
 * combinators, `closest()`, class lists, event bubbling with a capture phase,
 * `hidden`, an inline `style` bag and a settable `activeElement`.
 */

const VOID_ELEMENTS = new Set(['br', 'hr', 'img', 'input', 'link', 'meta', 'source', 'area']);

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: '\u00a0' };

/**
 * Assigns an event field even when the platform Event defines it as a read-only
 * getter (real Node `CustomEvent` does). A failed assignment is harmless: the
 * field is only used for diagnostic purposes inside the stub.
 */
function defineEventField(event, name, value) {
  try {
    event[name] = value;
  } catch {
    try {
      Object.defineProperty(event, name, { value, writable: true, configurable: true });
    } catch {
      // Give up silently; diagnostics are non-essential.
    }
  }
}

function decodeEntities(text) {
  return text.replace(/&(#?\w+);/g, (match, name) => ENTITIES[name] ?? match);
}

function splitSelector(selector) {
  return selector
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseCompound(token) {
  const spec = { tag: null, id: null, classes: [], attrs: [] };
  const part = /^([a-zA-Z][\w-]*)|^#([\w-]+)|^\.([\w-]+)|^\[([^\]]+)\]/;
  let rest = token;
  while (rest.length > 0) {
    const match = part.exec(rest);
    if (!match) break;
    if (match[1]) spec.tag = match[1].toUpperCase();
    else if (match[2]) spec.id = match[2];
    else if (match[3]) spec.classes.push(match[3]);
    else if (match[4]) {
      const body = match[4];
      const eq = body.indexOf('=');
      if (eq < 0) {
        spec.attrs.push({ name: body.trim(), value: null });
      } else {
        const name = body.slice(0, eq).trim();
        const raw = body.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        spec.attrs.push({ name, value: decodeEntities(raw) });
      }
    }
    rest = rest.slice(match[0].length);
  }
  return spec;
}

function parseChain(selector) {
  const tokens = selector.replace(/>/g, ' > ').split(/\s+/).filter(Boolean);
  const steps = [];
  let combinator = ' ';
  for (const token of tokens) {
    if (token === '>') {
      combinator = '>';
      continue;
    }
    steps.push({ compound: parseCompound(token), combinator });
    combinator = ' ';
  }
  return steps;
}

/** `steps[i].combinator` describes how step `i` relates to step `i - 1`. */
function matchesChain(element, steps, index) {
  if (index < 0) return true;
  if (!matchesCompound(element, steps[index].compound)) return false;
  if (index === 0) return true;
  if (steps[index].combinator === '>') {
    const parent = element.parentElement;
    return parent ? matchesChain(parent, steps, index - 1) : false;
  }
  let node = element.parentElement;
  while (node) {
    if (matchesChain(node, steps, index - 1)) return true;
    node = node.parentElement;
  }
  return false;
}

function matchesCompound(element, spec) {
  if (!element || element.nodeType !== 1) return false;
  if (spec.tag && element.tagName !== spec.tag) return false;
  if (spec.id && element.getAttribute('id') !== spec.id) return false;
  for (const name of spec.classes) {
    if (!element.classList.contains(name)) return false;
  }
  for (const attr of spec.attrs) {
    if (attr.value === null) {
      if (!element.hasAttribute(attr.name)) return false;
    } else if (element.getAttribute(attr.name) !== attr.value) {
      return false;
    }
  }
  return true;
}

function matchesSelector(element, selector) {
  return splitSelector(selector).some((group) => {
    const steps = parseChain(group);
    return matchesChain(element, steps, steps.length - 1);
  });
}

class ClassList {
  constructor(element) {
    this.element = element;
    this.tokens = new Set();
  }

  contains(token) {
    return this.tokens.has(token);
  }

  add(...tokens) {
    for (const token of tokens) this.tokens.add(token);
    this.sync();
  }

  remove(...tokens) {
    for (const token of tokens) this.tokens.delete(token);
    this.sync();
  }

  toggle(token, force) {
    const enabled = force === undefined ? !this.contains(token) : Boolean(force);
    if (enabled) this.tokens.add(token);
    else this.tokens.delete(token);
    this.sync();
    return enabled;
  }

  sync() {
    this.element._attrs.set('class', [...this.tokens].join(' '));
  }

  toString() {
    return [...this.tokens].join(' ');
  }
}

class TextNode {
  constructor(text) {
    this.nodeType = 3;
    this.nodeValue = text;
    this.parentNode = null;
  }

  get textContent() {
    return this.nodeValue;
  }

  set textContent(value) {
    this.nodeValue = String(value);
  }
}

class Element {
  constructor(tagName, ownerDocument) {
    this.nodeType = 1;
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.childNodes = [];
    this._attrs = new Map();
    this._listeners = new Map();
    this.classList = new ClassList(this);
    this.dataset = {};
    this.style = { overflow: '', position: '', top: '', left: '', opacity: '', display: '' };
    this.value = '';
    this.scrollTop = 0;
    this._html = null;
  }

  get parentElement() {
    return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null;
  }

  get children() {
    return this.childNodes.filter((node) => node.nodeType === 1);
  }

  get id() {
    return this.getAttribute('id') ?? '';
  }

  set id(value) {
    this.setAttribute('id', String(value));
  }

  get className() {
    return this.classList.toString();
  }

  set className(value) {
    this.classList.tokens = new Set(String(value).split(/\s+/).filter(Boolean));
    this.classList.sync();
  }

  get hidden() {
    return this.hasAttribute('hidden');
  }

  set hidden(value) {
    if (value) this.setAttribute('hidden', '');
    else this.removeAttribute('hidden');
  }

  /* `img.src` reflects the attribute in a browser; the widget relies on that. */
  get src() {
    return this.getAttribute('src') ?? '';
  }

  set src(value) {
    this.setAttribute('src', String(value));
  }

  get textContent() {
    return this.childNodes.map((node) => node.textContent).join('');
  }

  set textContent(value) {
    this.childNodes = [];
    this._html = null;
    if (value !== '' && value !== null && value !== undefined) {
      const node = new TextNode(String(value));
      node.parentNode = this;
      this.childNodes.push(node);
    }
  }

  get innerHTML() {
    return this._html ?? this.childNodes.map((node) => (node.nodeType === 1 ? node.outerHTML : node.nodeValue)).join('');
  }

  set innerHTML(html) {
    this._html = String(html);
    this.childNodes = parseNodes(this._html, this.ownerDocument).map((node) => {
      node.parentNode = this;
      return node;
    });
  }

  get outerHTML() {
    const attrs = [...this._attrs.entries()]
      .map(([name, value]) => (value === '' ? ` ${name}` : ` ${name}="${value}"`))
      .join('');
    const tag = this.tagName.toLowerCase();
    if (VOID_ELEMENTS.has(tag)) return `<${tag}${attrs}>`;
    return `<${tag}${attrs}>${this.innerHTML}</${tag}>`;
  }

  setAttribute(name, value) {
    const text = String(value);
    this._attrs.set(name, text);
    if (name === 'class') {
      this.classList.tokens = new Set(text.split(/\s+/).filter(Boolean));
    }
    if (name.startsWith('data-')) {
      const key = name
        .slice(5)
        .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[key] = text;
    }
  }

  getAttribute(name) {
    if (name === 'class') return this.className;
    return this._attrs.has(name) ? this._attrs.get(name) : null;
  }

  hasAttribute(name) {
    return this._attrs.has(name);
  }

  removeAttribute(name) {
    this._attrs.delete(name);
    if (name.startsWith('data-')) {
      const key = name
        .slice(5)
        .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      delete this.dataset[key];
    }
  }

  appendChild(node) {
    if (node.parentNode) node.remove();
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }

  remove() {
    const parent = this.parentNode;
    if (!parent) return;
    const index = parent.childNodes.indexOf(this);
    if (index >= 0) parent.childNodes.splice(index, 1);
    this.parentNode = null;
  }

  matches(selector) {
    return matchesSelector(this, selector);
  }

  closest(selector) {
    let node = this;
    while (node && node.nodeType === 1) {
      if (matchesSelector(node, selector)) return node;
      node = node.parentNode;
    }
    return null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    const groups = splitSelector(selector).map(parseChain);
    const found = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (groups.some((steps) => matchesChain(child, steps, steps.length - 1))) {
          found.push(child);
        }
        walk(child);
      }
    };
    walk(this);
    return found;
  }

  addEventListener(type, handler, options) {
    const capture = options === true || Boolean(options && options.capture);
    const list = this._listeners.get(type) ?? [];
    list.push({ handler, capture });
    this._listeners.set(type, list);
  }

  removeEventListener(type, handler, options) {
    const capture = options === true || Boolean(options && options.capture);
    const list = this._listeners.get(type) ?? [];
    this._listeners.set(
      type,
      list.filter((entry) => entry.handler !== handler || entry.capture !== capture),
    );
  }

  listenerCount(type) {
    if (type) return (this._listeners.get(type) ?? []).length;
    let total = 0;
    for (const list of this._listeners.values()) total += list.length;
    return total;
  }

  dispatchEvent(event) {
    const evt = typeof event === 'string' ? { type: event } : event;
    defineEventField(evt, 'target', this);
    defineEventField(evt, 'defaultPrevented', false);
    defineEventField(evt, 'propagationStopped', false);
    if (typeof evt.preventDefault !== 'function') evt.preventDefault = () => { evt.defaultPrevented = true; };
    if (typeof evt.stopPropagation !== 'function') evt.stopPropagation = () => { evt.propagationStopped = true; };

    const path = [];
    let node = this;
    while (node) {
      path.push(node);
      node = node.parentNode;
    }

    const run = (current, capture) => {
      defineEventField(evt, 'currentTarget', current);
      const list = current._listeners ? current._listeners.get(evt.type) ?? [] : [];
      for (const entry of [...list]) {
        if (entry.capture !== capture) continue;
        entry.handler.call(current, evt);
        if (evt.propagationStopped) return;
      }
    };

    for (let index = path.length - 1; index > 0; index -= 1) run(path[index], true);
    evt.currentTarget = path[0];
    const targetList = path[0]._listeners ? path[0]._listeners.get(evt.type) ?? [] : [];
    for (const entry of [...targetList]) {
      entry.handler.call(path[0], evt);
      if (evt.propagationStopped) return !evt.defaultPrevented;
    }
    if (evt.bubbles === false) return !evt.defaultPrevented;
    for (let index = 1; index < path.length; index += 1) run(path[index], false);
    return !evt.defaultPrevented;
  }

  click() {
    this.dispatchEvent({ type: 'click', bubbles: true, target: this });
  }

  focus() {
    if (this.ownerDocument) this.ownerDocument.activeElement = this;
  }

  blur() {}

  select() {}

  setSelectionRange() {}

  get isConnected() {
    let node = this;
    while (node.parentNode) node = node.parentNode;
    return node.nodeType === 9;
  }
}

class Document extends Element {
  constructor() {
    super('#document', null);
    this.nodeType = 9;
    this.ownerDocument = this;
    this.title = '';
    this.activeElement = null;
    this.currentScript = null;
    this.defaultView = null;
    this.execCommandResult = true;
    this.clipboardText = '';
  }

  createElement(tagName) {
    return new Element(tagName, this);
  }

  createTextNode(text) {
    return new TextNode(String(text));
  }

  execCommand(command) {
    if (String(command).toLowerCase() === 'copy') {
      const area = this.querySelector('textarea');
      this.clipboardText = area ? area.value : '';
      return this.execCommandResult;
    }
    return false;
  }

  get documentElement() {
    return this.children.find((child) => child.tagName === 'HTML') ?? null;
  }

  get body() {
    return this.documentElement ? this.documentElement.querySelector('body') : null;
  }
}

const TOKEN = /<\/?([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
const ATTRIBUTE = /([\w-:.]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g;

function parseNodes(html, ownerDocument) {
  const nodes = [];
  const stack = [];
  const append = (node) => {
    const parent = stack[stack.length - 1];
    if (parent) {
      parent.childNodes.push(node);
      node.parentNode = parent;
    } else {
      nodes.push(node);
    }
  };

  TOKEN.lastIndex = 0;
  let lastIndex = 0;
  let match;
  while ((match = TOKEN.exec(html)) !== null) {
    const text = html.slice(lastIndex, match.index);
    if (text.trim()) append(new TextNode(decodeEntities(text)));
    lastIndex = TOKEN.lastIndex;

    const [raw, rawTag, rawAttributes] = match;
    const tag = rawTag.toLowerCase();
    if (raw.startsWith('</')) {
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        if (stack[index].tagName === tag.toUpperCase()) {
          stack.length = index;
          break;
        }
      }
      continue;
    }

    const element = ownerDocument.createElement(tag);
    ATTRIBUTE.lastIndex = 0;
    let attr;
    while ((attr = ATTRIBUTE.exec(rawAttributes)) !== null) {
      const name = attr[1];
      if (!name || name === '/') continue;
      const rawValue = attr[2];
      const quoted = rawValue && (rawValue.startsWith('"') || rawValue.startsWith("'"));
      element.setAttribute(name, quoted ? decodeEntities(rawValue.slice(1, -1)) : decodeEntities(rawValue ?? ''));
    }
    append(element);
    if (!VOID_ELEMENTS.has(tag) && !raw.endsWith('/>')) stack.push(element);
  }

  const tail = html.slice(lastIndex);
  if (tail.trim()) append(new TextNode(decodeEntities(tail)));
  return nodes;
}

/**
 * Builds a document plus the globals the widget reads. `location.href`,
 * `navigator.clipboard` and `window.open` are all injectable, so a test can drive
 * the clipboard and the share window without a browser.
 */
export function createEnvironment(options = {}) {
  const document = new Document();
  document.innerHTML = options.html ?? '<html><body></body></html>';

  const opened = [];
  const window = {
    location: { href: options.href ?? 'https://example.com/page?a=1&b=2' },
    open(url, target) {
      if (typeof options.open === 'function') return options.open(url, target);
      opened.push(url);
      return { opener: null, closed: false };
    },
  };
  document.defaultView = window;

  const navigator = {
    clipboard:
      options.clipboard === null
        ? undefined
        : {
            text: '',
            async writeText(text) {
              if (typeof options.clipboard === 'function') return options.clipboard(text);
              this.text = text;
            },
          },
  };

  class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
      this.bubbles = Boolean(init.bubbles);
    }
  }

  if (document.body) document.activeElement = document.body;

  return { document, window, navigator, opened, CustomEvent, Event: FakeEvent };
}

class FakeEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.bubbles = init.bubbles !== false;
    this.target = init.target ?? null;
    this.key = init.key;
  }
}

/** The globals the bundles expect, ready to be used as a `vm` sandbox. */
export function createSandbox(environment) {
  return {
    document: environment.document,
    window: environment.window,
    navigator: environment.navigator,
    CustomEvent: environment.CustomEvent,
    Event: environment.Event,
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    queueMicrotask,
    console: { warn() {}, log() {}, error() {} },
  };
}
