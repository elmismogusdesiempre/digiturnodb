// ============================================================
// API.JS - Capa de conexión con Google Sheets (cliente)
// Se carga ANTES del script principal: <script src="api.js"></script>
//  - Datos "vivos" (turnos, llamados, mensajes): acciones atómicas en el servidor.
//  - Configuración (operadores, servicios, playlist, tickers, logo): saveDB() la guarda
//    solo si cambió, con pequeña espera para no enviar en cada movimiento de slider.
// ============================================================
const API_URL = 'https://script.google.com/macros/s/AKfycby2l-J5soheP4RXRrSwuP0ymBOR_0ZQa61aUndXcshu4q8xrT-kGU6aYCAp9UXOiHeA/exec';

let db = {};
let _cfgVersion = null;
let _lastSent = {};
let dbOffline = false;
const SERVER_MIN = 4;   // versión mínima de code.gs

function showBanner(msg) {
  let b = document.getElementById('conn-banner');
  if (!msg) { if (b) b.remove(); return; }
  if (!b) {
    b = document.createElement('div'); b.id = 'conn-banner';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:1000000;background:#c53030;color:#fff;padding:8px 14px;font:600 14px sans-serif;text-align:center';
    document.body.appendChild(b);
  }
  b.textContent = msg;
}

// ---- Transporte ----
async function apiGet(action) {
  const r = await fetch(`${API_URL}?action=${action}&_=${Date.now()}`);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  return d;
}
// Acciones pequeñas por GET: respuesta siempre legible
async function apiAct(action, data = {}) {
  const r = await fetch(`${API_URL}?action=${action}&payload=${encodeURIComponent(JSON.stringify(data))}&_=${Date.now()}`);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  return d;
}
async function apiPost(action, data = {}) {
  // x-www-form-urlencoded = "petición simple": evita el bloqueo CORS de Apps Script
  const r = await fetch(API_URL, {
    method: 'POST',
    body: new URLSearchParams({ payload: JSON.stringify({ action, ...data }) })
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  return d;
}

// ---- Carga ----
function configSections() {
  return {
    operators: db.operators, services: db.services, playlist: db.playlist, rss: db.rss,
    config: { primaryColor: db.config.primaryColor, showVideo: db.config.showVideo, logo: db.config.logo || null }
  };
}

function applyData(data) {
  const cfg = data.config || {};
  db = {
    operators: data.operators || [],
    queue: data.queue || [],
    playlist: (data.playlist || []).map(p => ({ url: p.url, time: Number(p.time) || 5 })),
    services: data.services || [],
    rss: (data.rss || []).map(f => ({ ...f, active: f.active === true || f.active === 'TRUE' || f.active === 'true',
                                      size: Math.min(10, Math.max(1, Number(f.size) || 4)),
                                      pace: Math.min(10, Math.max(1, Number(f.pace) || 5)) })),
    clients: data.clients || [],
    opHistory: data.opHistory || [],
    msgLog: data.msgLog || [],
    pushMessage: data.pushMessage || { text: '', color: 'red' },
    activeCall: data.activeCall || cfg.activeCall || null,
    config: {
      primaryColor: cfg.primaryColor || '#0056b3',
      showVideo: cfg.showVideo === undefined ? true : (cfg.showVideo === true || cfg.showVideo === 'true'),
      logo: cfg.logo && cfg.logo.data ? cfg.logo : null
    }
  };
  _cfgVersion = data.cfgVersion !== undefined ? data.cfgVersion : (cfg.cfgVersion || 0);

  // Valores por defecto si la hoja está vacía
  if (!db.operators.length) db.operators = [{ name: 'Admin', pin: '1234', box: 'Box 1' }];
  if (!db.services.length) db.services = [{ name: 'Medicina General', emoji: '🩺' }, { name: 'Odontología', emoji: '🦷' }, { name: 'Asesoría Comercial', emoji: '💼' }];
  if (!db.rss.length) db.rss = [
    { active: true, type: 'text', content: 'Bienvenidos a Clínica Central', bgColor: '#0d47a1', textColor: '#ffffff', size: 4, pace: 5, direction: 'left' },
    { active: true, type: 'json', content: 'https://api.rss2json.com/v1/api.json?rss_url=https://www.eltiempo.com/rss/colombia.xml', bgColor: '#b71c1c', textColor: '#ffffff', size: 4, pace: 5, direction: 'left' }
  ];
  if (!db.playlist.length) db.playlist = [{ url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1920&q=80', time: 5 }];
  if (typeof normRSS === 'function') normRSS(db.rss);

  // Lo que ya está en el servidor no se vuelve a enviar
  const sec = configSections();
  _lastSent = {};
  if (data.operators && data.operators.length) _lastSent.operators = JSON.stringify(sec.operators);
  if (data.services && data.services.length) _lastSent.services = JSON.stringify(sec.services);
  if (data.playlist && data.playlist.length) _lastSent.playlist = JSON.stringify(sec.playlist);
  if (data.rss && data.rss.length) _lastSent.rss = JSON.stringify(sec.rss);
  _lastSent.config = JSON.stringify(sec.config);
}

async function loadData() {
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      const d = await apiGet('getAll');
      applyData(d);
      localStorage.setItem('offline_db', JSON.stringify(db));
      dbOffline = false;
      showBanner((d.serverVersion || 0) < SERVER_MIN
        ? '⚠️ El script de Google desplegado es una versión ANTIGUA. En Apps Script: Implementar → Administrar implementaciones → ✏️ Editar → Versión: Nueva versión → Implementar.'
        : '');
      return;
    } catch (err) { lastErr = err; await new Promise(r => setTimeout(r, 1200)); }
  }
  {
    const err = lastErr;
    console.warn('⚠️ Sin conexión con Sheets. Usando respaldo local.', err);
    dbOffline = true;
    showBanner('⚠️ Sin conexión con la base de datos (' + (err && err.message) + '). Usando datos locales: los PIN y servicios pueden estar desactualizados.');
    const off = localStorage.getItem('offline_db');
    if (off) db = JSON.parse(off);
    else applyData({});
  }
}

// Refresco liviano de datos vivos. Devuelve true si la configuración cambió y se recargó.
async function refreshLive() {
  try {
    const d = await apiGet('getLive');
    db.queue = d.queue || [];
    db.activeCall = d.activeCall || null;
    db.pushMessage = d.pushMessage || { text: '', color: 'red' };
    db.msgLog = d.msgLog || [];
    db.opHistory = d.opHistory || [];
    if (d.cfgVersion !== _cfgVersion) { await loadData(); return true; }
  } catch (err) { console.warn('refreshLive:', err); }
  return false;
}

// ---- Guardado de configuración (solo admin) ----
let _saveTimer;
function saveDB() {
  localStorage.setItem('offline_db', JSON.stringify(db));
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(flushSave, 700);
}
async function flushSave() {
  const sec = configSections(), changed = {};
  for (const k in sec) { const j = JSON.stringify(sec[k]); if (_lastSent[k] !== j) changed[k] = sec[k]; }
  if (!Object.keys(changed).length) return;
  try {
    const before = _cfgVersion;
    let ver;
    try { ver = (await apiPost('saveConfig', { sections: changed })).cfgVersion; }
    catch (err) {
      // La escritura pudo hacerse aunque la respuesta no se pueda leer: se verifica por GET
      const d = await apiGet('getLive');
      if (d.cfgVersion === before) throw err;
      ver = d.cfgVersion;
    }
    for (const k in changed) _lastSent[k] = JSON.stringify(changed[k]);
    _cfgVersion = ver;
    showBanner('');
    console.log('✅ Configuración guardada:', Object.keys(changed).join(', '));
  } catch (err) {
    console.error('❌ Error guardando configuración:', err);
    showBanner('⚠️ No se pudo guardar la configuración en la base de datos: ' + err.message);
  }
}

// ---- Acciones atómicas (se ejecutan en el servidor con bloqueo) ----
const apiRegister    = (cedula, nombre, servicio) => apiAct('registerTurn', { cedula, nombre, servicio });
const apiCallNext    = (servicio, op) => apiAct('callNext', { servicio, operator: { name: op.name, pin: op.pin, box: op.box } });
const apiSendMessage = (text, color) => apiAct('sendMessage', { text, color });
let _notesTimer;
function apiNotes(id, notes) {
  clearTimeout(_notesTimer);
  _notesTimer = setTimeout(() => apiAct('updateNotes', { id, notes }).catch(e => console.error('notas:', e)), 800);
}
