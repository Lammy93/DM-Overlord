// === Constants ===
const API_BASE = '';
const STANDARD_DICE = [4, 6, 8, 10, 12, 20, 100];
const DICE_ICONS = { 4: '/icons/dice/d4.svg', 6: '/icons/dice/d6.svg', 8: '/icons/dice/d8.svg', 10: '/icons/dice/d10.svg', 12: '/icons/dice/d12.svg', 20: '/icons/dice/d20.svg', 100: '/icons/dice/d10.svg' };
const ABILITY_SHORT = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' };

// === DOM Helper ===
function el(tag, attrs, ...children) {
  const e = document.createElement(tag);
  if (attrs && typeof attrs === 'object' && !Array.isArray(attrs)) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'className') e.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k === 'dataset') Object.assign(e.dataset, v);
      else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') e.innerHTML = v;
      else e.setAttribute(k, v);
    }
  }
  for (const child of children) {
    if (child == null || child === false) continue;
    e.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return e;
}

function loadingMsg(text) { return el('div', { className: 'loading' }, text || 'Loading...'); }
function errorMsg(msg) { return el('div', { className: 'error' }, 'Error: ' + msg); }
function emptyMsg(msg) { return el('div', { className: 'empty' }, msg || 'Nothing here yet.'); }

function render(page, content) {
  const container = document.getElementById('page-content');
  container.innerHTML = '';
  container.append(content);
  document.querySelectorAll('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.page === page));
}

// === API Class ===
class API {
  static token() { return localStorage.getItem('dmoverlord_token'); }
  static playerToken() { return localStorage.getItem('dmoverlord_token'); }
  static getToken() { return localStorage.getItem('dmoverlord_token'); }

  static async request(method, path, body, isFormData) {
    const headers = {};
    const token = API.getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (body && !isFormData) { headers['Content-Type'] = 'application/json'; }
    const opts = { method, headers };
    if (body) opts.body = isFormData ? body : JSON.stringify(body);
    const res = await fetch(API_BASE + path, opts);
    if (res.status === 401) { localStorage.removeItem('token'); localStorage.removeItem('player_token'); navigate('login'); throw new Error('Session expired'); }
    if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error(err.error || res.statusText); }
    if (res.status === 204 || res.headers.get('content-length') === '0') return null;
    return res.json();
  }

  static get(path) { return API.request('GET', path); }
  static post(path, body) { return API.request('POST', path, body); }
  static patch(path, body) { return API.request('PATCH', path, body); }
  static put(path, body) { return API.request('PUT', path, body); }
  static delete(path) { return API.request('DELETE', path); }
  static upload(path, formData) { return API.request('POST', path, formData, true); }
}

// === Auth System ===
let currentUser = null;

let USER_ROLE = '';
let PLAYER_USER = null;
let GUILD_LIST = [];

async function checkAuth() {
  const token = API.getToken();
  const loginPage = document.getElementById('login-page');
  const sidebar = document.getElementById('sidebar');
  const userInfo = document.getElementById('user-info');
  const badge = document.getElementById('user-role-badge');
  const displayName = document.getElementById('user-display-name');
  const guildWrap = document.getElementById('guild-selector-wrap');

  if (!token) {
    USER_ROLE = '';
    PLAYER_USER = null;
    return false;
  }

  try {
    const status = await API.get('/api/auth/status');
    if (status.role === 'dm') {
      USER_ROLE = 'dm';
      PLAYER_USER = null;
    } else if (status.loggedIn && status.user) {
      USER_ROLE = 'player';
      PLAYER_USER = status.user;
    } else {
      USER_ROLE = '';
      PLAYER_USER = null;
      localStorage.removeItem('dmoverlord_token');
      return false;
    }
    return true;
  } catch {
    localStorage.removeItem('dmoverlord_token');
    USER_ROLE = '';
    PLAYER_USER = null;
    return false;
  }
}

function showLogin() {
  const loginPage = document.getElementById('login-page');
  if (loginPage) loginPage.style.display = 'flex';
  document.body.className = '';
  const err = document.getElementById('page-login-error');
  const err2 = document.getElementById('page-login-error-player');
  if (err) err.textContent = '';
  if (err2) err2.textContent = '';
}

function updateAuthUI() {
  const loggedIn = USER_ROLE === 'dm' || !!PLAYER_USER;
  const loginPage = document.getElementById('login-page');
  const userInfo = document.getElementById('user-info');
  const badge = document.getElementById('user-role-badge');
  const displayName = document.getElementById('user-display-name');
  const guildWrap = document.getElementById('guild-selector-wrap');

  if (loggedIn) {
    if (loginPage) loginPage.style.display = 'none';
    document.body.className = USER_ROLE === 'dm' ? 'dm-mode' : 'player-mode';
    if (USER_ROLE === 'dm') {
      if (badge) { badge.textContent = 'DM'; badge.className = 'role-badge dm-badge'; }
      if (displayName) displayName.textContent = '';
      if (userInfo) userInfo.style.display = 'flex';
      if (guildWrap) guildWrap.style.display = 'block';
      loadGuildList();
    } else {
      if (badge) { badge.textContent = 'Player'; badge.className = 'role-badge player-badge'; }
      if (displayName) displayName.textContent = PLAYER_USER?.display_name || PLAYER_USER?.username || '';
      if (userInfo) userInfo.style.display = 'flex';
      if (guildWrap) guildWrap.style.display = 'none';
    }
  } else {
    if (loginPage) loginPage.style.display = 'flex';
    document.body.className = '';
    if (userInfo) userInfo.style.display = 'none';
    if (guildWrap) guildWrap.style.display = 'none';
  }
}

async function doLogin(username, password) {
  try {
    const res = await API.post('/api/auth/login', { username, password });
    localStorage.setItem('dmoverlord_token', res.token);
    USER_ROLE = 'dm';
    PLAYER_USER = null;
    updateAuthUI();
    navigate('dashboard');
  } catch (e) {
    document.getElementById('page-login-error').textContent = e.message;
  }
}

async function doPlayerLogin(username, password) {
  try {
    const res = await API.post('/api/auth/player-login', { username, password });
    localStorage.setItem('dmoverlord_token', res.token);
    USER_ROLE = 'player';
    PLAYER_USER = res.user || { username, display_name: username };
    updateAuthUI();
    navigate('roll');
  } catch (e) {
    document.getElementById('page-login-error-player').textContent = e.message;
  }
}

async function logout() {
  try { await API.post('/api/auth/logout'); } catch {}
  localStorage.removeItem('dmoverlord_token');
  USER_ROLE = '';
  PLAYER_USER = null;
  updateAuthUI();
  window.location.hash = 'login';
}

async function changePassword(oldPassword, newPassword) {
  return API.post('/api/auth/change-password', { oldPassword, newPassword });
}

