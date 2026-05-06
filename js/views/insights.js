// ============================================================================
// views/insights.js — Análisis profundo y detección de patrones
// ============================================================================
import { el, countBy, sumBy, similarity, fmtDate, fmtDuration,
         isFollowUp, isoDaysAgo, todayISO, TIPO_COLORS, SEDE_COLORS, esc } from '../utils.js';
import { state } from '../state.js';
import { tipoBadge, sedeBadge, estadoBadge } from '../components.js';
import { openTaskDetail } from './log.js';

let charts = [];

export function render(container) {
  charts.forEach(c => c.destroy && c.destroy());
  charts = [];

  const tasks = state.tasks;

  const top = el('div', { class: 'dash-row' },
    periodCompareCard(tasks),
    strategicRatioCard(tasks)
  );

  const middle = el('div', { class: 'dash-row' },
    recurringTasksCard(tasks),
    timeByCategoryCard(tasks)
  );

  const bottom = el('div', { class: 'dash-row' },
    missingObservationsCard(tasks),
    bySedeCard(tasks)
  );

  container.replaceChildren(top, middle, bottom);

  if (window.Chart) {
    renderTimeChart(tasks);
    renderSedeStackedChart(tasks);
    renderPeriodChart(tasks);
  } else {
    const t = setInterval(() => {
      if (window.Chart) {
        clearInterval(t);
        renderTimeChart(tasks);
        renderSedeStackedChart(tasks);
        renderPeriodChart(tasks);
      }
    }, 80);
  }
}

// ----- Period comparison -----
function periodCompareCard(tasks) {
  return el('div', { class: 'card' },
    el('h3', { class: 'card-title' }, 'Período actual vs anterior'),
    el('div', { class: 'card-subtitle' }, 'Últimos 30 días vs 30 días previos'),
    el('div', { style: { position: 'relative', height: '240px' } },
      el('canvas', { id: 'period-chart' })
    )
  );
}

function renderPeriodChart(tasks) {
  const ctx = document.getElementById('period-chart');
  if (!ctx) return;
  const monthAgo = isoDaysAgo(30);
  const twoMonthAgo = isoDaysAgo(60);

  const current = tasks.filter(t => (t.fecha || '') >= monthAgo);
  const previous = tasks.filter(t => (t.fecha || '') >= twoMonthAgo && (t.fecha || '') < monthAgo);

  const tipos = [...new Set([...current, ...previous].map(t => t.tipo).filter(Boolean))];
  const cCounts = countBy(current, 'tipo');
  const pCounts = countBy(previous, 'tipo');

  const c = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: tipos,
      datasets: [
        {
          label: 'Anterior (30–60 días)',
          data: tipos.map(t => pCounts[t] || 0),
          backgroundColor: 'rgba(142,142,147,0.6)',
          borderRadius: 6
        },
        {
          label: 'Actual (últimos 30)',
          data: tipos.map(t => cCounts[t] || 0),
          backgroundColor: tipos.map(t => TIPO_COLORS[t]?.color || '#0a84ff'),
          borderRadius: 6
        }
      ]
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#ebebf599', usePointStyle: true, font: { family: '-apple-system' } } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#ebebf599' } },
        y: { grid: { color: 'rgba(84,84,88,0.30)' }, ticks: { color: '#ebebf599', precision: 0 } }
      }
    }
  });
  charts.push(c);
}

// ----- Strategic ratio over time -----
function strategicRatioCard(tasks) {
  // Compute monthly ratio for the last 6 months
  const months = [];
  const today = new Date();
  for (let i = 5; i >= 0; i--) {
    const m = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const next = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
    const isoStart = m.toISOString().slice(0, 10);
    const isoEnd = next.toISOString().slice(0, 10);
    const mt = tasks.filter(t => t.fecha >= isoStart && t.fecha < isoEnd);
    const total = mt.length;
    const stra = mt.filter(t => t.tipo === 'Estratégico').length;
    months.push({
      label: m.toLocaleDateString('es-AR', { month: 'short' }),
      ratio: total > 0 ? Math.round(stra / total * 100) : 0,
      total, stra
    });
  }

  const rows = months.map(m =>
    el('div', { class: 'insight-row' },
      el('div', { class: 'insight-text' },
        el('strong', null, m.label.toUpperCase()),
        el('small', null, `${m.stra} estratégicas de ${m.total} totales`)
      ),
      el('div', { class: 'row gap-2' },
        el('div', { class: 'kpi-value', style: { fontSize: '20px' } }, m.ratio + '%'),
        el('div', {
          style: {
            width: '80px', height: '6px', borderRadius: '3px',
            background: 'var(--bg-3)', overflow: 'hidden'
          }
        },
          el('div', {
            style: {
              width: m.ratio + '%', height: '100%',
              background: 'linear-gradient(90deg, var(--purple), var(--indigo))'
            }
          })
        )
      )
    )
  );

  return el('div', { class: 'card' },
    el('h3', { class: 'card-title' }, 'Ratio estratégico mensual'),
    el('div', { class: 'card-subtitle' }, '% de tareas con tipo "Estratégico" sobre el total mensual'),
    ...rows
  );
}

