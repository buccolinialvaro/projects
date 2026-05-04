// ============================================================================
// views/dashboard.js
// ============================================================================
import { el, countBy, sumBy, fmtDate, fmtRelative, fmtDuration,
         isFollowUp, isoDaysAgo, todayISO, TIPO_COLORS, SEDE_COLORS } from '../utils.js';
import { state, pendingTasks } from '../state.js';
import { tipoBadge, sedeBadge, estadoBadge } from '../components.js';
import { openTaskDetail } from './log.js';

let chartInstances = [];

export function render(container) {
  // Cleanup previous charts
  chartInstances.forEach(c => c.destroy && c.destroy());
  chartInstances = [];

  const tasks = state.tasks;
  const pending = pendingTasks();

  // -- KPIs --
  const today = todayISO();
  const weekAgo = isoDaysAgo(7);
  const monthAgo = isoDaysAgo(30);
  const prevMonth = isoDaysAgo(60);

  const todayTasks = tasks.filter(t => t.fecha === today);
  const weekTasks = tasks.filter(t => (t.fecha || '') >= weekAgo);
  const monthTasks = tasks.filter(t => (t.fecha || '') >= monthAgo);
  const prevMonthTasks = tasks.filter(t => (t.fecha || '') >= prevMonth && (t.fecha || '') < monthAgo);

  const totalMonth = monthTasks.length;
  const totalPrev = prevMonthTasks.length;
  const trend = totalPrev === 0 ? 0 : Math.round(((totalMonth - totalPrev) / totalPrev) * 100);

  const strategicMonth = monthTasks.filter(t => t.tipo === 'Estratégico').length;
  const strategicRatio = totalMonth === 0 ? 0 : Math.round((strategicMonth / totalMonth) * 100);

  const minutesMonth = sumBy(monthTasks, 'duracion_min');

  // --- KPI ROW ---
  const kpis = el('div', { class: 'dash-grid' },
    kpiCard('Tareas hoy', todayTasks.length, '#0a84ff', null),
    kpiCard('Esta semana', weekTasks.length, '#5e5ce6', null),
    kpiCard('Pendientes', pending.length, '#ff9f0a', null),
    kpiCard(
      'Ratio estratégico',
      strategicRatio + '%',
      '#bf5af2',
      `${strategicMonth} de ${totalMonth} (últimos 30 días)`
    )
  );

  // --- ROW 2: Tipo donut + Sede bar ---
  const row2 = el('div', { class: 'dash-row' },
    chartCard('Tareas por Tipo (30 días)', 'tipo-chart', 'doughnut'),
    chartCard('Tareas por Sede (30 días)', 'sede-chart', 'bar')
  );

  // --- ROW 3: Heatmap + Follow-ups ---
  const row3 = el('div', { class: 'dash-row' },
    heatmapCard(tasks),
    followUpsCard(tasks)
  );

  // --- ROW 4: Recent feed + Trend chart ---
  const row4 = el('div', { class: 'dash-row' },
    trendChartCard(),
    recentFeedCard(tasks)
  );

  container.replaceChildren(kpis, row2, row3, row4);

  // After mount, render charts
  if (window.Chart) {
    renderTipoChart(monthTasks);
    renderSedeChart(monthTasks);
    renderTrendChart(tasks);
  } else {
    // Chart.js still loading — defer
    waitForChart(() => {
      renderTipoChart(monthTasks);
      renderSedeChart(monthTasks);
      renderTrendChart(tasks);
    });
  }
}

function waitForChart(cb) {
  const t = setInterval(() => {
    if (window.Chart) { clearInterval(t); cb(); }
  }, 80);
}

function kpiCard(label, value, tint, sub) {
  return el('div', { class: 'kpi' },
    el('div', { class: 'kpi-tint', style: { background: tint } }),
    el('div', { class: 'kpi-label' }, label),
    el('div', { class: 'kpi-value' }, value),
    sub ? el('div', { class: 'kpi-delta flat' }, sub) : null
  );
}

