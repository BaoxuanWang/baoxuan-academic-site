import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { textFromHtml } from './update-submissions.mjs';

const siteData = 'https://baoxuanwang.github.io/baoxuan-academic-site/funding-data.js';
const hash = text => createHash('sha256').update(text).digest('hex');
const dateKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function readSnapshot(text) {
  const match = text.match(/window\.BAOXUAN_FUNDING\s*=\s*({[\s\S]*});?\s*$/);
  if (!match) throw new Error('Invalid funding snapshot');
  return JSON.parse(match[1]);
}
export function mergeMonitoring(current, previous) {
  if (!previous || previous.schemaVersion !== current.schemaVersion || previous.curatedDate !== current.curatedDate) return current;
  for (const item of current.monitors) {
    const old = previous.monitors.find(x => x.id === item.id);
    if (!old) continue;
    for (const key of ['lastHash', 'seenLinks', 'lastSuccess', 'hasUnreviewedChange']) if (old[key] != null) item[key] = old[key];
  }
  current.updates = previous.updates || current.updates;
  if (previous.platformWindow) current.platformWindow = previous.platformWindow;
  return current;
}
export function noticeLinks(html, source) {
  const keyword = new RegExp(source.keywords || '申报|基金|资助|博士后|人才');
  const year = new Date().getFullYear();
  const found = new Map();
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const title = textFromHtml(match[2]);
    if (title.length < 8 || title.length > 220 || !keyword.test(title)) continue;
    try {
      const url = new URL(match[1].replace(/&amp;/g, '&'), source.url);
      if (!['https:', 'http:'].includes(url.protocol) || url.hostname !== new URL(source.url).hostname) continue;
      if (!String(title + url.href).includes(String(year)) && !String(title + url.href).includes(String(year + 1))) continue;
      url.hash = ''; found.set(url.href, { title, url: url.href });
    } catch {}
  }
  return [...found.values()].slice(0, 60);
}
function articleText(html) {
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];
  const text = textFromHtml(article || html)
    .replace(/(?:阅读次数|访问量|浏览次数)\s*[:：]?\s*\d*/g, '')
    .replace(/\s+/g, ' ').trim();
  if (text.length < 120 || /^(Access Denied|Just a moment|Verify you are human)/i.test(text)) throw new Error('No readable official content');
  return text;
}
function ningboContent(json) {
  const data = json.data;
  if (!data?.admPolicyInfoNewAddVo || !data?.admPolicyApplyOpenVo) throw new Error('No official policy data');
  const strings = [];
  const collect = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'string' && /name|title|content|condition|standard|object|material|description|interpret|policy/i.test(key)) strings.push(textFromHtml(item));
      else if (item && typeof item === 'object') collect(item);
    }
  };
  collect(data.admPolicyInfoNewAddVo); collect(data.admPolicyInterpretVo);
  const w = data.admPolicyApplyOpenVo;
  return { text: strings.join('\n') + JSON.stringify([w.applyStartTime, w.applyEndTime, w.applyStatusDesc]), window: { start: w.applyStartTime?.slice(0, 10), end: w.applyEndTime?.slice(0, 10), status: w.applyStatusDesc, checkedDate: dateKey() } };
}
function addUpdate(data, update) {
  const key = `${update.kind}:${update.url}:${update.hash || ''}`;
  if (!data.updates.some(item => item.key === key)) data.updates.unshift({ ...update, key, detectedDate: dateKey() });
  data.updates = data.updates.slice(0, 60);
}
export async function checkSource(source, data) {
  source.lastAttempt = new Date().toISOString();
  try {
    const response = await fetch(source.fetchUrl || source.url, { signal: AbortSignal.timeout(18000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    let content;
    if (source.kind === 'ningbo-api') {
      const result = ningboContent(await response.json()); content = result.text;
      if (result.window.start && result.window.end) data.platformWindow = result.window;
    } else {
      const html = source.kind === 'index-json' ? (await response.json()).data?.html : await response.text();
      if (typeof html !== 'string') throw new Error('No public notice-list content');
      content = articleText(html);
      if (source.kind.startsWith('index')) {
        const links = noticeLinks(html, source);
        if (source.seenLinks) for (const item of links) if (!source.seenLinks.includes(item.url)) addUpdate(data, { kind: 'new-notice', title: item.title, url: item.url });
        source.seenLinks = [...new Set([...(source.seenLinks || []), ...links.map(x => x.url)])].slice(-300);
        content = links.map(x => `${x.url} ${x.title}`).join('\n') || content;
      }
    }
    const nextHash = hash(content);
    if (!source.kind.startsWith('index') && source.lastHash && source.lastHash !== nextHash) {
      source.hasUnreviewedChange = true;
      addUpdate(data, { kind: 'changed-content', title: `${source.name}：来源内容发生变化`, url: source.url, hash: nextHash });
    }
    source.lastHash = nextHash; source.lastSuccess = new Date().toISOString(); source.lastStatus = 'ok'; delete source.lastError;
  } catch (error) {
    source.lastStatus = 'unavailable'; source.lastError = error.message;
    console.warn(`${source.id}: retained reviewed policy (${error.message})`);
  }
}
async function main() {
  const target = resolve('dist/funding-data.js');
  const data = readSnapshot(await readFile(target, 'utf8'));
  try {
    const response = await fetch(`${siteData}?monitor=${Date.now()}`, { signal: AbortSignal.timeout(10000), cache: 'no-store' });
    if (response.ok) mergeMonitoring(data, readSnapshot(await response.text()));
  } catch { console.warn('Previous public monitor state unavailable; using source snapshot.'); }
  for (let start = 0; start < data.monitors.length; start += 4) await Promise.all(data.monitors.slice(start, start + 4).map(source => checkSource(source, data)));
  data.generatedAt = new Date().toISOString();
  await writeFile(target, `window.BAOXUAN_FUNDING=${JSON.stringify(data, null, 2)};\n`, 'utf8');
  console.log(`Funding monitoring: ${data.monitors.filter(x => x.lastStatus === 'ok').length}/${data.monitors.length} official sources read; ${data.updates.length} change notices queued. Curated rules unchanged.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
