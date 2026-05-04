// ============================================================================
// app.js — Entry point: routing, bootstrap, shortcuts, view re-rendering
// ============================================================================
import { state, setState, setFilter, subscribe } from './state.js';
import { $, $$, debounce } from './utils.js';
import { bindModalClose, toast } from './components.js';
import * as api from './api.js';

import * as dashboard from './views/dashboard.js';
import * as logView from './views/log.js';
import * as pendingView from './views/pending.js';
import * as insightsView from './views/insights.js';
import * as templatesView from './views/templates.js';
import * as settingsView from './views/settings.js';

const ROUTES = {
  dashboard: { module: dashboard, title: 'Dashboard', sub: 'Resumen general' },
  log:       { module: logView, title: 'Bitácora', sub: 'Registro completo de tareas' },
  pending:   { module: pendingView, title: 'Pendientes', sub: 'Kanban de tareas en curso' },
  insights:  { module: insightsView, title: 'Insights', sub: 'Análisis profundo' },
  templates: { module: templatesView, title: 'Plantillas', sub: 'Tareas frecuentes' },
  settings:  { module: settingsView, title: 'Ajustes', sub: 'Conexión, taxonomía, recordatorios' }
};

// ============================================================================
// Boot
// ============================================================================
async function boot() {
  bindModalClose();
  bindNav();
  bindShortcuts();
  bindSearch();
  bindQuickAdd();

  // First paint from cache
  const cachedBoot = api.loadCachedBootstrap();
  const cachedTasks = api.loadCachedLog();
  if (cachedBoot) {
    setState({
      tipos: cachedBoot.tipos || [],
      sedes: cachedBoot.sedes || [],
      frecuencias: cachedBoot.frecuencias || [],
      proyectos: cachedBoot.proyectos || [],
      templates: cachedBoot.templates || [],
      settings: cachedBoot.settings || {}
    });
  }
  if (cachedTasks.length) setState({ tasks: cachedTasks });

  // Determine initial route
  const initialRoute = (location.hash.replace('#', '') || 'dashboard');
  setState({ route: initialRoute, ready: true });

  // Subscribe to state changes -> re-render current view
  subscribe(() => render());
  render();

  // If not configured, force settings view and notify
  if (!api.isConfigured()) {
    location.hash = '#settings';
    toast('Configurá la conexión en Ajustes para empezar', 'info', 5000);
    setSyncStatus('offline', 'Sin conectar');
    return;
  }

  // Live refresh from network
  refreshFromNetwork();
}

async function refreshFromNetwork() {
  setSyncStatus('offline', 'Sincronizando...');
  try {
    await api.ping();
    const [boot, tasks] = await Promise.all([
      api.bootstrap(),
      api.listTasks()
    ]);
    setState({
      tipos: boot.tipos || [],
      sedes: boot.sedes || [],
      frecuencias: boot.frecuencias || [],
      proyectos: boot.proyectos || [],
      templates: boot.templates || [],
      settings: boot.settings || {},
      tasks: tasks
    });
    setSyncStatus('online', 'Conectado');
  } catch (err) {
    console.error(err);
    setSyncStatus('error', 'Error: ' + err.message);
    if (state.tasks.length === 0) {
      // First-time error and no cache — push to settings
      toast('No se pudo conectar. Verificá los datos en Ajustes.', 'error', 5000);
    }
  }
}

// ============================================================================
// Render dispatcher
// ============================================================================
function render() {
  const route = state.route;
  const def = ROUTES[route] || ROUTES.dashboard;

  // Update sidebar active state
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.route === route));

  // Update topbar
  $('#page-title').textContent = def.title;
  $('#page-sub').textContent = def.sub;

  // Update pending count badge
  const pendingCount = state.tasks.filter(t =>
    t.estado === 'Pendiente' || t.estado === 'En curso' || t.estado === 'Bloqueado'
  ).length;
  const badge = $('#nav-pending-count');
  if (pendingCount > 0) {
    badge.textContent = pendingCount;
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }

  // Render the view module
  const container = $('#view');
  try {
    def.module.render(container);
  } catch (err) {
    console.error('Render error:', err);
    container.innerHTML = `<div class="card"><h3 class="card-title">Error al renderizar</h3><pre style="color:var(--red);font-size:12px;white-space:pre-wrap">${err.message}\n${err.stack || ''}</pre></div>`;
  }
}

// ============================================================================
// Navigation
// ============================================================================
function bindNav() {
  $$('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const route = btn.dataset.route;
      location.hash = '#' + route;
    });
  });
  window.addEventListener('hashchange', () => {
    const route = location.hash.replace('#', '') || 'dashboard';
    if (ROUTES[route]) setState({ route });
  });
}

// ============================================================================
// Shortcuts
// ============================================================================
function bindShortcuts() {
  document.addEventListener('keydown', (e) => {
    const meta = e.metaKey || e.ctrlKey;
    if (meta && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      logView.openNewTask();
    } else if (meta && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      $('#global-search').focus();
    }
  });
}

// ============================================================================
// Search
// ============================================================================
function bindSearch() {
  const inp = $('#global-search');
  const update = debounce((v) => setFilter('search', v), 200);
  inp.addEventListener('input', (e) => {
    update(e.target.value);
    // Auto-route to log view when typing
    if (e.target.value && state.route !== 'log') location.hash = '#log';
  });
}

// ============================================================================
// Quick add button
// ============================================================================
function bindQuickAdd() {
  $('#quick-add-btn').addEventListener('click', () => {
    if (!api.isConfigured()) {
      toast('Configurá la conexión primero', 'error');
      location.hash = '#settings';
      return;
    }
    logView.openNewTask();
  });
}

// ============================================================================
// Sync status indicator
// ============================================================================
function setSyncStatus(kind, text) {
  const wrap = $('#sync-status');
  const dot = wrap.querySelector('.dot');
  const txt = wrap.querySelector('.sync-text');
  dot.className = 'dot dot-' + kind;
  txt.textContent = text;
}

// ============================================================================
// Go!
// ============================================================================
document.addEventListener('DOMContentLoaded', boot);
