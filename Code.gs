/**
 * NEHUEL TASK LOG — Apps Script Backend
 * ----------------------------------------
 * Web App publicada como REST API para una SPA hosteada en GitHub Pages.
 * Persiste todo en una Google Sheet con las hojas:
 *   - LOG, CONFIG_TIPOS, CONFIG_SEDES, CONFIG_FRECUENCIAS,
 *     CONFIG_PROYECTOS, TEMPLATES, SETTINGS
 *
 * Endpoints (todos protegidos por API token):
 *   GET ?action=ping
 *   GET ?action=bootstrap     -> devuelve config + templates + settings
 *   GET ?action=list          -> lista de tareas (params opcionales: from, to, estado, tipo, sede, proyecto)
 *   POST action=create        -> crea tarea (body: task)
 *   POST action=update        -> actualiza tarea (body: task con id)
 *   POST action=delete        -> elimina tarea (body: {id})
 *   POST action=bulk_create   -> crea muchas tareas (body: {tasks: [...]})
 *   POST action=template_save -> guarda/actualiza plantilla
 *   POST action=template_delete
 *   POST action=config_set    -> agrega valor a CONFIG_TIPOS/SEDES/FRECUENCIAS/PROYECTOS
 *   POST action=config_remove
 *   POST action=settings_save
 *   POST action=schedule_reminder -> crea evento en Google Calendar
 *
 * Setup: ejecutar setupSpreadsheet() una vez para crear las hojas y headers.
 */

// =============================================================================
// CONFIG
// =============================================================================

const SHEET_NAMES = {
  LOG: 'LOG',
  TIPOS: 'CONFIG_TIPOS',
  SEDES: 'CONFIG_SEDES',
  FRECUENCIAS: 'CONFIG_FRECUENCIAS',
  PROYECTOS: 'CONFIG_PROYECTOS',
  TEMPLATES: 'TEMPLATES',
  SETTINGS: 'SETTINGS'
};

const LOG_HEADERS = [
  'id', 'fecha', 'concepto', 'tipo', 'sede', 'frecuencia',
  'proyecto', 'prioridad', 'estado', 'tags', 'observacion',
  'resultado', 'duracion_min', 'energia', 'tarea_relacionada_id',
  'created_at', 'updated_at'
];

const TEMPLATE_HEADERS = [
  'id', 'nombre', 'concepto', 'tipo', 'sede', 'frecuencia',
  'proyecto', 'prioridad', 'duracion_min', 'tags'
];

// =============================================================================
// INITIAL SETUP — RUN ONCE
// =============================================================================

function setupSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEET_NAMES.LOG, LOG_HEADERS);
  ensureSheet_(ss, SHEET_NAMES.TIPOS, ['nombre', 'color']);
  ensureSheet_(ss, SHEET_NAMES.SEDES, ['nombre', 'color']);
  ensureSheet_(ss, SHEET_NAMES.FRECUENCIAS, ['nombre']);
  ensureSheet_(ss, SHEET_NAMES.PROYECTOS, ['nombre', 'color', 'activo']);
  ensureSheet_(ss, SHEET_NAMES.TEMPLATES, TEMPLATE_HEADERS);
  ensureSheet_(ss, SHEET_NAMES.SETTINGS, ['key', 'value']);

  // Defaults — solo si están vacíos
  const tipos = readSheetObjects_(SHEET_NAMES.TIPOS);
  if (tipos.length === 0) {
    appendObjects_(SHEET_NAMES.TIPOS, [
      { nombre: 'Aplicaciones', color: '#0a84ff' },
      { nombre: 'Administrativo', color: '#5e5ce6' },
      { nombre: 'Estratégico', color: '#bf5af2' },
      { nombre: 'Profesional', color: '#30d158' }
    ]);
  }
  const sedes = readSheetObjects_(SHEET_NAMES.SEDES);
  if (sedes.length === 0) {
    appendObjects_(SHEET_NAMES.SEDES, [
      { nombre: 'CAVyAG', color: '#ff9f0a' },
      { nombre: 'EDESTE', color: '#ff453a' },
      { nombre: 'NEHUEL', color: '#0a84ff' },
      { nombre: 'PERSONAL', color: '#8e8e93' }
    ]);
  }
  const freq = readSheetObjects_(SHEET_NAMES.FRECUENCIAS);
  if (freq.length === 0) {
    appendObjects_(SHEET_NAMES.FRECUENCIAS, [
      { nombre: 'Único' }, { nombre: 'Diario' }, { nombre: 'Semanal' },
      { nombre: 'Mensual' }, { nombre: 'No definido' }
    ]);
  }

  // Ensure SETTINGS has defaults
  const settings = readSettings_();
  if (!settings.api_token) {
    setSetting_('api_token', Utilities.getUuid());
  }
  if (!settings.reminder_hour) {
    setSetting_('reminder_hour', '18');
  }
  if (!settings.reminder_enabled) {
    setSetting_('reminder_enabled', 'false');
  }

  SpreadsheetApp.getUi().alert(
    'Setup OK',
    'Hojas creadas/verificadas. Tu API token es:\n\n' +
      readSettings_().api_token +
      '\n\nGuárdalo, lo vas a pegar en la app.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  }
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
}

// =============================================================================
// HTTP ENDPOINTS
// =============================================================================

function doGet(e) {
  return handleRequest_(e, 'GET');
}

function doPost(e) {
  return handleRequest_(e, 'POST');
}

function handleRequest_(e, method) {
  try {
    const params = e.parameter || {};
    let body = {};
    if (method === 'POST' && e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents); } catch (_) {}
    }
    const action = params.action || body.action || 'ping';
    const token = params.token || body.token;

    // Auth
    const settings = readSettings_();
    if (action !== 'ping' && (!token || token !== settings.api_token)) {
      return jsonResponse_({ ok: false, error: 'Unauthorized' });
    }

    let result;
    switch (action) {
      case 'ping': result = { ok: true, ts: new Date().toISOString() }; break;
      case 'bootstrap': result = bootstrap_(); break;
      case 'list': result = listTasks_(params); break;
      case 'create': result = createTask_(body.task); break;
      case 'update': result = updateTask_(body.task); break;
      case 'delete': result = deleteTask_(body.id); break;
      case 'bulk_create': result = bulkCreateTasks_(body.tasks); break;
      case 'template_save': result = saveTemplate_(body.template); break;
      case 'template_delete': result = deleteTemplate_(body.id); break;
      case 'config_set': result = configSet_(body.kind, body.item); break;
      case 'config_remove': result = configRemove_(body.kind, body.nombre); break;
      case 'settings_save': result = settingsSave_(body.settings); break;
      case 'schedule_reminder': result = scheduleReminder_(body); break;
      default: result = { ok: false, error: 'Unknown action: ' + action };
    }
    if (result && result.ok === undefined) result.ok = true;
    return jsonResponse_(result);
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// =============================================================================
// HANDLERS
// =============================================================================

function bootstrap_() {
  return {
    tipos: readSheetObjects_(SHEET_NAMES.TIPOS),
    sedes: readSheetObjects_(SHEET_NAMES.SEDES),
    frecuencias: readSheetObjects_(SHEET_NAMES.FRECUENCIAS),
    proyectos: readSheetObjects_(SHEET_NAMES.PROYECTOS),
    templates: readSheetObjects_(SHEET_NAMES.TEMPLATES),
    settings: readSettings_(),
    server_time: new Date().toISOString()
  };
}

