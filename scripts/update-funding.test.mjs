import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSnapshot, noticeLinks, mergeMonitoring, checkSource } from './update-funding.mjs';

test('snapshot is parsed as JSON and does not execute script content', () => {
  assert.equal(readSnapshot('window.BAOXUAN_FUNDING={"schemaVersion":1};').schemaVersion, 1);
  assert.throws(() => readSnapshot('window.BAOXUAN_FUNDING={}; console.log("unexpected")'));
});
test('new notices must match keywords, year and official source host', () => {
  const year = new Date().getFullYear();
  const html = `<a href="/${year}/new.html">${year + 1}年度博士后基金申报通知</a><a href="https://example.net/${year}/new.html">${year + 1}年度博士后基金申报通知</a><a href="/${year}/news.html">无关新闻新闻新闻</a>`;
  const result = noticeLinks(html, { url: 'https://example.edu.cn/', keywords: '基金' });
  assert.equal(result.length, 1); assert.equal(result[0].url, `https://example.edu.cn/${year}/new.html`);
});
test('monitor state carries across deploys, but new curated versions reset it', () => {
  const previous = { schemaVersion: 1, curatedDate: 'version-a', monitors: [{ id: 'a', lastHash: 'previous' }], updates: [{ title: 'pending' }] };
  const current = { schemaVersion: 1, curatedDate: 'version-a', monitors: [{ id: 'a' }], programs: [{ deadline: 'fixed' }] };
  mergeMonitoring(current, previous); assert.equal(current.monitors[0].lastHash, 'previous'); assert.equal(current.programs[0].deadline, 'fixed');
  const fresh = { schemaVersion: 1, curatedDate: 'version-b', monitors: [{ id: 'a' }] };
  mergeMonitoring(fresh, previous); assert.equal(fresh.monitors[0].lastHash, undefined);
});
test('changed source is queued without silently changing eligibility or deadlines', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, text: async () => '<article>' + '公开政策正文资格条件申报时间。'.repeat(20) + '</article>' });
  try {
    const data = { programs: [{ deadline: '2026-12-10' }], updates: [] };
    const source = { id: 'a', url: 'https://example.edu.cn/', name: '通知', kind: 'notice', lastHash: 'old' };
    await checkSource(source, data); assert.equal(source.lastStatus, 'ok'); assert.equal(source.hasUnreviewedChange, true); assert.equal(data.updates.length, 1); assert.equal(data.programs[0].deadline, '2026-12-10');
  } finally { globalThis.fetch = original; }
});
test('access failures preserve the last successful check', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 403 });
  try {
    const source = { id: 'a', url: 'https://example.edu.cn/', lastHash: 'old', lastSuccess: 'previous' };
    await checkSource(source, { updates: [] }); assert.equal(source.lastHash, 'old'); assert.equal(source.lastSuccess, 'previous'); assert.equal(source.lastStatus, 'unavailable');
  } finally { globalThis.fetch = original; }
});