// === Password Change Overlay ===
function showPasswordOverlay() {
  const overlay = el('div', { style: 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center' });
  const box = el('div', { className: 'card', style: 'width:360px;max-width:90vw;padding:2rem' });
  box.append(el('h3', { style: 'margin-bottom:1rem;border:none' }, 'Change Password'));
  const oldInput = el('input', { type: 'password', placeholder: 'Current password', id: 'pw-overlay-old' });
  const newInput = el('input', { type: 'password', placeholder: 'New password', id: 'pw-overlay-new' });
  const confirmInput = el('input', { type: 'password', placeholder: 'Confirm new password', id: 'pw-overlay-confirm' });
  const errDiv = el('div', { className: 'login-error', id: 'pw-overlay-error' });
  const btnRow = el('div', { style: 'display:flex;gap:0.5rem' });
  const cancelBtn = el('button', { className: 'secondary' }, 'Cancel');
  const saveBtn = el('button', {}, 'Change Password');
  btnRow.append(cancelBtn, saveBtn);
  box.append(oldInput, newInput, confirmInput, errDiv, btnRow);
  overlay.append(box);
  document.body.append(overlay);

  cancelBtn.onclick = () => overlay.remove();
  saveBtn.onclick = async () => {
    const oldPw = oldInput.value;
    const newPw = newInput.value;
    if (newPw !== confirmInput.value) { errDiv.textContent = 'Passwords do not match'; return; }
    if (newPw.length < 4) { errDiv.textContent = 'Password too short'; return; }
    try {
      await changePassword(oldPw, newPw);
      overlay.remove();
      alert('Password changed successfully');
    } catch (e) { errDiv.textContent = e.message; }
  };
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}

// === Router ===
function navigate(hash) {
  const clean = (hash || location.hash || '').replace(/^#/, '');
  const parts = clean.split('/');
  const page = parts[0] || 'login';

  if (page === 'login' || !USER_ROLE && !PLAYER_USER) {
    showLogin();
    return;
  }

  switch (page) {
      case 'dashboard': renderDashboard(); break;
      case 'campaigns': renderCampaigns(); break;
      case 'campaign': renderCampaignDetail(parts[1]); break;
      case 'characters': renderCharacters(); break;
      case 'character': renderCharacterDetail(parts[1]); break;
      case 'roll': renderDiceRoller(); break;
      case 'srd': renderSRD(parts[1] || 'monsters'); break;
      case 'srd-monster': renderSRDMonsterDetail(parts[1]); break;
      case 'srd-spell': renderSRDSpellDetail(parts[1]); break;
      case 'activity': renderActivity(); break;
      case 'adventures': renderAdventures(); break;
      case 'adventure-session': renderAdventureSession(parts[1]); break;

      case 'encounters': renderEncounters(); break;
      case 'encounter': renderEncounterDetail(parts[1]); break;
      case 'maps':
        if (parts[1]) renderCampaignMaps(parts[1]);
        else renderMaps();
        break;
      case 'map': showMapViewer(parts[1]); break;
      case 'admin-characters': renderAdminCharacters(); break;
      case 'settings': renderSettings(); break;
      case 'roles': renderRoles(); break;
      case 'file-browser': renderFileBrowser(); break;
      case 'player-settings': renderPlayerSettings(); break;
      case 'player-characters': renderPlayerCharacters(); break;
      default: renderDashboard(); break;
    }
}

// === Collapsible Sections ===
function setupCollapsibleSections() {
  document.querySelectorAll('.nav-section-label').forEach(label => {
    const section = label.dataset.section;
    label.onclick = () => {
      const isCollapsed = label.classList.toggle('collapsed');
      document.querySelectorAll(`.nav-item[data-section="${section}"]`).forEach(item => item.classList.toggle('collapsed', isCollapsed));
      const state = JSON.parse(localStorage.getItem('sidebarCollapsed') || '{}');
      state[section] = isCollapsed;
      localStorage.setItem('sidebarCollapsed', JSON.stringify(state));
    };
  });
}

function applyCollapsedState() {
  const state = JSON.parse(localStorage.getItem('sidebarCollapsed') || '{}');
  for (const [section, collapsed] of Object.entries(state)) {
    const label = document.querySelector(`.nav-section-label[data-section="${section}"]`);
    if (label) {
      label.classList.toggle('collapsed', collapsed);
      document.querySelectorAll(`.nav-item[data-section="${section}"]`).forEach(item => item.classList.toggle('collapsed', collapsed));
    }
  }
}

// === Guild Selector ===
let guildList = [];

async function loadGuildList() {
  const select = document.getElementById('guild-select');
  if (!select) return;
  try {
    guildList = await API.get('/api/guilds');
    const current = select.value;
    select.innerHTML = '<option value="">All Guilds</option>';
    for (const g of guildList) {
      select.append(el('option', { value: g.id }, g.name));
    }
    if (current) select.value = current;
  } catch {}
  select.onchange = () => {
    const hash = location.hash.replace(/^#/, '');
    if (hash) navigate(hash);
  };
}

function currentGuild() {
  const select = document.getElementById('guild-select');
  return select ? select.value : '';
}

function setCurrentGuild(id) {
  const select = document.getElementById('guild-select');
  if (select) select.value = id || '';
}

// === Icon Helper ===
function icon(path, size) {
  return el('img', { src: '/icons/' + path + '.svg', style: 'width:' + (size || 20) + 'px;height:' + (size || 20) + 'px', alt: path, className: 'icon' });
}

// === Die Selector / Dice Roller Core ===
function renderDiceSelector(dieCounts, onChange) {
  const grid = el('div', { className: 'die-selector-grid' });
  for (const die of STANDARD_DICE) {
    const count = dieCounts[die] || 0;
    const card = el('div', { className: 'die-card' });
    const img = el('img', { src: DICE_ICONS[die], style: 'width:48px;height:48px', alt: 'd' + die });
    const label = el('div', { style: 'font-size:0.75rem;color:var(--text-muted)' }, 'd' + die);
    const counter = el('div', { className: 'die-counter' });
    const decBtn = el('button', { className: 'die-ctrl-btn' }, '–');
    const countSpan = el('span', { className: 'die-count', id: 'die-count-' + die }, count.toString());
    const incBtn = el('button', { className: 'die-ctrl-btn' }, '+');
    counter.append(decBtn, countSpan, incBtn);

    incBtn.onclick = () => { dieCounts[die] = (dieCounts[die] || 0) + 1; countSpan.textContent = dieCounts[die]; if (onChange) onChange(); };
    decBtn.onclick = () => { if ((dieCounts[die] || 0) > 0) { dieCounts[die]--; countSpan.textContent = dieCounts[die] || '0'; if (onChange) onChange(); } };

    card.append(img, label, counter);
    grid.append(card);
  }
  return grid;
}

function createDieResult(dieType, value) {
  const wrapper = el('div', { className: 'die-result-dice' });
  const img = el('img', { src: DICE_ICONS[dieType], className: 'die-custom-img', style: 'max-width:60px;max-height:60px' });
  const overlay = el('span', { className: 'die-r-value-dice' }, value.toString());
  wrapper.append(img, overlay);
  return wrapper;
}

function rollDie(sides) { return Math.floor(Math.random() * sides) + 1; }

// === Map Viewer Class ===
class MapViewer {
  constructor(container, imageUrl) {
    this.container = container;
    this.imageUrl = imageUrl;
    this.canvas = el('canvas', { style: 'width:100%;height:100%;cursor:grab;display:block' });
    this.ctx = this.canvas.getContext('2d');
    container.append(this.canvas);
    this.img = new Image();
    this.loaded = false;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.showGrid = false;
    this.gridSize = 50;
    this.fogCanvas = null;
    this.fogCtx = null;
    this.fogVisible = false;
    this.isFogging = false;
    this.fogMode = 'reveal';
    this.fogRadius = 30;
    this.pins = [];
    this.pinMode = false;
    this.onPinAdd = null;

    this.img.onload = () => {
      this.loaded = true;
      this.canvas.width = this.img.naturalWidth;
      this.canvas.height = this.img.naturalHeight;
      this.fogCanvas = document.createElement('canvas');
      this.fogCanvas.width = this.img.naturalWidth;
      this.fogCanvas.height = this.img.naturalHeight;
      this.fogCtx = this.fogCanvas.getContext('2d');
      this.fogCtx.fillStyle = 'rgba(0,0,0,0.7)';
      this.fogCtx.fillRect(0, 0, this.fogCanvas.width, this.fogCanvas.height);
      this.render();
    };
    this.img.src = imageUrl;

    this.canvas.onwheel = (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const oldScale = this.scale;
      this.scale *= e.deltaY > 0 ? 0.9 : 1.1;
      this.scale = Math.max(0.1, Math.min(10, this.scale));
      this.offsetX = mx - (mx - this.offsetX) * (this.scale / oldScale);
      this.offsetY = my - (my - this.offsetY) * (this.scale / oldScale);
      this.render();
    };

    this.canvas.onmousedown = (e) => {
      if (e.button === 0) {
        if (this.pinMode) {
          const rect = this.canvas.getBoundingClientRect();
          const x = (e.clientX - rect.left - this.offsetX) / this.scale;
          const y = (e.clientY - rect.top - this.offsetY) / this.scale;
          const name = prompt('Pin name:');
          if (name) {
            const pin = { x, y, name };
            this.pins.push(pin);
            this.render();
            if (this.onPinAdd) this.onPinAdd(pin);
          }
          this.pinMode = false;
          this.canvas.style.cursor = 'grab';
          return;
        }
        this.isDragging = true;
        this.dragStartX = e.clientX - this.offsetX;
        this.dragStartY = e.clientY - this.offsetY;
        this.canvas.style.cursor = 'grabbing';
        if (e.ctrlKey) {
          this.isFogging = true;
          this.canvas.style.cursor = 'crosshair';
        }
      }
    };

    this.canvas.onmousemove = (e) => {
      if (this.isDragging && !this.isFogging) {
        this.offsetX = e.clientX - this.dragStartX;
        this.offsetY = e.clientY - this.dragStartY;
        this.render();
      }
      if (this.isFogging && e.ctrlKey) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.offsetX) / this.scale;
        const y = (e.clientY - rect.top - this.offsetY) / this.scale;
        if (this.fogCtx) {
          this.fogCtx.globalCompositeOperation = this.fogMode === 'reveal' ? 'destination-out' : 'source-over';
          this.fogCtx.fillStyle = this.fogMode === 'reveal' ? 'rgba(0,0,0,1)' : 'rgba(0,0,0,0.7)';
          this.fogCtx.beginPath();
          this.fogCtx.arc(x, y, this.fogRadius, 0, Math.PI * 2);
          this.fogCtx.fill();
          this.fogCtx.globalCompositeOperation = 'source-over';
          this.render();
        }
      }
    };

    this.canvas.onmouseup = () => {
      this.isDragging = false;
      this.isFogging = false;
      this.canvas.style.cursor = this.pinMode ? 'crosshair' : 'grab';
    };

    this.canvas.onmouseleave = () => {
      this.isDragging = false;
      this.isFogging = false;
    };

    window.addEventListener('resize', () => this.render());
  }

  setGrid(show) { this.showGrid = show; this.render(); }
  setGridSize(size) { this.gridSize = size; if (this.showGrid) this.render(); }
  setFogRadius(r) { this.fogRadius = r; }
  setFogMode(mode) { this.fogMode = mode; }
  resetFog() {
    if (this.fogCtx) {
      this.fogCtx.globalCompositeOperation = 'source-over';
      this.fogCtx.fillStyle = 'rgba(0,0,0,0.7)';
      this.fogCtx.fillRect(0, 0, this.fogCanvas.width, this.fogCanvas.height);
      this.render();
    }
  }
  clearFog() {
    if (this.fogCtx) {
      this.fogCtx.clearRect(0, 0, this.fogCanvas.width, this.fogCanvas.height);
      this.render();
    }
  }
  togglePins() {
    this.pinMode = !this.pinMode;
    this.canvas.style.cursor = this.pinMode ? 'crosshair' : 'grab';
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (!this.loaded) return;

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
    ctx.drawImage(this.img, 0, 0);

    if (this.fogCanvas && this.fogVisible) {
      ctx.drawImage(this.fogCanvas, 0, 0);
    }

    if (this.showGrid) {
      ctx.strokeStyle = 'rgba(201, 173, 106, 0.5)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += this.gridSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += this.gridSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    }

    for (const pin of this.pins) {
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#c94a4a';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pin.name, pin.x, pin.y - 14);
    }

    ctx.restore();
  }

  destroy() {
    this.container.innerHTML = '';
  }
}

// =====================================================
// PAGE: Dashboard
// =====================================================
async function renderDashboard() {
  const page = el('div');
  page.append(el('h2', { className: 'page-title' }, 'Dashboard'));

  try {
    const [campaigns, characters, status] = await Promise.all([
      API.get('/api/campaigns'),
      API.get('/api/characters'),
      API.get('/api/status'),
    ]);

    const grid = el('div', { className: 'stats-grid' });
    const statItems = [
      { label: 'Campaigns', value: campaigns.length },
      { label: 'Characters', value: characters.length },
      { label: 'Status', value: status.status || 'ok' },
    ];
    for (const s of statItems) {
      const card = el('div', { className: 'stat-card' });
      card.append(el('div', { className: 'value' }, String(s.value)));
      card.append(el('div', { className: 'label' }, s.label));
      grid.append(card);
    }
    page.append(grid);

    if (campaigns.length) {
      page.append(el('h3', { style: 'margin-bottom:0.5rem' }, 'Recent Campaigns'));
      for (const c of campaigns.slice(0, 5)) {
        const card = el('div', { className: 'card', style: 'cursor:pointer' });
        card.onclick = () => navigate('campaign/' + c.id);
        card.append(el('h3', { style: 'border:none;margin-bottom:0.2rem' }, c.name));
        if (c.description) card.append(el('p', {}, c.description));
        card.append(el('div', { style: 'display:flex;gap:1rem;margin-top:0.5rem;font-size:0.8rem;color:var(--text-muted)' },
          el('span', {}, 'Status: ' + (c.status || 'unknown')),
        ));
        page.append(card);
      }
    } else {
      page.append(emptyMsg('No campaigns yet.'));
    }
  } catch (e) {
    page.append(errorMsg(e.message));
  }

  render('dashboard', page);
}

// =====================================================
// PAGE: Campaigns
// =====================================================
async function renderCampaigns() {
  const page = el('div');
  page.append(el('h2', { className: 'page-title' }, 'Campaigns'));

  const toggleRow = el('div', { className: 'campaign-view-toggle' });
  const myBtn = el('button', { className: 'cv-toggle-btn active', id: 'cv-my' }, 'My Campaigns');
  const libraryBtn = el('button', { className: 'cv-toggle-btn', id: 'cv-library' }, 'Library / LFG');
  toggleRow.append(myBtn, libraryBtn);
  page.append(toggleRow);

  const guildId = currentGuild();
  const listDiv = el('div', { id: 'campaign-list' });
  page.append(listDiv);

  async function loadCampaigns(library) {
    listDiv.innerHTML = '';
    listDiv.append(loadingMsg());
    try {
      const path = library ? '/api/campaigns?library=true' : '/api/campaigns' + (guildId ? '?guildId=' + guildId : '');
      const campaigns = await API.get(path);
      listDiv.innerHTML = '';
      if (!campaigns.length) { listDiv.append(emptyMsg('No campaigns found.')); return; }
      for (const c of campaigns) {
        const card = el('div', { className: 'card', style: 'cursor:pointer' });
        card.onclick = () => navigate('campaign/' + c.id);
        const header = el('div', { style: 'display:flex;justify-content:space-between;align-items:center' });
        header.append(el('h3', { style: 'border:none;margin:0' }, c.name));
        if (c.guildName) header.append(el('span', { style: 'font-size:0.75rem;color:var(--text-muted)' }, c.guildName));
        card.append(header);
        if (c.description) card.append(el('p', { style: 'margin-top:0.3rem' }, c.description));
        if (c.stats) {
          card.append(el('div', { style: 'display:flex;gap:1rem;margin-top:0.5rem;font-size:0.8rem;color:var(--text-muted)' },
            el('span', {}, '\u{1F465} ' + (c.stats.players ?? 0) + ' players'),
            el('span', {}, '\u{1F3AD} ' + (c.stats.characters ?? 0) + ' characters'),
            el('span', {}, '\u{1F4DC} ' + (c.stats.sessions ?? 0) + ' sessions'),
          ));
        }
        listDiv.append(card);
      }
    } catch (e) { listDiv.innerHTML = ''; listDiv.append(errorMsg(e.message)); }
  }

  myBtn.onclick = () => { myBtn.classList.add('active'); libraryBtn.classList.remove('active'); loadCampaigns(false); };
  libraryBtn.onclick = () => { libraryBtn.classList.add('active'); myBtn.classList.remove('active'); loadCampaigns(true); };

  loadCampaigns(false);
  render('campaigns', page);
}

// =====================================================
// PAGE: Campaign Detail
// =====================================================
async function renderCampaignDetail(id) {
  const page = el('div');
  page.append(loadingMsg());

  try {
    const c = await API.get('/api/campaigns/' + id);
    page.innerHTML = '';

    page.append(el('h2', { className: 'page-title' }, c.name));
    if (c.guildName) page.append(el('div', { style: 'font-size:0.85rem;color:var(--text-muted);margin-bottom:0.5rem' }, 'Server: ' + c.guildName));

    const statsGrid = el('div', { className: 'stats-grid' });
    if (c.stats) {
      for (const [key, label] of [['players', 'Players'], ['characters', 'Characters'], ['sessions', 'Sessions']]) {
        const card = el('div', { className: 'stat-card' });
        card.append(el('div', { className: 'value' }, (c.stats[key] ?? 0).toString()));
        card.append(el('div', { className: 'label' }, label));
        statsGrid.append(card);
      }
    }
    page.append(statsGrid);

    if (c.description) {
      const descCard = el('div', { className: 'card' });
      descCard.append(el('h3', {}, 'Description'));
      descCard.append(el('p', {}, c.description));
      page.append(descCard);
    }

    const renameRow = el('div', { style: 'display:flex;gap:0.5rem;align-items:end;margin-bottom:1rem' });
    const renameInput = el('input', { type: 'text', placeholder: 'Rename campaign...', id: 'campaign-rename-input' });
    const renameBtn = el('button', {}, 'Rename');
    renameRow.append(el('div', { style: 'flex:1' }, el('label', {}, 'Rename Campaign'), renameInput), renameBtn);
    renameBtn.onclick = async () => {
      if (!renameInput.value.trim()) return;
      try {
        const updated = await API.patch('/api/campaigns/' + id, { name: renameInput.value.trim() });
        document.querySelector('.page-title').textContent = updated.name;
        renameInput.value = '';
      } catch (e) { alert(e.message); }
    };
    page.append(renameRow);

    if (c.characters?.length) {
      const charCard = el('div', { className: 'card' });
      charCard.append(el('h3', {}, 'Characters (' + c.characters.length + ')'));
      for (const ch of c.characters) {
        const row = el('div', { style: 'display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;border-bottom:1px solid var(--border);cursor:pointer' });
        row.onclick = () => navigate('character/' + ch.id);
        row.append(el('span', { style: 'font-weight:600;flex:1' }, ch.name));
        if (ch.race || ch.class) row.append(el('span', { style: 'font-size:0.8rem;color:var(--text-muted)' }, [ch.race, ch.class].filter(Boolean).join(' ')));
        if (ch.level) row.append(el('span', { style: 'font-size:0.8rem;color:var(--accent)' }, 'Lvl ' + ch.level));
        charCard.append(row);
      }
      page.append(charCard);
    }

    if (c.players?.length) {
      const playerCard = el('div', { className: 'card' });
      playerCard.append(el('h3', {}, 'Players (' + c.players.length + ')'));
      for (const p of c.players) {
        const row = el('div', { style: 'display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;border-bottom:1px solid var(--border)' });
        row.append(el('span', { style: 'font-weight:600;flex:1' }, p.username || p.name));
        if (p.role) row.append(el('span', { className: 'tag' }, p.role));
        playerCard.append(row);
      }
      page.append(playerCard);
    }

    if (c.sessions?.length) {
      const sessCard = el('div', { className: 'card' });
      sessCard.append(el('h3', {}, 'Sessions (' + c.sessions.length + ')'));
      for (const s of c.sessions) {
        const row = el('div', { style: 'display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;border-bottom:1px solid var(--border)' });
        row.append(el('span', { style: 'font-weight:600;flex:1' }, s.name || 'Session #' + s.id));
        if (s.date) row.append(el('span', { style: 'font-size:0.8rem;color:var(--text-muted)' }, new Date(s.date).toLocaleDateString()));
        sessCard.append(row);
      }
      page.append(sessCard);
    }
  } catch (e) {
    page.innerHTML = '';
    page.append(errorMsg(e.message));
  }

  render('campaign', page);
}

// =====================================================
// PAGE: Characters
// =====================================================
async function renderCharacters() {
  const page = el('div');
  page.append(el('h2', { className: 'page-title' }, 'Characters'));

  const searchRow = el('div', { style: 'margin-bottom:1rem' });
  const searchInput = el('input', { type: 'text', placeholder: 'Search characters...', id: 'char-search' });
  searchRow.append(searchInput);
  page.append(searchRow);

  const gridDiv = el('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:0.8rem', id: 'char-grid' });
  page.append(gridDiv);

  async function loadChars(query) {
    gridDiv.innerHTML = '';
    gridDiv.append(loadingMsg());
    try {
      const path = query ? '/api/characters?search=' + encodeURIComponent(query) : '/api/characters';
      const chars = await API.get(path);
      gridDiv.innerHTML = '';
      if (!chars.length) { gridDiv.append(emptyMsg('No characters found.')); return; }
      for (const ch of chars) {
        const card = el('div', { className: 'card', style: 'cursor:pointer;text-align:left' });
        card.onclick = () => navigate('character/' + ch.id);
        const topRow = el('div', { style: 'display:flex;gap:0.8rem;align-items:start' });
        if (ch.image_url) {
          topRow.append(el('img', { src: ch.image_url, style: 'width:64px;height:64px;object-fit:cover;border-radius:6px;border:2px solid var(--border);flex-shrink:0' }));
        } else {
          topRow.append(el('div', { style: 'font-size:2rem;flex-shrink:0' }, '\u{1F3AD}'));
        }
        const infoDiv = el('div', { style: 'flex:1;min-width:0' });
        infoDiv.append(el('div', { style: 'font-weight:700;font-size:1.05rem;color:var(--text-secondary)' }, ch.name));
        infoDiv.append(el('div', { style: 'font-size:0.85rem;color:var(--accent)' }, `Lvl ${ch.level || '?'} ${ch.race || ''} ${ch.class || ''}`));
        if (ch.background) infoDiv.append(el('div', { style: 'font-size:0.75rem;color:var(--text-muted)' }, ch.background));
        if (ch.player_name || ch.player_discord_id) infoDiv.append(el('div', { style: 'font-size:0.75rem;color:var(--text-muted);margin-top:0.2rem' }, 'by ' + (ch.player_name || ch.player_discord_id)));
        topRow.append(infoDiv);
        card.append(topRow);

        const statRow = el('div', { style: 'display:flex;gap:0.5rem;margin-top:0.5rem;flex-wrap:wrap' });
        const statTag = (label, val) => el('span', { className: 'tag', style: 'font-size:0.75rem' }, `${label}: ${val ?? '?'}`);
        statRow.append(statTag('HP', ch.hp_max));
        statRow.append(statTag('AC', ch.armor_class));
        if (ch.campaign_id) statRow.append(statTag('Campaign', '#' + ch.campaign_id));
        card.append(statRow);

        gridDiv.append(card);
      }
    } catch (e) { gridDiv.innerHTML = ''; gridDiv.append(errorMsg(e.message)); }
  }

  searchInput.oninput = () => loadChars(searchInput.value);
  loadChars('');
  render('characters', page);
}

// =====================================================
// PAGE: Character Detail
// =====================================================
async function renderCharacterDetail(id) {
  const page = el('div');
  page.append(loadingMsg());

  try {
    const ch = await API.get('/api/characters/' + id);
    page.innerHTML = '';

    // Header with portrait
    const headerRow = el('div', { style: 'display:flex;gap:1rem;align-items:start;margin-bottom:1rem;flex-wrap:wrap' });
    if (ch.image_url) headerRow.append(el('img', { src: ch.image_url, style: 'width:100px;height:100px;object-fit:cover;border-radius:8px;border:2px solid var(--border);flex-shrink:0' }));
    const headerInfo = el('div', { style: 'flex:1;min-width:200px' });
    headerInfo.append(el('h2', { className: 'page-title', style: 'margin-bottom:0.2rem' }, ch.name));
    const subLine = [ch.race, ch.class].filter(Boolean).join(' ');
    if (subLine || ch.level) headerInfo.append(el('div', { style: 'font-size:1rem;color:var(--accent);margin-bottom:0.2rem' }, `${subLine}${ch.level ? ' — Level ' + ch.level : ''}`));
    if (ch.background) headerInfo.append(el('div', { style: 'font-size:0.85rem;color:var(--text-muted)' }, `Background: ${ch.background}`));
    if (ch.alignment) headerInfo.append(el('div', { style: 'font-size:0.85rem;color:var(--text-muted)' }, `Alignment: ${ch.alignment}`));
    if (ch.experience != null) headerInfo.append(el('div', { style: 'font-size:0.85rem;color:var(--text-muted)' }, `XP: ${ch.experience}`));
    if (ch.player_discord_id) headerInfo.append(el('div', { style: 'font-size:0.85rem;color:var(--text-muted);margin-top:0.3rem' }, `Player: ${ch.player_discord_id}`));
    headerRow.append(headerInfo);
    page.append(headerRow);

    // Ability Scores
    const stats = ch.stats || {};
    if (Object.keys(stats).length) {
      const scoresDiv = el('div', { className: 'ability-scores', style: 'margin-bottom:1rem' });
      for (const abbr of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
        const val = stats[abbr];
        if (val == null) continue;
        const mod = Math.floor((val - 10) / 2);
        const sc = el('div', { className: 'ability-score' });
        sc.append(el('div', { className: 'abbr' }, abbr.toUpperCase()));
        sc.append(el('div', { className: 'score' }, val.toString()));
        sc.append(el('div', { className: 'mod' }, (mod >= 0 ? '+' : '') + mod));
        scoresDiv.append(sc);
      }
      page.append(scoresDiv);
    }

    // Combat Stats
    const combatCard = el('div', { className: 'card' });
    combatCard.append(el('h3', {}, 'Combat'));
    const cGrid = el('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:0.5rem' });
    const combatItems = [
      ['AC', ch.armor_class != null ? String(ch.armor_class) : null],
      ['HP', ch.hp_max != null ? `${ch.hp_current ?? ch.hp_max}/${ch.hp_max}` : null],
      ['Speed', ch.speed ? `${ch.speed}ft` : null],
      ['Initiative', ch.initiative_bonus != null ? (ch.initiative_bonus >= 0 ? '+' : '') + ch.initiative_bonus : null],
    ];
    for (const [label, val] of combatItems) {
      if (val == null) continue;
      const item = el('div', { style: 'text-align:center;padding:0.3rem' });
      item.append(el('div', { style: 'font-size:1.3rem;font-weight:700;color:var(--accent)' }, val));
      item.append(el('div', { style: 'font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-top:0.1rem' }, label));
      cGrid.append(item);
    }
    combatCard.append(cGrid);
    // Currency
    const currency = [['PP', ch.platinum], ['GP', ch.gold], ['EP', ch.electrum], ['SP', ch.silver], ['CP', ch.copper]].filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(' | ') || '0 GP';
    combatCard.append(el('div', { style: 'margin-top:0.5rem;font-size:0.85rem;color:var(--text-muted);text-align:center' }, `💰 ${currency}`));
    page.append(combatCard);

    // Skills
    const skills = ch.skills || {};
    const skillList = Object.keys(skills).filter(k => skills[k]);
    if (skillList.length) {
      const skillCard = el('div', { className: 'card' });
      skillCard.append(el('h3', {}, `Skills (${skillList.length})`));
      const grid = el('div', { style: 'display:flex;flex-wrap:wrap;gap:0.3rem' });
      for (const s of skillList) grid.append(el('span', { className: 'tag' }, s.charAt(0).toUpperCase() + s.slice(1)));
      skillCard.append(grid);
      page.append(skillCard);
    }

    // Proficiencies
    const profs = ch.proficiencies || [];
    if (profs.length) {
      const profCard = el('div', { className: 'card' });
      profCard.append(el('h3', {}, `Proficiencies (${profs.length})`));
      const grid = el('div', { style: 'display:flex;flex-wrap:wrap;gap:0.3rem' });
      for (const p of profs) grid.append(el('span', { className: 'tag' }, typeof p === 'string' ? p : p.name || p));
      profCard.append(grid);
      page.append(profCard);
    }

    // Features & Traits
    const features = ch.features || [];
    if (features.length) {
      const featCard = el('div', { className: 'card' });
      featCard.append(el('h3', {}, `Features & Traits (${features.length})`));
      for (const f of features) {
        const name = typeof f === 'string' ? f : f.name || '';
        const desc = typeof f === 'string' ? '' : f.description || f.desc || '';
        const block = el('div', { style: 'padding:0.3rem 0;border-bottom:1px solid var(--border);margin-bottom:0.3rem' });
        block.append(el('strong', { style: 'color:var(--text-secondary)' }, name));
        if (desc) block.append(el('p', { style: 'font-size:0.85rem;margin-top:0.15rem;color:var(--text-muted);line-height:1.4' }, desc));
        featCard.append(block);
      }
      page.append(featCard);
    }

    // Inventory
    const inv = ch.inventory || [];
    if (inv.length) {
      const invCard = el('div', { className: 'card' });
      invCard.append(el('h3', {}, `Inventory (${inv.length})`));
      for (const item of inv) {
        const name = typeof item === 'string' ? item : item.name || '';
        const qty = typeof item === 'object' ? item.quantity || item.qty : null;
        const row = el('div', { style: 'display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;border-bottom:1px solid var(--border);font-size:0.9rem' });
        row.append(el('span', { style: 'flex:1' }, name));
        if (qty) row.append(el('span', { className: 'tag' }, 'x' + qty));
        invCard.append(row);
      }
      page.append(invCard);
    }

    // Spells
    const spells = ch.spells || {};
    const spellLevels = Object.keys(spells).filter(k => spells[k]?.length);
    if (spellLevels.length) {
      const spellCard = el('div', { className: 'card' });
      spellCard.append(el('h3', {}, 'Spells'));
      for (const level of spellLevels.sort((a, b) => a === '0' ? -1 : a - b)) {
        const list = spells[level];
        if (!list?.length) continue;
        spellCard.append(el('div', { style: 'font-weight:600;color:var(--accent);margin:0.5rem 0 0.3rem;font-size:0.85rem' }, level === '0' ? 'Cantrips' : `Level ${level}`));
        for (const s of list) {
          spellCard.append(el('div', { style: 'padding:0.2rem 0.5rem;margin:0.15rem 0;background:var(--bg-hover);border-radius:4px;font-size:0.85rem' }, s));
        }
      }
      page.append(spellCard);
    }

    // Personality
    const personality = [
      ['Personality Traits', ch.personality_traits],
      ['Ideals', ch.ideals],
      ['Bonds', ch.bonds],
      ['Flaws', ch.flaws],
    ].filter(([, v]) => v);
    if (personality.length) {
      const persCard = el('div', { className: 'card' });
      persCard.append(el('h3', {}, 'Personality'));
      for (const [label, val] of personality) {
        persCard.append(el('div', { style: 'margin-bottom:0.4rem' }));
        persCard.append(el('strong', { style: 'font-size:0.85rem;color:var(--text-secondary)' }, label));
        persCard.append(el('p', { style: 'font-size:0.85rem;color:var(--text-muted);margin-top:0.1rem;font-style:italic' }, val));
      }
      page.append(persCard);
    }

    // Appearance & Backstory
    if (ch.appearance) {
      const appCard = el('div', { className: 'card' });
      appCard.append(el('h3', {}, 'Appearance'));
      appCard.append(el('p', { style: 'font-size:0.85rem;color:var(--text-muted)' }, ch.appearance));
      page.append(appCard);
    }
    if (ch.backstory) {
      const backCard = el('div', { className: 'card' });
      backCard.append(el('h3', {}, 'Backstory'));
      backCard.append(el('p', { style: 'font-size:0.85rem;color:var(--text-muted);line-height:1.5;white-space:pre-wrap' }, ch.backstory));
      page.append(backCard);
    }

  } catch (e) {
    page.innerHTML = '';
    page.append(errorMsg(e.message));
  }

  render('character', page);
}

// =====================================================
// PAGE: Dice Roller
// =====================================================
function renderDiceRoller() {
  const page = el('div');
  page.append(el('h2', { className: 'page-title' }, 'Dice Roller'));

  const dieCounts = {};
  const results = [];

  const dieSelector = renderDiceSelector(dieCounts);
  page.append(dieSelector);

  const rollBar = el('div', { className: 'roll-bar' });
  rollBar.append(el('label', { style: 'margin:0;white-space:nowrap' }, 'Modifier:'));
  const modInput = el('input', { type: 'number', className: 'roll-mod-input', id: 'roll-mod', value: '0' });
  rollBar.append(modInput);
  const rollBtn = el('button', { className: 'roll-main-btn', id: 'roll-btn' }, 'Roll Dice!');
  rollBar.append(rollBtn);
  page.append(rollBar);

  const quickRolls = el('div', { className: 'quick-rolls' });
  const quickPresets = [
    { label: '1d20', dice: { 20: 1 }, mod: 0 },
    { label: '1d20+5', dice: { 20: 1 }, mod: 5 },
    { label: '2d6', dice: { 6: 2 }, mod: 0 },
    { label: '3d6', dice: { 6: 3 }, mod: 0 },
    { label: '1d8+3', dice: { 8: 1 }, mod: 3 },
    { label: '1d12', dice: { 12: 1 }, mod: 0 },
    { label: 'Advantage', dice: { 20: 2 }, mod: 0, adv: true },
    { label: 'Disadvantage', dice: { 20: 2 }, mod: 0, dis: true },
    { label: 'd100', dice: { 100: 1 }, mod: 0 },
  ];
  for (const preset of quickPresets) {
    const btn = el('button', { className: 'secondary', style: 'font-size:0.8rem' }, preset.label);
    btn.onclick = () => {
      for (const k of Object.keys(dieCounts)) dieCounts[k] = 0;
      Object.assign(dieCounts, preset.dice);
      for (const [die, count] of Object.entries(preset.dice)) {
        const span = document.getElementById('die-count-' + die);
        if (span) span.textContent = count.toString();
      }
      modInput.value = preset.mod.toString();
      doRoll();
    };
    quickRolls.append(btn);
  }
  page.append(quickRolls);

  const trayHeader = el('div', { className: 'dice-tray-header' });
  const autoLabel = el('label', { className: 'dice-auto-toggle' });
  const autoCheck = el('input', { type: 'checkbox', id: 'dice-auto-clear' });
  autoLabel.append(autoCheck, ' Auto-clear (5s)');
  trayHeader.append(autoLabel);
  const clearBtn = el('button', { className: 'dice-clear-btn' }, 'Clear');
  trayHeader.append(clearBtn);
  page.append(trayHeader);

  const tray = el('div', { className: 'dice-tray', id: 'dice-tray' });
  const resultRow = el('div', { className: 'dice-result-row', id: 'dice-result-row' });
  const totalDiv = el('div', { className: 'dice-total', id: 'dice-total' });
  const formulaDiv = el('div', { style: 'text-align:center;color:var(--text-muted);font-size:0.8rem;margin-top:0.3rem', id: 'dice-formula' });
  tray.append(resultRow, totalDiv, formulaDiv);
  page.append(tray);

  let autoClearTimer = null;

  function doRoll() {
    if (autoClearTimer) { clearTimeout(autoClearTimer); autoClearTimer = null; }
    resultRow.innerHTML = '';
    const modifier = parseInt(modInput.value) || 0;
    const allRolls = [];
    let total = 0;

    for (const [sides, count] of Object.entries(dieCounts)) {
      const s = parseInt(sides);
      for (let i = 0; i < count; i++) {
        const val = rollDie(s);
        allRolls.push({ type: s, value: val });
        total += val;
      }
    }

    if (!allRolls.length) {
      totalDiv.textContent = 'Select some dice!';
      formulaDiv.textContent = '';
      return;
    }

    for (const r of allRolls) {
      resultRow.append(createDieResult(r.type, r.value));
    }

    const parts = [];
    for (const [sides, count] of Object.entries(dieCounts)) {
      if (count > 0) parts.push(count + 'd' + sides);
    }
    formulaDiv.textContent = parts.join(' + ') + (modifier !== 0 ? ' + ' + modifier : '');
    totalDiv.textContent = (total + modifier).toString();

    if (autoCheck.checked) {
      autoClearTimer = setTimeout(() => {
        resultRow.innerHTML = '';
        totalDiv.textContent = '';
        formulaDiv.textContent = '';
      }, 5000);
    }
  }

  rollBtn.onclick = doRoll;
  clearBtn.onclick = () => {
    resultRow.innerHTML = '';
    totalDiv.textContent = '';
    formulaDiv.textContent = '';
    for (const k of Object.keys(dieCounts)) dieCounts[k] = 0;
    for (const die of STANDARD_DICE) {
      const span = document.getElementById('die-count-' + die);
      if (span) span.textContent = '0';
    }
    if (autoClearTimer) { clearTimeout(autoClearTimer); autoClearTimer = null; }
  };

  render('roll', page);
}

// =====================================================
// PAGE: SRD Browser
// =====================================================
async function renderSRD(type) {
  const page = el('div');
  page.append(el('h2', { className: 'page-title' }, 'SRD Browser'));

  const tabs = el('div', { className: 'campaign-view-toggle' });
  const tabTypes = [
    { key: 'monsters', label: 'Monsters' },
    { key: 'spells', label: 'Spells' },
    { key: 'items', label: 'Items' },
  ];
  const tabBtns = {};
  for (const t of tabTypes) {
    const btn = el('button', { className: 'cv-toggle-btn' + (t.key === type ? ' active' : ''), id: 'srd-tab-' + t.key }, t.label);
    tabBtns[t.key] = btn;
    btn.onclick = () => navigate('srd/' + t.key);
    tabs.append(btn);
  }
  page.append(tabs);

  const searchRow = el('div', { style: 'margin-bottom:1rem' });
  const searchInput = el('input', { type: 'text', placeholder: 'Search ' + type + '...', id: 'srd-search' });
  searchRow.append(searchInput);
  page.append(searchRow);

  const listDiv = el('div', { id: 'srd-list' });
  page.append(listDiv);

  async function loadList(query) {
    listDiv.innerHTML = '';
    listDiv.append(loadingMsg());
    try {
      const q = query ? '?search=' + encodeURIComponent(query) : '';
      const items = await API.get('/api/srd/' + type + q);
      listDiv.innerHTML = '';
      if (!items.length) { listDiv.append(emptyMsg('No ' + type + ' found.')); return; }
      // Build a table
      const table = el('table');
      const thead = el('thead');
      const tbody = el('tbody');
      const getProp = (item, key, fallback = '') => item.properties?.[key] ?? item[key] ?? fallback;
      if (type === 'monsters') {
        thead.append(el('tr', {}, el('th', {}, 'Name'), el('th', {}, 'Type'), el('th', {}, 'CR'), el('th', {}, 'AC'), el('th', {}, 'HP')));
        for (const item of items) {
          const tr = el('tr', { style: 'cursor:pointer' });
          tr.onclick = () => navigate('srd-monster/' + encodeURIComponent(item.name));
          tr.append(el('td', {}, el('strong', {}, item.name)));
          tr.append(el('td', { style: 'font-size:0.85rem;color:var(--text-muted)' }, getProp(item, 'Type')));
          tr.append(el('td', {}, getProp(item, 'CR') ? 'CR ' + getProp(item, 'CR') : ''));
          tr.append(el('td', {}, getProp(item, 'AC')));
          tr.append(el('td', {}, getProp(item, 'HP')));
          tbody.append(tr);
        }
      } else if (type === 'spells') {
        thead.append(el('tr', {}, el('th', {}, 'Name'), el('th', {}, 'Level'), el('th', {}, 'School'), el('th', {}, 'Casting Time'), el('th', {}, 'Duration')));
        for (const item of items) {
          const tr = el('tr', { style: 'cursor:pointer' });
          tr.onclick = () => navigate('srd-spell/' + encodeURIComponent(item.name));
          const lvl = parseInt(getProp(item, 'Level', 0), 10);
          tr.append(el('td', {}, el('strong', {}, item.name)));
          tr.append(el('td', {}, lvl === 0 ? 'Cantrip' : 'Level ' + lvl));
          tr.append(el('td', { style: 'font-size:0.85rem;color:var(--text-muted)' }, getProp(item, 'School')));
          tr.append(el('td', {}, getProp(item, 'Casting Time')));
          tr.append(el('td', {}, getProp(item, 'Duration')));
          tbody.append(tr);
        }
      } else {
        thead.append(el('tr', {}, el('th', {}, 'Name'), el('th', {}, 'Type'), el('th', {}, 'Rarity'), el('th', {}, 'Cost')));
        for (const item of items) {
          const tr = el('tr', {});
          tr.append(el('td', {}, el('strong', {}, item.name)));
          tr.append(el('td', { style: 'font-size:0.85rem;color:var(--text-muted)' }, getProp(item, 'Item Type') || getProp(item, 'Category')));
          tr.append(el('td', {}, getProp(item, 'Item Rarity')));
          tr.append(el('td', {}, getProp(item, 'Cost')));
          tbody.append(tr);
        }
      }
      table.append(thead, tbody);
      listDiv.append(table);
    } catch (e) { listDiv.innerHTML = ''; listDiv.append(errorMsg(e.message)); }
  }

  searchInput.oninput = () => loadList(searchInput.value);
  loadList('');
  render('srd', page);
}

// =====================================================
// PAGE: SRD Monster Detail
// =====================================================
async function renderSRDMonsterDetail(name) {
  const page = el('div');
  page.append(loadingMsg());

  try {
    const m = await API.get('/api/srd/monsters/' + encodeURIComponent(name));
    page.innerHTML = '';

    page.append(el('a', { href: '#srd', style: 'color:var(--text-muted);font-size:0.85rem;text-decoration:none;display:block;margin-bottom:0.5rem' }, '← Back to SRD'));

    const prop = (k, fb = '') => m.properties?.[k] ?? m[k] ?? fb;
    const num = (k, fb = 0) => { const v = prop(k); return v ? parseInt(v, 10) || parseFloat(v) || fb : fb; };

    const block = el('div', { className: 'monster-block' });
    const nameLine = el('div', { style: 'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap' });
    nameLine.append(el('h3', { style: 'font-size:1.5rem;margin:0' }, m.name));
    const cr = prop('CR');
    if (cr) nameLine.append(el('span', { className: 'tag tag-success' }, 'CR ' + cr));
    block.append(nameLine);

    const typeLine = [prop('Size'), prop('Type')].filter(Boolean).join(' ');
    if (typeLine) block.append(el('p', { style: 'font-style:italic;color:var(--text-muted);margin:0.3rem 0 0.8rem' }, typeLine));

    const statTable = el('table', { style: 'margin-bottom:0.8rem' });
    const sb = el('tbody');
    const addRow = (label, val) => { if (val) { const tr = el('tr'); tr.append(el('td', { style: 'font-weight:600;padding:0.2rem 0.8rem 0.2rem 0;white-space:nowrap;width:1px' }, label)); tr.append(el('td', { style: 'padding:0.2rem 0' }, String(val))); sb.append(tr); } };
    addRow('Armor Class', prop('AC'));
    addRow('Hit Points', prop('HP'));
    addRow('Speed', prop('Speed'));
    statTable.append(sb);
    block.append(statTable);

    // Ability scores
    const scoreKeys = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
    const abbrs = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
    const hasScores = scoreKeys.some(k => prop(k));
    if (hasScores) {
      const sTable = el('table', { style: 'margin-bottom:0.8rem' });
      const sHead = el('thead'); const sBody = el('tbody');
      const hRow = el('tr'); const bRow = el('tr');
      for (let i = 0; i < scoreKeys.length; i++) {
        const val = num(scoreKeys[i]);
        if (!val) continue;
        const mod = Math.floor((val - 10) / 2);
        hRow.append(el('th', { style: 'text-align:center;padding:0.15rem 0.4rem;font-size:0.75rem' }, abbrs[i]));
        bRow.append(el('td', { style: 'text-align:center;padding:0.15rem 0.4rem;font-size:0.85rem' }, val + ' (' + (mod >= 0 ? '+' : '') + mod + ')'));
      }
      sHead.append(hRow); sBody.append(bRow);
      sTable.append(sHead, sBody);
      block.append(sTable);
    }

    const addLine = (label, val) => { if (val) block.append(el('p', { className: 'stat-line', style: 'margin:0.2rem 0' }, label + ': ' + val)); };
    addLine('Saving Throws', prop('Saving Throws'));
    addLine('Skills', prop('Skills'));
    addLine('Damage Resistances', prop('Damage Resistances'));
    addLine('Damage Immunities', prop('Damage Immunities'));
    addLine('Condition Immunities', prop('Condition Immunities'));
    addLine('Senses', prop('Senses'));
    addLine('Languages', prop('Languages'));
    addLine('Challenge', cr ? cr + (prop('XP') ? ' (' + prop('XP') + ' XP)' : '') : null);

    if (m.publisher || m.book) {
      const src = [m.publisher, m.book].filter(Boolean).join(' — ');
      block.append(el('p', { style: 'margin-top:0.8rem;font-size:0.75rem;color:var(--text-muted);border-top:1px solid var(--border);padding-top:0.5rem' }, '📖 ' + src));
    }

    if (m.description) block.append(el('p', { style: 'font-size:0.85rem;color:var(--text-secondary);margin-top:0.8rem;line-height:1.5' }, m.description));

    page.append(block);
  } catch (e) {
    page.innerHTML = '';
    page.append(errorMsg(e.message));
  }

  render('srd', page);
}

// =====================================================
// PAGE: SRD Spell Detail
// =====================================================
async function renderSRDSpellDetail(name) {
  const page = el('div');
  page.append(loadingMsg());

  try {
    const s = await API.get('/api/srd/spells/' + encodeURIComponent(name));
    page.innerHTML = '';

    page.append(el('a', { href: '#srd', style: 'color:var(--text-muted);font-size:0.85rem;text-decoration:none;display:block;margin-bottom:0.5rem' }, '← Back to SRD'));

    const prop = (k, fb = '') => s.properties?.[k] ?? s[k] ?? fb;

    const card = el('div', { className: 'card' });
    const nameRow = el('div', { style: 'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap' });
    nameRow.append(el('h3', { style: 'font-size:1.3rem;margin:0' }, s.name));
    const lvl = parseInt(prop('Level', 0), 10);
    const school = prop('School');
    const levelLabel = lvl === 0 ? 'Cantrip' : 'Level ' + lvl;
    if (levelLabel) nameRow.append(el('span', { className: 'tag tag-success' }, levelLabel + (school ? ' ' + school : '')));
    card.append(nameRow);

    const table = el('table', { style: 'margin-top:0.8rem' });
    const tbody = el('tbody');
    const addRow = (label, val) => { if (val) { const tr = el('tr'); tr.append(el('td', { style: 'font-weight:600;padding:0.25rem 1rem 0.25rem 0;white-space:nowrap;width:1px' }, label)); tr.append(el('td', { style: 'padding:0.25rem 0' }, String(val))); tbody.append(tr); } };
    addRow('Casting Time', prop('Casting Time'));
    addRow('Range', prop('Range'));
    addRow('Components', prop('Components'));
    addRow('Duration', prop('Duration'));
    addRow('Damage Type', prop('Damage Type'));
    addRow('Save', prop('Save'));
    addRow('Ritual', prop('Ritual') ? 'Yes' : '');
    table.append(tbody);
    card.append(table);

    if (s.description) card.append(el('div', { style: 'margin-top:0.8rem;padding:0.8rem;background:var(--bg-hover);border-radius:6px;font-size:0.9rem;line-height:1.6;white-space:pre-wrap;color:var(--text-primary)' }, s.description));

    if (s.publisher || s.book) {
      const src = [s.publisher, s.book].filter(Boolean).join(' — ');
      card.append(el('p', { style: 'margin-top:0.5rem;font-size:0.75rem;color:var(--text-muted)' }, '📖 ' + src));
    }

    page.append(card);
  } catch (e) {
    page.innerHTML = '';
    page.append(errorMsg(e.message));
  }

  render('srd', page);
}

// =====================================================
// PAGE: Activity (SSE Live Log Feed)
// =====================================================
function renderActivity() {
  const page = el('div');
  page.append(el('h2', { className: 'page-title' }, 'Activity Log'));

  const badge = el('span', { className: 'live-badge' }, 'LIVE');
  const headerRow = el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem' });
  headerRow.append(el('div', {}, el('span', { style: 'font-size:0.9rem;color:var(--text-muted)' }, 'Real-time server activity feed')));
  headerRow.append(badge);
  page.append(headerRow);

  const filterBar = el('div', { className: 'log-filter-bar', id: 'log-filters' });
  const filters = ['All', 'campaign', 'character', 'session', 'encounter', 'roll', 'adventure', 'system'];
  const filterBtns = {};
  for (const f of filters) {
    const btn = el('button', { className: 'filter-btn' + (f === 'All' ? ' active' : ''), dataset: { filter: f } }, f);
    filterBtns[f] = btn;
    filterBar.append(btn);
  }
  page.append(filterBar);

  const feed = el('div', { className: 'log-feed', id: 'log-feed' });
  page.append(feed);

  let activeFilter = 'All';
  let eventSource = null;

  for (const [key, btn] of Object.entries(filterBtns)) {
    btn.onclick = () => {
      Object.values(filterBtns).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = key;
      feed.querySelectorAll('.log-entry').forEach(e => {
        const type = e.dataset.type || 'system';
        e.style.display = (activeFilter === 'All' || activeFilter === type) ? 'flex' : 'none';
      });
    };
  }

  function addLog(entry) {
    const row = el('div', { className: 'log-entry log-new', dataset: { type: entry.type || 'system' } });
    const time = el('span', { className: 'log-time' }, entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '');
    const iconSpan = el('span', { className: 'log-icon' }, entry.icon || '\u{1F4AC}');
    const body = el('div', { className: 'log-body' });
    body.append(el('div', { className: 'log-title' }, entry.title || ''));
    if (entry.content) body.append(el('div', { className: 'log-content' }, entry.content));
    row.append(time, iconSpan, body);
    row.style.display = (activeFilter === 'All' || activeFilter === (entry.type || 'system')) ? 'flex' : 'none';
    feed.prepend(row);
    if (feed.children.length > 200) feed.lastChild.remove();
    setTimeout(() => row.classList.remove('log-new'), 600);
  }

  function connectSSE() {
    if (eventSource) eventSource.close();
    const token = API.getToken();
    if (!token) return;
    eventSource = new EventSource('/api/events?token=' + encodeURIComponent(token));
    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        addLog(data);
      } catch {}
    };
    eventSource.onerror = () => {
      setTimeout(connectSSE, 3000);
    };
  }

  connectSSE();
  page._cleanup = () => { if (eventSource) { eventSource.close(); eventSource = null; } };

  render('activity', page);
}