// ----- Recurring tasks (similar concepts) -----
function recurringTasksCard(tasks) {
  const groups = []; // [{ key, items[] }]
  const used = new Set();
  for (let i = 0; i < tasks.length; i++) {
    if (used.has(i)) continue;
    const t = tasks[i];
    const group = [t];
    used.add(i);
    for (let j = i + 1; j < tasks.length; j++) {
      if (used.has(j)) continue;
      if (similarity(t.concepto, tasks[j].concepto) >= 0.65) {
        group.push(tasks[j]);
        used.add(j);
      }
    }
    if (group.length >= 3) {
      groups.push({ key: t.concepto, count: group.length, items: group });
    }
  }
  groups.sort((a, b) => b.count - a.count);

  const list = el('div');
  if (groups.length === 0) {
    list.appendChild(el('div', { class: 'empty' },
      el('div', { class: 'empty-emoji' }, '🤔'),
      el('h3', null, 'No detecté tareas recurrentes'),
      el('p', null, 'Cuando 3+ tareas tengan conceptos similares, aparecen acá como candidatas a automatizar.')
    ));
  } else {
    groups.slice(0, 8).forEach(g => {
      const totalMin = sumBy(g.items, 'duracion_min');
      list.appendChild(el('div', { class: 'insight-row' },
        el('div', { class: 'insight-text' },
          el('strong', null, g.key),
          el('small', null,
            `${g.count} ocurrencias` +
            (totalMin ? ` · ${fmtDuration(totalMin)} acumulados` : '') +
            ` · candidata a automatizar`
          )
        ),
        el('div', { class: 'kpi-value', style: { fontSize: '20px' } }, '×' + g.count)
      ));
    });
  }

  return el('div', { class: 'card' },
    el('h3', { class: 'card-title' }, '⚡ Tareas recurrentes'),
    el('div', { class: 'card-subtitle' }, 'Conceptos similares que aparecen 3+ veces — candidatas a automatización o plantilla'),
    list
  );
}

// ----- Tiempo por tipo -----
function timeByCategoryCard(tasks) {
  return el('div', { class: 'card' },
    el('h3', { class: 'card-title' }, 'Tiempo total por tipo (30 días)'),
    el('div', { class: 'card-subtitle' }, 'Suma de duraciones cargadas'),
    el('div', { style: { position: 'relative', height: '240px' } },
      el('canvas', { id: 'time-chart' })
    )
  );
}

function renderTimeChart(tasks) {
  const ctx = document.getElementById('time-chart');
  if (!ctx) return;
  const monthTasks = tasks.filter(t => (t.fecha || '') >= isoDaysAgo(30));
  const byTipo = {};
  monthTasks.forEach(t => {
    if (!t.tipo) return;
    byTipo[t.tipo] = (byTipo[t.tipo] || 0) + (parseInt(t.duracion_min) || 0);
  });
  const labels = Object.keys(byTipo);
  const data = Object.values(byTipo).map(m => Math.round(m / 60 * 10) / 10); // hours
  const colors = labels.map(l => TIPO_COLORS[l]?.color || '#8e8e93');

  const c = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Horas', data, backgroundColor: colors, borderRadius: 6 }]
    },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(84,84,88,0.30)' }, ticks: { color: '#ebebf599' }, title: { display: true, text: 'horas', color: '#ebebf599' } },
        y: { grid: { display: false }, ticks: { color: '#ebebf599' } }
      }
    }
  });
  charts.push(c);
}

// ----- Tareas sin observación -----
function missingObservationsCard(tasks) {
  const isMissing = (t) =>
    !String(t.observacion || '').trim() && !String(t.resultado || '').trim();
  const sinObs = tasks
    .filter(isMissing)
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
    .slice(0, 8);

  const total = tasks.filter(isMissing).length;
  const pct = tasks.length === 0 ? 0 : Math.round(total / tasks.length * 100);

  const list = el('div');
  if (sinObs.length === 0) {
    list.appendChild(el('div', { class: 'empty' },
      el('div', { class: 'empty-emoji' }, '📝'),
      el('h3', null, 'Todas tienen observación'),
      el('p', null, 'Excelente, tu documentación está completa.')
    ));
  } else {
    sinObs.forEach(t => {
      const row = el('div', { class: 'insight-row', style: { cursor: 'pointer' } },
        el('div', { class: 'insight-text' },
          el('strong', null, t.concepto || '(sin título)'),
          el('small', null, `${fmtDate(t.fecha)} · ${t.sede || '—'}`)
        ),
        el('button', { class: 'btn btn-sm', onClick: () => openTaskDetail(t) }, 'Completar')
      );
      list.appendChild(row);
    });
  }

  return el('div', { class: 'card' },
    el('h3', { class: 'card-title' }, 'Tareas sin observación'),
    el('div', { class: 'card-subtitle' }, `${total} tareas sin documentar (${pct}%) — posibles huecos en el conocimiento`),
    list
  );
}

// ----- By Sede / Tipo stacked -----
function bySedeCard(tasks) {
  return el('div', { class: 'card' },
    el('h3', { class: 'card-title' }, 'Distribución por sede × tipo'),
    el('div', { class: 'card-subtitle' }, 'Mapa de carga por contexto de trabajo'),
    el('div', { style: { position: 'relative', height: '240px' } },
      el('canvas', { id: 'sede-stacked-chart' })
    )
  );
}

function renderSedeStackedChart(tasks) {
  const ctx = document.getElementById('sede-stacked-chart');
  if (!ctx) return;
  const sedes = state.sedes.map(s => s.nombre);
  const tipos = state.tipos.map(t => t.nombre);

  const datasets = tipos.map(tipo => ({
    label: tipo,
    data: sedes.map(sede => tasks.filter(t => t.tipo === tipo && t.sede === sede).length),
    backgroundColor: TIPO_COLORS[tipo]?.color || '#8e8e93',
    borderRadius: 4
  }));

  const c = new Chart(ctx, {
    type: 'bar',
    data: { labels: sedes, datasets },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#ebebf599', usePointStyle: true, font: { family: '-apple-system' } } }
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: '#ebebf599' } },
        y: { stacked: true, grid: { color: 'rgba(84,84,88,0.30)' }, ticks: { color: '#ebebf599', precision: 0 } }
      }
    }
  });
  charts.push(c);
}