function listTasks_(params) {
  let tasks = readSheetObjects_(SHEET_NAMES.LOG);
  // Optional filters
  if (params.from) tasks = tasks.filter(t => t.fecha >= params.from);
  if (params.to) tasks = tasks.filter(t => t.fecha <= params.to);
  if (params.estado) tasks = tasks.filter(t => t.estado === params.estado);
  if (params.tipo) tasks = tasks.filter(t => t.tipo === params.tipo);
  if (params.sede) tasks = tasks.filter(t => t.sede === params.sede);
  if (params.proyecto) tasks = tasks.filter(t => t.proyecto === params.proyecto);
  return { tasks: tasks };
}

function createTask_(task) {
  if (!task) throw new Error('task required');
  if (!task.id) task.id = 'T' + Utilities.getUuid().replace(/-/g, '').substring(0, 10).toUpperCase();
  const now = new Date().toISOString();
  task.created_at = task.created_at || now;
  task.updated_at = now;
  appendObjects_(SHEET_NAMES.LOG, [task]);
  return { task: task };
}

function bulkCreateTasks_(tasks) {
  if (!Array.isArray(tasks)) throw new Error('tasks must be an array');
  const now = new Date().toISOString();
  const enriched = tasks.map(t => {
    if (!t.id) t.id = 'T' + Utilities.getUuid().replace(/-/g, '').substring(0, 10).toUpperCase();
    t.created_at = t.created_at || now;
    t.updated_at = now;
    return t;
  });
  appendObjects_(SHEET_NAMES.LOG, enriched);
  return { count: enriched.length };
}

function updateTask_(task) {
  if (!task || !task.id) throw new Error('task.id required');
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.LOG);
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('id');
  for (let r = 1; r < data.length; r++) {
    if (data[r][idIdx] === task.id) {
      task.updated_at = new Date().toISOString();
      const row = headers.map(h => task[h] !== undefined ? task[h] : data[r][headers.indexOf(h)]);
      sh.getRange(r + 1, 1, 1, headers.length).setValues([row]);
      return { task: task };
    }
  }
  throw new Error('Task not found: ' + task.id);
}

function deleteTask_(id) {
  if (!id) throw new Error('id required');
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.LOG);
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('id');
  for (let r = 1; r < data.length; r++) {
    if (data[r][idIdx] === id) {
      sh.deleteRow(r + 1);
      return { id: id };
    }
  }
  throw new Error('Task not found: ' + id);
}

function saveTemplate_(tpl) {
  if (!tpl) throw new Error('template required');
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.TEMPLATES);
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('id');

  if (tpl.id) {
    for (let r = 1; r < data.length; r++) {
      if (data[r][idIdx] === tpl.id) {
        const row = headers.map(h => tpl[h] !== undefined ? tpl[h] : data[r][headers.indexOf(h)]);
        sh.getRange(r + 1, 1, 1, headers.length).setValues([row]);
        return { template: tpl };
      }
    }
  }
  tpl.id = 'TPL' + Utilities.getUuid().replace(/-/g, '').substring(0, 8).toUpperCase();
  appendObjects_(SHEET_NAMES.TEMPLATES, [tpl]);
  return { template: tpl };
}

function deleteTemplate_(id) {
  if (!id) throw new Error('id required');
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.TEMPLATES);
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('id');
  for (let r = 1; r < data.length; r++) {
    if (data[r][idIdx] === id) {
      sh.deleteRow(r + 1);
      return { id: id };
    }
  }
  throw new Error('Template not found: ' + id);
}

function configSet_(kind, item) {
  const map = {
    tipo: SHEET_NAMES.TIPOS,
    sede: SHEET_NAMES.SEDES,
    frecuencia: SHEET_NAMES.FRECUENCIAS,
    proyecto: SHEET_NAMES.PROYECTOS
  };
  const sheet = map[kind];
  if (!sheet) throw new Error('Unknown kind: ' + kind);
  const existing = readSheetObjects_(sheet);
  const idx = existing.findIndex(x => x.nombre === item.nombre);
  if (idx >= 0) {
    // Update in place
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheet);
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const row = headers.map(h => item[h] !== undefined ? item[h] : existing[idx][h]);
    sh.getRange(idx + 2, 1, 1, headers.length).setValues([row]);
  } else {
    appendObjects_(sheet, [item]);
  }
  return { item: item };
}

