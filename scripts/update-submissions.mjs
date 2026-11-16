import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function textFromHtml(html) {
  return html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&#x([\da-f]+);/gi, (_, x) => String.fromCodePoint(parseInt(x, 16)))
    .replace(/&#(\d+);/g, (_, x) => String.fromCodePoint(Number(x)))
    .replace(/&(?:amp|nbsp|ndash|mdash|quot|apos);/g, x => ({ '&amp;': '&', '&nbsp;': ' ', '&ndash;': '–', '&mdash;': '—', '&quot;': '"', '&apos;': "'" })[x])
    .replace(/\s+/g, ' ').trim();
}

function isoDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const pieces = value.replace(/,/g, '').trim().split(/\s+/);
  const monthFirst = /^[A-Za-z]/.test(pieces[0]);
  const month = monthNames.indexOf(pieces[monthFirst ? 0 : 1].slice(0, 3).toLowerCase());
  const day = Number(pieces[monthFirst ? 1 : 0]), year = Number(pieces[2]);
  const date = new Date(Date.UTC(year, month, day));
  if (month < 0 || date.getUTCDate() !== day || date.getUTCMonth() !== month) return null;
  return date.toISOString().slice(0, 10);
}

export function parseCall(html, expectedTitle) {
  const normalize = value => textFromHtml(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  const headings = [...html.matchAll(/<(?:h1|title)\b[^>]*>([\s\S]*?)<\/(?:h1|title)>/gi)].map(m => normalize(m[1]));
  if (!headings.some(heading => heading.includes(normalize(expectedTitle)))) throw new Error('Call title not found; possible redirect or access challenge');
  const text = textFromHtml(html);
  const date = '(\\d{1,2}\\s+[A-Za-z]{3,9}\\s+\\d{4}|[A-Za-z]{3,9}\\s+\\d{1,2},?\\s+\\d{4}|\\d{4}-\\d{2}-\\d{2})';
  const deadlineMatch = text.match(new RegExp('(?:Deadline for manuscript submissions|Manuscript submission deadline|Submission deadline|Submission closes)\\s*[:–—-]?\\s*' + date, 'i'));
  const deadline = deadlineMatch ? isoDate(deadlineMatch[1]) : null;
  const closed = /(?:this special issue|submissions?|call for papers)\s+(?:is |are |has been |have been |now )?(?:now )?closed\b/i.test(text);
  const opening = text.match(new RegExp('(?:Submission opens|Submissions open|Manuscript submission opens)\\s*[:–—-]?\\s*' + date, 'i'));
  if (!deadline && !closed) throw new Error('No unambiguous submission deadline or closure notice');
  return { deadline, closed, openDate: opening ? isoDate(opening[1]) : null };
}

export async function refreshIssue(item) {
  const attempt = new Date().toISOString();
  item.lastAttempt = attempt;
  try {
    const response = await fetch(item.url, {
      signal: AbortSignal.timeout(20000),
      headers: { Accept: 'text/html' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = parseCall(await response.text(), item.title);
    if (parsed.deadline) item.deadline = parsed.deadline;
    item.closed = parsed.closed;
    if (parsed.openDate) item.openDate = parsed.openDate;
    item.checkedDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    item.sourceStatus = 'verified';
    delete item.lastError;
  } catch (error) {
    item.sourceStatus = 'cached';
    item.lastError = error.message;
    console.warn(`${item.id}: retained record (${error.message})`);
  }
}

async function main() {
  const target = resolve('dist/submissions.js');
  const source = await readFile(target, 'utf8');
  const match = source.match(/window\.BAOXUAN_SUBMISSIONS\s*=\s*({[\s\S]*});?\s*$/);
  if (!match) throw new Error('Unable to parse submissions.js');
  const data = JSON.parse(match[1]);
  // Bounded concurrency limits request pressure on publisher websites.
  for (let start = 0; start < data.issues.length; start += 3) await Promise.all(data.issues.slice(start, start + 3).map(refreshIssue));
  data.generatedAt = new Date().toISOString();
  await writeFile(target, `window.BAOXUAN_SUBMISSIONS=${JSON.stringify(data, null, 2)};\n`, 'utf8');
  console.log(`Updated ${data.issues.filter(item => item.sourceStatus === 'verified').length}/${data.issues.length} special-issue sources.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
