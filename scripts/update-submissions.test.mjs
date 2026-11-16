import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCall, refreshIssue } from './update-submissions.mjs';

test('uses labelled manuscript deadline rather than article publication dates', () => {
  assert.equal(parseCall('<h1>Blade Structures</h1><p>Published 1 May 2026</p><p>Submission deadline 30 April 2027</p>', 'Blade Structures').deadline, '2027-04-30');
});
test('supports month-first dates and a future submission opening', () => {
  const result = parseCall('<h1>Blade Structures</h1><p>Submissions open: January 1, 2027</p><p>Manuscript submission deadline: June 30, 2027</p>', 'Blade Structures');
  assert.equal(result.deadline, '2027-06-30'); assert.equal(result.openDate, '2027-01-01');
});
test('recognises an explicit closed call', () => {
  assert.equal(parseCall('<h1>Blade Structures</h1>This special issue is now closed for submissions.', 'Blade Structures').closed, true);
});
test('rejects challenge pages and generic dates without a deadline label', () => {
  assert.throws(() => parseCall('<title>Access denied</title>Submission deadline 30 April 2027', 'Blade Structures'));
  assert.throws(() => parseCall('<h1>Blade Structures</h1>Published 30 April 2027', 'Blade Structures'));
});
test('an unavailable source preserves deadline and last successful check', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 403 });
  try {
    const item = { id: 'fixture', title: 'Blade Structures', url: 'https://example.com/call', deadline: '2027-04-30', checkedDate: '2026-11-16' };
    await refreshIssue(item);
    assert.equal(item.deadline, '2027-04-30'); assert.equal(item.checkedDate, '2026-11-16'); assert.equal(item.sourceStatus, 'cached');
  } finally { globalThis.fetch = originalFetch; }
});
