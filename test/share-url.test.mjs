import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_TARGETS,
  SHARE_TARGETS,
  buildShareUrl,
  getShareTarget,
  isShareTargetName,
} from '../lib/js/xqshare-esm.mjs';

const payload = {
  type: 'qq',
  url: 'https://example.com/post?id=1&from=xq#top',
  title: '标题 & 100% #tag',
  desc: '描述 with "quotes" & amp',
};

test('every default target builds an https url', () => {
  for (const name of DEFAULT_TARGETS) {
    const url = buildShareUrl(name, { ...payload, type: name });
    assert.equal(typeof url, 'string', `${name} should build a url`);
    assert.match(url, /^https:\/\//, `${name} must not use plain http`);
    // A parsed URL proves the query string is well formed, not just string-joined.
    assert.doesNotThrow(() => new URL(url));
  }
});

test('the default target list is the five historical icons', () => {
  assert.deepEqual([...DEFAULT_TARGETS], ['qq', 'qzone', 'weibo', 'douban', 'tieba']);
  assert.equal(SHARE_TARGETS.length, 6, 'wechat stays available as an opt-in target');
});

test('url, title and desc survive the round trip through the query string', () => {
  const url = buildShareUrl('qq', payload);
  const parsed = new URL(url);

  assert.equal(parsed.searchParams.get('url'), payload.url);
  assert.equal(parsed.searchParams.get('title'), payload.title);
  assert.equal(parsed.searchParams.get('desc'), payload.desc);
});

test('qzone carries the description that used to arrive as "undefined"', () => {
  const parsed = new URL(buildShareUrl('qzone', payload));
  assert.equal(parsed.searchParams.get('desc'), payload.desc);
  assert.equal(parsed.searchParams.get('summary'), payload.desc);
  assert.equal(parsed.searchParams.get('site'), payload.url);
  assert.ok(!buildShareUrl('qzone', payload).includes('undefined'));
});

test('empty description is omitted instead of sent as an empty parameter', () => {
  const parsed = new URL(buildShareUrl('qq', { ...payload, desc: '' }));
  assert.equal(parsed.searchParams.has('desc'), false);
  assert.equal(parsed.searchParams.get('title'), payload.title);
});

test('wechat has no endpoint, so callers fall back to copying', () => {
  assert.equal(buildShareUrl('wechat', payload), null);
  assert.equal(getShareTarget('wechat')?.build, null);
});

test('an unknown target returns null instead of throwing', () => {
  assert.equal(buildShareUrl('nope', payload), null);
  assert.equal(buildShareUrl('', payload), null);
  assert.equal(getShareTarget('constructor'), null);
  assert.equal(getShareTarget('__proto__'), null);
});

test('target names are validated as data, not truthy strings', () => {
  assert.equal(isShareTargetName('qq'), true);
  assert.equal(isShareTargetName('toString'), false);
  assert.equal(isShareTargetName(42), false);
  assert.equal(isShareTargetName(undefined), false);
});
