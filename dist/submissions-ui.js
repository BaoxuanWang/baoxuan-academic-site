(function () {
  const data = window.BAOXUAN_SUBMISSIONS;
  if (!data || !document.getElementById('submission-journals')) return;
  let language = document.documentElement.lang.startsWith('zh') ? 'zh' : 'en';
  const t = (zh, en) => language === 'zh' ? zh : en;
  const copy = (item, key) => item[key + (language === 'zh' ? 'Zh' : 'En')];
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
  const link = (url, text, cls = '') => { const n = el('a', cls, text); n.href = url; n.target = '_blank'; n.rel = 'noopener noreferrer'; return n; };
  const dateKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const journals = window.BAOXUAN_JOURNALS || {};
  const quartiles = window.BAOXUAN_QUARTILES || {};
  const topicControl = document.getElementById('submission-topic');
  const rankControl = document.getElementById('submission-quartile');
  const pastControl = document.getElementById('submission-show-past');
  function issueState(item) {
    if (item.closed || (item.deadline && item.deadline < dateKey())) return { cls: 'closed', label: t('已截止', 'Closed'), closed: true };
    if (item.openDate && item.openDate > dateKey()) return { cls: 'pending', label: t('尚未开放', 'Not yet open') };
    if (!item.deadline) return { cls: 'pending', label: t('截止日待核验', 'Deadline unverified') };
    if (item.sourceStatus === 'cached') return { cls: 'pending', label: t('最近有效征稿记录', 'Last valid call') };
    return { cls: 'open', label: t('征稿中', 'Open for submission') };
  }
  function matches(item, rank) {
    return (topicControl.value === 'all' || item.topics.includes(topicControl.value)) && (rankControl.value === 'all' || String(rank) === rankControl.value);
  }
  function detail(label, text) { const p = el('p'); p.append(el('strong', '', label), document.createTextNode(text)); return p; }
  function render() {
    const journalGrid = document.getElementById('submission-journals');
    const issueGrid = document.getElementById('submission-issues');
    const selected = data.journals.filter(item => matches(item, quartiles[item.name]?.jcr));
    journalGrid.replaceChildren(...selected.map(item => {
      const journal = journals[item.name] || {}, rank = quartiles[item.name]?.jcr;
      const card = el('article', 'submission-journal');
      const header = el('div', 'submission-journal-head');
      if (journal.cover) { const cover = link(journal.homepage, '', 'submission-cover'); const img = el('img'); img.src = journal.cover; img.alt = `${item.name} cover`; img.loading = 'lazy'; cover.append(img); header.append(cover); }
      const heading = el('div'); heading.append(el('span', 'submission-priority', copy(item, 'priority')), el('h4'));
      heading.lastChild.append(link(journal.homepage, `${item.name} ↗`));
      const metrics = el('div', 'submission-metrics');
      metrics.append(link(item.name === 'Ships and Offshore Structures' ? item.scopeUrl : (quartiles[item.name]?.jcrSource || journal.source), `JCR 2025 · Q${rank}`));
      if (journal.impactFactor != null) metrics.append(link(journal.source, `IF ${journal.impactFactor}`));
      heading.append(metrics); header.append(heading); card.append(header);
      card.append(el('p', 'submission-scope', copy(item, 'scope')), detail(t('适合的研究：', 'Research fit: '), copy(item, 'fit')));
      const more = el('details', 'submission-analysis'); more.append(el('summary', '', t('投稿前的重点与范围依据', 'What to strengthen before submission')));
      more.append(el('p', '', copy(item, 'advice')), link(item.scopeUrl, t('出版社范围说明 ↗', 'Publisher aims & scope ↗'))); card.append(more);
      const actions = el('div', 'submission-actions'); actions.append(link(journal.homepage, t('期刊主页 ↗', 'Journal website ↗')));
      if (journal.homepage.includes('sciencedirect.com')) actions.append(link(`${journal.homepage}/about/call-for-papers`, t('官网特刊目录 ↗', 'Official special issues ↗')));
      else actions.append(link(item.scopeUrl, t('范围与投稿说明 ↗', 'Scope & journal information ↗')));
      card.append(actions); return card;
    }));
    const selectedIssues = data.issues.filter(item => matches(item, item.jcr) && (pastControl.checked || !issueState(item).closed)).sort((a,b) => String(a.deadline || '9999').localeCompare(String(b.deadline || '9999')));
    issueGrid.replaceChildren(...selectedIssues.map(item => {
      const card = el('article', 'submission-issue'); const state = issueState(item);
      const top = el('div', 'submission-issue-top'); top.append(el('span', 'submission-priority', item.journal), el('span', `submission-state is-${state.cls}`, state.label));
      const heading = el('h4'); heading.append(link(item.url, `${item.title} ↗`));
      const badges = el('div', 'submission-metrics'); badges.append(link(item.rankSource, `JCR Q${item.jcr} · ${item.category}`), el('span', '', item.indexing));
      const deadline = el('p', 'submission-deadline', t(`全文截止：${item.deadline || '待公布'}`, `Manuscript deadline: ${item.deadline || 'TBA'}`));
      card.append(top, heading, badges, deadline, el('p', 'submission-scope', copy(item, 'scope')), detail(t('与你的研究契合点：', 'Fit with your work: '), copy(item, 'fit')));
      if (item.editors) card.append(el('p', 'submission-editors', t(`客座编辑：${item.editors}`, `Guest editors: ${item.editors}`)));
      const checkText = item.checkedDate
        ? t(`最近核验：${item.checkedDate} · ${item.sourceStatus === 'cached' ? '官网暂不可核验，保留最近记录' : '官网征稿页'}`, `Last verified: ${item.checkedDate} · ${item.sourceStatus === 'cached' ? 'Source unavailable; retained record' : 'Official call'}`)
        : t('已发现官网入口 · 当前征稿状态待核验', 'Official link found · Current call status unverified');
      card.append(el('p', 'submission-check', checkText));
      const actions = el('div', 'submission-actions'); actions.append(link(item.url, t('查看征稿与投稿入口 ↗', 'Official call & submission ↗')), link(item.journalUrl, t('期刊主页 ↗', 'Journal website ↗'))); card.append(actions); return card;
    }));
    if (!selected.length) journalGrid.append(el('p', 'submission-empty', t('该筛选下暂无推荐期刊。', 'No journals match these filters.')));
    if (!selectedIssues.length) issueGrid.append(el('p', 'submission-empty', t('该筛选下暂无未截止的已核验特刊，可查看期刊官网征稿目录。', 'No tracked calls match these filters; check the journal call directories.')));
    document.getElementById('submission-count').textContent = t(`${selected.length} 本期刊 · ${selectedIssues.length} 个特刊`, `${selected.length} journals · ${selectedIssues.length} calls`);
    const attempt = data.generatedAt ? new Date(data.generatedAt).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-GB', { timeZone: 'Asia/Shanghai', dateStyle: 'medium', timeStyle: 'short' }) : data.curatedDate;
    document.getElementById('submission-updated').textContent = t(`每日检查已追踪征稿 · 最近检查 ${attempt}`, `Tracked calls checked daily · Last check ${attempt}`);
  }
  [topicControl, rankControl, pastControl].forEach(control => control.addEventListener('change', render));
  document.addEventListener('site:language', event => { language = event.detail.language; render(); });
  render();
})();
