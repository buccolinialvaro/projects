// ============================================================================
// api.js — Apps Script REST client
// ============================================================================

const STORAGE_KEYS = {
  endpoint: 'nehuel.endpoint',
  token: 'nehuel.token',
  cache_log: 'nehuel.cache.log',
  cache_bootstrap: 'nehuel.cache.bootstrap'
};

export const config = {
  get endpoint() { return localStorage.getItem(STORAGE_KEYS.endpoint) || ''; },
  set endpoint(v) { localStorage.setItem(STORAGE_KEYS.endpoint, v || ''); },
  get token() { return localStorage.getItem(STORAGE_KEYS.token) || ''; },
  set token(v) { localStorage.setItem(STORAGE_KEYS.token, v || ''); }
};

export function isConfigured() {
  return Boolean(config.endpoint && config.token);
}

// ----- Local cache (so first paint is instant) -----
export function loadCachedLog() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.cache_log) || '[]'); }
  catch { return []; }
}
export function saveCachedLog(tasks) {
  try { localStorage.setItem(STORAGE_KEYS.cache_log, JSON.stringify(tasks)); }
  catch {}
}
export function loadCachedBootstrap() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.cache_bootstrap) || 'null'); }
  catch { return null; }
}
export function saveCachedBootstrap(b) {
  try { localStorage.setItem(STORAGE_KEYS.cache_bootstrap, JSON.stringify(b)); }
  catch {}
}

// ----- HTTP -----
async function request(action, payload, method = 'POST') {
  if (!config.endpoint) throw new Error('Endpoint no configurado');

  const url = method === 'GET'
    ? `${config.endpoint}?action=${encodeURIComponent(action)}&token=${encodeURIComponent(config.token)}` +
      (payload ? '&' + new URLSearchParams(payload).toString() : '')
    : config.endpoint;

  const opts = {
    method,
    redirect: 'follow'
  };

  if (method === 'POST') {
    // Use text/plain to avoid CORS preflight on Apps Script
    opts.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
    opts.body = JSON.stringify({ action, token: config.token, ...payload });
  }

  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Error desconocido');
  return data;
}

// ----- Public API -----
export async function ping() {
  return request('ping', null, 'GET');
}

export async function bootstrap() {
  const data = await request('bootstrap', null, 'GET');
  saveCachedBootstrap(data);
  return data;
}

export async function listTasks(filters = {}) {
  const data = await request('list', filters, 'GET');
  saveCachedLog(data.tasks || []);
  return data.tasks || [];
}

export async function createTask(task) {
  const data = await request('create', { task });
  return data.task;
}

export async function bulkCreateTasks(tasks) {
  return request('bulk_create', { tasks });
}

export async function updateTask(task) {
  const data = await request('update', { task });
  return data.task;
}

export async function deleteTask(id) {
  return request('delete', { id });
}

export async function saveTemplate(template) {
  const data = await request('template_save', { template });
  return data.template;
}

export async function deleteTemplate(id) {
  return request('template_delete', { id });
}

export async function configSet(kind, item) {
  return request('config_set', { kind, item });
}

export async function configRemove(kind, nombre) {
  return request('config_remove', { kind, nombre });
}

export async function settingsSave(settings) {
  return request('settings_save', { settings });
}

export async function scheduleReminder(payload) {
  return request('schedule_reminder', payload);
}
