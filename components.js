// ============================================================================
// components.js — Reusable UI pieces
// ============================================================================
import { el, esc, TIPO_COLORS, SEDE_COLORS, ESTADOS, PRIORIDADES,
         DURATION_PRESETS, fmtDate, fmtDuration, todayISO, uid } from './utils.js';
import { state } from './state.js';

// ----- TOAST -----
export function toast(message, kind = 'info', ms = 3200) {
  const stack = document.getElementById('toast-stack');
  const t = el('div', { class: `toast ${kind}` }, message);
  stack.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'toastIn 200ms reverse';
    setTimeout(() => t.remove(), 200);
  }, ms);
}

// ----- MODAL -----
let modalCloseHandler = null;

export function openModal(title, contentNode, onClose) {
  document.getElementById('modal-title').textContent = title;
  const body = document.getElementById('modal-body');
  body.innerHTML = '';
  body.appendChild(contentNode);
  document.getElementById('modal-backdrop').hidden = false;
  modalCloseHandler = onClose;
}

export function closeModal() {
  document.getElementById('modal-backdrop').hidden = true;
  if (modalCloseHandler) { modalCloseHandler(); modalCloseHandler = null; }
}

export function bindModalClose() {
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modal-backdrop') closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('modal-backdrop').hidden) closeModal();
  });
}

// ----- BADGES -----
export function tipoBadge(tipo) {
  const meta = TIPO_COLORS[tipo] || { class: 'badge-gray' };
  return el('span', { class: `badge ${meta.class}` },
    el('span', { class: 'badge-dot' }), tipo || '—');
}

export function sedeBadge(sede) {
  const meta = SEDE_COLORS[sede] || { class: 'badge-gray' };
  return el('span', { class: `badge ${meta.class}` }, sede || '—');
}

export function estadoBadge(estado) {
  const cls = (estado || '').replace(' ', '');
  return el('span', { class: `badge estado-${cls}` }, estado || '—');
}

export function prioridadBadge(prio) {
  if (!prio) return el('span', { class: 'text-3' }, '—');
  return el('span', { class: `text-xs prio-${prio}` }, '● ' + prio);
}