function chartCard(title, canvasId, _type) {
  return el('div', { class: 'card' },
    el('h3', { class: 'card-title' }, title),
    el('div', { style: { position: 'relative', height: '260px' } },
      el('canvas', { id: canvasId })
    )
  );
}

function renderTipoChart(tasks) {
  const counts = countBy(tasks, 'tipo');
  const labels = Object.keys(counts);
  const data = Object.values(counts);
  const colors = labels.map(l => TIPO_COLORS[l]?.color || '#8e8e93');
  const ctx = document.getElementById('tipo-chart');
  if (!ctx) return;
  const c = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: '#1c1c1e',
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      maintainAspectRatio: false,
      cutout: '64%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#ebebf599',
            font: { family: '-apple-system, "SF Pro Text", system-ui', size: 12 },
            boxWidth: 12, boxHeight: 12, padding: 12, usePointStyle: true
          }
        }
      }
    }
  });
  chartInstances.push(c);
}

function renderSedeChart(tasks) {
  const counts = countBy(tasks, 'sede');
  const labels = Object.keys(counts);
  const data = Object.values(counts);
  const colors = labels.map(l => SEDE_COLORS[l]?.color || '#8e8e93');
  const ctx = document.getElementById('sede-chart');
  if (!ctx) return;
  const c = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderRadius: 6, borderSkipped: false }]
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#ebebf599', font: { family: '-apple-system' } } },
        y: { grid: { color: 'rgba(84,84,88,0.30)' }, ticks: { color: '#ebebf599', font: { family: '-apple-system' }, precision: 0 } }
      }
    }
  });
  chartInstances.push(c);
}

function renderTrendChart(tasks) {
  // Last 12 weeks, count tasks/week, split by tipo
  const ctx = document.getElementById('trend-chart');
  if (!ctx) return;
  const weeks = 12;
  const labels = [];
  const seriesByTipo = {};
  const tiposActive = [...new Set(tasks.map(t => t.tipo).filter(Boolean))];
  tiposActive.forEach(t => seriesByTipo[t] = new Array(weeks).fill(0));

  for (let i = weeks - 1; i >= 0; i--) {
    const start = isoDaysAgo((i + 1) * 7 - 1);
    const end = isoDaysAgo(i * 7);
    const idx = weeks - 1 - i;
    labels.push(fmtDate(end));
    const wk = tasks.filter(t => (t.fecha || '') >= start && (t.fecha || '') <= end);
    wk.forEach(t => { if (seriesByTipo[t.tipo]) seriesByTipo[t.tipo][idx]++; });
  }

  const datasets = Object.keys(seriesByTipo).map(tipo => ({
    label: tipo,
    data: seriesByTipo[tipo],
    borderColor: TIPO_COLORS[tipo]?.color || '#8e8e93',
    backgroundColor: (TIPO_COLORS[tipo]?.color || '#8e8e93') + '30',
    fill: true,
    tension: 0.32,
    borderWidth: 2,
    pointRadius: 2,
    pointHoverRadius: 4
  }));

  const c = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#ebebf599', font: { family: '-apple-system', size: 12 }, usePointStyle: true, boxWidth: 8 }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#ebebf599', maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } },
        y: { grid: { color: 'rgba(84,84,88,0.30)' }, ticks: { color: '#ebebf599', precision: 0 }, stacked: true }
      }
    }
  });
  chartInstances.push(c);
}

function trendChartCard() {
  return el('div', { class: 'card' },
    el('h3', { class: 'card-title' }, 'Tendencia (12 semanas)'),
    el('div', { class: 'card-subtitle' }, 'Tareas por semana, apiladas por tipo'),
    el('div', { style: { position: 'relative', height: '260px' } },
      el('canvas', { id: 'trend-chart' })
    )
  );
}

