(function () {
  const endpoint = 'https://baoxuanwang.goatcounter.com';
  const canonicalPath = '/baoxuan-academic-site/';
  const counterUrl = `${endpoint}/counter/${encodeURIComponent(canonicalPath)}.json`;
  const trackingStartedOn = '2026-11-18';
  const total = document.getElementById('visitor-total');
  const today = document.getElementById('visitor-today');
  const status = document.getElementById('visitor-status');
  const collectionStatus = document.getElementById('visitor-collection-status');
  if (!total || !today || !status) return;
  let language = document.documentElement.lang.startsWith('zh') ? 'zh' : 'en';
  let values = { today: null, total: null }, state = 'loading', lastRead = 0, lastDay = '';
  let collection = 'loading', automated = false;
  const t = (zh, en) => language === 'zh' ? zh : en;
  const utcDay = () => new Date().toISOString().slice(0, 10);
  function render() {
    for (const [key, node] of [['today', today], ['total', total]]) node.textContent = values[key] == null ? '—' : values[key].toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US');
    status.textContent = state === 'loading' ? t('正在读取访问统计…', 'Loading visit counts…')
      : state === 'disabled' ? t('公开计数尚未启用；访问采集独立运行。', 'Public counters are not enabled; collection runs independently.')
      : state === 'error' ? t('计数暂不可用，请稍后再试。', 'Counts temporarily unavailable; please try later.')
      : t('今日按 UTC（北京时间 08:00 换日）· 公开计数可能延迟至多 4 小时', 'Today uses UTC · Public counts may be delayed by up to 4 hours');
    const messages = {
      loading: ['正在加载访问记录…', 'Loading visit tracking…'],
      sending: ['正在联系统计服务…', 'Contacting the analytics service…'],
      accepted: ['统计服务已响应；是否计入请以后台为准。', 'The service responded; check the dashboard to confirm inclusion.'],
      ignored: ['统计服务已排除本次访问，请检查后台的忽略 IP 设置。', 'The service excluded this visit; check the dashboard’s Ignore IP settings.'],
      rejected: ['统计服务未接受记录请求。', 'The analytics service rejected the request.'],
      network: ['未能确认送达：请检查网络或浏览器拦截设置。', 'Delivery could not be confirmed; check network or browser blocking settings.'],
      script: ['访问记录脚本未能加载。', 'The visit tracking script could not load.'],
      privacy: ['浏览器已启用不跟踪，本次访问未发送。', 'A browser privacy preference is enabled; this visit was not sent.'],
      excluded: ['此链接已关闭访问统计。', 'Tracking is disabled for this link.'],
      outside: ['当前不是正式线上页面，不记录访问。', 'Visits are only recorded on the production website.'],
      frame: ['当前为嵌入页面，本次访问未发送；请在独立浏览器中打开。', 'This embedded page was not tracked; open it in a separate browser.'],
      optedout: ['此浏览器已选择不统计本人访问。', 'This browser has opted out of counting its own visits.'],
      filtered: ['本次访问被浏览器端规则排除。', 'A browser-side rule excluded this visit.']
    };
    if (collectionStatus) collectionStatus.textContent = t(...messages[collection]) + (automated ? t(' 检测到自动化环境标记，服务可能将其作为机器人排除。', ' An automation flag was detected; the service may exclude this as a bot.') : '');
  }
  function setCollection(next) { collection = next; render(); }
  async function readCount(url) {
    const response = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(10000) });
    if (!response.ok && response.status !== 404) { const error = new Error(`HTTP ${response.status}`); error.status = response.status; throw error; }
    const data = await response.json();
    const raw = String(data.count ?? '').replace(/[,\s]/g, '');
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) throw new Error('Invalid public count');
    // An empty path/date range returns 404 with a valid zero-count JSON body.
    if (response.status === 404 && Number(raw) !== 0) throw new Error('Invalid empty count');
    return Number(raw);
  }
  async function refresh() {
    const day = utcDay(); lastRead = Date.now(); lastDay = day;
    const dailyCount = readCount(`${counterUrl}?start=${day}`);
    const cumulativeCount = day === trackingStartedOn ? dailyCount : readCount(`${counterUrl}?start=${trackingStartedOn}`);
    const results = await Promise.allSettled([
      // The public counter uses UTC dates; omit end to include all of today.
      dailyCount,
      cumulativeCount
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
    if (!production) return setCollection('outside');
    if (excluded) return setCollection('excluded');
    if (optedOut) return setCollection('privacy');
    const script = document.createElement('script');
    script.src = './assets/vendor/goatcounter-count.js?v=478f026'; script.async = true; script.fetchPriority = 'high';
    script.dataset.goatcounter = `${endpoint}/count`;
    script.dataset.goatcounterSettings = JSON.stringify({ no_onload: true, no_events: true });
    script.addEventListener('error', () => setCollection('script'), { once: true });
    script.addEventListener('load', async () => {
      try {
        const tracker = window.goatcounter;
        if (!tracker?.url || typeof tracker.get_data !== 'function') return setCollection('script');
        const filtered = tracker.filter?.();
        if (filtered) return setCollection(filtered === 'frame' ? 'frame' : filtered === 'disabled with #toggle-goatcounter' ? 'optedout' : 'filtered');
        const originalData = tracker.get_data.bind(tracker);
        tracker.get_data = vars => {
          const data = originalData(vars);
          // Only permit coarse, non-form fields; the vendor also adds queries.
          return { p: canonicalPath, t: 'Baoxuan Wang | Research', r: vars?.referrer || '', s: data.s, b: data.b, ns: true };
        };
        let referral = '';
        try { referral = document.referrer ? new URL(document.referrer).origin : ''; } catch {}
        // One count per page load; no filter values, queries, fragments or form data.
        const url = tracker.url({ path: canonicalPath, title: 'Baoxuan Wang | Research', referrer: referral, no_session: true });
        automated = Number(new URL(url).searchParams.get('b')) > 0;
        setCollection('sending');
        // Send once and observe the response. Never retry an uncertain delivery.
        const response = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', keepalive: true, signal: AbortSignal.timeout(12000) });
        setCollection(response.status === 202 ? 'ignored' : response.ok ? 'accepted' : 'rejected');
      } catch { setCollection('network'); }
    }, { once: true });
    document.head.append(script);
  }
  document.addEventListener('site:language', event => { language = event.detail.language; render(); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && (utcDay() !== lastDay || Date.now() - lastRead > 600000)) refresh();
  });
  render(); startCollection(); refresh();
})();
