// ============================================================================
// views/log.js — Bitácora (tareas completas con filtros)
// ============================================================================
import { el, fmtDate, fmtDuration, esc, downloadFile, toCSV } from '../utils.js';
import { state, setFilter, clearFilters, filteredTasks, setState } from '../state.js';
import { tipoBadge, sedeBadge, estadoBadge, prioridadBadge,
         taskForm, openModal, closeModal, toast, confirmDialog } from '../components.js';
import * as api from '../api.js';

export function render(container) {
  const tasks = filteredTasks();
  const f = state.filters;

  const toolbar = el('div', { class: 'toolbar' },
    selectFilter('estado', '', 'Todos los estados', ['Pendiente', 'En curso', 'Hecho', 'Bloqueado']),
    selectFilter('tipo', '', 'Todos los tipos', state.tipos.map(x => x.nombre)),
    selectFilter('sede', '', 'Todas las sedes', state.sedes.map(x => x.nombre)),
    selectFilter('proyecto', '', 'Todos los proyectos', state.proyectos.map(x => x.nombre)),
    el('input', {
      class: 'field-input', type: 'date', value: f.from || '',
      style: { maxWidth: '150px' },
      onChange: (e) => setFilter('from', e.target.value)
    }),
    el('span', { class: 'text-2 text-xs' }, '→'),
    el('input', {
      class: 'field-input', type: 'date', value: f.to || '',
      style: { maxWidth: '150px' },
      onChange: (e) => setFilter('to', e.target.value)
    }),
    el('button', { class: 'btn btn-ghost', onClick: () => clearFilters() }, 'Limpiar'),
    el('div', { class: 'spacer' }),
    el('button', { class: 'btn', onClick: exportCSV }, '⬇ CSV'),
    el('button', { class: 'btn', onClick: exportJSON }, '⬇ JSON')
  );

  // Set current values on selects after creation
  setTimeout(() => {
    document.querySelectorAll('.toolbar select').forEach(s => {
      const k = s.dataset.filter;
      if (k && f[k] !== undefined) s.value = f[k];
    });
  });

  const card = el('div', { class: 'card' },
    el('div', { class: 'row mb-3' },
      el('h3', { class: 'card-title', style: { margin: 0 } },
        `${tasks.length} tarea${tasks.length !== 1 ? 's' : ''}`
      ),
      el('div', { class: 'spacer' })
    ),
    tasks.length === 0
      ? el('div', { class: 'empty' },
          el('div', { class: 'empty-emoji' }, '🔍'),
          el('h3', null, 'Sin resultados'),
          el('p', null, 'Probá ajustar los filtros o limpiar la búsqueda.'))
      : taskTable(tasks)
  );

  container.replaceChildren(toolbar, card);
}

function selectFilter(key, _ignored, allLabel, options) {
  const sel = el('select', {
    class: 'field-select',
    dataset: { filter: key },
    style: { maxWidth: '180px' },
    onChange: (e) => setFilter(key, e.target.value)
  },
    el('option', { value: '' }, allLabel),
    ...options.map(v => el('option', { value: v }, v))
  );
  return sel;
}

function taskTable(tasks) {
  const tbody = el('tbody');
  tasks.forEach(t => {
    const obs = String(t.observacion || '');
    const tr = el('tr', null,
      el('td', null,
        el('div', { class: 'task-row-concept' }, t.concepto || '(sin título)'),
        el('div', { class: 'task-row-meta' },
          [
            t.proyecto && `📁 ${t.proyecto}`,
            t.tags && `🏷 ${t.tags}`,
            t.duracion_min && `⏱ ${fmtDuration(t.duracion_min)}`
          ].filter(Boolean).join('  ·  ')
        )
      ),
      el('td', null, fmtDate(t.fecha)),
      el('td', null, tipoBadge(t.tipo)),
      el('td', null, sedeBadge(t.sede)),
      el('td', null, estadoBadge(t.estado)),
      el('td', null, prioridadBadge(t.prioridad)),
      el('td', null, obs ? el('span', { class: 'text-2 text-xs' }, obs.slice(0, 60) + (obs.length > 60 ? '…' : '')) : el('span', { class: 'text-3' }, '—'))
    );
    tr.addEventListener('click', () => openTaskDetail(t));
    tbody.appendChild(tr);
  });

  return el('table', { class: 'task-table' },
    el('thead', null,
      el('tr', null,
        el('th', null, 'Concepto'),
        el('th', null, 'Fecha'),
        el('th', null, 'Tipo'),
        el('th', null, 'Sede'),
        el('th', null, 'Estado'),
        el('th', null, 'Prio.'),
        el('th', null, 'Observación')
      )
    ),
    tbody
  );
}

