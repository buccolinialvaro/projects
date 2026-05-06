// ============================================================================
// state.js — Central app state with pub/sub
// ============================================================================

const listeners = new Set();

export const state = {
  ready: false,
  route: 'dashboard',
  tasks: [],
  tipos: [],
  sedes: [],
  frecuencias: [],
  proyectos: [],
  templates: [],
  settings: {},
  filters: {
    search: '',
    estado: '',
    tipo: '',
    sede: '',
    proyecto: '',
    from: '',
    to: ''
  }
};

export function setState(patch) {
  Object.assign(state, patch);
  notify();
}

export function setFilter(key, value) {
  state.filters[key] = value;
  notify();
}

export function clearFilters() {
  state.filters = { search: '', estado: '', tipo: '', sede: '', proyecto: '', from: '', to: '' };
  notify();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) {
    try { fn(state); } catch (e) { console.error(e); }
  }
}

// ----- Derived selectors -----

export function filteredTasks() {
  const f = state.filters;
  let t = [...state.tasks];
  if (f.search) {
    const q = f.search.toLowerCase();
    t = t.filter(x =>
      String(x.concepto || '').toLowerCase().includes(q) ||
      String(x.observacion || '').toLowerCase().includes(q) ||
      String(x.proyecto || '').toLowerCase().includes(q) ||
      String(x.tags || '').toLowerCase().includes(q) ||
      String(x.resultado || '').toLowerCase().includes(q)
    );
  }
  if (f.estado) t = t.filter(x => x.estado === f.estado);
  if (f.tipo) t = t.filter(x => x.tipo === f.tipo);
  if (f.sede) t = t.filter(x => x.sede === f.sede);
  if (f.proyecto) t = t.filter(x => x.proyecto === f.proyecto);
  if (f.from) t = t.filter(x => (x.fecha || '') >= f.from);
  if (f.to) t = t.filter(x => (x.fecha || '') <= f.to);
  // Newest first
  t.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') ||
                   (b.created_at || '').localeCompare(a.created_at || ''));
  return t;
}

export function pendingTasks() {
  return state.tasks.filter(t =>
    t.estado === 'Pendiente' || t.estado === 'En curso' || t.estado === 'Bloqueado'
  );
}

export function tasksInRange(from, to) {
  return state.tasks.filter(t => (t.fecha || '') >= from && (t.fecha || '') <= to);
}
