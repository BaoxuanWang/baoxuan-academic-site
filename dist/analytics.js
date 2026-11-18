(function () {
  const endpoint = 'https://baoxuanwang.goatcounter.com';
  const canonicalPath = '/baoxuan-academic-site/';
  const total = document.getElementById('visitor-total');
  const today = document.getElementById('visitor-today');
  const status = document.getElementById('visitor-status');
  if (!total || !today || !status) return;
  let language = document.documentElement.lang.startsWith('zh') ? 'zh' : 'en';
  let values = { today: null, total: null }, state = 'loading', lastRead = 0, lastDay = '', collectionFailed = false;
  const t = (zh, en) => language === 'zh' ? zh : en;
  const utcDay = () => new Date().toISOString().slice(0, 10);
  function render() {
    for (const [key, node] of [['today', today], ['total', total]]) node.textContent = values[key] == null ? '—' : values[key].toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US');
    status.textContent = state === 'loading' ? t('正在读取访问统计…', 'Loading visit counts…')
      : state === 'disabled' ? t('公开计数尚未启用；访问采集独立运行。', 'Public counters are not enabled; collection runs independently.')
      : state === 'error' ? t('计数暂不可用，请稍后再试。', 'Counts temporarily unavailable; please try later.')
      : t('今日按 UTC（北京时间 08:00 换日）· 公开计数可能延迟至多 4 小时', 'Today uses UTC · Public counts may be delayed by up to 4 hours');
    if (collectionFailed) status.textContent += t(' · 访问记录脚本未能加载，请检查浏览器拦截设置。', ' · Visit tracking could not load; please check browser blocking settings.');
  }
  async function readCount(url) {
    const response = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(10000) });
    if (!response.ok) { const error = new Error(`HTTP ${response.status}`); error.status = response.status; throw error; }
    const data = await response.json();
    const raw = String(data.count ?? '').replace(/[,\s]/g, '');
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) throw new Error('Invalid public count');
    return Number(raw);
  }
  async function refresh() {
    const day = utcDay(); lastRead = Date.now(); lastDay = day;
    const results = await Promise.allSettled([
      // The public counter uses UTC dates; omit end to include all of today.
      readCount(`${endpoint}/counter/TOTAL.json?start=${day}`),
      readCount(`${endpoint}/counter/TOTAL.json`)
    ]);
    ['today', 'total'].forEach((key, index) => { values[key] = results[index].status === 'fulfilled' ? results[index].value : null; });
    state = results.some(r => r.status === 'rejected' && r.reason.status === 403) ? 'disabled'
      : results.some(r => r.status === 'rejected') ? 'error' : 'ready';
    render();
  }
  function startCollection() {
    const production = location.hostname === 'baoxuanwang.github.io' && location.pathname.startsWith(canonicalPath);
    const excluded = new URLSearchParams(location.search).get('analytics') === 'off';
    const optedOut = navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true;
    if (!production || excluded || optedOut) return;
    const script = document.createElement('script');
    script.src = './assets/vendor/goatcounter-count.js?v=478f026'; script.async = true;
    script.dataset.goatcounter = `${endpoint}/count`;
    script.dataset.goatcounterSettings = JSON.stringify({ no_onload: true, no_events: true });
    script.addEventListener('error', () => { collectionFailed = true; render(); }, { once: true });
    script.addEventListener('load', () => {
      const tracker = window.goatcounter;
      if (!tracker?.count || typeof tracker.get_data !== 'function' || tracker.filter?.()) return;
      const originalData = tracker.get_data.bind(tracker);
      tracker.get_data = vars => {
        const data = originalData(vars);
        // Only permit coarse, non-form fields; the vendor also adds queries.
        return { p: canonicalPath, t: 'Baoxuan Wang | Research', r: vars?.referrer || '', s: data.s, b: data.b, ns: true };
      };
      let referral = '';
      try { referral = document.referrer ? new URL(document.referrer).origin : ''; } catch {}
      // One count per page load; no filter values, queries, fragments or form data.
      tracker.count({ path: canonicalPath, title: 'Baoxuan Wang | Research', referrer: referral, no_session: true });
    }, { once: true });
    document.head.append(script);
  }
  document.addEventListener('site:language', event => { language = event.detail.language; render(); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && (utcDay() !== lastDay || Date.now() - lastRead > 600000)) refresh();
  });
  render(); startCollection(); refresh();
})();
