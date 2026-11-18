(function () {
  const data = window.BAOXUAN_FUNDING;
  if (!data || !document.getElementById('funding-projects')) return;
  let language = document.documentElement.lang.startsWith('zh') ? 'zh' : 'en';
  const t = (zh, en) => language === 'zh' ? zh : en;
  const copy = (item, field) => item[field + (language === 'zh' ? 'Zh' : 'En')] || '';
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
  const link = (url, text) => { const n = el('a', '', text); n.href = url; n.target = '_blank'; n.rel = 'noopener noreferrer'; return n; };
  const category = document.getElementById('funding-category'), status = document.getElementById('funding-status'), search = document.getElementById('funding-search');
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const categoryName = key => ({ postdoc: t('国家博士后', 'National postdoc'), nsfc: 'NSFC', zhejiang: t('浙江省', 'Zhejiang'), ningbo: t('宁波市', 'Ningbo'), open: t('开放基金', 'Open funds') })[key];
  function state(item) {
    if (item.mode === 'conditional') return { id: 'conditional', text: t('达到条件后办理', 'Milestone-based') };
    if (item.deadline && item.deadline < today()) return item.nextNotice
      ? { id: 'waiting', text: t('本轮已截止 · 等待下一轮', 'Round closed · awaiting next call') }
      : { id: 'closed', text: t('本轮已截止', 'Call closed') };
    if (item.start && item.start > today()) return { id: 'upcoming', text: t('尚未开始', 'Upcoming') };
    if (item.deadline) return { id: 'open', text: t('申报窗口开放', 'Application window open') };
    return { id: 'waiting', text: t('等待正式通知', 'Awaiting official notice') };
  }
  function facts(label, text) { const p = el('p'); p.append(el('strong', '', label), document.createTextNode(text)); return p; }
  function render() {
    const all = data.programs;
    const ranks = { open: 0, upcoming: 1, conditional: 2, waiting: 3, closed: 4 };
    const query = search.value.trim().toLowerCase();
    const items = all.filter(item => (category.value === 'all' || item.category === category.value) && (status.value === 'all' || state(item).id === status.value) && (!query || JSON.stringify(item).toLowerCase().includes(query)))
      .sort((a, b) => ranks[state(a).id] - ranks[state(b).id] || String(a.deadline || '9999').localeCompare(String(b.deadline || '9999')));
    document.getElementById('funding-projects').replaceChildren(...items.map(item => {
      const card = el('article', 'funding-card'); const s = state(item);
      const top = el('div', 'funding-card-top'); top.append(el('span', 'funding-category', categoryName(item.category)), el('span', `funding-state is-${s.id}`, s.text));
      const h = el('h3'); h.append(link(data.sources[item.sourceKeys[0]], copy(item, 'name') + ' ↗'));
      card.append(top, h, el('p', 'funding-version', copy(item, 'version')));
      const typeLabel = { research: t('科研经费', 'Research funding'), personal: t('个人支持 · 按规定核算', 'Personal support · subject to rules'), institution: t('款拨单位 · 非个人直接领取', 'Paid to host · not a direct personal award'), mixed: t('生活支持与科研经费分列', 'Separate living and research components') }[item.fundType];
      card.append(el('span', 'funding-type', typeLabel), el('p', 'funding-amount', copy(item, 'amount')));
      const dates = el('dl', 'funding-dates');
      for (const [label, value] of [[t('开始 / 发布', 'Opening / notice'), item.start || (item.mode === 'conditional' ? t('按条件和经办批次', 'By milestone and service batch') : t('未核得统一起始日', 'No verified common opening date'))], [t('本轮截止', 'Recorded deadline'), item.deadline || t('非统一固定日期', 'No universal fixed date')]]) {
        const row = el('div'); row.append(el('dt', '', label), el('dd', '', value)); dates.append(row);
      }
      card.append(dates, el('p', 'funding-window-note', copy(item, 'windowNote')), facts(t('资格要点：', 'Eligibility: '), copy(item, 'eligibility')));
      const details = el('details', 'submission-analysis'); details.append(el('summary', '', t('准备事项与适用边界', 'Preparation and applicability')), el('p', '', copy(item, 'prepare'))); card.append(details);
      const sources = el('div', 'submission-actions'); item.sourceKeys.forEach((key, index) => sources.append(link(data.sources[key], `${t('官方依据', 'Official source')}${index + 1} ↗`))); card.append(sources);
      return card;
    }));
    if (!items.length) document.getElementById('funding-projects').append(el('p', 'submission-empty', t('没有符合筛选条件的项目。', 'No schemes match these filters.')));
    document.getElementById('funding-count').textContent = t(`显示 ${items.length} / ${all.length} 项`, `Showing ${items.length} of ${all.length} schemes`);
    document.getElementById('funding-summary').textContent = t(`已整理 ${all.length} 项公开政策与基金 · ${all.filter(x => state(x).id === 'open').length} 项处于申报窗口 · 窗口开放不等于符合资格`, `${all.length} public schemes · ${all.filter(x => state(x).id === 'open').length} windows open · an open window does not establish eligibility`);
    document.getElementById('funding-conflicts').replaceChildren(...data.conflicts.map(item => {
      const card = el('article', 'funding-rule'); card.append(el('span', 'funding-rule-type', ({ exclusive: t('互斥 / 不重复', 'Exclusion / no duplication'), qualification: t('资格口径不同', 'Different eligibility rules'), limit: t('限项', 'Project limit'), topup: t('就高补差', 'Higher-rate / top-up'), conditional: t('有条件兼容', 'Conditional compatibility') })[item.type]), el('h4', '', copy(item, 'name')), el('p', '', copy(item, 'rule')));
      const sources = el('div', 'submission-actions'); item.sourceKeys.forEach((key, i) => sources.append(link(data.sources[key], `${t('依据', 'Source')}${i + 1} ↗`))); card.append(sources); return card;
    }));
    const updates = (data.updates || []).slice(0, 12);
    document.getElementById('funding-updates').replaceChildren(...updates.map(item => {
      const row = el('li'); row.append(link(item.url, item.title + ' ↗'), el('span', '', t(`检测于${item.detectedDate} · 待复核，尚未替换已核验规则`, `Detected ${item.detectedDate} · pending review; verified rules unchanged`))); return row;
    }));
    if (!updates.length) document.getElementById('funding-updates').append(el('li', '', t('暂无已记录的新通知或内容变化；这不等于所有政策网站均已成功检查。', 'No new notices or changes recorded; this does not mean every source was successfully checked.')));
    const ok = data.monitors.filter(x => x.lastStatus === 'ok').length;
    const last = data.generatedAt ? new Date(data.generatedAt).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-GB', { timeZone: 'Asia/Shanghai', dateStyle: 'medium', timeStyle: 'short' }) : t('尚未运行', 'Not yet run');
    document.getElementById('funding-updated').textContent = t(`政策口径人工核验：${data.curatedDate} · 来源监测：${last} · 本次成功 ${ok}/${data.monitors.length}`, `Rules reviewed ${data.curatedDate} · Sources checked ${last} · ${ok}/${data.monitors.length} successful`);
    const w = data.platformWindow;
    document.getElementById('funding-platform-window').textContent = w ? t(`宁波博士后业务平台当前显示：${w.start} 至 ${w.end}（${w.status}）。这是平台受理窗口，不是所有个人的统一资格截止；个人仍须满足在站、开题、参保等条件。`, `The Ningbo postdoc service platform displays ${w.start} to ${w.end}. This is a service window, not a universal eligibility deadline; milestone and insurance conditions still apply.`) : '';
    document.getElementById('funding-monitors').replaceChildren(...data.monitors.map(item => {
      const row = el('li'); row.append(link(item.url, item.name + ' ↗'), el('span', '', item.lastStatus === 'ok' ? t('本次读取成功', 'Read successfully') : t('本次未核验 · 保留已核验资料', 'Not verified this run · retained reviewed information'))); return row;
    }));
  }
  [category, status].forEach(n => n.addEventListener('change', render)); search.addEventListener('input', render);
  document.addEventListener('site:language', event => { language = event.detail.language; render(); });
  render();
})();