// ----- DETAIL / EDIT MODAL -----
export function openTaskDetail(task) {
  const form = taskForm(task);

  const footer = el('div', { class: 'row gap-2', style: { justifyContent: 'space-between', marginTop: '18px', paddingTop: '14px', borderTop: '0.5px solid rgba(84,84,88,0.28)' } },
    el('button', {
      class: 'btn btn-danger',
      onClick: () => {
        confirmDialog('Eliminar tarea',
          `¿Seguro querés eliminar "${task.concepto}"? No se puede deshacer.`,
          async () => {
            try {
              await api.deleteTask(task.id);
              setState({ tasks: state.tasks.filter(x => x.id !== task.id) });
              toast('Tarea eliminada', 'success');
            } catch (err) {
              toast('Error: ' + err.message, 'error');
            }
          });
      }
    }, '🗑 Eliminar'),
    el('div', { class: 'row gap-2' },
      el('button', { class: 'btn', onClick: closeModal }, 'Cancelar'),
      el('button', { class: 'btn-primary', onClick: async () => {
        const data = form.getValues();
        if (!data.concepto) { toast('Falta el concepto', 'error'); return; }
        try {
          const updated = await api.updateTask(data);
          const idx = state.tasks.findIndex(x => x.id === task.id);
          if (idx >= 0) state.tasks[idx] = updated;
          setState({ tasks: [...state.tasks] });
          toast('Tarea actualizada', 'success');
          closeModal();
        } catch (err) { toast('Error: ' + err.message, 'error'); }
      }}, 'Guardar cambios')
    )
  );

  const node = el('div', null, form.node, footer);
  openModal('Editar tarea', node);
}

export function openNewTask() {
  const form = taskForm();

  const footer = el('div', { class: 'row gap-2', style: { justifyContent: 'flex-end', marginTop: '18px', paddingTop: '14px', borderTop: '0.5px solid rgba(84,84,88,0.28)' } },
    el('button', { class: 'btn', onClick: closeModal }, 'Cancelar'),
    el('button', { class: 'btn-primary', onClick: async () => {
      const data = form.getValues();
      if (!data.concepto) { toast('Falta el concepto', 'error'); return; }
      try {
        const created = await api.createTask(data);
        setState({ tasks: [created, ...state.tasks] });
        toast('Tarea creada', 'success');
        closeModal();
      } catch (err) { toast('Error: ' + err.message, 'error'); }
    }}, 'Crear tarea')
  );

  openModal('Nueva tarea', el('div', null, form.node, footer));
}

// ----- EXPORTS -----
function exportCSV() {
  const rows = filteredTasks();
  if (rows.length === 0) { toast('Nada para exportar', 'info'); return; }
  const csv = toCSV(rows, [
    'fecha','concepto','tipo','sede','frecuencia','proyecto',
    'prioridad','estado','tags','duracion_min','energia',
    'observacion','resultado','tarea_relacionada_id'
  ]);
  const date = new Date().toISOString().slice(0, 10);
  downloadFile(`bitacora-${date}.csv`, csv);
  toast(`Exportadas ${rows.length} tareas`, 'success');
}

function exportJSON() {
  const rows = filteredTasks();
  if (rows.length === 0) { toast('Nada para exportar', 'info'); return; }
  const date = new Date().toISOString().slice(0, 10);
  downloadFile(`bitacora-${date}.json`, JSON.stringify(rows, null, 2), 'application/json');
  toast(`Exportadas ${rows.length} tareas`, 'success');
}
