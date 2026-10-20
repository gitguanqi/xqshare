import type { ResolvedOptions, ShareMode } from './types';
import { getShareTarget } from './share-url';

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes text that is interpolated into markup or into an attribute value. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);
}

/**
 * The snippet a consumer embeds elsewhere. It is copied as text, so it only has
 * to survive being escaped once into the `value` attribute.
 */
export function buildIframeSnippet(url: string): string {
  const safe = url.replace(/"/g, '%22');
  return `<iframe src="${safe}" frameborder="0" width="100%" height="500"></iframe>`;
}

function renderTitleRow(mode: ShareMode): string {
  if (mode !== 'pop') return '';
  return (
    '<div class="xqshare-title">' +
    '<span>分享预览页面</span>' +
    '<button type="button" class="xqshare-close" data-action="close" aria-label="关闭">×</button>' +
    '</div>'
  );
}

function renderTip(mode: ShareMode): string {
  if (mode === 'pop') return '';
  if (mode === 'slide') {
    return (
      '<button type="button" class="xqshare-tip" data-action="toggle" ' +
      'aria-expanded="false">分享至</button>'
    );
  }
  // In the inline bar the label is decorative: the list is always open.
  return '<span class="xqshare-tip">分享至</span>';
}

function renderItems(options: ResolvedOptions): string {
  const items: string[] = [];
  for (const name of options.targets) {
    const target = getShareTarget(name);
    if (!target) continue;
    const icon = `${options.iconBase}${target.icon}`;
    items.push(
      '<li>' +
        `<button type="button" class="xqshare-item" data-share="${escapeHtml(target.name)}">` +
        `<img src="${escapeHtml(icon)}" alt="" width="25" height="25" decoding="async" ` +
        `data-icon="${escapeHtml(target.icon)}">` +
        `<span>${escapeHtml(target.label)}</span>` +
        '</button>' +
        '</li>',
    );
  }
  return `<ul class="xqshare-ls">${items.join('')}</ul>`;
}

function renderUrls(options: ResolvedOptions): string {
  if (options.type !== 'pop') return '';
  const url = escapeHtml(options.url);
  const iframe = escapeHtml(buildIframeSnippet(options.url));
  return (
    '<div class="xqshare-urls">' +
    '<p class="xqshare-url-row">' +
    '<span class="xqshare-url-label">预览地址</span>' +
    `<input class="xqshare-input" type="text" readonly data-field="url" value="${url}">` +
    '<button type="button" class="xqshare-copy" data-copy="url">复制</button>' +
    '</p>' +
    '<p class="xqshare-url-row">' +
    '<span class="xqshare-url-label">嵌入代码</span>' +
    `<input class="xqshare-input" type="text" readonly data-field="iframe" value="${iframe}">` +
    '<button type="button" class="xqshare-copy" data-copy="iframe">复制</button>' +
    '</p>' +
    '</div>'
  );
}

/**
 * Renders the widget markup.
 *
 * Two rules are load-bearing:
 * - no `id` attributes, because a page may host several instances;
 * - every hook is a `data-*` attribute resolved with `closest()` from the click
 *   target, so the markup is never queried globally.
 */
export function renderMarkup(options: ResolvedOptions): string {
  const mode = options.type;
  const dialog =
    mode === 'pop' ? ' role="dialog" aria-modal="true" aria-label="分享"' : '';
  return (
    `<div class="xqshare-box ${mode}" data-mode="${mode}"${dialog}>` +
    '<div class="xqshare-inner">' +
    renderTitleRow(mode) +
    renderTip(mode) +
    renderItems(options) +
    renderUrls(options) +
    '<p class="xqshare-status" role="status" aria-live="polite"></p>' +
    '</div>' +
    '</div>'
  );
}
