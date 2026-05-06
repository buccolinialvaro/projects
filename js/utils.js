// ============================================================================
// utils.js — Helpers
// ============================================================================

export const TIPO_COLORS = {
  'Aplicaciones':   { color: '#0a84ff', class: 'badge-blue' },
  'Administrativo': { color: '#5e5ce6', class: 'badge-indigo' },
  'Estratégico':    { color: '#bf5af2', class: 'badge-purple' },
  'Profesional':    { color: '#30d158', class: 'badge-green' }
};

export const SEDE_COLORS = {
  'CAVyAG':   { color: '#ff9f0a', class: 'badge-orange' },
  'EDESTE':   { color: '#ff453a', class: 'badge-red' },
  'NEHUEL':   { color: '#0a84ff', class: 'badge-blue' },
  'PERSONAL': { color: '#8e8e93', class: 'badge-gray' }
};

export const ESTADOS = ['Pendiente', 'En curso', 'Hecho', 'Bloqueado'];
export const PRIORIDADES = ['Alta', 'Media', 'Baja'];

// Duration presets in minutes
export const DURATION_PRESETS = [
  { label: '15 min', min: 15 },
  { label: '30 min', min: 30 },
  { label: '1 h',   min: 60 },
  { label: '2 h',   min: 120 },
  { label: '4 h',   min: 240 },
  { label: 'Día completo', min: 480 }
];

// ----- IDs -----
export function uid(prefix = 'T') {
  const r = Math.random().toString(16).slice(2, 8) + Date.now().toString(16).slice(-4);
  return prefix + r.toUpperCase().slice(0, 10);
}

// ----- Dates -----
export function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function nowISO() {
  return new Date().toISOString();
}

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

export function fmtDateLong(iso) {
  if (!iso) return '';
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
  return d.toLocaleDateString('es-AR', {
    weekday: 'short', day: '2-digit', month: 'long', year: 'numeric'
  });
}

export function fmtRelative(iso) {
  if (!iso) return '';
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff < 7)   return `Hace ${diff} días`;
  if (diff < 30)  return `Hace ${Math.floor(diff/7)} sem`;
  return fmtDate(iso);
}

export function fmtDuration(min) {
  if (!min || isNaN(min)) return '—';
  min = parseInt(min, 10);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min/60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function startOfWeek(d = new Date()) {
  const day = d.getDay() || 7; // Sunday=0 -> 7
  const r = new Date(d);
  r.setDate(d.getDate() - day + 1);
  r.setHours(0,0,0,0);
  return r;
}

export function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// ----- DOM -----
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.substring(2).toLowerCase(), v);
    } else if (v !== undefined && v !== null && v !== false) {
      node.setAttribute(k, v);
    }
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

// ----- HTML escape -----
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ----- Debounce -----
export function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ----- Group / pivot helpers -----
export function groupBy(arr, key) {
  const m = {};
  for (const x of arr) {
    const k = typeof key === 'function' ? key(x) : x[key];
    (m[k] ||= []).push(x);
  }
  return m;
}

export function countBy(arr, key) {
  const m = {};
  for (const x of arr) {
    const k = typeof key === 'function' ? key(x) : x[key];
    if (k === '' || k == null) continue;
    m[k] = (m[k] || 0) + 1;
  }
  return m;
}

export function sumBy(arr, key) {
  let s = 0;
  for (const x of arr) {
    const v = typeof key === 'function' ? key(x) : x[key];
    if (!isNaN(parseFloat(v))) s += parseFloat(v);
  }
  return s;
}

// ----- CSV export -----
export function toCSV(rows, columns) {
  const headers = columns || Object.keys(rows[0] || {});
  const escapeCell = (v) => {
    const s = v == null ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map(h => escapeCell(r[h])).join(','));
  return lines.join('\n');
}

export function downloadFile(filename, content, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ----- Levenshtein (cheap) for similar concept detection -----
export function similarity(a, b) {
  a = String(a || '').toLowerCase().trim();
  b = String(b || '').toLowerCase().trim();
  if (a === b) return 1;
  if (!a || !b) return 0;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  const longerLen = longer.length;
  if (longerLen === 0) return 1;
  // simple substring & word overlap
  const aw = new Set(a.split(/\s+/));
  const bw = new Set(b.split(/\s+/));
  let inter = 0;
  for (const w of aw) if (bw.has(w)) inter++;
  const overlap = inter / Math.max(aw.size, bw.size);
  if (longer.includes(shorter)) return Math.max(0.7, overlap);
  return overlap;
}

// Find observations that mention follow-up keywords
const FOLLOWUP_KEYWORDS = [
  'pendiente', 'consultar', 'verificar', 'revisar', 'seguimiento',
  'preguntar', 'falta', 'esperar', 'definir', 'avanzar', 'avisar',
  'pre-compra', 'cotizar', 'cotización'
];
export function isFollowUp(text) {
  if (text === null || text === undefined || text === '') return false;
  const t = String(text).toLowerCase();
  return FOLLOWUP_KEYWORDS.some(k => t.includes(k));
}
