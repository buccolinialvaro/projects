// ============================================================================
// views/settings.js — Conexión, taxonomía, recordatorios, import/export
// ============================================================================
import { el, todayISO, downloadFile, toCSV } from '../utils.js';
import { state, setState } from '../state.js';
import { toast, openModal, closeModal, confirmDialog } from '../components.js';
import * as api from '../api.js';

export function render(container) {
  container.replaceChildren(
    connectionCard(),
    taxonomySection(),
    remindersCard(),
    importCard(),
    exportCard(),
    aboutCard()
  );
}

// ============================================================================
// Connection card — Endpoint URL + API token
// ============================================================================
function connectionCard() {
  const endpointInp = el('input', {
    class: 'field-input', type: 'url',
    placeholder: 'https://script.google.com/macros/s/.../exec',
    value: api.config.endpoint
  });
  const tokenInp = el('input', {
    class: 'field-input', type: 'text',
    placeholder: 'UUID generado por setupSpreadsheet()',
    value: api.config.token
  });
  const statusEl = el('span', { class: 'text-xs text-2' }, '');

  const saveBtn = el('button', { class: 'btn-primary', onClick: () => {
    api.config.endpoint = endpointInp.value.trim();
    api.config.token = tokenInp.value.trim();
    toast('Conexión guardada — recargá si no aparecen los datos', 'success');
  }}, 'Guardar');

  const testBtn = el('button', { class: 'btn', onClick: async () => {
    api.config.endpoint = endpointInp.value.trim();
    api.config.token = tokenInp.value.trim();
    statusEl.textContent = 'Probando...';
    statusEl.className = 'text-xs text-2';
    try {
      const r = await api.ping();
      statusEl.textContent = '✓ OK · ' + new Date(r.ts).toLocaleString('es-AR');
      statusEl.className = 'text-xs';
      statusEl.style.color = 'var(--green)';
      // Refresh data
      const boot = await api.bootstrap();
      const tasks = await api.listTasks();
      setState({
        tipos: boot.tipos || [], sedes: boot.sedes || [],
        frecuencias: boot.frecuencias || [], proyectos: boot.proyectos || [],
        templates: boot.templates || [], settings: boot.settings || {},
        tasks: tasks
      });
      toast('Conectado y datos sincronizados', 'success');
    } catch (err) {
      statusEl.textContent = '✗ ' + err.message;
      statusEl.style.color = 'var(--red)';
    }
  }}, 'Probar conexión');

  return el('div', { class: 'card mb-4' },
    el('h3', { class: 'card-title' }, '🔌 Conexión al backend'),
    el('div', { class: 'card-subtitle' },
      'Pegá la URL del Web App de Apps Script y el token generado por setupSpreadsheet().'),
    el('div', { class: 'form-grid' },
      el('div', { class: 'field full' },
        el('label', { class: 'field-label' }, 'Endpoint URL'),
        endpointInp
      ),
      el('div', { class: 'field full' },
        el('label', { class: 'field-label' }, 'API Token'),
        tokenInp
      )
    ),
    el('div', { class: 'row gap-2 mt-3' }, saveBtn, testBtn, statusEl)
  );
}

// ============================================================================
// Taxonomy section — Tipos, Sedes, Frecuencias, Proyectos
// ============================================================================
function taxonomySection() {
  const wrap = el('div', { class: 'dash-row mb-4' },
    listManagerCard('Tipos', 'tipo', state.tipos, true),
    listManagerCard('Sedes', 'sede', state.sedes, true)
  );
  const wrap2 = el('div', { class: 'dash-row mb-4' },
    listManagerCard('Frecuencias', 'frecuencia', state.frecuencias, false),
    listManagerCard('Proyectos', 'proyecto', state.proyectos, true)
  );
  return el('div', null, wrap, wrap2);
}

