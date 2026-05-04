// ============================================================================
// views/pending.js — Kanban de pendientes
// ============================================================================
import { el, fmtDate, fmtDuration } from '../utils.js';
import { state, setState, pendingTasks } from '../state.js';
import { tipoBadge, sedeBadge, prioridadBadge, toast } from '../components.js';
import { openTaskDetail } from './log.js';
import * as api from '../api.js';

const COLUMNS = [
  { key: 'Pendiente', label: 'Pendiente', color: '#ffd60a' },
  { key: 'En curso',  label: 'En curso',  color: '#0a84ff' },
  { key: 'Bloqueado', label: 'Bloqueado', color: '#ff453a' }
];

export function render(container) {
  const tasks = pendingTasks();

  const intro = el('div', { class: 'card mb-4' },
    el('div', { class: 'row' },
      el('div', null,
        el('h3', { class: 'card-title', style: { margin: 0 } }, `${tasks.length} tarea${tasks.length !== 1 ? 's' : ''} en curso`),
        el('div', { class: 'card-subtitle', style: { margin: 0 } }, 'Arrastrá las tarjetas entre columnas para cambiar el estado.')
      )
    )
  );

  const board = el('div', { class: 'kanban' });
  COLUMNS.forEach(col => {
    const colTasks = tasks.filter(t => t.estado === col.key);
    const colNode = el('div', {
      class: 'kanban-col',
      dataset: { col: col.key }
    },
      el('div', { class: 'kanban-col-header' },
        el('div', { class: 'row gap-2' },
          el('span', { style: { width: '8px', height: '8px', background: col.color, borderRadius: '50%' } }),
          col.label
        ),
        el('span', { class: 'kanban-col-count' }, String(colTasks.length))
      ),
      el('div', { class: 'kanban-cards' },
        ...(colTasks.length === 0
          ? [el('div', { class: 'text-3 text-xs', style: { padding: '12px 4px' } }, 'Sin tareas')]
          : colTasks.map(t => kanbanCard(t)))
      )
    );

    // Drop targets
    colNode.addEventListener('dragover', (e) => {
      e.preventDefault();
      colNode.style.outline = '2px solid var(--accent)';
    });
    colNode.addEventListener('dragleave', () => { colNode.style.outline = ''; });
    colNode.addEventListener('drop', async (e) => {
      e.preventDefault();
      colNode.style.outline = '';
      const id = e.dataTransfer.getData('text/plain');
      const task = state.tasks.find(t => t.id === id);
      if (!task || task.estado === col.key) return;
      const updated = { ...task, estado: col.key };
      try {
        await api.updateTask(updated);
        const idx = state.tasks.findIndex(t => t.id === id);
        state.tasks[idx] = updated;
        setState({ tasks: [...state.tasks] });
        toast(`Movida a "${col.label}"`, 'success');
      } catch (err) {
        toast('Error: ' + err.message, 'error');
      }
    });

    board.appendChild(colNode);
  });

  container.replaceChildren(intro, board);
}

function kanbanCard(task) {
  const card = el('div', {
    class: 'kanban-card',
    draggable: 'true',
    dataset: { id: task.id }
  },
    el('div', { class: 'kanban-card-title' }, task.concepto || '(sin título)'),
    el('div', { class: 'kanban-card-meta' },
      tipoBadge(task.tipo),
      sedeBadge(task.sede),
      task.prioridad ? prioridadBadge(task.prioridad) : null,
      task.fecha ? el('span', { class: 'text-3 text-xxs' }, '· ' + fmtDate(task.fecha)) : null
    )
  );
  card.addEventListener('click', () => openTaskDetail(task));
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', task.id);
    card.style.opacity = '0.5';
  });
  card.addEventListener('dragend', () => { card.style.opacity = '1'; });
  return card;
}
