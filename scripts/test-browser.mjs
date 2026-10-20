import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createTestServer } from './demo-server.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pages = ['browser.html', 'esm.html', 'vue2.html', 'vue3.html'];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function connectCdp(url) {
  return new Promise((resolveConnection, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    const handlers = new Map();
    let nextId = 0;

    socket.addEventListener('open', () => {
      resolveConnection({
        send(method, params = {}, sessionId) {
          const id = ++nextId;
          return new Promise((resolveMessage, rejectMessage) => {
            const timer = setTimeout(() => {
              pending.delete(id);
              rejectMessage(new Error(`CDP timeout: ${method}`));
            }, 15000);
            pending.set(id, { resolve: resolveMessage, reject: rejectMessage, timer });
            socket.send(JSON.stringify({ id, method, params, sessionId }));
          });
        },
        on(method, handler) {
          const list = handlers.get(method) ?? [];
          list.push(handler);
          handlers.set(method, list);
          return () => {
            handlers.set(
              method,
              (handlers.get(method) ?? []).filter((item) => item !== handler),
            );
          };
        },
        close() {
          socket.close();
        },
      });
    });

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const request = pending.get(message.id);
        if (!request) return;
        clearTimeout(request.timer);
        pending.delete(message.id);
        if (message.error) {
          request.reject(new Error(message.error.message));
        } else {
          request.resolve(message.result);
        }
        return;
      }

      for (const handler of handlers.get(message.method) ?? []) {
        handler(message);
      }
    });

    socket.addEventListener('error', () => reject(new Error('Unable to connect to browser CDP')));
  });
}

function waitForDevtoolsUrl(child) {
  return new Promise((resolveUrl, reject) => {
    let output = '';
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for browser DevTools.\n${output}`));
    }, 15000);

    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        clearTimeout(timer);
        resolveUrl(match[1]);
      }
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Browser exited before DevTools was ready (code ${code}).\n${output}`));
    });
  });
}

async function verifyPage(browser, baseUrl, page) {
  const errors = [];
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.send('Target.attachToTarget', {
    targetId,
    flatten: true,
  });
  const offs = [];

  try {
    await Promise.all([
      browser.send('Page.enable', {}, sessionId),
      browser.send('Runtime.enable', {}, sessionId),
      browser.send('Log.enable', {}, sessionId),
      browser.send(
        'Emulation.setDeviceMetricsOverride',
        { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false },
        sessionId,
      ),
    ]);

    offs.push(
      browser.on('Runtime.exceptionThrown', (event) => {
        const detail = event.params.exceptionDetails;
        errors.push(detail.exception?.description ?? detail.text ?? 'Uncaught exception');
      }),
      browser.on('Runtime.consoleAPICalled', (event) => {
        if (event.params.type === 'error' || event.params.type === 'assert') {
          const text = event.params.args
            .map((argument) => argument.value ?? argument.description ?? '')
            .join(' ');
          errors.push(text || `console.${event.params.type}`);
        }
      }),
      browser.on('Log.entryAdded', (event) => {
        if (event.params.entry.level === 'error') {
          errors.push(event.params.entry.text);
        }
      }),
    );

    await browser.send('Page.navigate', { url: `${baseUrl}/test/${page}` }, sessionId);

    const deadline = Date.now() + 30000;
    let state = null;
    while (Date.now() < deadline) {
      try {
        const evaluated = await browser.send(
          'Runtime.evaluate',
          {
            expression: 'window.__XQSHARE_TEST__ ?? null',
            returnByValue: true,
            awaitPromise: true,
          },
          sessionId,
        );
        state = evaluated.result.value;
        if (state && state.status !== 'running') break;
      } catch {
        // Navigation briefly replaces the execution context.
      }
      await sleep(200);
    }

    if (!state || state.status === 'running') {
      throw new Error('test runner did not finish within 30 seconds');
    }
    if (state.status !== 'passed') {
      throw new Error(state.errors.join(' | ') || 'the page reported a failure');
    }

    await browser.send(
      'Emulation.setDeviceMetricsOverride',
      { width: 390, height: 844, deviceScaleFactor: 1, mobile: true },
      sessionId,
    );
    await sleep(150);
    const layout = await browser.send(
      'Runtime.evaluate',
      {
        expression:
          '({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth })',
        returnByValue: true,
      },
      sessionId,
    );
    const { scrollWidth, innerWidth } = layout.result.value;
    if (scrollWidth > innerWidth + 1) {
      throw new Error(`390px viewport overflows (${scrollWidth}px > ${innerWidth}px)`);
    }

    const combinedErrors = [...state.errors, ...errors].filter(Boolean);
    if (combinedErrors.length > 0) {
      throw new Error(combinedErrors.join(' | '));
    }

    return { checks: state.checks.length };
  } finally {
    offs.forEach((off) => off());
    await browser.send('Target.closeTarget', { targetId }).catch(() => undefined);
  }
}

const executable = findBrowser();
if (!executable) {
  console.error('xqshare: no Chrome or Edge executable found; set CHROME_PATH to run browser checks.');
  process.exitCode = 1;
} else {
  const server = createTestServer({ root });
  let browserProcess;
  let cdp;
  let profile;

  try {
    await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    profile = await mkdtemp(join(tmpdir(), 'xqshare-browser-'));
    browserProcess = spawn(
      executable,
      [
        '--headless=new',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-background-networking',
        '--disable-component-update',
        '--no-first-run',
        '--no-default-browser-check',
        '--remote-allow-origins=*',
        '--remote-debugging-port=0',
        `--user-data-dir=${profile}`,
        'about:blank',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true },
    );
    const devtoolsUrl = await waitForDevtoolsUrl(browserProcess);
    cdp = await connectCdp(devtoolsUrl);

    console.log(`xqshare: browser ${basename(executable)}`);
    let failures = 0;
    for (const page of pages) {
      try {
        const result = await verifyPage(cdp, baseUrl, page);
        console.log(`PASS ${page}: ${result.checks} checks, no overflow at 390px`);
      } catch (error) {
        failures++;
        console.error(`FAIL ${page}: ${error.message}`);
      }
    }

    if (failures > 0) {
      process.exitCode = 1;
    } else {
      console.log('xqshare: all browser pages passed.');
    }
  } catch (error) {
    console.error(`xqshare: browser check failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    cdp?.close();
    if (browserProcess && browserProcess.exitCode === null) {
      const exited = new Promise((resolveExit) => browserProcess.once('exit', resolveExit));
      browserProcess.kill();
      await Promise.race([exited, sleep(3000)]);
    }
    await new Promise((resolveClose) => server.close(resolveClose));
    if (profile) {
      const resolvedProfile = resolve(profile);
      const resolvedTemp = resolve(tmpdir());
      if (resolvedProfile.startsWith(resolvedTemp + sep)) {
        let cleanupError;
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            await rm(resolvedProfile, { recursive: true, force: true });
            cleanupError = null;
            break;
          } catch (error) {
            cleanupError = error;
            await sleep(200 * (attempt + 1));
          }
        }
        if (cleanupError) {
          console.warn(`xqshare: temporary browser profile was not fully removed: ${cleanupError.message}`);
        }
      }
    }
  }
}
