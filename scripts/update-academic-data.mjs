import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const orcidId = '0000-0001-8802-6800';
const orcidUrl = `https://orcid.org/${orcidId}`;
const target = resolve('dist/works.js');

async function getJson(url, headers = {}) {
  const response = await fetch(url, { headers: { Accept: 'application/json', ...headers } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

function doiKey(value = '') {
  return String(value).trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '').replace(/^doi:\s*/, '');
}

function fromOrcid(data) {
  if (!Array.isArray(data.group)) throw new Error('Invalid ORCID response');
  const unique = new Map();
  for (const group of data.group) {
    const entries = group['work-summary'] || [];
    const item = entries.find((entry) => entry.type === 'journal-article') || entries[0];
    const title = item?.title?.title?.value?.trim();
    const doi = item?.['external-ids']?.['external-id']?.find((id) => id['external-id-type']?.toLowerCase() === 'doi')?.['external-id-value'];
    if (!title || !doi) continue;
    const work = {
      title,
      year: item['publication-date']?.year?.value || '',
      type: item.type || '',
      doi: doiKey(doi),
      journal: item['journal-title']?.value || '',
      url: item.url?.value || `https://doi.org/${doiKey(doi)}`
    };
    const key = title.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!unique.has(key) || (unique.get(key).type === 'preprint' && work.type !== 'preprint')) unique.set(key, work);
  }
  return [...unique.values()].sort((a, b) => Number(b.year) - Number(a.year) || a.title.localeCompare(b.title));
}

async function citationSnapshot(works) {
  const dois = [...new Set(works.map((work) => doiKey(work.doi)).filter(Boolean))];
  const indexedUrl = new URL('https://api.openalex.org/works');
  indexedUrl.searchParams.set('filter', `doi:${dois.join('|')}`);
  indexedUrl.searchParams.set('per_page', '200');
  indexedUrl.searchParams.set('select', 'id,doi,cited_by_count');
  const indexed = await getJson(indexedUrl);
  const doiSet = new Set(dois);
  const matched = (indexed.results || []).filter((work) => doiSet.has(doiKey(work.doi)));
  if (!matched.length) throw new Error('No OpenAlex matches');
  const citations = matched.reduce((sum, work) => sum + (Number(work.cited_by_count) || 0), 0);
  const ids = new Set(matched.map((work) => work.id));
  const cited = matched.map((work) => work.id.split('/').pop());
  const selfUrl = new URL('https://api.openalex.org/works');
  selfUrl.searchParams.set('filter', `cites:${cited.join('|')},author.orcid:${orcidUrl}`);
  selfUrl.searchParams.set('per_page', '200');
  selfUrl.searchParams.set('select', 'id,authorships,referenced_works');
  let selfCitations = 0, page = 1, count = 0;
  do {
    selfUrl.searchParams.set('page', String(page));
    const citing = await getJson(selfUrl);
    count = Number(citing.meta?.count) || 0;
    for (const work of citing.results || []) {
      if (!(work.authorships || []).some((entry) => entry.author?.orcid === orcidUrl)) continue;
      for (const reference of work.referenced_works || []) if (ids.has(reference)) selfCitations += 1;
    }
    page += 1;
  } while ((page - 1) * 200 < count && page <= 10);
  return { citations, externalCitations: Math.max(0, citations - selfCitations), coverage: `${matched.length}/${dois.length}` };
}

const orcidData = await getJson(`https://pub.orcid.org/v3.0/${orcidId}/works`, { Accept: 'application/vnd.orcid+json' });
const works = fromOrcid(orcidData);
if (!works.length) throw new Error('ORCID returned no DOI works');
const citations = await citationSnapshot(works);
const snapshot = { generatedAt: new Date().toISOString(), source: 'ORCID + OpenAlex', ...citations };
const output = `window.BAOXUAN_WORKS=${JSON.stringify(works)};\nwindow.BAOXUAN_ACADEMIC_SNAPSHOT=${JSON.stringify(snapshot)};\n`;
await writeFile(target, output, 'utf8');
console.log(`Wrote ${works.length} works and ${citations.coverage} OpenAlex coverage to ${target}`);

