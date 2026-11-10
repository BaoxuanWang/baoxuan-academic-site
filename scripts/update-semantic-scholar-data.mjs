import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const worksPath = resolve('dist/works.js');
const target = resolve('dist/semantic-scholar.js');
const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

function readWorks(source) {
  const prefix = 'window.BAOXUAN_WORKS=';
  const suffix = ';\nwindow.BAOXUAN_ACADEMIC_SNAPSHOT=';
  const start = source.indexOf(prefix);
  const end = source.indexOf(suffix);
  if (start < 0 || end < 0) throw new Error('Unable to read works.js');
  return JSON.parse(source.slice(start + prefix.length, end));
}

async function getBatch(dois) {
  const url = 'https://api.semanticscholar.org/graph/v1/paper/batch?fields=title,url,citationCount,authors';
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'BaoxuanWang-Academic-Site/1.0' },
      body: JSON.stringify({ ids: dois.map((doi) => `DOI:${doi}`) })
    });
    if (response.ok) return response.json();
    if (response.status !== 429 && response.status < 500) throw new Error(`HTTP ${response.status}`);
    await delay(10000 * (attempt + 1));
  }
  throw new Error('Semantic Scholar remained unavailable after retries');
}

const works = readWorks(await readFile(worksPath, 'utf8'));
let papers;
try {
  papers = await getBatch(works.map((work) => work.doi));
} catch (error) {
  console.warn(`${error.message}; preserving the existing Semantic Scholar snapshot`);
  process.exit(0);
}

const records = {};
let citations = 0;
let matched = 0;
for (let index = 0; index < works.length; index += 1) {
  const paper = papers[index];
  if (!paper) continue;
  const doi = works[index].doi;
  const total = Number(paper.citationCount) || 0;
  records[doi] = { paperId: paper.paperId, url: paper.url, total };
  citations += total;
  matched += 1;
}

if (!matched) {
  console.warn('Semantic Scholar returned no matched works; preserving the existing snapshot');
  process.exit(0);
}
const snapshot = { generatedAt: new Date().toISOString(), source: 'Semantic Scholar', citations, coverage: `${matched}/${works.length}`, works: records };
await writeFile(target, `window.BAOXUAN_SEMANTIC_SCHOLAR=${JSON.stringify(snapshot)};\n`, 'utf8');
console.log(`Wrote ${matched}/${works.length} Semantic Scholar works to ${target}`);
