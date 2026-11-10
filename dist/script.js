(function () {
  const orcid = 'https://orcid.org/0000-0001-8802-6800';
  const button = document.getElementById('language-switch');
  const journals = window.BAOXUAN_JOURNALS || {};
  const quartiles = window.BAOXUAN_QUARTILES || {};
  const scholar = window.BAOXUAN_SCHOLAR || {};
  const semantic = window.BAOXUAN_SEMANTIC_SCHOLAR || { works: {} };
  const cnki = window.BAOXUAN_CNKI_CITATIONS || { works: {} };
  const service = window.BAOXUAN_SERVICE || { editorial: [], reviewers: [] };
  const dailySnapshot = window.BAOXUAN_ACADEMIC_SNAPSHOT || null;
  const xinruiSource = 'https://kjc.cdmc.edu.cn/module/download/downfile.jsp?classid=0&filename=77490d1d77c14c02936e1737479be025.xlsx';
  let language = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'zh';
  let works = window.BAOXUAN_WORKS || [];
  let filter = 'all';
  let orcidLive = false;
  const semanticAvailable = Number.isFinite(Number(semantic.citations)) && semantic.generatedAt;
  let citationState = semanticAvailable ? 'semantic' : dailySnapshot ? 'daily' : 'loading';
  let coverage = semanticAvailable ? semantic.coverage : dailySnapshot?.coverage || '';
  let updatedAt = semanticAvailable ? new Date(semantic.generatedAt) : dailySnapshot?.generatedAt ? new Date(dailySnapshot.generatedAt) : null;
  const t = (zh, en) => language === 'zh' ? zh : en;
  const doiKey = (value) => String(value || '').replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').trim().toLowerCase();
  const number = (value) => Number(value).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US');
  const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text != null) node.textContent = text; return node; };
  if (semanticAvailable || dailySnapshot) {
    document.getElementById('citations-total').dataset.value = String(semanticAvailable ? semantic.citations : dailySnapshot.citations);
    document.getElementById('citations-external').dataset.value = String(dailySnapshot?.externalCitations ?? '');
  }

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
    if (!journal?.homepage || !journal?.cover) return null;
    const cover = el('a', `journal-cover${compact ? ' journal-cover-compact' : ''}`);
    cover.href = journal.homepage;
    cover.target = '_blank';
    cover.rel = 'noopener noreferrer';
    cover.setAttribute('aria-label', t(`打开 ${name} 期刊官网`, `Open the ${name} journal website`));
    const image = el('img');
    image.src = journal.cover;
    image.alt = t(`${name} 真实期刊封面`, `Real cover of ${name}`);
    image.loading = 'eager'; image.decoding = 'sync';
    cover.append(image);
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

  function renderPortfolio() {
    const articles = works.filter((work) => work.type === 'journal-article' && work.journal);
    const groups = new Map();
    for (const work of articles) groups.set(work.journal, (groups.get(work.journal) || 0) + 1);
    const sci = articles.filter((work) => journals[work.journal]?.wos === 'SCIE').length;
    const firstAuthor = articles.filter((work) => work.firstAuthor ?? dailySnapshot?.works?.[doiKey(work.doi)]?.firstAuthor).length;
    const totals = document.getElementById('portfolio-totals');
    const items = [
      [t('期刊论文', 'Journal articles'), articles.length],
      [t('发表期刊', 'Journals'), groups.size],
      [t('SCIE 期刊论文', 'SCIE journal articles'), sci],
      [t('第一作者', 'First author'), firstAuthor]
    ];
    totals.replaceChildren(...items.map(([label, value]) => {
      const item = el('span', 'portfolio-total');
      item.append(el('strong', '', number(value)), el('small', '', label));
      return item;
    }));
    const grid = document.getElementById('journal-portfolio-grid');
    const fragment = document.createDocumentFragment();
    for (const [name, count] of [...groups].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
      const journal = journals[name];
      const card = el(journal?.homepage ? 'a' : 'div', 'portfolio-journal');
      if (journal?.homepage) { card.href = journal.homepage; card.target = '_blank'; card.rel = 'noopener noreferrer'; }
      const cover = journalCover(name, true);
      const text = el('span', 'portfolio-journal-copy');
      text.append(el('strong', '', name), el('small', '', t(`${count} 篇论文`, `${count} article${count === 1 ? '' : 's'}`)));
      card.append(...(cover ? [cover.firstChild, text] : [text]));
      fragment.append(card);
    }
    grid.replaceChildren(fragment);
    document.getElementById('portfolio-author-note').textContent = t(
      '第一作者按 ORCID 与完整作者顺序统计，并以规范姓名匹配补足缺失的 ORCID 关联；通讯作者需由论文原文核验。',
      'First authorship uses ORCID and full author order, with normalized-name matching when an ORCID link is missing. Corresponding authorship requires verification from the paper.'
    );
  }

  function citationSummary(work) {
    const doi = doiKey(work.doi);
    const google = scholar.works?.[doi];
    const semanticScholar = semantic.works?.[doi];
    const openalex = dailySnapshot?.works?.[doi];
    const chinese = cnki.works?.[doi];
    return { doi, google, semanticScholar, openalex, chinese };
  }

  async function showCitationDetails(root, work, summary) {
    root.hidden = false;
    root.replaceChildren(el('p', 'citation-loading', t('正在获取施引文献…', 'Loading citing documents…')));
    const fragment = document.createDocumentFragment();
    const header = el('div', 'citation-detail-head');
    header.append(el('strong', '', t('施引文献详情', 'Citing documents')));
    if (summary.google?.citedByUrl) {
      const link = el('a', '', 'Google Scholar ↗');
      link.href = summary.google.citedByUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; header.append(link);
    }
    fragment.append(header);
    const semanticSection = el('section', 'citation-source');
    semanticSection.append(el('h4', '', 'Semantic Scholar'));
    if (summary.semanticScholar?.paperId) {
      try {
        const url = new URL(`https://api.semanticscholar.org/graph/v1/paper/${summary.semanticScholar.paperId}/citations`);
        url.searchParams.set('limit', '100');
        url.searchParams.set('fields', 'title,authors,year,url');
        const data = await getJson(url);
        const list = el('ol', 'citation-list');
        for (const record of data.data || []) {
          const paper = record.citingPaper || {};
          const item = el('li');
          const titleNode = paper.url ? el('a', '', paper.title || t('未命名文献', 'Untitled work')) : el('span', '', paper.title || t('未命名文献', 'Untitled work'));
          if (paper.url) { titleNode.href = paper.url; titleNode.target = '_blank'; titleNode.rel = 'noopener noreferrer'; }
          item.append(titleNode, el('small', '', [(paper.authors || []).map((author) => author.name).join(', '), paper.year].filter(Boolean).join(' · '))); list.append(item);
        }
        semanticSection.append(list.childNodes.length ? list : el('p', '', t('暂无 Semantic Scholar 施引记录。', 'No Semantic Scholar citing records.')));
        if (data.next != null) semanticSection.append(el('p', 'citation-more', t('显示前 100 条记录', 'Showing the first 100 records')));
      } catch (error) { semanticSection.append(el('p', '', t('Semantic Scholar 详情暂不可用。', 'Semantic Scholar details are temporarily unavailable.'))); }
    } else semanticSection.append(el('p', '', t('暂无 Semantic Scholar 匹配记录。', 'No Semantic Scholar match.')));
    fragment.append(semanticSection);
    const openalexSection = el('section', 'citation-source');
    openalexSection.append(el('h4', '', 'OpenAlex'));
    if (summary.openalex?.id) {
      try {
        const url = new URL('https://api.openalex.org/works');
        url.searchParams.set('filter', `cites:${summary.openalex.id}`);
        url.searchParams.set('per_page', '100');
        url.searchParams.set('select', 'display_name,publication_year,authorships,doi,primary_location');
        const data = await getJson(url);
        const list = el('ol', 'citation-list');
        for (const item of data.results || []) {
          const entry = el('li');
          const title = item.display_name || t('未命名文献', 'Untitled work');
          const href = item.doi || item.primary_location?.landing_page_url;
          const titleNode = href ? el('a', '', title) : el('span', '', title);
          if (href) { titleNode.href = href; titleNode.target = '_blank'; titleNode.rel = 'noopener noreferrer'; }
          const authors = (item.authorships || []).slice(0, 4).map((author) => author.author?.display_name).filter(Boolean).join(', ');
          entry.append(titleNode, el('small', '', `${authors}${authors && item.publication_year ? ' · ' : ''}${item.publication_year || ''}`));
          list.append(entry);
        }
        openalexSection.append(list.childNodes.length ? list : el('p', '', t('暂无施引记录。', 'No citing records.')));
        if (Number(data.meta?.count) > 100) openalexSection.append(el('p', 'citation-more', t(`显示前 100 / ${number(data.meta.count)} 条`, `Showing 100 of ${number(data.meta.count)}`)));
      } catch (error) { openalexSection.append(el('p', '', t('OpenAlex 详情暂不可用。', 'OpenAlex details are temporarily unavailable.'))); }
    } else openalexSection.append(el('p', '', t('暂无 OpenAlex 匹配记录。', 'No OpenAlex match.')));
    fragment.append(openalexSection);
    const cnkiSection = el('section', 'citation-source');
    cnkiSection.append(el('h4', '', t('中国知网中文施引', 'CNKI Chinese citations')));
    const records = summary.chinese?.citations || [];
    if (records.length) {
      const list = el('ol', 'citation-list');
      for (const record of records) {
        const item = el('li');
        const titleNode = record.url ? el('a', '', record.title) : el('span', '', record.title);
        if (record.url) { titleNode.href = record.url; titleNode.target = '_blank'; titleNode.rel = 'noopener noreferrer'; }
        item.append(titleNode, el('small', '', [record.authors, record.year].filter(Boolean).join(' · '))); list.append(item);
      }
      cnkiSection.append(list);
    } else cnkiSection.append(el('p', '', t('等待导入知网“引证文献”检索记录。', 'Awaiting an exported CNKI citing-document record.')));
    fragment.append(cnkiSection);
    root.replaceChildren(fragment);
  }

  function renderWorks() {
    const query = document.getElementById('works-search').value.trim().toLowerCase();
    const visible = works.filter((work) => (filter === 'all' || work.type === filter) && (!query || `${work.title} ${work.journal} ${work.doi} ${work.year}`.toLowerCase().includes(query)));
    const list = document.getElementById('publication-list');
    const fragment = document.createDocumentFragment();
    const labels = { 'journal-article': t('期刊论文', 'Article'), 'conference-paper': t('会议论文', 'Conference'), preprint: t('预印本', 'Preprint') };
    for (const work of visible) {
      const article = el('article', 'publication');
      const journal = journals[work.journal];
      const cover = journalCover(work.journal);
      const side = el('div', 'publication-side');
      side.append(el('span', 'publication-year', work.year || '—'));
      if (cover) side.append(cover);
      article.append(side);
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
      body.append(heading);
      const authors = work.authors?.length ? work.authors : dailySnapshot?.works?.[doiKey(work.doi)]?.authors || [];
      if (authors.length) {
        const authorLine = el('p', 'publication-authors');
        authors.forEach((author, index) => {
          if (index) authorLine.append(document.createTextNode(', '));
          const authorNode = el('span', /^(baoxuan\s+wang|wang,?\s+baoxuan)$/i.test(author.trim()) ? 'is-profile-author' : '', author);
          authorLine.append(authorNode);
        });
        body.append(authorLine);
      }
      body.append(publicationMeta);
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
      if (journal?.letpub) {
        const letpub = el('a', 'fact-badge', t('LetPub 实时指标 ↗', 'LetPub live metrics ↗'));
        letpub.href = journal.letpub; letpub.target = '_blank'; letpub.rel = 'noopener noreferrer'; facts.append(letpub);
      }
      if (journal?.wos) facts.append(el('span', 'fact-badge fact-coverage', t(`期刊 ${journal.wos}`, `Journal ${journal.wos}`)));
      if (journal?.ei) facts.append(el('span', 'fact-badge fact-coverage', t('期刊 EI', 'Journal EI')));
      if (work.type !== 'preprint') facts.append(el('span', 'fact-badge fact-pending', t('单篇 SCI/EI 待核验', 'Article SCI/EI unverified')));
      const citations = citationSummary(work);
      if (citations.google && Number.isFinite(Number(citations.google.total))) facts.append(el('span', 'fact-badge fact-citation', `Google Scholar ${t('总引用', 'total')} ${number(citations.google.total)}`));
      else if (citations.semanticScholar) facts.append(el('span', 'fact-badge fact-citation', `Semantic Scholar ${t('总引用', 'total')} ${number(citations.semanticScholar.total)}`));
      else if (citations.openalex) facts.append(el('span', 'fact-badge fact-citation', `OpenAlex ${t('总引用', 'total')} ${number(citations.openalex.total)} · ${t('备用', 'fallback')}`));
      if (citations.openalex) facts.append(el('span', 'fact-badge fact-citation', `OpenAlex ${t('他引', 'external')} ${number(citations.openalex.external)}`));
      if (citations.chinese && Number.isFinite(Number(citations.chinese.total))) facts.append(el('span', 'fact-badge fact-cnki', `CNKI ${t('中文施引', 'Chinese citing')} ${number(citations.chinese.total)}`));
      else facts.append(el('span', 'fact-badge fact-pending', `CNKI ${t('待导入', 'pending')}`));
      if (facts.childNodes.length) body.append(facts);
      if (citations.semanticScholar || citations.openalex || citations.google || citations.chinese) {
        const detailButton = el('button', 'citation-detail-button', t('查看施引文献详情', 'View citing documents'));
        detailButton.type = 'button'; detailButton.setAttribute('aria-expanded', 'false');
        const detail = el('div', 'citation-detail'); detail.hidden = true;
        detailButton.addEventListener('click', () => {
          const opening = detail.hidden;
          detail.hidden = !opening; detailButton.setAttribute('aria-expanded', String(opening));
          if (opening && !detail.dataset.loaded) { detail.dataset.loaded = 'true'; showCitationDetails(detail, work, citations); }
        });
        body.append(detailButton, detail);
      }
      article.append(body); fragment.append(article);
    }
    if (!visible.length) fragment.append(el('p', 'publication-empty', t('没有匹配的成果。', 'No matching works.')));
    list.replaceChildren(fragment);
    document.getElementById('works-count').textContent = number(works.length);
    document.getElementById('works-visible-count').textContent = t(`显示 ${visible.length} / ${works.length} 项成果`, `Showing ${visible.length} of ${works.length} works`);
    renderPortfolio();
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
      if (journal?.letpub) {
        const link = el('a', '', t('LetPub 实时指标', 'LetPub live metrics'));
        link.href = journal.letpub; link.target = '_blank'; link.rel = 'noopener noreferrer'; meta.append(link);
      }
      if (!meta.childNodes.length) meta.append(el('span', '', t('暂无公开 JIF / 分区', 'No published JIF / ranking')));
      body.append(meta);
      const cover = journalCover(name, true);
      item.classList.toggle('reviewer-no-cover', !cover);
      item.replaceChildren(...(cover ? [cover, body] : [body]));
    });
  }

  function renderService() {
    const editorial = document.getElementById('editorial-list');
    const reviewer = document.getElementById('reviewer-list');
    editorial.replaceChildren(...service.editorial.map((name) => el('li', '', name)));
    reviewer.replaceChildren(...service.reviewers.map((name) => el('li', '', name)));
  }

  function renderStatus() {
    const dot = document.getElementById('data-status-dot');
    dot.classList.toggle('is-live', citationState === 'semantic' || citationState === 'live' || citationState === 'daily');
    dot.classList.toggle('is-error', citationState === 'error');
    const time = updatedAt?.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
    document.getElementById('data-status').textContent = citationState === 'loading'
      ? t('正在获取最新引用数据…', 'Loading current citation data…')
      : citationState === 'error'
        ? t('引用数据暂不可用；论文列表仍可浏览。', 'Citation data is temporarily unavailable; the works list remains available.')
        : citationState === 'semantic'
          ? t(`每日学术数据更新：${time} · Semantic Scholar 已匹配 ${coverage} 项成果`, `Daily academic update: ${time} · ${coverage} works matched in Semantic Scholar`)
        : citationState === 'daily'
          ? t(`每日学术数据更新：${time} · OpenAlex 已匹配 ${coverage} 项 ORCID 成果`, `Daily academic update: ${time} · ${coverage} ORCID works matched in OpenAlex`)
          : t(`OpenAlex 本次获取：${time} · 已匹配 ${coverage} 项 ORCID 成果${orcidLive ? '' : ' · 论文列表采用每日快照'}`, `OpenAlex fetched ${time} · ${coverage} ORCID works matched${orcidLive ? '' : ' · Publication list uses the daily snapshot'}`);
  }

  function render() {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-zh][data-en]').forEach((node) => { node.textContent = node.dataset[language]; });
    button.innerHTML = language === 'zh' ? 'EN <span aria-hidden="true">↗</span>' : '中文 <span aria-hidden="true">↗</span>';
    button.setAttribute('aria-label', language === 'zh' ? 'Switch to English' : '切换到中文');
    document.getElementById('works-search').placeholder = t('搜索标题、期刊或 DOI', 'Search title, journal or DOI');
    document.getElementById('citations-total').textContent = document.getElementById('citations-total').dataset.value ? number(document.getElementById('citations-total').dataset.value) : '—';
    document.getElementById('citations-external').textContent = document.getElementById('citations-external').dataset.value ? number(document.getElementById('citations-external').dataset.value) : '—';
    document.getElementById('citations-total-source').textContent = semanticAvailable ? 'Semantic Scholar' : t('OpenAlex · 备用', 'OpenAlex · fallback');
    document.getElementById('citations-external-source').textContent = semanticAvailable ? t('OpenAlex · 他引', 'OpenAlex · external') : t('OpenAlex · 备用', 'OpenAlex · fallback');
    renderScholar();
    renderWorks(); renderService(); renderReviewerMetrics(); renderStatus();
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
      const cached = new Map(works.map((work) => [doiKey(work.doi), work]));
      works = liveWorks.map((work) => ({ ...cached.get(doiKey(work.doi)), ...work }));
      orcidLive = true; renderWorks(); renderStatus();
    } catch (error) { console.warn('ORCID refresh unavailable:', error); }
  }

  async function loadCitations() {
    try {
      const dois = [...new Set(works.map((work) => doiKey(work.doi)).filter(Boolean))];
      if (!dois.length) throw new Error('No DOIs');
      const indexedUrl = new URL('https://api.openalex.org/works');
      indexedUrl.searchParams.set('filter', `doi:${dois.join('|')}`);
      indexedUrl.searchParams.set('per_page', '200');
      indexedUrl.searchParams.set('select', 'id,doi,cited_by_count,authorships');
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
      if (!semanticAvailable) {
        document.getElementById('citations-total').dataset.value = String(total);
        document.getElementById('citations-external').dataset.value = String(Math.max(0, total - self));
      }
      const byDoi = new Map(matched.map((item) => [doiKey(item.doi), item]));
      works = works.map((work) => {
        const item = byDoi.get(doiKey(work.doi));
        if (!item) return work;
        const authorships = item.authorships || [];
        const first = authorships.find((entry) => entry.author_position === 'first') || authorships[0];
        const firstName = String(first?.author?.display_name || '').toLowerCase().replace(/[^a-z]/g, '');
        return {
          ...work,
          authors: authorships.map((entry) => entry.author?.display_name).filter(Boolean),
          firstAuthor: first?.author?.orcid === orcid || firstName === 'baoxuanwang' || firstName === 'wangbaoxuan'
        };
      });
      if (!semanticAvailable) { coverage = `${matched.length}/${dois.length}`; updatedAt = new Date(); citationState = 'live'; }
    } catch (error) { citationState = semanticAvailable ? 'semantic' : dailySnapshot ? 'daily' : 'error'; console.warn('OpenAlex refresh unavailable:', error); }
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
