import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const target = resolve('dist/conferences.js');
const source = await readFile(target, 'utf8');
const match = source.match(/window\.BAOXUAN_CONFERENCES\s*=\s*({[\s\S]*});?\s*$/);
if (!match) throw new Error('Unable to read dist/conferences.js');
const data = JSON.parse(match[1]);

const deadlineRules = {
  'marstruct-2027': [/extended to(?:\s+Friday)?\s+(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+(?:\s+\d{4})?)/i, 2026],
  'omae-2027': [/([A-Za-z]+\s+\d{1,2},\s+\d{4})\s+Abstract Submission/i, 2026],
  'isog-2026': [/Abstract Submission(?:\s+Image)?\s+(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})/i, 2026],
  'energy-geotechnics-2027': [/Abstract submission deadline:\s*(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})/i, 2026],
  'iceg-2027': [/Abstract submission deadline:\s*([A-Za-z]+\s+\d{1,2}(?:\s*\([^)]+\))?,\s+\d{4})/i, 2026],
  'iccm-2027': [/(\d{1,2}\s+[A-Za-z]+\s+\d{4})\s+(?:\||–|-)?\s*Abstract Submission Deadline/i, 2027],
  'ewtec-2027': [/Abstract deadline\s+(?:\||–|-)?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i, 2027],
  'otc-brasil-2027': [/([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})\s+Abstract Submission Deadline/i, 2027],
  'isope-2027': [/Abstract Deadline:\s*([A-Za-z]+\s+\d{1,2}(?:,\s+\d{4})?)/i, 2026]
};

const months = new Map(['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].map((name, index) => [name, index + 1]));

function htmlText(html) {
  return html
    .replace(/<script\b(?![^>]*application\/ld\+json)[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseEnglishDate(value, fallbackYear) {
  const clean = String(value || '')
    .replace(/\([^)]+\)/g, ' ')
    .replace(/(\d)(?:st|nd|rd|th)\b/gi, '$1')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  let month, day, year;
  let parts = clean.match(/^([A-Za-z]+)\s+(\d{1,2})(?:\s+(\d{4}))?$/);
  if (parts) { month = months.get(parts[1].slice(0, 3).toLowerCase()); day = Number(parts[2]); year = Number(parts[3] || fallbackYear); }
  else {
    parts = clean.match(/^(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?$/);
    if (parts) { day = Number(parts[1]); month = months.get(parts[2].slice(0, 3).toLowerCase()); year = Number(parts[3] || fallbackYear); }
  }
  if (!month || !day || !year) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function jsonLdEvents(html) {
  const events = [];
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
    if (types.some((type) => String(type).toLowerCase() === 'event')) events.push(value);
    for (const child of Object.values(value)) if (child && typeof child === 'object') visit(child);
  };
  for (const block of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(block[1])); } catch {}
  }
  return events;
}

function dateOnly(value) {
  if (!value) return null;
  const match = String(value).match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] || null;
}

function eventLocation(event) {
  const location = Array.isArray(event?.location) ? event.location[0] : event?.location;
  const address = location?.address || {};
  const parts = [location?.name, address.addressLocality, address.addressRegion, address.addressCountry].filter(Boolean);
  return [...new Set(parts)].join(', ');
}

async function refresh(item) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(item.source, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'BaoxuanAcademicSite/1.0 (+https://baoxuanwang.github.io/baoxuan-academic-site/)' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const text = htmlText(html);
    const rule = deadlineRules[item.id];
    if (rule) {
      const deadlineMatch = text.match(rule[0]);
      const parsed = parseEnglishDate(deadlineMatch?.[1], rule[1]);
      if (parsed) item.deadline = parsed;
    }
    const event = jsonLdEvents(html)[0];
    const start = dateOnly(event?.startDate), end = dateOnly(event?.endDate);
    if (start) item.dateStart = start;
    if (end) item.dateEnd = end;
    const location = eventLocation(event);
    if (location && location.length <= 140 && location !== item.locationEn) {
      item.locationEn = location;
      item.locationZh = location;
    }
    item.lastChecked = new Date().toISOString();
    item.sourceStatus = 'verified';
  } catch (error) {
    item.sourceStatus = 'cached';
    console.warn(`${item.id}: ${error.message}`);
  } finally { clearTimeout(timer); }
}

await Promise.all(data.items.map(refresh));
data.generatedAt = new Date().toISOString();
await writeFile(target, `window.BAOXUAN_CONFERENCES=${JSON.stringify(data, null, 2)};\n`, 'utf8');
console.log(`Updated ${data.items.filter((item) => item.sourceStatus === 'verified').length}/${data.items.length} conference sources.`);