// ----- HEATMAP -----
function heatmapCard(tasks) {
  // 26 weeks back, Mon-Sun grid
  const weeks = 26;
  const today = new Date();
  const dayOfWeek = (today.getDay() || 7) - 1; // 0=Mon..6=Sun
  const start = new Date(today);
  start.setDate(today.getDate() - dayOfWeek - (weeks - 1) * 7);
  start.setHours(0, 0, 0, 0);

  const counts = countBy(tasks, 'fecha');
  const max = Math.max(...Object.values(counts), 1);

  const heat = el('div', { class: 'heatmap' });
  for (let w = 0; w < weeks; w++) {
    const col = el('div', { class: 'heatmap-week' });
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + w * 7 + d);
      const iso = dt.toISOString().slice(0, 10);
      const c = counts[iso] || 0;
      let lvl = 0;
      if (c > 0) lvl = Math.min(4, Math.ceil((c / max) * 4));
      const cell = el('div', {
        class: 'heatmap-cell', dataset: { level: String(lvl) },
        title: `${iso} · ${c} tarea${c !== 1 ? 's' : ''}`
      });
      col.appendChild(cell);
    }
    heat.appendChild(col);
  }

  return el('div', { class: 'card' },
    el('h3', { class: 'card-title' }, 'Actividad (últimas 26 semanas)'),
    heat,
    el('div', { class: 'heatmap-legend' },
      'Menos',
      el('div', { class: 'heatmap-cell', dataset: { level: '0' } }),
      el('div', { class: 'heatmap-cell', dataset: { level: '1' } }),
      el('div', { class: 'heatmap-cell', dataset: { level: '2' } }),
      el('div', { class: 'heatmap-cell', dataset: { level: '3' } }),
      el('div', { class: 'heatmap-cell', dataset: { level: '4' } }),
      'Más'
    )
  );
}

// ----- FOLLOW-UPS -----
function followUpsCard(tasks) {
  const candidates = tasks
    .filter(t => isFollowUp(t.observacion))
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
    .slice(0, 6);

  const list = el('div');
  if (candidates.length === 0) {
    list.appendChild(el('div', { class: 'empty' },
      el('div', { class: 'empty-emoji' }, '✨'),
      el('h3', null, 'No hay follow-ups detectados'),
      el('p', null, 'Las observaciones con palabras tipo "pendiente", "verificar" o "consultar" aparecen acá.')
    ));
  } else {
    candidates.forEach(t => {
      const row = el('div', { class: 'insight-row' },
        el('div', { class: 'insight-text' },
          el('strong', null, t.concepto || '(sin título)'),
          el('small', null, `${fmtRelative(t.fecha)} · ${t.observacion || ''}`)
        ),
        el('button', { class: 'btn btn-sm', onClick: () => openTaskDetail(t) }, 'Abrir')
      );
      list.appendChild(row);
    });
  }
  return el('div', { class: 'card' },
    el('h3', { class: 'card-title' }, 'Follow-ups detectados'),
    el('div', { class: 'card-subtitle' }, 'Observaciones con palabras de seguimiento'),
    list
  );
}

// ----- RECENT FEED -----
function recentFeedCard(tasks) {
  const sorted = [...tasks]
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') ||
                    (b.created_at || '').localeCompare(a.created_at || ''))
    .slice(0, 8);

  const list = el('div');
  if (sorted.length === 0) {
    list.appendChild(el('div', { class: 'empty' },
      el('div', { class: 'empty-emoji' }, '📋'),
      el('h3', null, 'Sin tareas todavía'),
      el('p', null, 'Cargá tu primera tarea con el botón "Nueva tarea".')
    ));
  } else {
    sorted.forEach(t => {
      const row = el('div', { class: 'insight-row', style: { cursor: 'pointer' } },
        el('div', { class: 'insight-text' },
          el('strong', null, t.concepto || '(sin título)'),
          el('small', null, `${fmtRelative(t.fecha)} · ${t.sede || '—'}`)
        ),
        el('div', { class: 'row gap-2' },
          tipoBadge(t.tipo),
          estadoBadge(t.estado)
        )
      );
      row.addEventListener('click', () => openTaskDetail(t));
      list.appendChild(row);
    });
  }
  return el('div', { class: 'card' },
    el('h3', { class: 'card-title' }, 'Actividad reciente'),
    list
  );
}
