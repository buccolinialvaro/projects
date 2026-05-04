// ============================================================================
// views/templates.js — Plantillas de tareas frecuentes
// ============================================================================
import { el, fmtDuration, uid, todayISO, esc } from '../utils.js';
import { state, setState } from '../state.js';
import { tipoBadge, sedeBadge, openModal, closeModal, toast,
         confirmDialog, taskForm } from '../components.js';
import * as api from '../api.js';
import { openTaskDetail } from './log.js';

export function render(container) {
  const intro = el('div', { class: 'card mb-4' },
    el('div', { class: 'row' },
      el('div', null,
        el('h3', { class: 'card-title', style: { margin: 0 } }, 'Plantillas de tareas frecuentes'),
        el('div', { class: 'card-subtitle', style: { margin: 0 } },
          'Atajos para crear tareas que se repiten — clic en "Usar" para crear una nueva con esos valores.')
      ),
      el('div', { class: 'spacer' }),
      el('button', { class: 'btn-primary', onClick: openNewTemplate }, '+ Nueva plantilla')
    )
  );

  const list = el('div', { class: 'card' });

  if (state.templates.length === 0) {
    list.appendChild(el('div', { class: 'empty' },
      el('div', { class: 'empty-emoji' }, '⚡'),
      el('h3', null, 'Sin plantillas aún'),
      el('p', null, 'Creá una plantilla para tareas que cargás repetidamente (ej. "Reunión semanal CAR", "Revisión Normalizaciones").'),
      el('button', { class: 'btn-primary', onClick: openNewTemplate }, '+ Crear primera plantilla')
    ));
  } else {
    state.templates.forEach(tpl => list.appendChild(templateRow(tpl)));
  }

  container.replaceChildren(intro, list);
}

function templateRow(tpl) {
  return el('div', { class: 'list-row' },
    el('div', { class: 'list-row-main' },
      el('div', null,
        el('div', { class: 'text-bold' }, tpl.nombre || '(sin nombre)'),
        el('div', { class: 'text-xs text-2', style: { marginTop: '3px' } },
          [
            tpl.concepto && `"${tpl.concepto}"`,
            tpl.tipo && `· ${tpl.tipo}`,
            tpl.sede && `· ${tpl.sede}`,
            tpl.duracion_min && `· ${fmtDuration(tpl.duracion_min)}`,
            tpl.tags && `· 🏷 ${tpl.tags}`
          ].filter(Boolean).join(' ')
        )
      )
    ),
    el('div', { class: 'list-row-actions' },
      el('button', { class: 'btn btn-sm', onClick: () => useTemplate(tpl) }, '⚡ Usar'),
      el('button', { class: 'btn btn-sm', onClick: () => editTemplate(tpl) }, '✎ Editar'),
      el('button', { class: 'btn btn-sm btn-danger', onClick: () => {
        confirmDialog('Eliminar plantilla',
          `¿Eliminar "${tpl.nombre}"?`,
          async () => {
            try {
              await api.deleteTemplate(tpl.id);
              setState({ templates: state.templates.filter(x => x.id !== tpl.id) });
              toast('Plantilla eliminada', 'success');
            } catch (err) { toast('Error: ' + err.message, 'error'); }
          });
      }}, '🗑')
    )
  );
}

function useTemplate(tpl) {
  // Build a task pre-filled from the template
  const initialTask = {
    fecha: todayISO(),
    concepto: tpl.concepto || tpl.nombre,
    tipo: tpl.tipo,
    sede: tpl.sede,
    frecuencia: tpl.frecuencia,
    proyecto: tpl.proyecto,
    prioridad: tpl.prioridad || 'Media',
    estado: 'Pendiente',
    tags: tpl.tags,
    duracion_min: tpl.duracion_min
  };

  const form = taskForm(initialTask);
  const footer = el('div', { class: 'row gap-2', style: { justifyContent: 'flex-end', marginTop: '18px', paddingTop: '14px', borderTop: '0.5px solid rgba(84,84,88,0.28)' } },
    el('button', { class: 'btn', onClick: closeModal }, 'Cancelar'),
    el('button', { class: 'btn-primary', onClick: async () => {
      const data = form.getValues();
      if (!data.concepto) { toast('Falta el concepto', 'error'); return; }
      try {
        const created = await api.createTask(data);
        setState({ tasks: [created, ...state.tasks] });
        toast('Tarea creada desde plantilla', 'success');
        closeModal();
      } catch (err) { toast('Error: ' + err.message, 'error'); }
    }}, 'Crear tarea')
  );
  openModal(`Usar plantilla: ${tpl.nombre}`, el('div', null, form.node, footer));
}