function configRemove_(kind, nombre) {
  const map = {
    tipo: SHEET_NAMES.TIPOS, sede: SHEET_NAMES.SEDES,
    frecuencia: SHEET_NAMES.FRECUENCIAS, proyecto: SHEET_NAMES.PROYECTOS
  };
  const sheet = map[kind];
  if (!sheet) throw new Error('Unknown kind: ' + kind);
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheet);
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const nameIdx = headers.indexOf('nombre');
  for (let r = 1; r < data.length; r++) {
    if (data[r][nameIdx] === nombre) {
      sh.deleteRow(r + 1);
      return { removed: nombre };
    }
  }
  return { removed: null };
}

function settingsSave_(settings) {
  if (!settings) throw new Error('settings required');
  Object.keys(settings).forEach(k => setSetting_(k, settings[k]));
  return { settings: readSettings_() };
}

function scheduleReminder_(body) {
  // body: { date: 'YYYY-MM-DD', hour: 18, title: 'Cargar tareas del día', recurring: 'daily'|'weekdays'|null }
  const date = body.date;
  const hour = parseInt(body.hour || '18', 10);
  const title = body.title || '📝 Cargar tareas del día';
  const desc = 'Recordatorio automático del Task Log de Nehuel.';

  const start = date ? new Date(date + 'T00:00:00') : new Date();
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start.getTime() + 15 * 60 * 1000);

  const cal = CalendarApp.getDefaultCalendar();
  let event;
  if (body.recurring === 'daily') {
    event = cal.createEventSeries(title, start, end,
      CalendarApp.newRecurrence().addDailyRule(),
      { description: desc });
  } else if (body.recurring === 'weekdays') {
    event = cal.createEventSeries(title, start, end,
      CalendarApp.newRecurrence().addWeeklyRule().onlyOnWeekdays([
        CalendarApp.Weekday.MONDAY, CalendarApp.Weekday.TUESDAY,
        CalendarApp.Weekday.WEDNESDAY, CalendarApp.Weekday.THURSDAY,
        CalendarApp.Weekday.FRIDAY
      ]),
      { description: desc });
  } else {
    event = cal.createEvent(title, start, end, { description: desc });
  }
  return { event_id: event.getId(), title: title, when: start.toISOString() };
}

// =============================================================================
// LOW-LEVEL SHEET HELPERS
// =============================================================================

function readSheetObjects_(sheetName) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) return [];
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const objs = [];
  for (let r = 1; r < data.length; r++) {
    const o = {};
    for (let c = 0; c < headers.length; c++) {
      let v = data[r][c];
      if (v instanceof Date) v = Utilities.formatDate(v, 'America/Argentina/Mendoza', 'yyyy-MM-dd');
      o[headers[c]] = v === null || v === undefined ? '' : v;
    }
    objs.push(o);
  }
  return objs;
}

function appendObjects_(sheetName, objs) {
  if (!objs || objs.length === 0) return;
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const rows = objs.map(o => headers.map(h => o[h] !== undefined && o[h] !== null ? o[h] : ''));
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
}

function readSettings_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.SETTINGS);
  if (!sh || sh.getLastRow() < 2) return {};
  const data = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  const out = {};
  data.forEach(row => { if (row[0]) out[row[0]] = row[1]; });
  return out;
}

function setSetting_(key, value) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.SETTINGS);
  const data = sh.getDataRange().getValues();
  for (let r = 1; r < data.length; r++) {
    if (data[r][0] === key) {
      sh.getRange(r + 1, 2).setValue(value);
      return;
    }
  }
  sh.appendRow([key, value]);
}