function listManagerCard(title, kind, items, hasColor) {
  const list = el('div');
  function refresh() {
    list.innerHTML = '';
    if (items.length === 0) {
      list.appendChild(el('div', { class: 'text-2 text-xs', style: { padding: '8px 0' } }, 'Sin elementos'));
    } else {
      items.forEach(item => {
        const row = el('div', { class: 'list-row' },
          el('div', { class: 'list-row-main' },
            hasColor && item.color
              ? el('span', { class: 'list-row-swatch', style: { background: item.color } })
              : null,
            el('span', null, item.nombre)
          ),
          el('div', { class: 'list-row-actions' },
            el('button', { class: 'btn btn-sm btn-danger', onClick: () => {
              confirmDialog(`Eliminar ${title.toLowerCase().slice(0,-1)}`,
                `¿Eliminar "${item.nombre}"? Las tareas existentes que lo usen no se modifican.`,
                async () => {
                  try {
                    await api.configRemove(kind, item.nombre);
                    const idx = items.findIndex(x => x.nombre === item.nombre);
                    if (idx >= 0) items.splice(idx, 1);
                    setState({});
                    refresh();
                    toast('Eliminado', 'success');
                  } catch (err) { toast('Error: ' + err.message, 'error'); }
                });
            }}, '🗑')
          )
        );
        list.appendChild(row);
      });
    }
  }
  refresh();

  // Add new
  const newName = el('input', { class: 'field-input', type: 'text', placeholder: 'Nombre', style: { flex: '1' } });
  const newColor = hasColor
    ? el('input', { type: 'color', value: '#0a84ff', style: { width: '40px', height: '36px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer' } })
    : null;
  const addBtn = el('button', { class: 'btn-primary btn-sm', onClick: async () => {
    const item = { nombre: newName.value.trim() };
    if (hasColor) item.color = newColor.value;
    if (!item.nombre) { toast('Falta el nombre', 'error'); return; }
    try {
      await api.configSet(kind, item);
      items.push(item);
      setState({});
      refresh();
      newName.value = '';
      toast('Agregado', 'success');
    } catch (err) { toast('Error: ' + err.message, 'error'); }
  }}, '+ Agregar');

  return el('div', { class: 'card' },
    el('h3', { class: 'card-title' }, title),
    list,
    el('div', { class: 'row gap-2 mt-3' }, newName, newColor, addBtn)
  );
}

// ============================================================================
// Calendar reminders
// ============================================================================
function remindersCard() {
  const dateInp = el('input', { class: 'field-input', type: 'date', value: todayISO() });
  const hourInp = el('input', { class: 'field-input', type: 'number', value: state.settings.reminder_hour || '18', min: '0', max: '23' });
  const recurringSel = el('select', { class: 'field-select' },
    el('option', { value: '' }, 'Una sola vez'),
    el('option', { value: 'daily' }, 'Todos los días'),
    el('option', { value: 'weekdays' }, 'Días hábiles (L–V)')
  );
  const titleInp = el('input', { class: 'field-input', type: 'text', value: '📝 Cargar tareas del día' });

  return el('div', { class: 'card mb-4' },
    el('h3', { class: 'card-title' }, '⏰ Recordatorios en Google Calendar'),
    el('div', { class: 'card-subtitle' },
      'Programá un evento que te recuerde cargar las tareas. Se crea en tu calendario principal con scope script.'),
    el('div', { class: 'form-grid' },
      el('div', { class: 'field' },
        el('label', { class: 'field-label' }, 'Fecha de inicio'),
        dateInp
      ),
      el('div', { class: 'field' },
        el('label', { class: 'field-label' }, 'Hora (0–23)'),
        hourInp
      ),
      el('div', { class: 'field' },
        el('label', { class: 'field-label' }, 'Recurrencia'),
        recurringSel
      ),
      el('div', { class: 'field' },
        el('label', { class: 'field-label' }, 'Título del evento'),
        titleInp
      )
    ),
    el('div', { class: 'row gap-2 mt-3' },
      el('button', { class: 'btn-primary', onClick: async () => {
        try {
          const r = await api.scheduleReminder({
            date: dateInp.value,
            hour: hourInp.value,
            title: titleInp.value,
            recurring: recurringSel.value || null
          });
          toast(`Evento creado: ${r.title}`, 'success', 4000);
        } catch (err) { toast('Error: ' + err.message, 'error'); }
      }}, 'Programar evento')
    )
  );
}

