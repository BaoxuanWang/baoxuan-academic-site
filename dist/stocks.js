(function () {
  const stocks = [
    { code: '002202', secid: '0.002202', name: '金风科技', en: 'Goldwind', sector: '整机', sectorEn: 'Turbines', reason: '海上与漂浮式风机整机', reasonEn: 'Offshore and floating wind turbines', report: 'https://www.goldwind.com/cn/' },
    { code: '601615', secid: '1.601615', name: '明阳智能', en: 'Mingyang Smart Energy', sector: '整机', sectorEn: 'Turbines', reason: '大容量海上风机研发制造', reasonEn: 'Large offshore turbine development', report: 'https://www.myse.com.cn/' },
    { code: '300772', secid: '0.300772', name: '运达股份', en: 'Windey Energy', sector: '整机', sectorEn: 'Turbines', reason: '风机整机与新能源服务', reasonEn: 'Wind turbines and renewable services', report: 'https://www.chinawindey.com/' },
    { code: '688660', secid: '1.688660', name: '电气风电', en: 'Shanghai Electric Wind Power', sector: '整机', sectorEn: 'Turbines', reason: '海上风电整机与运维', reasonEn: 'Offshore turbines and services', report: 'https://www.sewpg.com/' },
    { code: '002080', secid: '0.002080', name: '中材科技', en: 'Sinoma Science & Technology', sector: '叶片材料', sectorEn: 'Blades', reason: '风电叶片与复合材料', reasonEn: 'Wind blades and composites', report: 'https://www.sinomatech.com/' },
    { code: '600458', secid: '1.600458', name: '时代新材', en: 'Times New Material', sector: '叶片材料', sectorEn: 'Blades', reason: '风电叶片与高分子材料', reasonEn: 'Wind blades and polymer materials', report: 'https://www.crrcgc.cc/sdxc' },
    { code: '603606', secid: '1.603606', name: '东方电缆', en: 'Orient Cable', sector: '海缆', sectorEn: 'Subsea cables', reason: '海上风电海缆系统', reasonEn: 'Subsea cables for offshore wind', report: 'https://www.orientcable.com/' },
    { code: '600522', secid: '1.600522', name: '中天科技', en: 'ZTT Group', sector: '海缆', sectorEn: 'Subsea cables', reason: '海缆与海洋工程', reasonEn: 'Subsea cables and marine engineering', report: 'https://www.zttgroup.com/' },
    { code: '600487', secid: '1.600487', name: '亨通光电', en: 'Hengtong Optic-Electric', sector: '海缆', sectorEn: 'Subsea cables', reason: '海洋通信与能源互联', reasonEn: 'Marine communications and energy links', report: 'https://www.htgd.com.cn/' },
    { code: '002487', secid: '0.002487', name: '大金重工', en: 'Dajin Heavy Industry', sector: '基础结构', sectorEn: 'Foundations', reason: '海上风电塔筒与基础', reasonEn: 'Offshore towers and foundations', report: 'https://www.dajin.cn/' },
    { code: '002531', secid: '0.002531', name: '天顺风能', en: 'Titan Wind Energy', sector: '基础结构', sectorEn: 'Foundations', reason: '风塔、叶片与海工装备', reasonEn: 'Towers, blades and offshore equipment', report: 'https://www.titanwind.com.cn/' },
    { code: '301155', secid: '0.301155', name: '海力风电', en: 'Haili Wind Power', sector: '基础结构', sectorEn: 'Foundations', reason: '海上风电塔筒及桩基', reasonEn: 'Offshore towers and monopiles', report: 'http://www.jshlfd.com/' }
  ];
  const quotes = new Map();
  const histories = new Map();
  let selected = stocks[0];
  let range = 'month';
  let goldRange = 'month';
  const holdings = {};
  const en = () => document.documentElement.lang === 'en';
  const t = (zh, english) => en() ? english : zh;
  const number = (value, digits = 2) => Number(value).toLocaleString(en() ? 'en-US' : 'zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const signed = (value) => `${value >= 0 ? '+' : ''}${number(value)}%`;
  const at = (timestamp) => new Date(timestamp).toLocaleString(en() ? 'en-US' : 'zh-CN', { timeZone: 'Asia/Shanghai', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  async function getJson(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally { clearTimeout(timeout); }
  }

  function getJsonp(url) {
    return new Promise((resolve, reject) => {
      const callback = `baoxuanStockSearch${Date.now()}${Math.floor(Math.random() * 1000)}`;
      const script = document.createElement('script');
      const timer = setTimeout(() => finish(new Error('Search timeout')), 12000);
      function finish(error, data) {
        clearTimeout(timer); delete window[callback]; script.remove();
        if (error) reject(error); else resolve(data);
      }
      window[callback] = (data) => finish(null, data);
      url.searchParams.set('cb', callback);
      script.src = url; script.onerror = () => finish(new Error('Search unavailable'));
      document.head.append(script);
    });
  }

  function make(tag, cls, value) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (value != null) node.textContent = value;
    return node;
  }

  function renderCards() {
    const root = document.getElementById('stock-grid');
    const fragment = document.createDocumentFragment();
    for (const stock of stocks) {
      const quote = quotes.get(stock.code);
      const card = make('button', `stock-card${stock.code === selected.code ? ' is-active' : ''}`);
      card.type = 'button'; card.setAttribute('aria-pressed', String(stock.code === selected.code));
      const head = make('span', 'stock-card-head');
      head.append(make('span', 'stock-card-name', en() ? stock.en : stock.name), make('span', 'stock-card-code', stock.code));
      card.append(head, make('span', 'stock-card-sector', en() ? stock.sectorEn : stock.sector), make('strong', 'stock-card-price', quote ? `¥${number(quote.price)}` : '—'));
      const change = quote ? (quote.price / quote.previous - 1) * 100 : null;
      card.append(make('span', `stock-card-change${change == null ? '' : change >= 0 ? ' up' : ' down'}`, change == null ? t('报价暂不可用', 'Quote unavailable') : signed(change)));
      card.addEventListener('click', () => selectStock(stock));
      fragment.append(card);
    }
    root.replaceChildren(fragment);
  }

  function stockFromSearch(item) {
    const code = String(item.Code || item.UnifiedCode || '').trim();
    const secid = item.QuoteID || `${item.MktNum}.${code}`;
    const market = secid.startsWith('1.') ? 'sh' : 'sz';
    return {
      code, secid, name: item.Name || code, en: item.Name || code,
      sector: item.SecurityTypeName || 'A 股', sectorEn: item.SecurityTypeName || 'A-share',
      reason: '用户查询的 A 股', reasonEn: 'User-selected A-share',
      report: `https://quote.eastmoney.com/${market}${code}.html`, searched: true
    };
  }

  async function searchStocks(query) {
    const root = document.getElementById('stock-search-results');
    root.textContent = t('正在查询…', 'Searching…');
    try {
      const url = new URL('https://searchapi.eastmoney.com/api/suggest/get');
      for (const [key, value] of Object.entries({ input: query, type: '14', token: 'D43BF722C8E33BECE2F82C9EB6D8A8D5' })) url.searchParams.set(key, value);
      const data = await getJsonp(url);
      const rows = (data.QuotationCodeTable?.Data || []).filter((item) => item.Classify === 'AStock' && /^\d{6}$/.test(item.Code)).slice(0, 8);
      if (!rows.length) { root.textContent = t('未找到匹配的 A 股。', 'No matching A-share found.'); return; }
      root.replaceChildren(...rows.map((item) => {
        const stock = stockFromSearch(item);
        const button = make('button', 'stock-search-result'); button.type = 'button';
        button.append(make('span', '', stock.name), make('small', '', `${stock.code} · ${stock.sector}`));
        button.addEventListener('click', async () => {
          const existing = stocks.find((entry) => entry.code === stock.code);
          const chosen = existing || stock;
          if (!existing) stocks.unshift(chosen);
          root.replaceChildren();
          document.getElementById('stock-search-input').value = `${chosen.name} ${chosen.code}`;
          await fetchQuote(chosen); selectStock(chosen); renderCards();
        });
        return button;
      }));
    } catch (error) { root.textContent = t('查询服务暂不可用。', 'Search is temporarily unavailable.'); }
  }

  function average(rows, count) {
    if (rows.length < count) return null;
    return rows.slice(-count).reduce((sum, row) => sum + row.close, 0) / count;
  }

  function svgElement(svg, tag, attributes = {}, value = '') {
    const node = document.createElementNS(svg.namespaceURI, tag);
    for (const [key, attribute] of Object.entries(attributes)) node.setAttribute(key, attribute);
    if (value) node.textContent = value;
    return node;
  }

  function renderInteractiveChart(root, points, options) {
    const pointSpacing = points.length <= 35 ? 24 : points.length <= 90 ? 13 : points.length <= 280 ? 7 : 4.5;
    const width = Math.max(760, Math.round(144 + (points.length - 1) * pointSpacing)), height = 320;
    const margin = { left: 72, right: 72, top: 24, bottom: 50 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const values = points.map((row) => row.close);
    const low = Math.min(...values), high = Math.max(...values);
    const padding = Math.max((high - low) * .12, high * .008, .01);
    const minimum = low - padding, maximum = high + padding;
    const x = (index) => margin.left + index / (points.length - 1) * plotWidth;
    const y = (price) => margin.top + (maximum - price) / (maximum - minimum) * plotHeight;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.style.width = `${width}px`;
    svg.style.maxWidth = 'none';
    svg.setAttribute('aria-hidden', 'true');

    for (let index = 0; index < 5; index += 1) {
      const yy = margin.top + index / 4 * plotHeight;
      const price = maximum - index / 4 * (maximum - minimum);
      svg.append(
        svgElement(svg, 'line', { x1: margin.left, x2: width - margin.right, y1: yy, y2: yy, stroke: options.grid, 'stroke-width': 1 }),
        svgElement(svg, 'text', { x: margin.left - 10, y: yy + 4, fill: options.muted, 'font-size': 10, 'text-anchor': 'end' }, options.tick(price)),
        svgElement(svg, 'text', { x: width - margin.right + 10, y: yy + 4, fill: options.muted, 'font-size': 10, 'text-anchor': 'start' }, options.tick(price))
      );
    }

    const tickIndexes = [...new Set([0, 1, 2, 3, 4].map((step) => Math.round(step / 4 * (points.length - 1))))];
    for (const index of tickIndexes) {
      const xx = x(index);
      const [year, month, day] = points[index].date.split('-');
      const label = options.longRange ? `${year}-${month}` : `${month}-${day}`;
      svg.append(
        svgElement(svg, 'line', { x1: xx, x2: xx, y1: margin.top, y2: height - margin.bottom, stroke: options.grid, 'stroke-width': 1, opacity: .55 }),
        svgElement(svg, 'line', { x1: xx, x2: xx, y1: height - margin.bottom, y2: height - margin.bottom + 5, stroke: options.axis, 'stroke-width': 1 }),
        svgElement(svg, 'text', { x: xx, y: height - 22, fill: options.muted, 'font-size': 10, 'text-anchor': 'middle' }, label)
      );
    }
    svg.append(
      svgElement(svg, 'line', { x1: margin.left, x2: margin.left, y1: margin.top, y2: height - margin.bottom, stroke: options.axis, 'stroke-width': 1 }),
      svgElement(svg, 'line', { x1: width - margin.right, x2: width - margin.right, y1: margin.top, y2: height - margin.bottom, stroke: options.axis, 'stroke-width': 1 }),
      svgElement(svg, 'line', { x1: margin.left, x2: width - margin.right, y1: height - margin.bottom, y2: height - margin.bottom, stroke: options.axis, 'stroke-width': 1 }),
      svgElement(svg, 'text', { x: 14, y: margin.top + plotHeight / 2, fill: options.muted, 'font-size': 10, 'text-anchor': 'middle', transform: `rotate(-90 14 ${margin.top + plotHeight / 2})` }, options.yLabel),
      svgElement(svg, 'text', { x: margin.left + plotWidth / 2, y: height - 4, fill: options.muted, 'font-size': 10, 'text-anchor': 'middle' }, t('日期', 'Date'))
    );

    const path = points.map((row, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(row.close).toFixed(1)}`).join(' ');
    svg.append(
      svgElement(svg, 'path', { d: `${path} L${x(points.length - 1)},${height - margin.bottom} L${x(0)},${height - margin.bottom} Z`, fill: options.fill }),
      svgElement(svg, 'path', { d: path, fill: 'none', stroke: options.color, 'stroke-width': 2.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' })
    );
    if (points.length <= 60) for (let index = 0; index < points.length; index += 1) svg.append(svgElement(svg, 'circle', { cx: x(index), cy: y(points[index].close), r: 2.2, fill: '#fff', stroke: options.color, 'stroke-width': 1.3, opacity: .82 }));
    svg.append(svgElement(svg, 'circle', { cx: x(points.length - 1), cy: y(points.at(-1).close), r: 4.2, fill: options.color, stroke: '#fff', 'stroke-width': 2 }));

    const focus = svgElement(svg, 'g', { display: 'none', 'pointer-events': 'none' });
    const vertical = svgElement(svg, 'line', { y1: margin.top, y2: height - margin.bottom, stroke: options.color, 'stroke-width': 1, 'stroke-dasharray': '4 4', opacity: .6 });
    const marker = svgElement(svg, 'circle', { r: 4.5, fill: '#fff', stroke: options.color, 'stroke-width': 2.2 });
    const tooltip = svgElement(svg, 'g');
    const tooltipBox = svgElement(svg, 'rect', { width: 168, height: 43, rx: 6, fill: '#173d49', opacity: .97 });
    const tooltipDate = svgElement(svg, 'text', { x: 9, y: 15, fill: '#bcd4ce', 'font-size': 9 });
    const tooltipValue = svgElement(svg, 'text', { x: 9, y: 30, fill: '#fff', 'font-size': 12, 'font-weight': 700 });
    tooltip.append(tooltipBox, tooltipDate, tooltipValue);
    focus.append(vertical, marker, tooltip);
    svg.append(focus);

    function showPoint(index) {
      const row = points[index], xx = x(index), yy = y(row.close);
      vertical.setAttribute('x1', xx); vertical.setAttribute('x2', xx);
      marker.setAttribute('cx', xx); marker.setAttribute('cy', yy);
      const tooltipX = xx + 10 + 168 > width - margin.right ? xx - 178 : xx + 10;
      const tooltipY = Math.max(margin.top + 3, Math.min(yy - 51, height - margin.bottom - 46));
      tooltip.setAttribute('transform', `translate(${tooltipX} ${tooltipY})`);
      tooltipDate.textContent = row.date;
      tooltipValue.textContent = `${options.value(row.close)} · ${t('日收盘', 'daily close')}`;
      focus.setAttribute('display', 'block');
      root.setAttribute('aria-label', `${options.name}: ${row.date}, ${options.value(row.close)}`);
    }

    function pointFromEvent(event) {
      const bounds = svg.getBoundingClientRect();
      const coordinate = (event.clientX - bounds.left) / bounds.width * width;
      return Math.max(0, Math.min(points.length - 1, Math.round((coordinate - margin.left) / plotWidth * (points.length - 1))));
    }
    let dragStart = null;
    let suppressClick = false;
    root.onpointerdown = (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      dragStart = { x: event.clientX, scroll: root.scrollLeft };
      suppressClick = false;
      root.classList.add('is-dragging');
      root.setPointerCapture?.(event.pointerId);
    };
    root.onpointermove = (event) => {
      if (dragStart) {
        const movement = event.clientX - dragStart.x;
        if (Math.abs(movement) > 3) suppressClick = true;
        root.scrollLeft = dragStart.scroll - movement;
      } else if (event.pointerType === 'mouse') showPoint(pointFromEvent(event));
    };
    const endDrag = (event) => {
      dragStart = null;
      root.classList.remove('is-dragging');
      root.releasePointerCapture?.(event.pointerId);
    };
    root.onpointerup = endDrag;
    root.onpointercancel = endDrag;
    svg.addEventListener('click', (event) => { if (!suppressClick) showPoint(pointFromEvent(event)); suppressClick = false; });
    root.replaceChildren(svg);
    root.scrollLeft = root.scrollWidth;
    showPoint(points.length - 1);
  }

  function drawChart(rows) {
    const root = document.getElementById('price-chart');
    if (!rows?.length) { root.textContent = t('走势暂不可用', 'Trend unavailable'); return; }
    const counts = { month: 22, quarter: 66, year: 250, fiveyear: Infinity };
    const count = counts[range] || 22;
    const points = Number.isFinite(count) ? rows.slice(-count) : rows;
    if (points.length < 2) { root.textContent = t('数据不足', 'Insufficient data'); return; }
    renderInteractiveChart(root, points, {
      name: en() ? selected.en : selected.name,
      color: '#258b85', fill: 'rgba(62,153,136,.10)', grid: '#e4eee8', axis: '#a9beb7', muted: '#78938d',
      longRange: points.length > 90, yLabel: t('收盘价（元）', 'Close (CNY)'), tick: (value) => number(value), value: (value) => `¥${number(value)}`
    });
  }

  function renderTrend() {
    const rows = histories.get(selected.code) || [];
    drawChart(rows);
    const root = document.getElementById('trend-summary');
    if (rows.length < 2) { root.textContent = t('暂无日线数据', 'No daily price history'); return; }
    const last = rows.at(-1).close;
    const month = rows.length > 22 ? (last / rows.at(-23).close - 1) * 100 : null;
    const year = rows.length > 250 ? (last / rows.at(-251).close - 1) * 100 : null;
    const ma20 = average(rows, 20), ma120 = average(rows, 120);
    const parts = [
      [t('近一月', '1 month'), month == null ? '—' : signed(month)],
      [t('近一年', '1 year'), year == null ? '—' : signed(year)],
      [t('20 日均线', '20-day average'), ma20 == null ? '—' : `¥${number(ma20)}`],
      [t('120 日均线', '120-day average'), ma120 == null ? '—' : `¥${number(ma120)}`]
    ];
    root.replaceChildren(...parts.map(([label, value]) => { const node = make('span', '', `${label} `); node.append(make('strong', '', value)); return node; }));
  }

  function trendGuidance(quote, rows) {
    if (!quote) return { title: t('等待最新报价', 'Waiting for a quote'), reason: t('报价恢复后将自动生成趋势建议。', 'Trend guidance will resume when a current quote is available.') };
    const ma20 = average(rows, 20), ma60 = average(rows, 60), ma120 = average(rows, 120);
    if (!ma20 || !ma60 || !ma120) return { title: t('趋势数据待更新', 'Trend data pending'), reason: t('日线数据完整后将比较 20、60 与 120 日均线。', 'Guidance will compare the 20-, 60- and 120-day averages once daily history is complete.') };
    const month = rows.length > 22 ? (quote.price / rows.at(-23).close - 1) * 100 : 0;
    const score = (quote.price >= ma20 ? 1 : -1) + (quote.price >= ma60 ? 1 : -1) + (quote.price >= ma120 ? 1 : -1) + (ma20 >= ma60 ? 1 : -1) + (month >= 0 ? 1 : -1);
    const details = t(`现价 ¥${number(quote.price)}；20 / 60 / 120 日均线 ¥${number(ma20)} / ¥${number(ma60)} / ¥${number(ma120)}；近一月 ${signed(month)}。`, `Price ¥${number(quote.price)}; 20 / 60 / 120-day averages ¥${number(ma20)} / ¥${number(ma60)} / ¥${number(ma120)}; one-month return ${signed(month)}.`);
    if (score >= 4) return { title: t('趋势偏强 · 分批关注', 'Stronger trend · consider staged exposure'), reason: `${details}${t(' 多周期动量一致，仍需控制单一股票仓位并观察成交与基本面。', ' Momentum aligns across horizons; keep position size controlled and confirm with volume and fundamentals.')}` };
    if (score >= 1) return { title: t('持有观察 · 等待确认', 'Monitor · wait for confirmation'), reason: `${details}${t(' 中短期信号偏正，但尚未形成全面一致的趋势。', ' Short- and medium-term signals lean positive but are not fully aligned.')}` };
    if (score <= -3) return { title: t('等待企稳 · 控制风险', 'Wait for stabilization · control risk'), reason: `${details}${t(' 多数趋势信号偏弱，避免仅因短期下跌而追加入场。', ' Most trend signals are weak; avoid adding solely because of a short-term decline.')}` };
    return { title: t('趋势分化 · 小仓观察', 'Mixed trend · small watch position'), reason: `${details}${t(' 长短周期方向不一致，优先等待均线结构改善。', ' Long- and short-horizon signals disagree; wait for the moving-average structure to improve.')}` };
  }

  function renderHolding() {
    const quote = quotes.get(selected.code);
    const rows = histories.get(selected.code) || [];
    const own = holdings[selected.code] || {};
    const shares = Math.floor(Math.max(0, Number(own.shares) || 0)), cost = Math.max(0, Number(own.cost) || 0);
    const value = document.getElementById('holding-value');
    const profit = document.getElementById('holding-profit');
    const guidance = document.getElementById('holding-guidance');
    const trend = trendGuidance(quote, rows);
    if (!shares || !cost) {
      value.textContent = '—'; profit.textContent = '—';
      guidance.replaceChildren(make('strong', '', trend.title), make('span', '', `${trend.reason}${t(' 填写持股数量和成本后，将叠加个人盈亏分析。', ' Add shares and cost to include your unrealized return.')}`));
      return;
    }
    if (!quote) {
      value.textContent = '—'; profit.textContent = t('等待最新报价', 'Waiting for a quote');
      guidance.textContent = t('报价不可用时不生成持仓判断。', 'No holding assessment without a current quote.');
      return;
    }
    const marketValue = shares * quote.price, gain = marketValue - shares * cost, gainPct = (quote.price / cost - 1) * 100;
    value.textContent = `¥${number(marketValue)}`;
    profit.textContent = `${gain >= 0 ? '+' : ''}¥${number(gain)} (${signed(gainPct)})`;
    profit.classList.toggle('up', gain >= 0); profit.classList.toggle('down', gain < 0);
    const title = trend.title;
    let reason = trend.reason;
    if (gainPct <= -10) reason += t(` 当前浮亏 ${number(Math.abs(gainPct))}%，请复核自己的风险承受范围。`, ` The unrealized loss is ${number(Math.abs(gainPct))}%; review your risk limit.`);
    else if (gainPct >= 20) reason += t(` 当前浮盈 ${number(gainPct)}%，注意利润回撤。`, ` The unrealized gain is ${number(gainPct)}%; watch for a reversal.`);
    guidance.replaceChildren(make('strong', '', title), make('span', '', reason));
  }

  function renderSelected() {
    const quote = quotes.get(selected.code);
    document.getElementById('chart-name').textContent = `${en() ? selected.en : selected.name} · ${selected.code}`;
    document.getElementById('chart-reason').textContent = t(`关注理由：${selected.reason}`, `Why watch: ${selected.reasonEn}`);
    document.getElementById('chart-price').textContent = quote ? `¥${number(quote.price)}` : '—';
    const change = quote ? (quote.price / quote.previous - 1) * 100 : null;
    const changeNode = document.getElementById('chart-change');
    changeNode.textContent = change == null ? t('报价暂不可用', 'Quote unavailable') : signed(change);
    changeNode.className = change == null ? '' : change >= 0 ? 'up' : 'down';
    document.getElementById('stock-time').textContent = quote ? t(`报价 ${at(quote.time)}`, `Quote ${at(quote.time)}`) : '—';
    document.getElementById('company-report').href = selected.report;
    renderTrend(); renderHolding();
  }

  function selectStock(stock) {
    selected = stock;
    const own = holdings[stock.code] || {};
    document.getElementById('holding-shares').value = own.shares ?? '';
    document.getElementById('holding-cost').value = own.cost ?? '';
    renderCards(); renderSelected(); loadHistory(stock);
  }

  async function loadHistory(stock) {
    if (histories.has(stock.code)) return;
    const start = new Date(Date.now() - 1900 * 86400000).toISOString().slice(0, 10).replaceAll('-', '');
    const url = new URL('https://push2his.eastmoney.com/api/qt/stock/kline/get');
    for (const [key, value] of Object.entries({ secid: stock.secid, klt: '101', fqt: '1', beg: start, end: '20500101', ut: 'fa5fd1943c7b386f172d6893dbfba10b', fields1: 'f1,f2,f3,f4,f5,f6', fields2: 'f51,f52,f53,f54,f55,f56,f57,f58' })) url.searchParams.set(key, value);
    try {
      const data = await getJson(url);
      const rows = (data.data?.klines || []).map((line) => { const fields = line.split(','); return { date: fields[0], close: Number(fields[2]) }; }).filter((row) => Number.isFinite(row.close));
      if (!rows.length) throw new Error('Empty price history');
      histories.set(stock.code, rows);
      if (selected.code === stock.code) renderSelected();
    } catch (error) {
      console.warn(`History unavailable for ${stock.code}:`, error);
      if (selected.code === stock.code) renderTrend();
    }
  }

  async function refreshQuotes() {
    await Promise.all(stocks.map(fetchQuote));
    renderCards(); renderSelected();
  }

  async function fetchQuote(stock) {
    const url = new URL('https://push2.eastmoney.com/api/qt/stock/get');
    url.searchParams.set('secid', stock.secid);
    url.searchParams.set('fields', 'f43,f57,f58,f60,f86');
    try {
      const data = (await getJson(url)).data;
      if (!data || !Number.isFinite(Number(data.f43)) || !Number.isFinite(Number(data.f60)) || !Number.isFinite(Number(data.f86))) throw new Error('Invalid quote');
      quotes.set(stock.code, { price: Number(data.f43) / 100, previous: Number(data.f60) / 100, time: Number(data.f86) * 1000 });
    } catch (error) { quotes.delete(stock.code); console.warn(`Quote unavailable for ${stock.code}:`, error); }
  }

  async function refreshGold() {
    try {
      const data = await getJson('https://api.gold-api.com/price/XAU/CNY');
      if (data.currency !== 'CNY' || !Number.isFinite(Number(data.price)) || !data.updatedAt) throw new Error('Invalid gold quote');
      const age = Date.now() - new Date(data.updatedAt).getTime();
      document.getElementById('gold-price').textContent = `¥${number(Number(data.price) / 31.1035)} / ${t('克', 'g')}`;
      document.getElementById('gold-time').textContent = t(`报价 ${at(data.updatedAt)}${age > 600000 ? ' · 数据较旧' : ''}`, `Quote ${at(data.updatedAt)}${age > 600000 ? ' · stale' : ''}`);
    } catch (error) {
      document.getElementById('gold-price').textContent = '—';
      document.getElementById('gold-time').textContent = t('金价暂不可用', 'Gold quote unavailable');
      console.warn('Gold quote unavailable:', error);
    }
  }

  function renderGoldTrend() {
    const root = document.getElementById('gold-chart');
    const summary = document.getElementById('gold-summary');
    const history = window.BAOXUAN_GOLD_HISTORY || {};
    const rows = Array.isArray(history.series) ? history.series.filter((row) => Number.isFinite(Number(row.close))).map((row) => ({ date: row.date, close: Number(row.close) })).sort((a, b) => a.date.localeCompare(b.date)) : [];
    if (rows.length < 2) { root.textContent = t('金价历史暂不可用', 'Gold history unavailable'); summary.replaceChildren(); return; }
    const counts = { month: 22, quarter: 66, year: 260, all: Infinity };
    const count = counts[goldRange] || 22;
    const points = Number.isFinite(count) ? rows.slice(-count) : rows;
    renderInteractiveChart(root, points, {
      name: t('国际现货黄金', 'Spot gold'),
      color: '#b8873b', fill: 'rgba(199,157,89,.13)', grid: '#e9e3d5', axis: '#c5b99f', muted: '#927f61',
      longRange: points.length > 90, yLabel: t('收盘价（美元/盎司）', 'Close (USD/oz)'), tick: (value) => `$${number(value, 0)}`, value: (value) => `$${number(value)}`
    });
    const last = rows.at(-1).close;
    const month = rows.length > 22 ? (last / rows.at(-23).close - 1) * 100 : null;
    const year = rows.length > 250 ? (last / rows.at(-251).close - 1) * 100 : null;
    const ma20 = average(rows, 20), ma120 = average(rows, 120);
    const parts = [
      [t('近一月', '1 month'), month == null ? '—' : signed(month)],
      [t('近一年', '1 year'), year == null ? '—' : signed(year)],
      [t('20 日均线', '20-day average'), ma20 == null ? '—' : `$${number(ma20)}`],
      [t('120 日均线', '120-day average'), ma120 == null ? '—' : `$${number(ma120)}`]
    ];
    summary.replaceChildren(...parts.map(([label, value]) => { const node = make('span', '', `${label} `); node.append(make('strong', '', value)); return node; }));
    document.getElementById('gold-history-time').textContent = history.generatedAt ? t(`日线更新 ${new Date(history.generatedAt).toLocaleDateString('zh-CN')}`, `Daily series updated ${new Date(history.generatedAt).toLocaleDateString('en-US')}`) : t('日线历史', 'Daily history');
  }

  for (const button of document.querySelectorAll('.range-button')) button.addEventListener('click', () => {
    range = button.dataset.range;
    document.querySelectorAll('.range-button').forEach((node) => node.classList.toggle('is-active', node === button));
    renderTrend();
  });
  for (const button of document.querySelectorAll('.gold-range-button')) button.addEventListener('click', () => {
    goldRange = button.dataset.goldRange;
    document.querySelectorAll('.gold-range-button').forEach((node) => node.classList.toggle('is-active', node === button));
    renderGoldTrend();
  });
  for (const id of ['holding-shares', 'holding-cost']) document.getElementById(id).addEventListener('input', () => {
    const shares = document.getElementById('holding-shares').value;
    const cost = document.getElementById('holding-cost').value;
    holdings[selected.code] = { shares, cost };
    renderHolding();
  });
  document.getElementById('stock-search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const query = document.getElementById('stock-search-input').value.trim();
    if (query) searchStocks(query);
  });
  document.getElementById('stock-search-input').addEventListener('input', (event) => {
    if (!event.target.value.trim()) document.getElementById('stock-search-results').replaceChildren();
  });
  document.getElementById('language-switch').addEventListener('click', () => {
    document.getElementById('stock-search-input').placeholder = t('输入名称或代码，例如：浙能 / 600023', 'Enter a name or code, e.g. 600023');
    renderCards(); renderSelected(); refreshGold(); renderGoldTrend();
  });
  selectStock(selected);
  refreshQuotes(); refreshGold(); renderGoldTrend();
  setInterval(refreshQuotes, 60000);
  setInterval(refreshGold, 30000);
})();
