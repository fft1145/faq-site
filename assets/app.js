/* ================================================================
   FFT 统一 FAQ 中心 — 前端逻辑
   纯原生 JavaScript，无框架、无 CDN。
   ================================================================ */
(function () {
  'use strict';

  // 账号接口（玩家登录 / 管理员登录）由主站后端提供；Worker 上线后改成同一个 API 地址
  const MAIN_BASE = window.FFT_MAIN_BASE || 'https://fgame12.netlify.app';
  const LS_TOKEN = 'fft_faq_token';
  const LS_PROFILE = 'fft_faq_profile';
  const SS_ADMIN = 'fft_faq_admin_token';
  const MAX_COMMENT = 1000;

  const DEFAULT_SITE = {
    title: 'FFT 统一 FAQ 中心',
    subtitle: 'Better CMD、BMCL 与 Minecraft 服务器的常见问题，在这里一次找到答案。',
    notice: ''
  };

  const CATEGORY_LABELS = {
    bcmd: 'Better CMD',
    bmcl: 'BMCL',
    server: 'Minecraft 服务器'
  };
  const CATEGORY_ORDER = ['bcmd', 'bmcl', 'server'];

  const state = {
    site: Object.assign({}, DEFAULT_SITE),
    faqs: [],
    comments: new Map(),
    player: null,
    playerToken: '',
    adminToken: '',
    filter: 'all',
    query: '',
    openIds: new Set(),
    adminCommentsLoaded: false
  };

  const loadingComments = new Set();
  let toastTimer = null;

  /* ---------------- DOM helpers ---------------- */
  function $(id) { return document.getElementById(id); }

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function showToast(message, isError) {
    const toast = $('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle('error', Boolean(isError));
    toast.classList.remove('hidden');
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.add('hidden');
    }, 3200);
  }

  /* ---------------- HTTP helpers ---------------- */
  async function request(path, options) {
    const opts = options || {};
    const headers = {};
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.token) headers.Authorization = 'Bearer ' + opts.token;

    let res;
    try {
      res = await fetch(path, {
        method: opts.method || 'GET',
        headers: headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
      });
    } catch (err) {
      return { ok: false, status: 0, data: {}, message: '网络连接失败，请稍后重试' };
    }

    let data = {};
    try { data = await res.json(); } catch (err) { data = {}; }
    if (!data || typeof data !== 'object') data = {};

    return {
      ok: res.ok && data.success === true,
      status: res.status,
      data: data,
      message: data.message || ''
    };
  }

  function requestMain(path, options) {
    return request(MAIN_BASE + path, options);
  }

  function viewerToken() {
    return state.adminToken || state.playerToken || '';
  }

  /* ---------------- Rendering: site ---------------- */
  function applySite() {
    const site = state.site || DEFAULT_SITE;
    const title = site.title || DEFAULT_SITE.title;

    document.title = title + ' · FFT STUDIO';
    $('siteTitle').textContent = title;
    $('siteSubtitle').textContent = site.subtitle || '';

    const notice = String(site.notice || '').trim();
    const noticeEl = $('siteNotice');
    if (notice) {
      noticeEl.textContent = notice;
      noticeEl.classList.remove('hidden');
    } else {
      noticeEl.textContent = '';
      noticeEl.classList.add('hidden');
    }
  }

  /* ---------------- Rendering: filters ---------------- */
  function buildFilters() {
    const bar = $('filterBar');
    bar.textContent = '';

    const categories = CATEGORY_ORDER.filter(function (cat) {
      return state.faqs.some(function (faq) { return faq.category === cat; });
    });
    if (state.filter !== 'all' && categories.indexOf(state.filter) === -1) {
      state.filter = 'all';
    }

    function addButton(value, label) {
      const btn = make('button', 'filter-btn', label);
      btn.type = 'button';
      btn.dataset.filter = value;
      if (state.filter === value) btn.classList.add('active');
      bar.appendChild(btn);
    }

    addButton('all', '全部');
    categories.forEach(function (cat) {
      addButton(cat, CATEGORY_LABELS[cat] || cat);
    });
  }

  function updateFilterActive() {
    Array.prototype.forEach.call($('filterBar').querySelectorAll('[data-filter]'), function (btn) {
      btn.classList.toggle('active', btn.dataset.filter === state.filter);
    });
  }

  /* ---------------- Rendering: FAQ list ---------------- */
  function visibleFaqs() {
    const q = state.query.trim().toLowerCase();
    return state.faqs.filter(function (faq) {
      if (state.filter !== 'all' && faq.category !== state.filter) return false;
      if (!q) return true;
      const haystack = [
        faq.question || '',
        faq.answer || '',
        CATEGORY_LABELS[faq.category] || ''
      ].join(' ').toLowerCase();
      return haystack.indexOf(q) !== -1;
    });
  }

  function findFaqCard(faqId) {
    const cards = $('faqList').querySelectorAll('.faq-item');
    for (let i = 0; i < cards.length; i += 1) {
      if (cards[i].dataset.id === faqId) return cards[i];
    }
    return null;
  }

  function renderFaqList() {
    const list = $('faqList');
    const currentlyOpen = list.querySelectorAll('details[open]');
    Array.prototype.forEach.call(currentlyOpen, function (item) {
      state.openIds.add(item.dataset.id);
    });

    const visible = visibleFaqs();
    list.textContent = '';

    visible.forEach(function (faq) {
      list.appendChild(buildFaqCard(faq));
    });

    $('faqTotal').textContent = state.faqs.length ? String(state.faqs.length) : '—';
    $('resultCount').textContent = state.query.trim()
      ? '找到 ' + visible.length + ' 个问题'
      : '共 ' + state.faqs.length + ' 个问题';

    const empty = $('emptyState');
    empty.classList.toggle('hidden', !(state.faqs.length > 0 && visible.length === 0));
    if (state.faqs.length > 0 && visible.length === 0) {
      empty.textContent = state.query.trim()
        ? '没有找到匹配的问题，换个关键词试试。'
        : '当前筛选下暂无问题。';
    }

    visible.forEach(function (faq) {
      if (!state.openIds.has(faq.id)) return;
      if (state.comments.has(faq.id)) renderComments(faq.id);
      else loadComments(faq.id);
    });
  }

  function buildFaqCard(faq) {
    const details = make('details', 'faq-item');
    details.dataset.id = faq.id;
    if (state.openIds.has(faq.id)) details.open = true;

    const summary = make('summary');
    const category = faq.category && CATEGORY_LABELS[faq.category] ? faq.category : 'server';
    summary.appendChild(make('span', 'faq-cat cat-' + category, CATEGORY_LABELS[category] || '常见问题'));
    summary.appendChild(make('span', 'faq-q', faq.question || ''));
    const chev = make('span', 'faq-chev', '+');
    chev.setAttribute('aria-hidden', 'true');
    summary.appendChild(chev);

    const body = make('div', 'faq-body');
    body.appendChild(make('div', 'faq-answer', faq.answer || ''));

    const comments = make('div', 'faq-comments');
    comments.dataset.faqId = faq.id;

    const head = make('div', 'comments-head');
    const title = make('span', 'comments-title');
    title.appendChild(document.createTextNode('评论 '));
    title.appendChild(make('span', 'comments-count', '0'));
    head.appendChild(title);
    head.appendChild(make('span', 'comments-hint',
      state.player ? '已登录：' + (state.player.playerName || '玩家') : '登录后可评论与回复'));

    comments.appendChild(head);
    comments.appendChild(make('div', 'comment-list'));
    comments.appendChild(buildCommentForm(faq.id, null));

    body.appendChild(comments);
    details.appendChild(summary);
    details.appendChild(body);
    return details;
  }

  /* ---------------- Rendering: comments ---------------- */
  function formatTime(value) {
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    const pad = function (n) { return String(n).padStart(2, '0'); };
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
      ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }

  function buildCommentForm(faqId, parentId, replyToName) {
    const form = make('form', 'comment-form');
    form.dataset.faqId = faqId;
    if (parentId) form.dataset.parentId = parentId;

    const textarea = make('textarea');
    textarea.rows = parentId ? 2 : 3;
    textarea.maxLength = MAX_COMMENT;
    textarea.dataset.counter = '1';
    textarea.placeholder = state.player
      ? (parentId ? '回复 @' + (replyToName || '评论者') + '…' : '写下你的评论…（最多 1000 字）')
      : '登录后可发表评论';
    if (!state.player) textarea.disabled = true;

    const foot = make('div', 'form-foot');
    const count = make('span', 'char-count', '0 / 1000');
    const submit = make('button',
      state.player ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline',
      state.player ? (parentId ? '回复' : '发表评论') : '登录后评论');
    submit.type = 'submit';

    foot.appendChild(count);

    if (parentId) {
      const cancel = make('button', 'link-btn', '取消');
      cancel.type = 'button';
      cancel.dataset.cancelReply = '1';
      foot.appendChild(cancel);
    }

    foot.appendChild(submit);
    form.appendChild(textarea);
    form.appendChild(foot);
    return form;
  }

  function buildComment(comment, isReply, faqId) {
    const wrap = make('div', 'comment');
    wrap.dataset.id = comment.id;

    const head = make('div', 'comment-head');
    const name = comment.authorName || '玩家';
    const initial = Array.from(name)[0] || '?';
    head.appendChild(make('span', 'comment-avatar', initial));
    head.appendChild(make('span', 'comment-name', name));
    if (comment.authorIsAdmin) head.appendChild(make('span', 'badge-admin', '管理员'));

    const time = make('time', 'comment-time', formatTime(comment.createdAt));
    time.dateTime = comment.createdAt || '';
    head.appendChild(time);

    const text = make('div', 'comment-text', comment.content || '');

    const actions = make('div', 'comment-actions');
    const reply = make('button', 'link-btn', state.player ? '回复' : '登录后回复');
    reply.type = 'button';
    if (state.player) {
      reply.dataset.replyTo = comment.id;
      reply.dataset.replyName = name;
    } else {
      reply.dataset.needLogin = '1';
    }
    actions.appendChild(reply);

    if (comment.canDelete) {
      const del = make('button', 'link-btn danger', '删除');
      del.type = 'button';
      del.dataset.deleteComment = comment.id;
      del.dataset.faqId = faqId;
      actions.appendChild(del);
    }

    wrap.appendChild(head);
    wrap.appendChild(text);
    wrap.appendChild(actions);
    wrap.appendChild(make('div', 'reply-slot'));
    return wrap;
  }

  function renderComments(faqId) {
    const card = findFaqCard(faqId);
    if (!card) return;
    const holder = card.querySelector('.faq-comments');
    if (!holder) return;
    const list = holder.querySelector('.comment-list');
    if (!list) return;

    const all = (state.comments.get(faqId) || []).slice();
    const ids = new Set(all.map(function (c) { return c.id; }));

    list.textContent = '';

    const countEl = holder.querySelector('.comments-count');
    if (countEl) countEl.textContent = String(all.length);

    const tops = all.filter(function (c) {
      return !c.parentId || !ids.has(c.parentId);
    }).sort(function (a, b) {
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });

    if (tops.length === 0) {
      list.appendChild(make('p', 'comments-empty', '还没有评论，来说说你的想法吧。'));
      return;
    }

    tops.forEach(function (top) {
      const thread = make('div', 'comment-thread');
      thread.appendChild(buildComment(top, false, faqId));

      const replies = all.filter(function (c) {
        return c.parentId === top.id;
      }).sort(function (a, b) {
        return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
      });

      if (replies.length) {
        const box = make('div', 'comment-replies');
        replies.forEach(function (reply) {
          box.appendChild(buildComment(reply, true, faqId));
        });
        thread.appendChild(box);
      }

      list.appendChild(thread);
    });
  }

  async function loadComments(faqId) {
    if (loadingComments.has(faqId)) return;
    loadingComments.add(faqId);

    const card = findFaqCard(faqId);
    if (!card) {
      loadingComments.delete(faqId);
      return;
    }

    const holder = card.querySelector('.faq-comments');
    const list = holder ? holder.querySelector('.comment-list') : null;
    if (!list) {
      loadingComments.delete(faqId);
      return;
    }

    list.textContent = '';
    list.appendChild(make('p', 'comments-loading', '加载评论中…'));

    const res = await request('/api/comments?faqId=' + encodeURIComponent(faqId), {
      token: viewerToken()
    });

    loadingComments.delete(faqId);

    if (!res.ok) {
      list.textContent = '';
      list.appendChild(make('p', 'comments-error',
        res.status === 429 ? '操作过于频繁，请稍后再试。' : '评论加载失败，请稍后重试。'));
      return;
    }

    state.comments.set(faqId, Array.isArray(res.data.items) ? res.data.items : []);
    renderComments(faqId);
  }

  /* ---------------- FAQ data ---------------- */
  async function loadFaq() {
    const res = await request('/api/faq');
    if (!res.ok) {
      $('loadState').textContent = res.status === 404
        ? 'FAQ 接口暂不可用，请稍后刷新页面。'
        : (res.message || '常见问题加载失败，请稍后刷新页面。');
      $('loadState').classList.remove('hidden');
      return;
    }

    $('loadState').classList.add('hidden');
    state.site = res.data.site && typeof res.data.site === 'object'
      ? res.data.site
      : Object.assign({}, DEFAULT_SITE);
    state.faqs = Array.isArray(res.data.items) ? res.data.items : [];

    applySite();
    buildFilters();
    renderFaqList();
  }

  /* ---------------- Auth UI ---------------- */
  function renderAuth() {
    const loggedIn = Boolean(state.player);
    const isAdmin = Boolean(state.adminToken);
    const name = loggedIn ? (state.player.playerName || '玩家') : (isAdmin ? '管理员' : '账号');
    const initial = Array.from(name)[0] || '?';

    $('loginBtn').classList.toggle('hidden', loggedIn);
    $('adminLoginBtn').classList.toggle('hidden', isAdmin);
    $('accountMenu').classList.toggle('hidden', !(loggedIn || isAdmin));

    $('accountName').textContent = name;
    $('accountAvatar').textContent = initial;

    $('accountPanelAvatar').textContent = initial;
    $('accountPanelName').textContent = name;
    $('accountPanelEmail').textContent = loggedIn
      ? (state.player.email || '')
      : (isAdmin ? '管理员会话' : '');

    const rank = loggedIn && state.player.rankLabel ? state.player.rankLabel : '';
    $('accountPanelRank').textContent = rank;
    $('accountPanelRank').classList.toggle('hidden', !rank);
    $('accountPanelAdmin').classList.toggle('hidden', !isAdmin);
    $('accountAdminBtn').classList.toggle('hidden', !isAdmin);
    $('logoutBtn').textContent = loggedIn ? '退出登录' : '退出管理员';
  }

  function toggleAccountPanel(show) {
    const panel = $('accountPanel');
    const visible = typeof show === 'boolean' ? show : panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !visible);
    $('accountBtn').setAttribute('aria-expanded', visible ? 'true' : 'false');
  }

  function logout() {
    state.player = null;
    state.playerToken = '';
    state.adminToken = '';
    state.comments.clear();
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_PROFILE);
    sessionStorage.removeItem(SS_ADMIN);
    renderAuth();
    toggleAccountPanel(false);
    renderFaqList();
    showToast('已退出登录');
  }

  function savePlayer(token, player) {
    state.playerToken = token;
    state.player = player || {};
    localStorage.setItem(LS_TOKEN, token);
    try { localStorage.setItem(LS_PROFILE, JSON.stringify(player || {})); } catch (err) { /* ignore */ }
  }

  function readHashToken() {
    const raw = window.location.hash.replace(/^#/, '');
    if (!raw) return '';
    let token = '';
    if (raw.indexOf('=') !== -1) {
      try {
        const params = new URLSearchParams(raw);
        token = params.get('token') || params.get('access_token') || params.get('session') || '';
      } catch (err) { token = ''; }
    } else {
      token = raw;
    }
    try { token = decodeURIComponent(token); } catch (err) { /* keep raw */ }
    return token.trim();
  }

  function clearHash() {
    try {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch (err) {
      window.location.hash = '';
    }
  }

  async function restoreAuth() {
    const hashToken = readHashToken();
    if (hashToken) clearHash();

    const storedToken = localStorage.getItem(LS_TOKEN) || '';
    const token = hashToken || storedToken;
    if (!token) {
      renderAuth();
      return;
    }

    const res = await request('/api/auth/me', { method: 'POST', token: token });

    if (res.ok && res.data.player) {
      savePlayer(token, res.data.player);
      renderAuth();
      if (hashToken) showToast('已通过主站自动登录');
      return;
    }

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem(LS_TOKEN);
      localStorage.removeItem(LS_PROFILE);
      if (hashToken) showToast('自动登录失败，请使用邮箱和玩家名登录', true);
    } else if (res.status !== 0) {
      showToast('登录状态验证失败，请稍后刷新', true);
    }

    renderAuth();
  }

  /* ---------------- Player login ---------------- */
  async function handlePlayerLogin(event) {
    event.preventDefault();
    const email = $('loginEmail').value.trim();
    const playerName = $('loginName').value.trim();
    const msg = $('loginMsg');
    msg.classList.remove('ok');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      msg.textContent = '请输入正确的邮箱地址';
      return;
    }
    if (playerName.length < 2 || playerName.length > 24) {
      msg.textContent = '玩家名需为 2 到 24 位';
      return;
    }

    const button = $('loginSubmit');
    button.disabled = true;
    button.textContent = '登录中…';
    msg.textContent = '';

    const res = await requestMain('/api/player-login', {
      method: 'POST',
      body: { email: email, playerName: playerName }
    });

    button.disabled = false;
    button.textContent = '登录';

    if (!res.ok || !res.data.token) {
      msg.textContent = res.message || '邮箱或玩家名不匹配';
      return;
    }

    savePlayer(res.data.token, res.data.player);
    state.comments.clear();
    closeModal('loginModal');
    renderAuth();
    renderFaqList();
    showToast('登录成功，欢迎 ' + (res.data.player && res.data.player.playerName
      ? res.data.player.playerName
      : playerName));
  }

  /* ---------------- Admin login ---------------- */
  async function handleAdminLogin(event) {
    event.preventDefault();
    const username = $('adminUser').value.trim();
    const password = $('adminPass').value;
    const msg = $('adminLoginMsg');

    if (!username || !password) {
      msg.textContent = '请输入管理员用户名和密码';
      return;
    }

    const button = $('adminLoginSubmit');
    button.disabled = true;
    button.textContent = '登录中…';
    msg.textContent = '';

    const res = await requestMain('/api/admin-login', {
      method: 'POST',
      body: { username: username, password: password }
    });

    button.disabled = false;
    button.textContent = '登录';

    if (!res.ok || !res.data.token) {
      msg.textContent = res.message || '管理员账号或密码错误';
      return;
    }

    state.adminToken = res.data.token;
    sessionStorage.setItem(SS_ADMIN, res.data.token);
    $('adminPass').value = '';
    closeModal('adminLoginModal');
    renderAuth();
    showToast('管理员登录成功');
    openAdminPanel();
  }

  /* ---------------- Modals ---------------- */
  function openModal(id) {
    ['loginModal', 'adminLoginModal', 'adminPanel'].forEach(function (modalId) {
      if (!$(modalId)) return;
      if (modalId === id) $(modalId).classList.remove('hidden');
      else $(modalId).classList.add('hidden');
    });
    if ($(id)) $(id).classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function closeModal(id) {
    if ($(id)) $(id).classList.add('hidden');
    document.body.classList.remove('modal-open');
  }

  /* ---------------- Admin panel ---------------- */
  async function adminRequest(path, options) {
    const opts = Object.assign({}, options || {});
    opts.token = state.adminToken;
    const res = await request(path, opts);

    if (res.status === 401 || res.status === 403) {
      state.adminToken = '';
      sessionStorage.removeItem(SS_ADMIN);
      state.adminCommentsLoaded = false;
      renderAuth();
      closeModal('adminPanel');
      showToast('管理员登录已失效，请重新登录', true);
      openModal('adminLoginModal');
    }
    return res;
  }

  function openAdminPanel() {
    if (!state.adminToken) {
      openModal('adminLoginModal');
      return;
    }
    openModal('adminPanel');
    fillSiteForm();
    renderAdminFaqList();
    loadAdminComments();
  }

  function fillSiteForm() {
    $('siteTitleInput').value = (state.site && state.site.title) || '';
    $('siteSubtitleInput').value = (state.site && state.site.subtitle) || '';
    $('siteNoticeInput').value = (state.site && state.site.notice) || '';
  }

  function renderAdminFaqList() {
    const box = $('adminFaqList');
    box.textContent = '';
    $('adminFaqCount').textContent = state.faqs.length + ' 条';

    if (!state.faqs.length) {
      box.appendChild(make('p', 'comments-empty', '暂无 FAQ，请在上方新增。'));
      return;
    }

    state.faqs.forEach(function (faq) {
      const row = make('div', 'admin-faq-row');
      const main = make('div', 'admin-row-main');
      main.appendChild(make('div', 'admin-row-q', faq.question || ''));
      main.appendChild(make('span', 'admin-row-meta',
        (CATEGORY_LABELS[faq.category] || faq.category || '其他') + ' · 排序 ' + (faq.order || 0)));

      const actions = make('div', 'admin-row-actions');
      const edit = make('button', 'link-btn', '编辑');
      edit.type = 'button';
      edit.dataset.editFaq = faq.id;
      const del = make('button', 'link-btn danger', '删除');
      del.type = 'button';
      del.dataset.deleteFaq = faq.id;

      actions.appendChild(edit);
      actions.appendChild(del);
      row.appendChild(main);
      row.appendChild(actions);
      box.appendChild(row);
    });
  }

  function resetFaqForm() {
    $('faqIdInput').value = '';
    $('faqQuestionInput').value = '';
    $('faqAnswerInput').value = '';
    $('faqCategoryInput').value = 'bcmd';
    $('faqOrderInput').value = '0';
    $('faqSubmitBtn').textContent = '新增 FAQ';
    $('faqCancelBtn').classList.add('hidden');
  }

  function editFaq(id) {
    const faq = state.faqs.find(function (item) { return item.id === id; });
    if (!faq) return;

    $('faqIdInput').value = faq.id;
    $('faqCategoryInput').value = faq.category && CATEGORY_LABELS[faq.category] ? faq.category : 'bcmd';
    $('faqOrderInput').value = String(faq.order || 0);
    $('faqQuestionInput').value = faq.question || '';
    $('faqAnswerInput').value = faq.answer || '';
    $('faqSubmitBtn').textContent = '保存修改';
    $('faqCancelBtn').classList.remove('hidden');

    if ($('faqForm') && $('faqForm').scrollIntoView) {
      $('faqForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  async function handleSiteSubmit(event) {
    event.preventDefault();
    const title = $('siteTitleInput').value.trim();
    if (!title) {
      showToast('站点标题不能为空', true);
      return;
    }

    const res = await adminRequest('/api/site', {
      method: 'PUT',
      body: {
        title: title,
        subtitle: $('siteSubtitleInput').value.trim(),
        notice: $('siteNoticeInput').value.trim()
      }
    });

    if (!res.ok) {
      if (res.status !== 401 && res.status !== 403) showToast(res.message || '保存失败', true);
      return;
    }

    state.site = res.data.site || state.site;
    applySite();
    showToast('站点信息已保存');
  }

  async function handleFaqSubmit(event) {
    event.preventDefault();
    const id = $('faqIdInput').value;
    const payload = {
      category: $('faqCategoryInput').value,
      order: parseInt($('faqOrderInput').value, 10) || 0,
      question: $('faqQuestionInput').value.trim(),
      answer: $('faqAnswerInput').value.trim()
    };

    if (!payload.question) {
      showToast('问题不能为空', true);
      return;
    }
    if (!payload.answer) {
      showToast('回答不能为空', true);
      return;
    }

    const body = Object.assign({}, payload);
    const options = { method: id ? 'PUT' : 'POST', body: body };
    if (id) body.id = id;

    const res = await adminRequest('/api/faq', options);
    if (!res.ok) {
      if (res.status !== 401 && res.status !== 403) showToast(res.message || '保存失败', true);
      return;
    }

    resetFaqForm();
    await loadFaq();
    renderAdminFaqList();
    state.adminCommentsLoaded = false;
    showToast(id ? 'FAQ 已更新' : 'FAQ 已新增');
  }

  async function deleteFaq(id) {
    if (!window.confirm('确定删除这条 FAQ？其下所有评论也会一并删除。')) return;

    const res = await adminRequest('/api/faq?id=' + encodeURIComponent(id), { method: 'DELETE' });
    if (!res.ok) {
      if (res.status !== 401 && res.status !== 403) showToast(res.message || '删除失败', true);
      return;
    }

    state.comments.delete(id);
    await loadFaq();
    renderAdminFaqList();
    loadAdminComments();
    showToast('FAQ 已删除');
  }

  async function loadAdminComments() {
    const box = $('adminCommentList');
    box.textContent = '';
    box.appendChild(make('p', 'comments-loading', '加载评论中…'));

    const res = await adminRequest('/api/comments', {});
    if (!res.ok) {
      if (res.status !== 401 && res.status !== 403) {
        box.textContent = '';
        box.appendChild(make('p', 'comments-error', '评论加载失败，请稍后重试。'));
      }
      return;
    }

    state.adminCommentsLoaded = true;
    const items = Array.isArray(res.data.items) ? res.data.items : [];

    box.textContent = '';
    if (!items.length) {
      box.appendChild(make('p', 'comments-empty', '暂无评论。'));
      return;
    }

    const groups = new Map();
    items.forEach(function (comment) {
      const key = comment.faqId || '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(comment);
    });

    const questionOf = function (faqId) {
      const faq = state.faqs.find(function (item) { return item.id === faqId; });
      return faq ? faq.question : '（已删除的 FAQ）';
    };

    groups.forEach(function (list, faqId) {
      const group = make('div', 'admin-comment-group');
      group.appendChild(make('h4', 'admin-group-title', 'Q: ' + questionOf(faqId)));

      list.sort(function (a, b) {
        return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
      });

      list.forEach(function (comment) {
        const row = make('div', 'admin-comment');
        const head = make('div', 'admin-comment-head');
        head.appendChild(make('span', 'admin-comment-name', comment.authorName || '玩家'));
        if (comment.authorIsAdmin) head.appendChild(make('span', 'badge-admin', '管理员'));
        if (comment.parentId) head.appendChild(make('span', 'tag tag-green', '回复'));
        head.appendChild(make('span', 'admin-comment-time', formatTime(comment.createdAt)));

        const del = make('button', 'link-btn danger', '删除');
        del.type = 'button';
        del.dataset.adminDeleteComment = comment.id;
        del.dataset.faqId = faqId;
        head.appendChild(del);

        row.appendChild(head);
        row.appendChild(make('div', 'admin-comment-text', comment.content || ''));
        group.appendChild(row);
      });

      box.appendChild(group);
    });
  }

  async function deleteAdminComment(id, faqId) {
    if (!window.confirm('确定删除这条评论？')) return;

    const res = await adminRequest('/api/comments/' + encodeURIComponent(id), { method: 'DELETE' });
    if (!res.ok) {
      if (res.status !== 401 && res.status !== 403) showToast(res.message || '删除失败', true);
      return;
    }

    state.comments.delete(faqId);
    await loadAdminComments();
    const card = faqId ? findFaqCard(faqId) : null;
    if (card && card.open) loadComments(faqId);
    showToast('评论已删除');
  }

  /* ---------------- Comment actions ---------------- */
  async function deleteOwnComment(id, faqId) {
    if (!window.confirm('确定删除这条评论？')) return;

    const res = await request('/api/comments/' + encodeURIComponent(id), {
      method: 'DELETE',
      token: viewerToken()
    });

    if (!res.ok) {
      showToast(res.status === 401 || res.status === 403
        ? '无权删除或登录已失效'
        : (res.message || '删除失败'), true);
      return;
    }

    state.comments.delete(faqId);
    showToast('评论已删除');
    if (faqId) loadComments(faqId);
  }

  async function handleCommentSubmit(event) {
    const form = event.target.closest('form.comment-form');
    if (!form) return;
    event.preventDefault();

    const faqId = form.dataset.faqId;
    const parentId = form.dataset.parentId || null;

    if (!state.player) {
      openModal('loginModal');
      return;
    }

    const textarea = form.querySelector('textarea');
    const content = textarea.value.trim();
    if (!content) {
      showToast('评论内容不能为空', true);
      return;
    }
    if (content.length > MAX_COMMENT) {
      showToast('评论不能超过 ' + MAX_COMMENT + ' 字', true);
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    const label = button ? button.textContent : '';
    if (button) {
      button.disabled = true;
      button.textContent = '提交中…';
    }

    const res = await request('/api/comments', {
      method: 'POST',
      token: state.playerToken,
      body: {
        faqId: faqId,
        parentId: parentId,
        content: content,
        authorName: state.player.playerName || '玩家'
      }
    });

    if (button) {
      button.disabled = false;
      button.textContent = label;
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        showToast('登录已失效，请重新登录', true);
      } else {
        showToast(res.message || (res.status === 429 ? '提交过于频繁，请稍后再试' : '评论失败'), true);
      }
      return;
    }

    textarea.value = '';
    const count = form.querySelector('.char-count');
    if (count) count.textContent = '0 / ' + MAX_COMMENT;

    state.comments.delete(faqId);
    showToast(parentId ? '回复已发布' : '评论已发布');
    await loadComments(faqId);
  }

  function openReplyForm(button) {
    const card = button.closest('.faq-item');
    if (!card) return;
    const comment = button.closest('.comment');
    const slot = comment ? comment.querySelector('.reply-slot') : null;
    if (!slot) return;

    slot.textContent = '';
    const form = buildCommentForm(card.dataset.id, button.dataset.replyTo, button.dataset.replyName);
    slot.appendChild(form);
    const textarea = form.querySelector('textarea');
    if (textarea) textarea.focus();
  }

  /* ---------------- Event binding ---------------- */
  function bindEvents() {
    $('loginBtn').addEventListener('click', function () { openModal('loginModal'); });
    $('adminLoginBtn').addEventListener('click', function () { openModal('adminLoginModal'); });

    $('accountBtn').addEventListener('click', function (event) {
      event.stopPropagation();
      toggleAccountPanel();
    });
    $('accountAdminBtn').addEventListener('click', function () {
      toggleAccountPanel(false);
      openAdminPanel();
    });
    $('logoutBtn').addEventListener('click', logout);

    $('loginForm').addEventListener('submit', handlePlayerLogin);
    $('adminLoginForm').addEventListener('submit', handleAdminLogin);

    $('searchInput').addEventListener('input', function () {
      state.query = this.value;
      $('searchClear').classList.toggle('hidden', !state.query);
      renderFaqList();
    });
    $('searchClear').addEventListener('click', function () {
      state.query = '';
      $('searchInput').value = '';
      $('searchClear').classList.add('hidden');
      renderFaqList();
      $('searchInput').focus();
    });

    $('filterBar').addEventListener('click', function (event) {
      const btn = event.target.closest('[data-filter]');
      if (!btn) return;
      state.filter = btn.dataset.filter;
      updateFilterActive();
      renderFaqList();
    });

    const list = $('faqList');
    list.addEventListener('toggle', function (event) {
      const item = event.target;
      if (!item.classList || !item.classList.contains('faq-item')) return;
      if (item.open) {
        state.openIds.add(item.dataset.id);
        if (!state.comments.has(item.dataset.id)) loadComments(item.dataset.id);
      } else {
        state.openIds.delete(item.dataset.id);
      }
    }, true);

    list.addEventListener('click', function (event) {
      const del = event.target.closest('[data-delete-comment]');
      if (del) {
        deleteOwnComment(del.dataset.deleteComment, del.dataset.faqId);
        return;
      }

      const cancel = event.target.closest('[data-cancel-reply]');
      if (cancel) {
        const slot = cancel.closest('.reply-slot');
        if (slot) slot.textContent = '';
        return;
      }

      const reply = event.target.closest('[data-reply-to]');
      if (reply) {
        openReplyForm(reply);
        return;
      }

      const needLogin = event.target.closest('[data-need-login]');
      if (needLogin) openModal('loginModal');
    });

    list.addEventListener('submit', handleCommentSubmit);

    list.addEventListener('input', function (event) {
      const textarea = event.target;
      if (!textarea.matches || !textarea.matches('textarea[data-counter]')) return;
      const form = textarea.closest('.comment-form');
      if (!form) return;
      const count = form.querySelector('.char-count');
      if (!count) return;
      const length = textarea.value.length;
      count.textContent = length + ' / ' + MAX_COMMENT;
      count.classList.toggle('over', length > MAX_COMMENT);
    });

    $('siteForm').addEventListener('submit', handleSiteSubmit);
    $('faqForm').addEventListener('submit', handleFaqSubmit);
    $('faqCancelBtn').addEventListener('click', resetFaqForm);
    $('refreshCommentsBtn').addEventListener('click', loadAdminComments);

    $('adminFaqList').addEventListener('click', function (event) {
      const edit = event.target.closest('[data-edit-faq]');
      if (edit) {
        editFaq(edit.dataset.editFaq);
        return;
      }
      const del = event.target.closest('[data-delete-faq]');
      if (del) deleteFaq(del.dataset.deleteFaq);
    });

    $('adminCommentList').addEventListener('click', function (event) {
      const del = event.target.closest('[data-admin-delete-comment]');
      if (del) deleteAdminComment(del.dataset.adminDeleteComment, del.dataset.faqId);
    });

    Array.prototype.forEach.call($('adminPanel').querySelectorAll('.tab'), function (tab) {
      tab.addEventListener('click', function () {
        const name = tab.dataset.tab;
        Array.prototype.forEach.call($('adminPanel').querySelectorAll('.tab'), function (item) {
          const active = item === tab;
          item.classList.toggle('active', active);
          item.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        Array.prototype.forEach.call($('adminPanel').querySelectorAll('.tab-panel'), function (panel) {
          panel.classList.toggle('hidden', panel.dataset.panel !== name);
        });
        if (name === 'comments') loadAdminComments();
        if (name === 'site') fillSiteForm();
        if (name === 'faq') renderAdminFaqList();
      });
    });

    document.addEventListener('click', function (event) {
      if (!event.target.closest('#accountMenu')) toggleAccountPanel(false);
    });

    document.addEventListener('click', function (event) {
      const closer = event.target.closest('[data-close]');
      if (closer) {
        closeModal(closer.dataset.close);
        return;
      }
      if (event.target.classList && event.target.classList.contains('modal')) {
        closeModal(event.target.id);
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      ['loginModal', 'adminLoginModal', 'adminPanel'].forEach(function (modalId) {
        if ($(modalId) && !$(modalId).classList.contains('hidden')) closeModal(modalId);
      });
      toggleAccountPanel(false);
    });
  }

  /* ---------------- Init ---------------- */
  async function init() {
    state.adminToken = sessionStorage.getItem(SS_ADMIN) || '';
    state.site = Object.assign({}, DEFAULT_SITE);
    bindEvents();
    renderAuth();
    applySite();

    await Promise.all([loadFaq(), restoreAuth()]);

    if (state.faqs.length) renderFaqList();
    renderAuth();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