// ----- TEMPLATE FORM -----
function templateFormNode(tpl = {}) {
  const data = {
    id: tpl.id || '',
    nombre: tpl.nombre || '',
    concepto: tpl.concepto || '',
    tipo: tpl.tipo || (state.tipos[0]?.nombre || ''),
    sede: tpl.sede || (state.sedes[0]?.nombre || ''),
    frecuencia: tpl.frecuencia || '',
    proyecto: tpl.proyecto || '',
    prioridad: tpl.prioridad || 'Media',
    duracion_min: tpl.duracion_min || '',
    tags: tpl.tags || ''
  };

  const nombreInp = el('input', { class: 'field-input', type: 'text', value: data.nombre, placeholder: 'Ej: Reunión semanal CAR' });
  const conceptoInp = el('input', { class: 'field-input', type: 'text', value: data.concepto, placeholder: 'Concepto de la tarea generada' });
  const tipoSel = makeSelect(state.tipos, data.tipo);
  const sedeSel = makeSelect(state.sedes, data.sede);
  const freqSel = makeSelect(state.frecuencias, data.frecuencia, true);
  const proySel = makeSelect(state.proyectos, data.proyecto, true);
  const prioSel = el('select', { class: 'field-select' },
    ...['Alta', 'Media', 'Baja'].map(p => el('option', { value: p, ...(p === data.prioridad ? { selected: 'true' } : {}) }, p))
  );
  const durInp = el('input', { class: 'field-input', type: 'number', value: data.duracion_min, placeholder: 'minutos' });
  const tagsInp = el('input', { class: 'field-input', type: 'text', value: data.tags, placeholder: 'tag1, tag2, tag3' });

  const node = el('div', { class: 'form-grid' },
    field('Nombre de la plantilla', nombreInp, true),
    field('Concepto generado', conceptoInp, true),
    field('Tipo', tipoSel),
    field('Sede', sedeSel),
    field('Frecuencia', freqSel),
    field('Proyecto', proySel),
    field('Prioridad por defecto', prioSel),
    field('Duración (min)', durInp),
    field('Tags', tagsInp, true)
  );

  function getValues() {
    return {
      ...data,
      nombre: nombreInp.value.trim(),
      concepto: conceptoInp.value.trim(),
      tipo: tipoSel.value,
      sede: sedeSel.value,
      frecuencia: freqSel.value,
      proyecto: proySel.value,
      prioridad: prioSel.value,
      duracion_min: durInp.value,
      tags: tagsInp.value.trim()
    };
  }
  return { node, getValues };
}

function field(label, input, full) {
  return el('div', { class: 'field' + (full ? ' full' : '') },
    el('label', { class: 'field-label' }, label),
    input
  );
}

function makeSelect(list, current, allowEmpty) {
  const opts = [];
  if (allowEmpty) opts.push(el('option', { value: '' }, '— Sin definir —'));
  list.forEach(item => {
    const o = el('option', { value: item.nombre }, item.nombre);
    if (item.nombre === current) o.selected = true;
    opts.push(o);
  });
  return el('select', { class: 'field-select' }, ...opts);
}

function openNewTemplate() {
  const f = templateFormNode();
  const footer = el('div', { class: 'row gap-2', style: { justifyContent: 'flex-end', marginTop: '18px', paddingTop: '14px', borderTop: '0.5px solid rgba(84,84,88,0.28)' } },
    el('button', { class: 'btn', onClick: closeModal }, 'Cancelar'),
    el('button', { class: 'btn-primary', onClick: async () => {
      const data = f.getValues();
      if (!data.nombre) { toast('Falta el nombre', 'error'); return; }
      try {
        const created = await api.saveTemplate(data);
        setState({ templates: [...state.templates, created] });
        toast('Plantilla creada', 'success');
        closeModal();
      } catch (err) { toast('Error: ' + err.message, 'error'); }
    }}, 'Crear plantilla')
  );
  openModal('Nueva plantilla', el('div', null, f.node, footer));
}

function editTemplate(tpl) {
  const f = templateFormNode(tpl);
  const footer = el('div', { class: 'row gap-2', style: { justifyContent: 'flex-end', marginTop: '18px', paddingTop: '14px', borderTop: '0.5px solid rgba(84,84,88,0.28)' } },
    el('button', { class: 'btn', onClick: closeModal }, 'Cancelar'),
    el('button', { class: 'btn-primary', onClick: async () => {
      const data = f.getValues();
      if (!data.nombre) { toast('Falta el nombre', 'error'); return; }
      try {
        const updated = await api.saveTemplate(data);
        const idx = state.templates.findIndex(x => x.id === tpl.id);
        if (idx >= 0) state.templates[idx] = updated;
        setState({ templates: [...state.templates] });
        toast('Plantilla actualizada', 'success');
        closeModal();
      } catch (err) { toast('Error: ' + err.message, 'error'); }
    }}, 'Guardar')
  );
  openModal('Editar plantilla', el('div', null, f.node, footer));
}
