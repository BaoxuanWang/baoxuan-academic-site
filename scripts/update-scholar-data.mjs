import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const apiKey = process.env.SERPAPI_KEY?.trim();
const target = resolve('dist/scholar.js');
const authorId = 'D3S5UeAAAAAJ';

if (!apiKey) {
  console.log('SERPAPI_KEY is not configured; preserving Scholar data and using OpenAlex fallback.');
  process.exit(0);
}

function titleKey(value = '') {
  return String(value).toLowerCase().normalize('NFKD').replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
}

async function getJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Google Scholar service: HTTP ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data;
}

const worksSource = await readFile(resolve('dist/works.js'), 'utf8');
const match = worksSource.match(/window\.BAOXUAN_WORKS=(\[[\s\S]*?\]);/);
if (!match) throw new Error('Unable to read dist/works.js');
const works = JSON.parse(match[1]);
const byTitle = new Map(works.map((work) => [titleKey(work.title), work]));
const scholarWorks = {};
let start = 0;

while (start < 500) {
  const url = new URL('https://serpapi.com/search.json');
  for (const [key, value] of Object.entries({ engine: 'google_scholar_author', author_id: authorId, hl: 'en', num: '100', start: String(start), api_key: apiKey })) url.searchParams.set(key, value);
  const data = await getJson(url);
  const articles = data.articles || [];
  for (const article of articles) {
    const local = byTitle.get(titleKey(article.title));
    if (!local) continue;
    scholarWorks[local.doi] = {
      total: Number(article.cited_by?.value) || 0,
      citationId: article.citation_id || null,
      citedByUrl: article.cited_by?.link || null
    };
  }
  if (articles.length < 100) break;
  start += 100;
}

const citations = Object.values(scholarWorks).reduce((sum, item) => sum + item.total, 0);
const payload = {
  citations,
  external: null,
  updated: new Date().toISOString().slice(0, 10),
  source: 'Google Scholar via SerpApi',
  works: scholarWorks
};
await writeFile(target, `window.BAOXUAN_SCHOLAR = ${JSON.stringify(payload)};\n`, 'utf8');
console.log(`Updated ${Object.keys(scholarWorks).length} Google Scholar article records.`);
