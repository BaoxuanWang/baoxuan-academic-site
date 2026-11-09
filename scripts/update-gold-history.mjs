import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const endpoint = 'https://api.goldprice.dev/v1/public/xau-history';
const response = await fetch(endpoint, { headers: { Accept: 'application/json', 'User-Agent': 'BaoxuanWang-Academic-Site/1.0' } });
if (!response.ok) throw new Error(`Gold history request failed: HTTP ${response.status}`);
const payload = await response.json();
const series = (payload.series || [])
  .map(({ date, close }) => ({ date, close: Number(close) }))
  .filter(({ date, close }) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(close))
  .sort((a, b) => a.date.localeCompare(b.date));
if (series.length < 20) throw new Error('Gold history response did not contain enough daily observations');

const target = resolve('dist/gold-history.js');
await mkdir(dirname(target), { recursive: true });
await writeFile(target, `window.BAOXUAN_GOLD_HISTORY = ${JSON.stringify({ symbol: payload.symbol || 'XAU-USD-SPOT', interval: '1d', generatedAt: new Date().toISOString(), series })};\n`, 'utf8');
console.log(`Wrote ${series.length} gold observations to ${target}`);