// ============================================================================
// Import LOG.xlsx (use the prepared initial_log.json)
// ============================================================================
function importCard() {
  return el('div', { class: 'card mb-4' },
    el('h3', { class: 'card-title' }, '📥 Importar bitácora inicial'),
    el('div', { class: 'card-subtitle' },
      'Carga los registros del LOG.xlsx que ya pre-procesé al schema nuevo (15 tareas del 20–30 marzo). Los podés editar después.'),
    el('div', { class: 'row gap-2 mt-3' },
      el('button', { class: 'btn-primary', onClick: importInitialLog }, '⬆ Importar LOG inicial'),
      el('button', { class: 'btn', onClick: importFromCSV }, '📄 Importar CSV personalizado')
    )
  );
}

async function importInitialLog() {
  let data;
  try {
    const res = await fetch('data/initial_log.json');
    data = await res.json();
  } catch (err) {
    toast('No pude cargar initial_log.json: ' + err.message, 'error');
    return;
  }
  confirmDialog(
    'Importar LOG inicial',
    `¿Importar ${data.length} tareas del LOG.xlsx? Se agregan a las que ya tenés cargadas.`,
    async () => {
      try {
        const r = await api.bulkCreateTasks(data);
        const tasks = await api.listTasks();
        setState({ tasks });
        toast(`Importadas ${r.count} tareas`, 'success');
      } catch (err) { toast('Error: ' + err.message, 'error'); }
    }
  );
}

function importFromCSV() {
  const inp = el('input', { type: 'file', accept: '.csv,.json' });
  inp.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    let rows = [];
    try {
      if (file.name.endsWith('.json')) {
        rows = JSON.parse(text);
      } else {
        rows = parseCSV(text);
      }
    } catch (err) { toast('Archivo inválido: ' + err.message, 'error'); return; }
    if (!Array.isArray(rows) || rows.length === 0) {
      toast('Sin filas para importar', 'error'); return;
    }
    confirmDialog('Importar CSV', `¿Importar ${rows.length} filas?`, async () => {
      try {
        await api.bulkCreateTasks(rows);
        const tasks = await api.listTasks();
        setState({ tasks });
        toast(`Importadas ${rows.length} tareas`, 'success');
      } catch (err) { toast('Error: ' + err.message, 'error'); }
    });
  });
  inp.click();
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const cols = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => obj[h] = cols[i] || '');
    return obj;
  });
}
function parseCSVLine(line) {
  const out = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i+1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === ',') { out.push(cur); cur = ''; }
      else if (c === '"') inQ = true;
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

// ============================================================================
// Export reports
// ============================================================================
function exportCard() {
  return el('div', { class: 'card mb-4' },
    el('h3', { class: 'card-title' }, '📤 Exportar reportes'),
    el('div', { class: 'card-subtitle' },
      'Descarga snapshots locales — útiles para informes externos o backup.'),
    el('div', { class: 'row gap-2 mt-3' },
      el('button', { class: 'btn', onClick: () => exportAll('csv') }, '⬇ Todas las tareas (CSV)'),
      el('button', { class: 'btn', onClick: () => exportAll('json') }, '⬇ Todas las tareas (JSON)'),
      el('button', { class: 'btn', onClick: exportPDF }, '⬇ Reporte ejecutivo (PDF)')
    )
  );
}

function exportAll(format) {
  const tasks = state.tasks;
  if (tasks.length === 0) { toast('Sin tareas para exportar', 'info'); return; }
  const date = todayISO();
  if (format === 'csv') {
    const csv = toCSV(tasks, [
      'id','fecha','concepto','tipo','sede','frecuencia','proyecto',
      'prioridad','estado','tags','duracion_min','energia',
      'observacion','resultado','tarea_relacionada_id','created_at','updated_at'
    ]);
    downloadFile(`bitacora-completa-${date}.csv`, csv);
  } else {
    downloadFile(`bitacora-completa-${date}.json`, JSON.stringify(tasks, null, 2), 'application/json');
  }
  toast(`Exportadas ${tasks.length} tareas`, 'success');
}