// =====================================================
// PAGE: Adventures
// =====================================================
async function renderAdventures() {
  const page = el('div');
  page.append(el('h2', { className: 'page-title' }, 'Adventures'));

  const guildId = currentGuild();

  const pickerDiv = el('div', { id: 'adventure-picker' });
  page.append(pickerDiv);

  const moduleDiv = el('div', { id: 'adventure-modules' });
  page.append(moduleDiv);

  async function loadCampaigns() {
    pickerDiv.innerHTML = '';
    try {
      const campaigns = await API.get('/api/campaigns' + (guildId ? '?guildId=' + guildId : ''));
      if (!campaigns.length) { pickerDiv.append(emptyMsg('No campaigns. Create one first.')); return; }
      pickerDiv.append(el('label', {}, 'Select Campaign'));
      const select = el('select', { id: 'adv-campaign-select' });
      select.append(el('option', { value: '' }, 'Choose a campaign...'));
      for (const c of campaigns) select.append(el('option', { value: c.id }, c.name));
      pickerDiv.append(select);
      select.onchange = () => {
        if (select.value) loadModules(select.value);
        else moduleDiv.innerHTML = '';
      };
    } catch (e) { pickerDiv.append(errorMsg(e.message)); }
  }

  async function loadModules(campaignId) {
    moduleDiv.innerHTML = '';
    moduleDiv.append(loadingMsg());
    try {
      const modules = await API.get('/api/adventures?campaignId=' + campaignId);
      moduleDiv.innerHTML = '';
      if (!modules.length) { moduleDiv.append(emptyMsg('No adventure modules for this campaign.')); return; }
      for (const mod of modules) {
        const card = el('div', { className: 'card' });
        const header = el('div', { style: 'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem' });
        header.append(el('h3', { style: 'border:none;margin:0' }, mod.name));
        const btnGroup = el('div', { style: 'display:flex;gap:0.3rem;align-items:center' });
        const startBtn = el('button', { style: 'font-size:0.8rem' }, '▶ Start');
        startBtn.onclick = async () => {
          try {
            const session = await API.post('/api/adventures/' + mod.id + '/start-session');
            navigate('adventure-session/' + session.id);
          } catch (e) { alert(e.message); }
        };
        const deleteBtn = el('button', { className: 'danger', style: 'font-size:0.7rem;padding:0.2rem 0.5rem' }, '🗑 Delete');
        deleteBtn.onclick = async () => {
          if (!confirm(`Delete "${mod.name}"? This cannot be undone.`)) return;
          try {
            await API.delete('/api/adventures/' + mod.id);
            loadModules(campaignId);
          } catch (e) { alert(e.message); }
        };
        btnGroup.append(startBtn, deleteBtn);
        header.append(btnGroup);
        card.append(header);
        if (mod.description) card.append(el('p', { style: 'margin-top:0.3rem' }, mod.description));
        if (mod.chapters?.length) {
          for (const ch of mod.chapters) {
            const chDiv = el('div', { style: 'margin-top:0.5rem;padding:0.5rem;background:var(--bg-secondary);border-radius:6px' });
            chDiv.append(el('strong', { style: 'color:var(--accent)' }, ch.name || 'Chapter'));
            if (ch.npcs?.length) {
              chDiv.append(el('div', { style: 'margin-top:0.3rem;font-size:0.8rem;color:var(--text-muted)' }, 'NPCs: ' + ch.npcs.map(n => n.name || n).join(', ')));
            }
            if (ch.scenes?.length) {
              chDiv.append(el('div', { style: 'margin-top:0.3rem;font-size:0.8rem;color:var(--text-muted)' }, 'Scenes: ' + ch.scenes.length));
              for (const sc of ch.scenes) {
                const scItem = el('div', { className: 'scene-list-item' });
                scItem.append(el('div', { className: 'sli-title' }, sc.title || sc.name || 'Scene'));
                if (sc.type) scItem.append(el('div', { className: 'sli-meta' }, sc.type));
                scItem.onclick = () => showSceneModal(sc);
                chDiv.append(scItem);
              }
            }
            card.append(chDiv);
          }
        }
        moduleDiv.append(card);
      }
    } catch (e) { moduleDiv.innerHTML = ''; moduleDiv.append(errorMsg(e.message)); }
  }

  function showSceneModal(scene) {
    const overlay = el('div', { style: 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem' });
    const card = el('div', { className: 'scene-card', style: 'max-width:600px;width:100%;max-height:80vh;overflow-y:auto' });
    const header = el('div', { className: 'scene-header' });
    header.append(el('span', { className: 'scene-type' }, scene.type || 'scene'));
    const closeBtn = el('button', { className: 'secondary', style: 'font-size:0.75rem;padding:0.2rem 0.5rem' }, 'X');
    header.append(closeBtn);
    card.append(header);
    card.append(el('div', { className: 'scene-title' }, scene.title || scene.name || 'Scene'));
    if (scene.text || scene.description) card.append(el('div', { className: 'scene-text' }, scene.text || scene.description));

    if (scene.npcs?.length) {
      for (const n of scene.npcs) {
        card.append(el('div', { className: 'conversation-block' },
          el('div', { className: 'speaker' }, n.name || n),
          el('div', { className: 'speech' }, n.speech || n.dialogue || ''),
        ));
      }
    }

    if (scene.choices?.length) {
      const choicesDiv = el('div', { className: 'scene-choices' });
      choicesDiv.append(el('strong', { style: 'display:block;margin-bottom:0.3rem' }, 'Choices:'));
      for (const ch of scene.choices) {
        const btn = el('button', { className: 'choice-btn' });
        btn.append(el('span', { className: 'choice-label' }, ch.label || 'Choice'));
        if (ch.description) btn.append(' — ' + ch.description);
        choicesDiv.append(btn);
      }
      card.append(choicesDiv);
    }

    overlay.append(card);
    document.body.append(overlay);
    closeBtn.onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  }

  loadCampaigns();
  render('adventures', page);
}

// =====================================================
// PAGE: Adventure Session
// =====================================================
async function renderAdventureSession(id) {
  const page = el('div');
  page.append(loadingMsg());

  try {
    const session = await API.get('/api/adventure-sessions/' + id);
    page.innerHTML = '';

    page.append(el('h2', { className: 'page-title' }, session.name || 'Adventure Session'));

    const lobbyDiv = el('div', { id: 'session-lobby' });
    if (session.players?.length) {
      const card = el('div', { className: 'card' });
      card.append(el('h3', {}, 'Players (' + session.players.length + ')'));
      for (const p of session.players) {
        card.append(el('div', { style: 'display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0' },
          el('span', { style: 'font-weight:600' }, p.username || p.name),
          p.ready ? el('span', { className: 'tag tag-success' }, 'Ready') : el('span', { className: 'tag' }, 'Waiting'),
        ));
      }
      lobbyDiv.append(card);
    }
    page.append(lobbyDiv);

    if (session.currentScene) {
      const sceneCard = el('div', { className: 'scene-card' });
      const header = el('div', { className: 'scene-header' });
      header.append(el('span', { className: 'scene-type' }, session.currentScene.type || 'scene'));
      sceneCard.append(header);
      sceneCard.append(el('div', { className: 'scene-title' }, session.currentScene.title || 'Scene'));
      if (session.currentScene.text) sceneCard.append(el('div', { className: 'scene-text' }, session.currentScene.text));

      if (session.currentScene.choices?.length) {
        const choicesDiv = el('div', { className: 'scene-choices' });
        choicesDiv.append(el('strong', { style: 'display:block;margin-bottom:0.3rem' }, 'Choices:'));
        for (const ch of session.currentScene.choices) {
          const btn = el('button', { className: 'choice-btn' });
          btn.append(el('span', { className: 'choice-label' }, ch.label || 'Choice'));
          if (ch.description) btn.append(' — ' + ch.description);
          btn.onclick = async () => {
            try {
              const updated = await API.post('/api/adventure-sessions/' + id + '/choice', { choiceId: ch.id || ch.label });
              renderAdventureSession(id);
            } catch (e) { alert(e.message); }
          };
          choicesDiv.append(btn);
        }
        sceneCard.append(choicesDiv);
      }

      page.append(sceneCard);
    }
  } catch (e) {
    page.innerHTML = '';
    page.append(errorMsg(e.message));
  }

  render('adventure-session', page);
}

// =====================================================
// PAGE: Adventure Runner
// =====================================================
// =====================================================
// PAGE: Encounters (campaign picker)
// =====================================================
async function renderEncounters() {
  const page = el('div');
  page.append(el('h2', { className: 'page-title' }, 'Encounters'));

  const guildId = currentGuild();

  const pickerDiv = el('div', { id: 'enc-campaign-picker' });
  page.append(pickerDiv);

  const listDiv = el('div', { id: 'enc-list' });
  page.append(listDiv);

  async function loadCampaigns() {
    pickerDiv.innerHTML = '';
    try {
      const campaigns = await API.get('/api/campaigns' + (guildId ? '?guildId=' + guildId : ''));
      if (!campaigns.length) { pickerDiv.append(emptyMsg('No campaigns.')); return; }
      pickerDiv.append(el('label', {}, 'Select Campaign'));
      const select = el('select', { id: 'enc-campaign' });
      select.append(el('option', { value: '' }, 'Choose...'));
      for (const c of campaigns) select.append(el('option', { value: c.id }, c.name));
      pickerDiv.append(select);
      select.onchange = () => {
        if (select.value) loadEncounters(select.value);
        else listDiv.innerHTML = '';
      };
    } catch (e) { pickerDiv.append(errorMsg(e.message)); }
  }

  async function loadEncounters(campaignId) {
    listDiv.innerHTML = '';
    listDiv.append(loadingMsg());
    try {
      const encounters = await API.get('/api/encounters?campaignId=' + campaignId);
      listDiv.innerHTML = '';
      if (!encounters.length) { listDiv.append(emptyMsg('No encounters for this campaign.')); return; }
      for (const enc of encounters) {
        const card = el('div', { className: 'card', style: 'cursor:pointer;padding:0.7rem 1rem' });
        card.onclick = () => navigate('encounter/' + enc.id);
        card.append(el('div', { style: 'font-weight:600' }, enc.name));
        card.append(el('div', { style: 'font-size:0.8rem;color:var(--text-muted);margin-top:0.2rem' },
          `${enc.status || 'prepared'} — ${enc.difficulty || 'unknown'} difficulty`
        ));
        listDiv.append(card);
      }
    } catch (e) { listDiv.innerHTML = ''; listDiv.append(errorMsg(e.message)); }
  }

  loadCampaigns();
  render('encounters', page);
}

// =====================================================
// PAGE: Encounter Detail (Combat Tracker)
// =====================================================
async function renderEncounterDetail(id) {
  const page = el('div');
  try {
    const encounter = await API.get('/api/encounters/' + id);
    page.append(el('a', { href: '#encounters', style: 'color:var(--text-muted);font-size:0.85rem;text-decoration:none;display:block;margin-bottom:0.5rem' }, '← Back to Encounters'));
    page.append(el('h2', { className: 'page-title' }, `⚔️ ${encounter.name}`));
    const infoBar = el('div', { className: 'encounter-status-bar' },
      el('div', { className: 'esb-item' }, el('div', { className: 'esb-label' }, 'Status'), el('div', { className: 'esb-value' }, encounter.status)),
      el('div', { className: 'esb-item' }, el('div', { className: 'esb-label' }, 'Round'), el('div', { className: 'esb-value' }, `${encounter.round || 1}`)),
      el('div', { className: 'esb-item' }, el('div', { className: 'esb-label' }, 'Difficulty'), el('div', { className: 'esb-value' }, encounter.difficulty || 'Unknown')),
      el('div', { className: 'esb-item' }, el('div', { className: 'esb-label' }, 'Environment'), el('div', { className: 'esb-value' }, encounter.environment || 'None')),
    );
    page.append(infoBar);
    if (encounter.description) page.append(el('div', { className: 'card' }, el('p', {}, encounter.description)));
    if (encounter.combatants?.length) {
      const combatCard = el('div', { className: 'card' });
      combatCard.append(el('h3', {}, `Combatants (${encounter.combatants.length})`));
      for (const c of encounter.combatants) {
        combatCard.append(el('div', { className: 'combatant-row' },
          el('span', { className: 'c-name' }, c.name),
          el('span', { className: 'c-hp' }, `HP: ${c.hp_current ?? '?'}/${c.hp_max ?? '?'}`),
          el('span', { className: 'c-type' }, c.type || ''),
        ));
      }
      page.append(combatCard);
    }
  } catch (e) { page.append(errorMsg(e.message)); }
  render('encounter', page);
}

// =====================================================
// PAGE: Maps (campaign picker)
// =====================================================
async function renderMaps() {
  const page = el('div');
  page.append(el('h2', { className: 'page-title' }, 'Maps'));

  const guildId = currentGuild();

  try {
    const campaigns = await API.get('/api/campaigns' + (guildId ? '?guildId=' + guildId : ''));
    if (!campaigns.length) { page.append(emptyMsg('No campaigns.')); render('maps', page); return; }

    const grid = el('div', { className: 'map-picker-campaigns' });
    for (const c of campaigns) {
      const card = el('div', { className: 'map-campaign-card' });
      card.onclick = () => navigate('campaign-maps/' + c.id);
      card.append(el('h3', {}, c.name));
      if (c.mapCount !== undefined) card.append(el('div', { className: 'map-count' }, c.mapCount + ' map(s)'));
      grid.append(card);
    }
    page.append(grid);
  } catch (e) {
    page.append(errorMsg(e.message));
  }

  render('maps', page);
}

// =====================================================
// PAGE: Campaign Maps
// =====================================================
async function renderCampaignMaps(campaignId) {
  const page = el('div');
  page.append(loadingMsg());

  try {
    const campaign = await API.get('/api/campaigns/' + campaignId);
    page.innerHTML = '';
    page.append(el('h2', { className: 'page-title' }, campaign.name + ' — Maps'));

    const uploadForm = el('div', { className: 'upload-zone', id: 'map-upload-zone' });
    uploadForm.append(el('div', { className: 'upload-icon' }, '\u{1F5BC}'));
    uploadForm.append(el('div', { className: 'upload-text' }, 'Drop an image here or click to upload'));
    uploadForm.append(el('div', { className: 'upload-hint' }, 'PNG, JPG, WEBP — recommended max 4096px'));
    const uploadInput = el('input', { type: 'file', accept: 'image/*', style: 'display:none', id: 'map-file-input' });
    const previewImg = el('img', { className: 'upload-preview', id: 'map-upload-preview' });
    uploadForm.append(uploadInput, previewImg);
    page.append(uploadForm);

    uploadForm.onclick = () => uploadInput.click();
    uploadForm.ondragover = (e) => { e.preventDefault(); uploadForm.classList.add('dragover'); };
    uploadForm.ondragleave = () => uploadForm.classList.remove('dragover');
    uploadForm.ondrop = (e) => {
      e.preventDefault();
      uploadForm.classList.remove('dragover');
      if (e.dataTransfer.files.length) uploadInput.files = e.dataTransfer.files;
    };

    uploadInput.onchange = () => {
      const file = uploadInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        previewImg.src = e.target.result;
        previewImg.classList.add('show');
        uploadForm.querySelector('.upload-text').textContent = file.name;
      };
      reader.readAsDataURL(file);
    };

    const uploadBtn = el('button', { style: 'margin-bottom:1rem' }, 'Upload Map');
    uploadBtn.onclick = async () => {
      const file = uploadInput.files[0];
      if (!file) { alert('Select a file first.'); return; }
      const formData = new FormData();
      formData.append('image', file);
      try {
        const guildId = currentGuild();
        await API.upload('/api/guilds/' + guildId + '/maps/upload', formData);
        alert('Map uploaded!');
        renderCampaignMaps(campaignId);
      } catch (e) { alert(e.message); }
    };
    page.append(uploadBtn);

    const guildId = currentGuild();
    const maps = await API.get('/api/guilds/' + guildId + '/maps?campaignId=' + campaignId);
    const mapListDiv = el('div', { id: 'map-list', style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0.8rem' });
    for (const m of (maps || [])) {
      const card = el('div', { className: 'card', style: 'cursor:pointer;padding:0.5rem;text-align:center' });
      const thumb = el('img', { src: m.thumbnailUrl || m.url, style: 'width:100%;height:120px;object-fit:cover;border-radius:4px;margin-bottom:0.3rem', alt: m.name });
      card.append(thumb);
      card.append(el('div', { style: 'font-size:0.85rem;font-weight:600' }, m.name));
      card.onclick = () => showMapViewer(m);
      mapListDiv.append(card);
    }
    page.append(mapListDiv);

    function showMapViewer(map) {
      const overlay = el('div', { style: 'position:fixed;inset:0;background:#000;z-index:10000;display:flex;flex-direction:column' });
      const toolbar = el('div', { style: 'display:flex;gap:0.5rem;padding:0.5rem 1rem;background:var(--bg-secondary);align-items:center;flex-wrap:wrap' });
      const title = el('span', { style: 'color:var(--accent);font-weight:600;margin-right:auto' }, map.name || 'Map');
      toolbar.append(title);

      const gridToggle = el('button', { className: 'fog-btn', style: 'font-size:0.75rem' }, 'Grid');
      gridToggle.onclick = () => { viewer.setGrid(!viewer.showGrid); gridToggle.classList.toggle('active'); };
      toolbar.append(gridToggle);

      const fogToggle = el('button', { className: 'fog-btn', style: 'font-size:0.75rem' }, 'Fog');
      fogToggle.onclick = () => {
        viewer.fogVisible = !viewer.fogVisible;
        fogToggle.classList.toggle('active');
        viewer.render();
      };
      toolbar.append(fogToggle);

      const revealBtn = el('button', { className: 'fog-btn', style: 'font-size:0.75rem' }, 'Reveal Mode');
      revealBtn.onclick = () => {
        viewer.setFogMode('reveal');
        document.querySelectorAll('.fog-btn').forEach(b => b.classList.remove('active'));
        revealBtn.classList.add('active');
      };
      toolbar.append(revealBtn);

      const hideBtn = el('button', { className: 'fog-btn', style: 'font-size:0.75rem' }, 'Hide Mode');
      hideBtn.onclick = () => {
        viewer.setFogMode('hide');
        document.querySelectorAll('.fog-btn').forEach(b => b.classList.remove('active'));
        hideBtn.classList.add('active');
      };
      toolbar.append(hideBtn);

      const resetFogBtn = el('button', { className: 'fog-btn', style: 'font-size:0.75rem' }, 'Reset Fog');
      resetFogBtn.onclick = () => viewer.resetFog();
      toolbar.append(resetFogBtn);

      const clearFogBtn = el('button', { className: 'fog-btn', style: 'font-size:0.75rem' }, 'Clear Fog');
      clearFogBtn.onclick = () => viewer.clearFog();
      toolbar.append(clearFogBtn);

      const pinBtn = el('button', { className: 'fog-btn', style: 'font-size:0.75rem' }, 'Add Pin');
      pinBtn.onclick = () => viewer.togglePins();
      toolbar.append(pinBtn);

      const closeBtn = el('button', { className: 'danger', style: 'font-size:0.75rem;margin-left:auto' }, 'Close');
      closeBtn.onclick = () => { viewer.destroy(); overlay.remove(); };
      toolbar.append(closeBtn);

      overlay.append(toolbar);
      const canvasWrap = el('div', { style: 'flex:1;overflow:hidden;position:relative' });
      overlay.append(canvasWrap);
      document.body.append(overlay);

      const viewer = new MapViewer(canvasWrap, map.url);
      viewer.fogVisible = false;
    }
  } catch (e) {
    page.innerHTML = '';
    page.append(errorMsg(e.message));
  }

  render('maps', page);
}

// =====================================================
// PAGE: Admin Characters (Character Manager)
// =====================================================
async function renderAdminCharacters() {
  const page = el('div');
  page.append(el('h2', { className: 'page-title' }, 'Character Manager'));

  const searchRow = el('div', { style: 'margin-bottom:1rem' });
  const searchInput = el('input', { type: 'text', placeholder: 'Search by name, player, or campaign...', id: 'admin-char-search' });
  searchRow.append(searchInput);
  const importBtn = el('button', { style: 'font-size:0.8rem;margin-left:0.5rem;padding:0.3rem 0.8rem' }, '📥 Import JSON');
  importBtn.onclick = () => {
    const input = el('input', { type: 'file', accept: '.json', style: 'display:none' });
    input.onchange = async () => {
      if (!input.files?.[0]) return;
      try {
        const text = await input.files[0].text();
        const data = JSON.parse(text);
        await API.post('/api/characters/import-json', data);
        loadTable(searchInput.value);
        alert('Character imported successfully!');
      } catch (e) { alert('Import failed: ' + e.message); }
    };
    input.click();
  };
  searchRow.append(importBtn);
  page.append(searchRow);

  const tableWrap = el('div', { style: 'overflow-x:auto' });
  page.append(tableWrap);

  async function loadTable(query) {
    tableWrap.innerHTML = '';
    tableWrap.append(loadingMsg());
    try {
      const q = query ? '?search=' + encodeURIComponent(query) : '';
      const chars = await API.get('/api/characters' + q);
      tableWrap.innerHTML = '';
      if (!chars.length) { tableWrap.append(emptyMsg('No characters found.')); return; }
      const table = el('table');
      const thead = el('thead');
      thead.append(el('tr', {},
        el('th', {}, 'Name'),
        el('th', {}, 'Player'),
        el('th', {}, 'Campaign'),
        el('th', {}, 'Level'),
        el('th', {}, 'Status'),
        el('th', {}, 'Actions'),
      ));
      table.append(thead);
      const tbody = el('tbody');
      for (const ch of chars) {
        const tr = el('tr', {});
        tr.append(el('td', { style: 'font-weight:600' }, ch.name));
        const isLinked = ch.player_discord_id && ch.player_discord_id !== '';
        tr.append(el('td', {}, ch.player_name || ch.player_discord_id || '-'));
        tr.append(el('td', {}, ch.campaign_id ? '#' + ch.campaign_id : '-'));
        tr.append(el('td', {}, (ch.level || '-').toString()));
        tr.append(el('td', {}, isLinked ? el('span', { className: 'tag tag-success' }, 'Linked') : el('span', { className: 'tag' }, 'Unlinked')));

        const actionTd = el('td', { style: 'vertical-align:middle' });
        const actionWrap = el('div', { style: 'display:flex;gap:0.4rem;align-items:center' });
        if (isLinked) {
          const unlinkBtn = el('button', { className: 'danger', style: 'font-size:0.75rem;padding:0.15rem 0.5rem' }, 'Unlink');
          unlinkBtn.onclick = async () => {
            try { await API.delete('/api/characters/' + ch.id + '/link'); loadTable(searchInput.value); }
            catch (e) { alert(e.message); }
          };
          actionWrap.append(unlinkBtn);
        } else {
          const linkBtn = el('button', { style: 'font-size:0.75rem;padding:0.15rem 0.5rem' }, 'Link');
          linkBtn.onclick = async () => {
            const discordId = prompt('Discord User ID:');
            if (discordId) {
              try { await API.put('/api/characters/' + ch.id + '/link', { discordId }); loadTable(searchInput.value); }
              catch (e) { alert(e.message); }
            }
          };
            actionWrap.append(linkBtn);
          }
          actionTd.append(actionWrap);
          tr.append(actionTd);
        tbody.append(tr);
      }
      table.append(tbody);
      tableWrap.append(table);
    } catch (e) { tableWrap.innerHTML = ''; tableWrap.append(errorMsg(e.message)); }
  }

  searchInput.oninput = () => loadTable(searchInput.value);
  loadTable('');
  render('admin-characters', page);
}

// =====================================================
// PAGE: Settings
// =====================================================
async function renderSettings() {
  const page = el('div');
  page.append(el('h2', { className: 'page-title' }, 'Server Settings'));

  const guildId = currentGuild();
  if (!guildId) {
    page.append(el('div', { className: 'dm-only-bar' }, 'Select a guild from the sidebar to configure its settings.'));
    render('settings', page);
    return;
  }

  try {
    const settings = await API.get('/api/guilds/' + guildId + '/settings');
    const form = el('div', { className: 'card' });
    form.append(el('h3', { style: 'border:none' }, 'Settings for ' + (guildList.find(g => g.id === guildId)?.name || guildId)));

    const channelGroup = el('div', { className: 'form-group' });
    channelGroup.append(el('label', {}, 'Embed Channel'));
    const channelInput = el('input', { type: 'text', placeholder: 'Channel ID or name', id: 'settings-embed-channel', value: settings.embedChannel || '' });
    channelGroup.append(channelInput);
    form.append(channelGroup);

    const localeGroup = el('div', { className: 'form-group' });
    localeGroup.append(el('label', {}, 'Locale'));
    const localeSelect = el('select', { id: 'settings-locale' });
    for (const loc of ['en-US', 'en-GB', 'de', 'fr', 'es', 'pt-BR', 'ja', 'ko']) {
      const opt = el('option', { value: loc }, loc);
      if (loc === settings.locale) opt.selected = true;
      localeSelect.append(opt);
    }
    localeGroup.append(localeSelect);
    form.append(localeGroup);

    const saveBtn = el('button', {}, 'Save Settings');
    saveBtn.onclick = async () => {
      try {
        await API.post('/api/guilds/' + guildId + '/settings', {
          embedChannel: channelInput.value.trim(),
          locale: localeSelect.value,
        });
        saveBtn.textContent = 'Saved!';
        setTimeout(() => { saveBtn.textContent = 'Save Settings'; }, 2000);
      } catch (e) { alert(e.message); }
    };
    form.append(saveBtn);
    page.append(form);
  } catch (e) {
    page.append(errorMsg(e.message));
  }

  render('settings', page);
}

// =====================================================
// PAGE: Player Roles (already exists - expanded version)
// =====================================================
async function renderRoles() {
  const page = el('div');
  page.append(el('h2', { className: 'page-title' }, 'Player Roles'));

  const guildRow = el('div', { className: 'form-row', style: 'align-items:end' });
  const guildGroup = el('div', { className: 'form-group', style: 'margin-bottom:0;flex:1' });
  guildGroup.append(el('label', {}, 'Select Server'));
  const guildSelect = el('select', { id: 'roles-guild' });
  guildGroup.append(guildSelect);
  guildRow.append(guildGroup);
  page.append(guildRow);

  const contentDiv = el('div', { id: 'roles-content' });
  page.append(contentDiv);

  async function loadGuilds() {
    try {
      const guilds = await API.get('/api/guilds');
      guildSelect.innerHTML = '<option value="">Select a server...</option>';
      for (const g of guilds) guildSelect.append(el('option', { value: g.id }, g.name));
    } catch {}
  }

  async function loadRoles(guildId) {
    contentDiv.innerHTML = '<div class="loading">Loading...</div>';
    if (!guildId) { contentDiv.innerHTML = ''; return; }
    try {
      const data = await API.get('/api/guilds/' + guildId + '/roles');
      contentDiv.innerHTML = '';

      if (data.admins?.length) {
        const adminCard = el('div', { className: 'card', style: 'padding:0.8rem 1rem;margin-bottom:0.8rem' });
        adminCard.append(el('h3', { style: 'font-size:0.95rem;margin-bottom:0.5rem' }, 'Guild Admins (' + data.admins.length + ')'));
        for (const a of data.admins) {
          adminCard.append(el('div', { style: 'display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;border-bottom:1px solid var(--border)' },
            el('span', { style: 'font-weight:600;min-width:150px' }, a.username),
            el('span', { style: 'font-size:0.8rem;color:var(--text-muted)' }, a.role),
          ));
        }
        contentDiv.append(adminCard);
      }

      if (!data.campaigns?.length && !data.players?.length) {
        contentDiv.append(emptyMsg('No campaigns or players in this server.'));
        return;
      }

      if (data.campaigns?.length) {
        for (const camp of data.campaigns) {
          const campPlayers = data.players.filter(p => p.campaignId === camp.id);
          if (!campPlayers.length) continue;

          const card = el('div', { className: 'card', style: 'padding:0.8rem 1rem;margin-bottom:0.8rem' });
          card.append(el('h3', { style: 'font-size:0.95rem;margin-bottom:0.5rem' }, camp.name + ' \u2014 ' + campPlayers.length + ' players'));

          for (const p of campPlayers) {
            const row = el('div', { style: 'display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;border-bottom:1px solid var(--border);flex-wrap:wrap' });
            row.append(el('span', { style: 'font-weight:600;min-width:120px;font-size:0.85rem' }, p.username));

            const roleSelect = el('select', { style: 'width:auto;margin:0;font-size:0.8rem;padding:0.15rem 0.3rem;display:inline-block' });
            for (const r of ['player', 'co-dm', 'observer']) {
              const opt = el('option', { value: r }, r);
              if (r === p.campaignRole) opt.selected = true;
              roleSelect.append(opt);
            }

            const saveBtn = el('button', { style: 'font-size:0.7rem;padding:0.15rem 0.4rem' }, 'Save');
            saveBtn.onclick = async () => {
              try {
                await API.put('/api/guilds/' + guildId + '/roles', { discordId: p.discordId, campaignId: p.campaignId, role: roleSelect.value });
                saveBtn.textContent = '\u2705';
                setTimeout(() => { saveBtn.textContent = 'Save'; }, 2000);
              } catch (e) { alert(e.message); }
            };

            row.append(roleSelect, saveBtn);

            if (p.characters?.length) {
              const chars = p.characters.map(ch => (ch.name + ' (Lvl ' + ch.level + ' ' + (ch.race || '') + ' ' + (ch.class || '') + ')').trim()).join(', ');
              row.append(el('span', { style: 'font-size:0.75rem;color:var(--text-muted)' }, '\u{1F3AD} ' + chars));
            }
            card.append(row);
          }
          contentDiv.append(card);
        }
      }
    } catch (e) {
      contentDiv.innerHTML = '';
      contentDiv.append(errorMsg(e.message));
    }
  }

  guildSelect.onchange = () => loadRoles(guildSelect.value);
  loadGuilds();
  render('roles', page);
}

// =====================================================
// PAGE: File Browser
// =====================================================
async function renderFileBrowser() {
  const page = el('div');
  page.append(el('h2', { className: 'page-title' }, 'File Browser'));

  const guildId = currentGuild();
  if (!guildId) {
    page.append(el('div', { className: 'dm-only-bar' }, 'Select a guild from the sidebar to browse its files.'));
    render('file-browser', page);
    return;
  }

  const uploadForm = el('div', { className: 'upload-zone', id: 'file-upload-zone' });
  uploadForm.append(el('div', { className: 'upload-icon' }, '\u{1F4C1}'));
  uploadForm.append(el('div', { className: 'upload-text' }, 'Drop files here or click to upload'));
  uploadForm.append(el('div', { className: 'upload-hint' }, 'Images, documents, audio, etc.'));
  const fileInput = el('input', { type: 'file', multiple: true, style: 'display:none', id: 'file-input' });
  uploadForm.append(fileInput);
  page.append(uploadForm);

  uploadForm.onclick = () => fileInput.click();
  uploadForm.ondragover = (e) => { e.preventDefault(); uploadForm.classList.add('dragover'); };
  uploadForm.ondragleave = () => uploadForm.classList.remove('dragover');
  uploadForm.ondrop = (e) => {
    e.preventDefault();
    uploadForm.classList.remove('dragover');
    if (e.dataTransfer.files.length) fileInput.files = e.dataTransfer.files;
  };

  const uploadBtn = el('button', { style: 'margin-bottom:1rem' }, 'Upload Files');
  uploadBtn.onclick = async () => {
    if (!fileInput.files.length) { alert('Select files first.'); return; }
    const formData = new FormData();
    for (const f of fileInput.files) formData.append('files', f);
    try {
      await API.upload('/api/files/' + guildId + '/upload', formData);
      alert('Files uploaded!');
      renderFileBrowser();
    } catch (e) { alert(e.message); }
  };
  page.append(uploadBtn);

  try {
    const files = await API.get('/api/files/' + guildId);
    const fileList = el('div', { id: 'file-list' });
    if (!files.length) {
      fileList.append(emptyMsg('No files uploaded yet.'));
    } else {
      fileList.append(el('h3', { style: 'margin-bottom:0.5rem' }, 'Uploaded Files (' + files.length + ')'));
      for (const f of files) {
        const card = el('div', { className: 'card', style: 'display:flex;align-items:center;gap:0.8rem;padding:0.6rem 1rem' });
        card.append(el('span', { style: 'flex:1;font-weight:600;font-size:0.9rem' }, f.name || f.filename));
        if (f.size) card.append(el('span', { style: 'font-size:0.75rem;color:var(--text-muted)' }, formatFileSize(f.size)));

        const viewBtn = el('button', { className: 'secondary', style: 'font-size:0.7rem;padding:0.2rem 0.5rem' }, 'View');
        viewBtn.onclick = () => window.open(f.url, '_blank');
        card.append(viewBtn);

        const copyBtn = el('button', { style: 'font-size:0.7rem;padding:0.2rem 0.5rem' }, 'Copy URL');
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(f.url).then(() => {
            copyBtn.textContent = 'Copied!';
            setTimeout(() => { copyBtn.textContent = 'Copy URL'; }, 2000);
          }).catch(() => alert('Could not copy URL: ' + f.url));
        };
        card.append(copyBtn);

        if (f.isImage) {
          card.prepend(el('img', { src: f.thumbnailUrl || f.url, style: 'width:50px;height:50px;object-fit:cover;border-radius:4px', alt: f.name || f.filename }));
        }

        const deleteBtn = el('button', { className: 'danger', style: 'font-size:0.7rem;padding:0.2rem 0.5rem' }, 'Delete');
        deleteBtn.onclick = async () => {
          if (!confirm('Delete ' + (f.name || f.filename) + '?')) return;
          try {
            await API.delete('/api/files/' + guildId + '/' + (f.id || encodeURIComponent(f.name || f.filename)));
            renderFileBrowser();
          } catch (e) { alert(e.message); }
        };
        card.append(deleteBtn);

        fileList.append(card);
      }
    }
    page.append(fileList);
  } catch (e) {
    page.append(errorMsg(e.message));
  }

  render('file-browser', page);
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// =====================================================
// PAGE: Player Settings
// =====================================================
function renderPlayerSettings() {
  const page = el('div');
  page.append(el('h2', { className: 'page-title' }, 'My Settings'));

  const card = el('div', { className: 'card' });
  card.append(el('h3', {}, 'Change Password'));

  const oldGroup = el('div', { className: 'form-group' });
  oldGroup.append(el('label', {}, 'Current Password'));
  const oldInput = el('input', { type: 'password', id: 'ps-old-pw' });
  oldGroup.append(oldInput);
  card.append(oldGroup);

  const newGroup = el('div', { className: 'form-group' });
  newGroup.append(el('label', {}, 'New Password'));
  const newInput = el('input', { type: 'password', id: 'ps-new-pw' });
  newGroup.append(newInput);
  card.append(newGroup);

  const confirmGroup = el('div', { className: 'form-group' });
  confirmGroup.append(el('label', {}, 'Confirm New Password'));
  const confirmInput = el('input', { type: 'password', id: 'ps-confirm-pw' });
  confirmGroup.append(confirmInput);
  card.append(confirmGroup);

  const errDiv = el('div', { className: 'login-error', id: 'ps-error' });
  card.append(errDiv);

  const saveBtn = el('button', {}, 'Change Password');
  saveBtn.onclick = async () => {
    const oldPw = oldInput.value;
    const newPw = newInput.value;
    if (newPw !== confirmInput.value) { errDiv.textContent = 'Passwords do not match'; return; }
    if (newPw.length < 4) { errDiv.textContent = 'Password too short'; return; }
    try {
      await changePassword(oldPw, newPw);
      errDiv.textContent = '';
      oldInput.value = '';
      newInput.value = '';
      confirmInput.value = '';
      saveBtn.textContent = 'Changed!';
      setTimeout(() => { saveBtn.textContent = 'Change Password'; }, 2000);
    } catch (e) { errDiv.textContent = e.message; }
  };
  card.append(saveBtn);

  page.append(card);
  render('player-settings', page);
}

// =====================================================
// PAGE: Player Characters
// =====================================================
async function renderPlayerCharacters() {
  const page = el('div');
  page.append(el('h2', { className: 'page-title' }, 'My Characters'));

  try {
    const chars = await API.get('/api/players/characters');
    if (!chars.length) {
      page.append(el('div', { className: 'dm-only-bar' }, 'You have no linked characters yet. Ask your DM to link a character to your Discord account.'));
      render('player-characters', page);
      return;
    }

    const grid = el('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:0.8rem' });
    for (const ch of chars) {
      const card = el('div', { className: 'card', style: 'cursor:pointer;text-align:center' });
      card.onclick = () => navigate('character/' + ch.id);
      card.append(el('div', { style: 'font-size:2.5rem;margin-bottom:0.3rem' }, '\u{1F3AD}'));
      card.append(el('div', { style: 'font-weight:700;font-size:1.1rem;color:var(--text-secondary)' }, ch.name));
      if (ch.race || ch.class) card.append(el('div', { style: 'font-size:0.85rem;color:var(--text-muted)' }, [ch.race, ch.class].filter(Boolean).join(' ')));
      if (ch.level) card.append(el('div', { style: 'font-size:0.8rem;color:var(--accent)' }, 'Level ' + ch.level));
      if (ch.campaignName) card.append(el('div', { style: 'font-size:0.75rem;color:var(--text-muted);margin-top:0.3rem' }, ch.campaignName));
      grid.append(card);
    }
    page.append(grid);
  } catch (e) {
    page.append(errorMsg(e.message));
  }

  render('player-characters', page);
}

// =====================================================
// INIT
// =====================================================
function init() {
  // Tab switching for login page
  const bindTab = (pageId, tab) => {
    const el = document.getElementById(pageId);
    if (el) el.onclick = () => {
      document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
      document.getElementById(pageId)?.classList.add('active');
      document.getElementById('login-page-dm').style.display = tab === 'dm' ? '' : 'none';
      document.getElementById('login-page-player').style.display = tab === 'player' ? '' : 'none';
    };
  };
  bindTab('page-tab-player', 'player');
  bindTab('page-tab-dm', 'dm');

  // Login buttons
  document.getElementById('page-login-btn').onclick = () => doLogin(
    document.getElementById('page-login-admin-user')?.value || '',
    document.getElementById('page-login-password')?.value || '',
  );
  document.getElementById('page-login-btn-player').onclick = () => doPlayerLogin(
    document.getElementById('page-login-username')?.value || '',
    document.getElementById('page-login-password-player')?.value || '',
  );

  document.getElementById('logout-btn').onclick = logout;

  // Enter key handlers
  ['page-login-admin-user', 'page-login-password'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.onkeydown = (e) => { if (e.key === 'Enter') document.getElementById('page-login-btn')?.click(); };
  });
  ['page-login-username', 'page-login-password-player'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.onkeydown = (e) => { if (e.key === 'Enter') document.getElementById('page-login-btn-player')?.click(); };
  });

  window.onhashchange = () => navigate(location.hash);
  setupCollapsibleSections();

  checkAuth().then(authed => {
    updateAuthUI();
    if (authed) {
      navigate(location.hash || 'dashboard');
    } else {
      showLogin();
    }
  });

  applyCollapsedState();
}

window.onload = init;