// ----- TASK FORM -----
// Returns { node, getValues } so the caller can submit
export function taskForm(initial = {}) {
  const data = {
    id: initial.id || '',
    fecha: initial.fecha || todayISO(),
    concepto: initial.concepto || '',
    tipo: initial.tipo || (state.tipos[0]?.nombre || ''),
    sede: initial.sede || (state.sedes[0]?.nombre || ''),
    frecuencia: initial.frecuencia || (state.frecuencias[0]?.nombre || ''),
    proyecto: initial.proyecto || '',
    prioridad: initial.prioridad || 'Media',
    estado: initial.estado || 'Hecho',
    tags: initial.tags || '',
    observacion: initial.observacion || '',
    resultado: initial.resultado || '',
    duracion_min: initial.duracion_min || '',
    energia: initial.energia || '',
    tarea_relacionada_id: initial.tarea_relacionada_id || ''
  };

  const fechaInput  = el('input', { class: 'field-input', type: 'date', value: data.fecha });
  const conceptoInput = el('input', { class: 'field-input', type: 'text', value: data.concepto, placeholder: 'Ej: Revisión Normalizaciones' });

  const tipoSel = selectFromList('tipo', state.tipos, data.tipo);
  const sedeSel = selectFromList('sede', state.sedes, data.sede);
  const freqSel = selectFromList('frecuencia', state.frecuencias, data.frecuencia);
  const proySel = selectFromList('proyecto', state.proyectos, data.proyecto, { allowEmpty: true, emptyLabel: '— Sin proyecto —' });

  const prioSeg = segmented(PRIORIDADES, data.prioridad, (v) => data.prioridad = v);
  const estadoSeg = segmented(ESTADOS, data.estado, (v) => data.estado = v);

  // Duration presets
  const durRow = el('div', { class: 'preset-row' });
  const durMin = el('input', { class: 'field-input', type: 'number', placeholder: 'min', value: data.duracion_min, style: { maxWidth: '120px' } });
  DURATION_PRESETS.forEach(p => {
    const b = el('button', { type: 'button', class: 'preset' + (parseInt(data.duracion_min) === p.min ? ' active' : '') }, p.label);
    b.addEventListener('click', () => {
      durRow.querySelectorAll('.preset').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      durMin.value = p.min;
    });
    durRow.appendChild(b);
  });

  // Energy 1-5
  const energyRow = el('div', { class: 'energy-row' });
  for (let i = 1; i <= 5; i++) {
    const dot = el('button', { type: 'button', class: 'energy-dot' + (parseInt(data.energia) >= i ? ' active' : ''), 'aria-label': 'Nivel ' + i });
    dot.addEventListener('click', () => {
      data.energia = String(i);
      energyRow.querySelectorAll('.energy-dot').forEach((d, idx) => {
        d.classList.toggle('active', idx < i);
      });
    });
    energyRow.appendChild(dot);
  }

  // Tags
  const tagsWrap = el('div', { class: 'tag-input-wrap' });
  let tagsArr = (data.tags || '').split(',').map(s => s.trim()).filter(Boolean);
  function renderTags() {
    tagsWrap.innerHTML = '';
    tagsArr.forEach((tg, i) => {
      const pill = el('span', { class: 'tag-pill' }, tg,
        el('button', { type: 'button', onClick: () => { tagsArr.splice(i,1); renderTags(); } }, '×'));
      tagsWrap.appendChild(pill);
    });
    const inp = el('input', { type: 'text', placeholder: tagsArr.length ? '+ tag' : 'Agregar tags (Enter)' });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && inp.value.trim()) {
        e.preventDefault();
        tagsArr.push(inp.value.trim());
        renderTags();
      } else if (e.key === 'Backspace' && !inp.value && tagsArr.length) {
        tagsArr.pop(); renderTags();
      }
    });
    tagsWrap.appendChild(inp);
    inp.focus();
  }
  renderTags();

  // Related task (autocomplete-ish: simple select)
  const relatedSel = el('select', { class: 'field-select' },
    el('option', { value: '' }, '— Ninguna —'),
    ...state.tasks.slice(0, 50).map(t => el('option', { value: t.id, ...(t.id === data.tarea_relacionada_id ? { selected: 'true' } : {}) },
      `${fmtDate(t.fecha)} · ${(t.concepto || '').slice(0, 60)}`))
  );

  const obsInput = el('textarea', { class: 'field-textarea', placeholder: 'Notas, contexto, dudas pendientes...' }, data.observacion);
  const resultInput = el('textarea', { class: 'field-textarea', placeholder: 'Qué se logró concretamente' }, data.resultado);

  const node = el('div', { class: 'col gap-3' },
    el('div', { class: 'form-grid' },
      field('Fecha', fechaInput),
      field('Estado', estadoSeg),
      field('Concepto', conceptoInput, { full: true }),
      field('Tipo', tipoSel),
      field('Sede', sedeSel),
      field('Frecuencia', freqSel),
      field('Proyecto', proySel),
      field('Prioridad', prioSeg),
      field('Energía / Foco (1–5)', energyRow),
      field('Duración', el('div', { class: 'col gap-2' }, durRow, durMin), { full: true }),
      field('Tags', tagsWrap, { full: true }),
      field('Observación', obsInput, { full: true }),
      field('Resultado / Outcome', resultInput, { full: true }),
      field('Tarea relacionada', relatedSel, { full: true })
    )
  );

  function getValues() {
    return {
      ...data,
      id: data.id || uid('T'),
      fecha: fechaInput.value,
      concepto: conceptoInput.value.trim(),
      tipo: tipoSel.value,
      sede: sedeSel.value,
      frecuencia: freqSel.value,
      proyecto: proySel.value,
      duracion_min: durMin.value,
      tags: tagsArr.join(', '),
      observacion: obsInput.value,
      resultado: resultInput.value,
      tarea_relacionada_id: relatedSel.value
    };
  }

  return { node, getValues };
}

function field(label, input, opts = {}) {
  return el('div', { class: 'field' + (opts.full ? ' full' : '') },
    el('label', { class: 'field-label' }, label),
    input
  );
}

function selectFromList(name, list, current, opts = {}) {
  const options = [];
  if (opts.allowEmpty) {
    options.push(el('option', { value: '' }, opts.emptyLabel || ''));
  }
  list.forEach(item => {
    const o = el('option', { value: item.nombre }, item.nombre);
    if (item.nombre === current) o.selected = true;
    options.push(o);
  });
  return el('select', { class: 'field-select', name }, ...options);
}

export function segmented(values, current, onChange) {
  const wrap = el('div', { class: 'segmented' });
  values.forEach(v => {
    const b = el('button', { type: 'button', class: v === current ? 'active' : '' }, v);
    b.addEventListener('click', () => {
      wrap.querySelectorAll('button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      onChange(v);
    });
    wrap.appendChild(b);
  });
  return wrap;
}

// Confirm dialog
export function confirmDialog(title, message, onConfirm) {
  const node = el('div', { class: 'col gap-3' },
    el('p', { class: 'text-sm text-2' }, message),
    el('div', { class: 'row gap-2', style: { justifyContent: 'flex-end', marginTop: '12px' } },
      el('button', { class: 'btn', onClick: closeModal }, 'Cancelar'),
      el('button', { class: 'btn btn-danger', onClick: () => { closeModal(); onConfirm(); } }, 'Confirmar')
    )
  );
  openModal(title, node);
}