function exportPDF() {
  // Build a printable HTML snapshot and trigger window.print
  const tasks = state.tasks.slice().sort((a,b) => (b.fecha || '').localeCompare(a.fecha || ''));
  if (tasks.length === 0) { toast('Sin tareas para exportar', 'info'); return; }

  const win = window.open('', '_blank');
  if (!win) { toast('Permití popups para esta función', 'error'); return; }

  const dateStr = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
  const totalMin = tasks.reduce((s, t) => s + (parseInt(t.duracion_min) || 0), 0);
  const byTipo = {};
  tasks.forEach(t => byTipo[t.tipo || '—'] = (byTipo[t.tipo || '—'] || 0) + 1);

  win.document.write(`<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Reporte Bitácora · ${dateStr}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; padding: 32px; color: #111; max-width: 900px; margin: auto; }
  h1 { font-size: 26px; letter-spacing: -0.02em; margin: 0 0 6px; }
  h2 { font-size: 16px; margin: 24px 0 8px; border-bottom: 2px solid #ccc; padding-bottom: 4px; }
  .sub { color: #666; font-size: 13px; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 18px 0; }
  .kpi { padding: 12px; border-radius: 8px; background: #f4f4f5; }
  .kpi-label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.04em; }
  .kpi-value { font-size: 22px; font-weight: 700; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
  th { background: #f4f4f5; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
  .obs { color: #555; font-size: 11px; }
  @page { size: A4; margin: 1.5cm; }
  @media print { .no-print { display: none; } }
</style></head>
<body>
<h1>Reporte de Bitácora</h1>
<div class="sub">Generado el ${dateStr} · Alvaro · Nehuel</div>

<div class="summary">
  <div class="kpi"><div class="kpi-label">Total tareas</div><div class="kpi-value">${tasks.length}</div></div>
  <div class="kpi"><div class="kpi-label">Tiempo cargado</div><div class="kpi-value">${Math.round(totalMin/60)}h</div></div>
  <div class="kpi"><div class="kpi-label">Tipos distintos</div><div class="kpi-value">${Object.keys(byTipo).length}</div></div>
  <div class="kpi"><div class="kpi-label">Pendientes</div><div class="kpi-value">${tasks.filter(t => t.estado === 'Pendiente' || t.estado === 'En curso').length}</div></div>
</div>

<h2>Distribución por tipo</h2>
<table>
  <thead><tr><th>Tipo</th><th>Cantidad</th><th>%</th></tr></thead>
  <tbody>
    ${Object.entries(byTipo).sort((a,b)=>b[1]-a[1]).map(([k,v]) => `
      <tr><td>${escHtml(k)}</td><td>${v}</td><td>${Math.round(v/tasks.length*100)}%</td></tr>
    `).join('')}
  </tbody>
</table>

<h2>Detalle de tareas</h2>
<table>
  <thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th>Sede</th><th>Estado</th><th>Observación</th></tr></thead>
  <tbody>
    ${tasks.map(t => `
      <tr>
        <td>${escHtml(t.fecha)}</td>
        <td><strong>${escHtml(t.concepto || '')}</strong>${t.tags ? `<div class="obs">🏷 ${escHtml(t.tags)}</div>` : ''}</td>
        <td>${escHtml(t.tipo || '—')}</td>
        <td>${escHtml(t.sede || '—')}</td>
        <td>${escHtml(t.estado || '—')}</td>
        <td class="obs">${escHtml(t.observacion || '')}${t.resultado ? `<br><em>→ ${escHtml(t.resultado)}</em>` : ''}</td>
      </tr>
    `).join('')}
  </tbody>
</table>

<div class="no-print" style="margin: 24px 0; text-align: center;">
  <button onclick="window.print()" style="padding: 10px 20px; font-size: 14px; cursor: pointer;">Imprimir / Guardar PDF</button>
</div>
</body></html>`);
  win.document.close();
}

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ============================================================================
// About
// ============================================================================
function aboutCard() {
  return el('div', { class: 'card' },
    el('h3', { class: 'card-title' }, '📖 Acerca de'),
    el('div', { class: 'col gap-2' },
      el('div', { class: 'text-sm text-2' },
        el('strong', null, 'Bitácora · Nehuel'), ' v1.0 — Web app para registro estructurado de tareas con backend en Google Apps Script.'),
      el('div', { class: 'text-sm text-2' },
        'Atajos: ',
        el('kbd', null, '⌘N'), ' nueva tarea · ',
        el('kbd', null, '⌘K'), ' buscar · ',
        el('kbd', null, 'Esc'), ' cerrar modal'
      ),
      el('div', { class: 'text-sm text-2' },
        'Desarrollado para Alvaro Carlos Buccolini · Mendoza, Argentina'
      )
    )
  );
}
