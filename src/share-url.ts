import type { SharePayload, ShareTargetName } from './types';

export interface ShareTargetDefinition {
  readonly name: ShareTargetName;
  /** Visible label under the icon. */
  readonly label: string;
  /** File name inside the icon directory. */
  readonly icon: string;
  /**
   * `null` means the destination has no web endpoint and the caller has to copy
   * the link instead of opening a window (that is the case for WeChat).
   */
  readonly build: ((payload: SharePayload) => string) | null;
}

function query(entries: ReadonlyArray<readonly [string, string]>): string {
  const search = new URLSearchParams();
  for (const [key, value] of entries) {
    if (value !== '') search.set(key, value);
  }
  return search.toString();
}

/**
 * The single source of truth for every destination. Each `build` receives an
 * already-trimmed payload and returns a fully encoded URL, so callers never
 * concatenate parameters by hand.
 */
export const SHARE_TARGETS: readonly ShareTargetDefinition[] = [
  {
    name: 'qq',
    label: 'QQ',
    icon: 'share_qq.png',
    build: ({ url, title, desc }) =>
      `https://connect.qq.com/widget/shareqq/iframe_index.html?${query([
        ['url', url],
        ['title', title],
        ['desc', desc],
      ])}`,
  },
  {
    name: 'qzone',
    label: '空间',
    icon: 'share_qzone.png',
    build: ({ url, title, desc }) =>
      `https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?${query([
        ['url', url],
        ['title', title],
        ['desc', desc],
        ['summary', desc],
        ['site', url],
      ])}`,
  },
  {
    name: 'weibo',
    label: '微博',
    icon: 'share_weibo.png',
    build: ({ url, title }) =>
      `https://service.weibo.com/share/share.php?${query([
        ['url', url],
        ['title', title],
        ['language', 'zh_cn'],
      ])}`,
  },
  {
    name: 'douban',
    label: '豆瓣',
    icon: 'share_douban.png',
    build: ({ url, title }) =>
      `https://shuo.douban.com/!service/share?${query([
        ['href', url],
        ['name', title],
      ])}`,
  },
  {
    name: 'tieba',
    label: '贴吧',
    icon: 'share_tieba.png',
    build: ({ url, title }) =>
      `https://tieba.baidu.com/f/commit/share/openShareApi?${query([
        ['title', title],
        ['url', url],
      ])}`,
  },
  {
    name: 'wechat',
    label: '微信',
    icon: 'share_wechat.png',
    build: null,
  },
];

/**
 * Rendered when `targets` is omitted: the five destinations the widget has
 * always shown. `wechat` stays available but opt-in, because it copies the link
 * instead of opening a share page.
 */
export const DEFAULT_TARGETS: readonly ShareTargetName[] = [
  'qq',
  'qzone',
  'weibo',
  'douban',
  'tieba',
];

const TARGET_INDEX: ReadonlyMap<string, ShareTargetDefinition> = new Map(
  SHARE_TARGETS.map((target) => [target.name, target]),
);

export function getShareTarget(name: string): ShareTargetDefinition | null {
  return TARGET_INDEX.get(name) ?? null;
}

export function isShareTargetName(name: unknown): name is ShareTargetName {
  return typeof name === 'string' && TARGET_INDEX.has(name);
}

/**
 * Builds the destination URL, or returns `null` when the destination has no
 * endpoint (`wechat`) or is not a known target. It never throws: an unknown
 * name used to crash the click handler.
 */
export function buildShareUrl(type: string, payload: SharePayload): string | null {
  const target = getShareTarget(type);
  if (!target || !target.build) return null;
  return target.build(payload);
}
