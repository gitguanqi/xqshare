export function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'assertion failed');
  }
}

// `checks.js` runs inside the browser, so it cannot import `node:assert`. The
// richer matchers below are tiny re-implementations kept in plain JS so the same
// `assert.equal(a, b)` / `assert.match(s, re)` calls work both here and in the
// Node test files that use the real `node:assert`.
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === 'object') {
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    return ak.every((key) => deepEqual(a[key], b[key]));
  }
  return false;
}
assert.equal = (actual, expected, message) =>
  assert(actual === expected, message || `expected ${expected}, got ${actual}`);
assert.strictEqual = assert.equal;
assert.notEqual = (actual, expected, message) =>
  assert(actual !== expected, message || `expected not ${expected}, got ${actual}`);
assert.deepEqual = (actual, expected, message) =>
  assert(deepEqual(actual, expected), message || 'deep equality failed');
assert.notDeepEqual = (actual, expected, message) =>
  assert(!deepEqual(actual, expected), message || 'expected values to differ');
assert.ok = (value, message) => assert(Boolean(value), message || 'expected a truthy value');
assert.match = (value, pattern, message) =>
  assert(
    typeof value === 'string' && pattern instanceof RegExp && pattern.test(value),
    message || `expected ${value} to match ${pattern}`,
  );
assert.throws = (fn, message) => {
  try {
    fn();
  } catch {
    return;
  }
  assert(false, message || 'expected the function to throw');
};
assert.doesNotThrow = (fn, message) => {
  try {
    fn();
  } catch (error) {
    assert(false, message || `expected the function not to throw: ${error}`);
  }
};
assert.fail = (message) => assert(false, message || 'fail() called');

export function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function click(root, selector) {
  const element = root.querySelector(selector);
  assert(element, `missing control: ${selector}`);
  element.click();
  return element;
}

export function waitFor(check, message, timeout = 4000) {
  const started = performance.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      try {
        if (check()) {
          resolve();
          return;
        }
      } catch {
        // Keep polling until the timeout reports the final failure.
      }
      if (performance.now() - started > timeout) {
        reject(new Error(message));
        return;
      }
      setTimeout(poll, 25);
    };
    poll();
  });
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

export function createCheckRunner({ page }) {
  const summary = document.querySelector('#summary');
  const list = document.querySelector('#checks');
  const details = document.querySelector('#details');
  const state = {
    page,
    status: 'running',
    checks: [],
    errors: [],
  };
  window.__XQSHARE_TEST__ = state;
  let finished = false;

  const setBadge = (status) => {
    if (!summary) return;
    summary.dataset.status = status;
    summary.className = `status-badge is-${status}`;
    summary.textContent =
      status === 'passed' ? 'PASS' : status === 'failed' ? 'FAIL' : 'RUNNING';
  };

  const failSurface = (error) => {
    const message = formatError(error);
    state.errors.push(message);
    if (finished) {
      state.status = 'failed';
      setBadge('failed');
      if (details) details.textContent = state.errors.join('\n');
    }
  };

  window.addEventListener('error', (event) => failSurface(event.error ?? event.message));
  window.addEventListener('unhandledrejection', (event) => failSurface(event.reason));
  setBadge('running');

  return {
    async run(checks) {
      let passed = 0;
      let failed = 0;

      for (const [name, check] of checks) {
        const item = document.createElement('li');
        item.className = 'check-item';
        item.dataset.testStatus = 'pending';
        const label = document.createElement('span');
        label.textContent = name;
        const badge = document.createElement('strong');
        badge.className = 'check-badge';
        badge.textContent = 'PENDING';
        item.append(label, badge);
        list.append(item);

        try {
          await check();
          item.dataset.testStatus = 'pass';
          item.className = 'check-item is-pass';
          badge.textContent = 'PASS';
          state.checks.push({ name, status: 'pass' });
          passed++;
        } catch (error) {
          const message = formatError(error);
          item.dataset.testStatus = 'fail';
          item.className = 'check-item is-fail';
          badge.textContent = 'FAIL';
          state.checks.push({ name, status: 'fail', message });
          state.errors.push(`${name}: ${message}`);
          failed++;
        }
      }

      finished = true;
      if (state.errors.length > 0) {
        failed = Math.max(failed, 1);
      }
      state.status = failed === 0 ? 'passed' : 'failed';
      setBadge(state.status);
      if (details) {
        details.textContent = `${passed} passed, ${failed} failed. ${
          state.errors.length > 0 ? state.errors.join(' | ') : 'No page errors.'
        }`;
      }
      return state.status;
    },
  };
}
