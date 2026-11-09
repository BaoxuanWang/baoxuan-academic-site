(function () {
  const orcid = 'https://orcid.org/0000-0001-8802-6800';
  const button = document.getElementById('language-switch');
  const journals = window.BAOXUAN_JOURNALS || {};
  const quartiles = window.BAOXUAN_QUARTILES || {};
  const scholar = window.BAOXUAN_SCHOLAR || {};
  const xinruiSource = 'https://kjc.cdmc.edu.cn/module/download/downfile.jsp?classid=0&filename=77490d1d77c14c02936e1737479be025.xlsx';
  let language = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'zh';
  let works = window.BAOXUAN_WORKS || [];
  let filter = 'all';
  let orcidLive = false;
  let citationState = 'loading';
  let coverage = '';
  let updatedAt = null;
  const t = (zh, en) => language === 'zh' ? zh : en;
  const doiKey = (value) => String(value || '').replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').trim().toLowerCase();
  const number = (value) => Number(value).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US');
  const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text != null) node.textContent = text; return node; };

  function appendQuartiles(root, name, compact = false) {
    const ranks = quartiles[name];
    const journal = journals[name];
    if (!ranks) return;
    for (const [label, value, source, title] of [
      [t('中科院', 'CAS'), ranks.cas && `${ranks.cas} ${t('区', '')}`, ranks.casSource || journal?.source, t(`2025 中科院大类：${ranks.category}`, `2025 CAS major category: ${ranks.category}`)],
      ['JCR', ranks.jcr && `Q${ranks.jcr}`, ranks.jcrSource || journal?.source, t('2025 JCR 最优学科分位', '2025 JCR best category quartile')]
    ]) {
      if (!value || !source) continue;
      const link = el('a', compact ? '' : 'fact-badge', `${label} ${value}${compact ? '' : ' · 2025'}`);
      link.href = source; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.title = title;
      root.append(link);
    }
  }

  function journalCover(name, compact = false) {
    const journal = journals[name];
    if (!journal?.homepage) return null;
    const cover = el('a', `journal-cover${compact ? ' journal-cover-compact' : ''}`);
    cover.href = journal.homepage;
    cover.target = '_blank';
    cover.rel = 'noopener noreferrer';
    cover.setAttribute('aria-label', t(`打开 ${name} 期刊官网`, `Open the ${name} journal website`));
    cover.style.setProperty('--cover-seed', String([...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5));
    cover.append(
      el('span', 'journal-cover-masthead', journal.publisher || t('期刊', 'Journal')),
      el('span', 'journal-cover-title', name),
      el('span', 'journal-cover-foot', t('期刊官网 ↗', 'Journal site ↗'))
    );
    return cover;
  }

  function renderScholar() {
    const has = (value) => value != null && Number.isFinite(Number(value)) && Number(value) >= 0;
    document.getElementById('scholar-citations-total').textContent = has(scholar.citations) ? number(scholar.citations) : '—';
    document.getElementById('scholar-citations-external').textContent = has(scholar.external) ? number(scholar.external) : '—';
    const date = scholar.updated || t('待录入', 'Pending');
    document.getElementById('scholar-updated').textContent = has(scholar.citations) ? date : t('待录入', 'Pending');
    document.getElementById('scholar-external-updated').textContent = has(scholar.external) ? date : t('待录入', 'Pending');
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
      const work = { title, year: item['publication-date']?.year?.value || '', type: item.type || '', doi: doiKey(doi), journal: item['journal-title']?.value || '', url: item.url?.value || `https://doi.org/${doiKey(doi)}` };
      const key = title.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!unique.has(key) || (unique.get(key).type === 'preprint' && work.type !== 'preprint')) unique.set(key, work);
    }
    return [...unique.values()].sort((a, b) => Number(b.year) - Number(a.year) || a.title.localeCompare(b.title));
  }

  function renderWorks() {
    const query = document.getElementById('works-search').value.trim().toLowerCase();
    const visible = works.filter((work) => (filter === 'all' || work.type === filter) && (!query || `${work.title} ${work.journal} ${work.doi} ${work.year}`.toLowerCase().includes(query)));
    const list = document.getElementById('publication-list');
    const fragment = document.createDocumentFragment();
    const labels = { 'journal-article': t('期刊论文', 'Article'), 'conference-paper': t('会议论文', 'Conference'), preprint: t('预印本', 'Preprint') };
    for (const work of visible) {
      const article = el('article', 'publication');
      article.append(el('span', 'publication-year', work.year || '—'));
      const journal = journals[work.journal];
      const cover = journalCover(work.journal);
      if (cover) article.append(cover);
      else article.classList.add('publication-no-cover');
      const body = el('div', 'publication-body');
      const heading = el('h3');
      const link = el('a', '', work.title);
      link.href = `https://doi.org/${encodeURI(work.doi)}`;
      link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.append(el('span', '', ' ↗'));
      heading.append(link, el('span', 'publication-type', labels[work.type] || work.type));
      const publicationMeta = el('p');
      if (journal?.homepage) {
        const journalLink = el('a', 'publication-journal-link', `${work.journal} ↗`);
        journalLink.href = journal.homepage; journalLink.target = '_blank'; journalLink.rel = 'noopener noreferrer';
        publicationMeta.append(journalLink);
      } else publicationMeta.append(document.createTextNode(work.journal || t('预印本', 'Preprint')));
      publicationMeta.append(document.createTextNode(` · DOI: ${work.doi}`));
      body.append(heading, publicationMeta);
      const facts = el('div', 'publication-facts');
      if (journal?.impactFactor != null) {
        const badge = el('a', 'fact-badge', `IF ${journal.impactFactor} · 2025`);
        badge.href = journal.source; badge.target = '_blank'; badge.rel = 'noopener noreferrer'; facts.append(badge);
      }
      if (journal?.xinrui) {
        const badge = el('a', 'fact-badge', t(`新锐 ${journal.xinrui} 区 · 2026`, `XinRui Q${journal.xinrui} · 2026`));
        badge.href = xinruiSource; badge.target = '_blank'; badge.rel = 'noopener noreferrer'; facts.append(badge);
      }
      appendQuartiles(facts, work.journal);
      if (journal?.wos) facts.append(el('span', 'fact-badge fact-coverage', t(`期刊 ${journal.wos}`, `Journal ${journal.wos}`)));
      if (journal?.ei) facts.append(el('span', 'fact-badge fact-coverage', t('期刊 EI', 'Journal EI')));
      if (work.type !== 'preprint') facts.append(el('span', 'fact-badge fact-pending', t('单篇 SCI/EI 待核验', 'Article SCI/EI unverified')));
      if (facts.childNodes.length) body.append(facts);
      article.append(body); fragment.append(article);
    }
    if (!visible.length) fragment.append(el('p', 'publication-empty', t('没有匹配的成果。', 'No matching works.')));
    list.replaceChildren(fragment);
    document.getElementById('works-count').textContent = number(works.length);
    document.getElementById('works-visible-count').textContent = t(`显示 ${visible.length} / ${works.length} 项成果`, `Showing ${visible.length} of ${works.length} works`);
  }

  function renderReviewerMetrics() {
    document.querySelectorAll('.reviewer-list li').forEach((item) => {
      const name = item.dataset.journal || item.textContent.trim();
      item.dataset.journal = name;
      const journal = journals[name];
      const body = el('span', 'reviewer-body');
      const nameNode = journal?.homepage ? el('a', 'reviewer-name', `${name} ↗`) : el('span', 'reviewer-name', name);
      if (journal?.homepage) { nameNode.href = journal.homepage; nameNode.target = '_blank'; nameNode.rel = 'noopener noreferrer'; }
      body.append(nameNode);
      const meta = el('span', 'reviewer-meta');
      if (journal?.impactFactor != null) {
        const link = el('a', '', `IF ${journal.impactFactor}`);
        link.href = journal.source; link.target = '_blank'; link.rel = 'noopener noreferrer'; meta.append(link);
      }
      if (journal?.xinrui) {
        const link = el('a', '', t(`新锐 ${journal.xinrui} 区`, `XinRui Q${journal.xinrui}`));
        link.href = xinruiSource; link.target = '_blank'; link.rel = 'noopener noreferrer'; meta.append(link);
      }
      appendQuartiles(meta, name, true);
      if (!meta.childNodes.length) meta.append(el('span', '', t('暂无公开 JIF / 分区', 'No published JIF / ranking')));
      body.append(meta);
      const cover = journalCover(name, true);
      item.replaceChildren(...(cover ? [cover, body] : [body]));
    });
  }

  function renderStatus() {
    const dot = document.getElementById('data-status-dot');
    dot.classList.toggle('is-live', citationState === 'live');
    dot.classList.toggle('is-error', citationState === 'error');
    const time = updatedAt?.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
    document.getElementById('data-status').textContent = citationState === 'loading'
      ? t('正在获取最新引用数据…', 'Loading current citation data…')
      : citationState === 'error'
        ? t('引用数据暂不可用；论文列表仍可浏览。', 'Citation data is temporarily unavailable; the works list remains available.')
        : t(`OpenAlex 本次获取：${time} · 已匹配 ${coverage} 项 ORCID 成果${orcidLive ? '' : ' · 论文列表采用本地备份'}`, `OpenAlex fetched ${time} · ${coverage} ORCID works matched${orcidLive ? '' : ' · Publication list uses a local backup'}`);
  }

  function render() {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-zh][data-en]').forEach((node) => { node.textContent = node.dataset[language]; });
    button.innerHTML = language === 'zh' ? 'EN <span aria-hidden="true">↗</span>' : '中文 <span aria-hidden="true">↗</span>';
    button.setAttribute('aria-label', language === 'zh' ? 'Switch to English' : '切换到中文');
    document.getElementById('works-search').placeholder = t('搜索标题、期刊或 DOI', 'Search title, journal or DOI');
    document.getElementById('citations-total').textContent = document.getElementById('citations-total').dataset.value ? number(document.getElementById('citations-total').dataset.value) : '—';
    document.getElementById('citations-external').textContent = document.getElementById('citations-external').dataset.value ? number(document.getElementById('citations-external').dataset.value) : '—';
    renderScholar();
    renderWorks(); renderReviewerMetrics(); renderStatus();
  }

  async function getJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18000);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally { clearTimeout(timer); }
  }

  async function loadOrcid() {
    try {
      const liveWorks = fromOrcid(await getJson('https://pub.orcid.org/v3.0/0000-0001-8802-6800/works'));
      if (!liveWorks.length) throw new Error('Empty ORCID list');
      works = liveWorks; orcidLive = true; renderWorks(); renderStatus();
    } catch (error) { console.warn('ORCID refresh unavailable:', error); }
  }

  async function loadCitations() {
    try {
      const dois = [...new Set(works.map((work) => doiKey(work.doi)).filter(Boolean))];
      if (!dois.length) throw new Error('No DOIs');
      const indexedUrl = new URL('https://api.openalex.org/works');
      indexedUrl.searchParams.set('filter', `doi:${dois.join('|')}`);
      indexedUrl.searchParams.set('per_page', '200');
      indexedUrl.searchParams.set('select', 'id,doi,cited_by_count');
      const indexed = await getJson(indexedUrl);
      const doiSet = new Set(dois);
      const matched = (indexed.results || []).filter((work) => doiSet.has(doiKey(work.doi)));
      if (!matched.length) throw new Error('No OpenAlex matches');
      const total = matched.reduce((sum, work) => sum + (Number(work.cited_by_count) || 0), 0);
      const ids = new Set(matched.map((work) => work.id));
      const cited = matched.map((work) => work.id.split('/').pop());
      const selfUrl = new URL('https://api.openalex.org/works');
      selfUrl.searchParams.set('filter', `cites:${cited.join('|')},author.orcid:${orcid}`);
      selfUrl.searchParams.set('per_page', '200');
      selfUrl.searchParams.set('select', 'id,authorships,referenced_works');
      let self = 0, page = 1, count = 0;
      do {
        selfUrl.searchParams.set('page', String(page));
        const citing = await getJson(selfUrl);
        count = Number(citing.meta?.count) || 0;
        for (const work of citing.results || []) {
          if (!(work.authorships || []).some((entry) => entry.author?.orcid === orcid)) continue;
          for (const reference of work.referenced_works || []) if (ids.has(reference)) self += 1;
        }
        page += 1;
      } while ((page - 1) * 200 < count && page <= 10);
      document.getElementById('citations-total').dataset.value = String(total);
      document.getElementById('citations-external').dataset.value = String(Math.max(0, total - self));
      coverage = `${matched.length}/${dois.length}`;
      updatedAt = new Date(); citationState = 'live';
    } catch (error) { citationState = 'error'; console.warn('OpenAlex refresh unavailable:', error); }
    render();
  }

  button.addEventListener('click', () => {
    language = language === 'zh' ? 'en' : 'zh';
    const url = new URL(location.href);
    if (language === 'en') url.searchParams.set('lang', 'en'); else url.searchParams.delete('lang');
    history.replaceState(null, '', url); render();
  });
  document.getElementById('works-search').addEventListener('input', renderWorks);
  document.querySelectorAll('.filter-button').forEach((item) => item.addEventListener('click', () => {
    filter = item.dataset.filter;
    document.querySelectorAll('.filter-button').forEach((node) => node.classList.toggle('is-active', node === item));
    renderWorks();
  }));
  document.getElementById('year').textContent = String(new Date().getFullYear());
  render(); loadOrcid().then(loadCitations);
})();
