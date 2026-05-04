# Bitácora · Nehuel

Web app personal para registro estructurado de tareas, con backend en Google Apps Script y frontend estático.

**Stack:** SPA vanilla JS (módulos ES) en GitHub Pages + Google Apps Script Web App + Google Sheets como base de datos.

**Estética:** iOS 18 / macOS Sequoia dark mode (liquid glass, sidebar translúcido, continuous corner curvature).

---

## Características

**Captura de tareas con campos extendidos**
- Concepto, tipo, sede, frecuencia, proyecto
- Prioridad (Alta/Media/Baja), estado (Pendiente/En curso/Hecho/Bloqueado)
- Tags libres, observación, resultado, energía 1–5
- Duración con presets (15m / 30m / 1h / 2h / 4h / día completo)
- Tarea relacionada (link interno)

**Vistas**
- **Dashboard**: KPIs (hoy, semana, pendientes, ratio estratégico) + heatmap 26 semanas + donut tipos + bar sedes + tendencia 12 semanas + follow-ups detectados
- **Bitácora**: tabla con filtros, búsqueda global, exports CSV/JSON
- **Pendientes**: kanban drag&drop entre Pendiente / En curso / Bloqueado
- **Insights**: comparación período actual vs anterior, ratio estratégico mensual (6m), detección de tareas recurrentes (similaridad ≥ 0.65), tiempo total por tipo, tareas sin observación, distribución sede × tipo
- **Plantillas**: tareas frecuentes para creación rápida
- **Ajustes**: conexión, taxonomía CRUD (tipos/sedes/frecuencias/proyectos), recordatorios Calendar, importar LOG, exports

**Atajos**
- `⌘N` / `Ctrl+N` — nueva tarea
- `⌘K` / `Ctrl+K` — buscar
- `Esc` — cerrar modal

---

## Setup paso a paso

### 1. Crear la Google Sheet

1. Ir a [sheets.new](https://sheets.new) y crear una sheet vacía. Renombrarla, p.ej. *Bitácora · Nehuel*.
2. **Extensiones → Apps Script**.

### 2. Configurar Apps Script

1. En el editor de Apps Script, **renombrar el proyecto** a *Bitácora Backend*.
2. Borrar el contenido de `Code.gs` y pegar el contenido de [`apps_script/Code.gs`](apps_script/Code.gs) de este repo.
3. **Mostrar el manifiesto:** ⚙ *Configuración del proyecto* → marcar *Mostrar el archivo de manifiesto `appsscript.json`*. Reemplazar su contenido con [`apps_script/appsscript.json`](apps_script/appsscript.json).
4. Guardar (💾).

### 3. Inicializar la base de datos

1. En el dropdown de funciones, elegir `setupSpreadsheet` y darle ▶ *Ejecutar*.
2. Autorizar los permisos cuando lo pida (Sheets, Calendar, External requests). En "Esta app no se ha verificado" → *Configuración avanzada* → *Ir a Bitácora Backend (no seguro)*.
3. Al terminar verás un alert con tu **API token** (UUID). **Copialo y guardalo** — lo vas a pegar en la app.

Esto crea las hojas: `LOG`, `CONFIG_TIPOS`, `CONFIG_SEDES`, `CONFIG_FRECUENCIAS`, `CONFIG_PROYECTOS`, `TEMPLATES`, `SETTINGS` con los valores por defecto (Tipos = Aplicaciones/Administrativo/Estratégico/Profesional · Sedes = CAVyAG/EDESTE/NEHUEL/PERSONAL · etc.).

### 4. Publicar como Web App

1. En Apps Script: *Implementar → Nueva implementación*.
2. Tipo: **Aplicación web**.
3. Configuración:
   - *Descripción*: Bitácora API v1
   - *Ejecutar como*: **Yo** (tu cuenta)
   - *Quién tiene acceso*: **Cualquier usuario** (acceso anónimo)
4. *Implementar* → autorizar de nuevo si lo pide.
5. **Copiar la URL del Web App** (termina en `/exec`).

> ⚠ Cada vez que cambies `Code.gs` y quieras que los cambios entren al Web App, hay que crear una *nueva versión* (Implementar → Gestionar implementaciones → ✎ → Versión: Nueva versión).

### 5. Hostear el frontend en GitHub Pages

```bash
# Desde el directorio del proyecto
git init
git add .
git commit -m "Bitácora v1"
git branch -M main
git remote add origin https://github.com/<TU-USUARIO>/bitacora.git
git push -u origin main
```

Después en GitHub: **Settings → Pages → Source: `main` / root** → guardar. La URL queda en `https://<TU-USUARIO>.github.io/bitacora/`.

### 6. Conectar la app

1. Abrir la URL de GitHub Pages.
2. La app te lleva automáticamente a *Ajustes* (porque no está configurada).
3. Pegar:
   - **Endpoint URL**: la URL `/exec` del paso 4
   - **API Token**: el UUID del paso 3
4. Click *Probar conexión*. Si todo está OK te dice ✓ y trae los datos.
5. Click *Guardar*.

### 7. Importar el LOG inicial

En *Ajustes → Importar bitácora inicial → Importar LOG inicial*. Sube las 15 tareas del 20–30 de marzo que ya tenías cargadas en el Excel. Las podés editar luego desde la vista Bitácora.

### 8. Programar recordatorio (opcional)

*Ajustes → Recordatorios en Google Calendar*. Configurá hora, recurrencia (una vez / diario / días hábiles) y *Programar evento*. Se crea en tu calendario principal.

---

## Estructura del proyecto

```
nehuel-log/
├── index.html                    Shell HTML (sidebar + content + modal)
├── css/styles.css                Sistema de diseño iOS dark mode
├── js/
│   ├── app.js                    Entry point: routing, shortcuts, bootstrap
│   ├── api.js                    Cliente del Apps Script Web App
│   ├── state.js                  Estado central + selectores
│   ├── components.js             Modal, toast, taskForm, badges, segmented
│   ├── utils.js                  Fechas, formato, group/count, CSV, similarity
│   └── views/
│       ├── dashboard.js          KPIs, donut/bar charts, heatmap, follow-ups
│       ├── log.js                Tabla con filtros, edición, exports
│       ├── pending.js            Kanban drag&drop
│       ├── insights.js           6 cards de análisis profundo
│       ├── templates.js          CRUD plantillas + "Usar" para crear tarea
│       └── settings.js           Conexión, taxonomía, recordatorios, import/export
├── apps_script/
│   ├── Code.gs                   Backend completo (REST sobre Sheets)
│   └── appsscript.json           Manifest (timezone Mendoza, V8, scopes)
├── data/
│   ├── initial_log.json          Tu LOG.xlsx ya pre-procesado al schema nuevo
│   └── initial_log.csv           Misma data en CSV (por si querés pegar a mano)
└── README.md
```

---

## Schema de la hoja `LOG`

| Campo | Tipo | Descripción |
|---|---|---|
| id | string | `T` + 10 chars uppercase, autogenerado |
| fecha | YYYY-MM-DD | fecha de ejecución |
| concepto | string | qué tarea fue |
| tipo | string | Aplicaciones / Administrativo / Estratégico / Profesional (FK CONFIG_TIPOS) |
| sede | string | CAVyAG / EDESTE / NEHUEL / PERSONAL (FK CONFIG_SEDES) |
| frecuencia | string | Único / Diario / Semanal / Mensual / No definido |
| proyecto | string | iniciativa o proyecto (FK CONFIG_PROYECTOS, opcional) |
| prioridad | string | Alta / Media / Baja |
| estado | string | Pendiente / En curso / Hecho / Bloqueado |
| tags | string | comma-separated |
| observacion | string | notas, contexto, dudas |
| resultado | string | qué se logró |
| duracion_min | number | minutos |
| energia | number | 1–5 |
| tarea_relacionada_id | string | id de otra tarea |
| created_at | ISO datetime | autogenerado |
| updated_at | ISO datetime | autogenerado |

---

## Seguridad

- El Web App es público (`ANYONE_ANONYMOUS`) porque GitHub Pages no puede autenticar contra Google sin un OAuth flow propio.
- La protección es por **token** (UUID generado en `setupSpreadsheet`). El backend rechaza requests sin token correcto.
- El token se guarda en el `localStorage` del navegador. **No comitearlo al repo.**
- Para uso personal en una máquina propia es suficiente. Si te preocupa, podés:
  - Rotar el token cambiándolo en la hoja `SETTINGS` y en *Ajustes* de la app.
  - Restringir el acceso del Web App a *Solo yo* (rompe el uso desde GitHub Pages, pero útil si vas a usarlo desde el editor de Apps Script).

---

## Notas técnicas

- **CORS**: el cliente usa `Content-Type: text/plain;charset=utf-8` para evitar el preflight de Apps Script.
- **Cache**: `localStorage` guarda el último bootstrap y la última lista de tareas, para que el primer paint sea instantáneo.
- **Charts**: Chart.js 4.4.1 cargado via CDN (jsdelivr). Si querés trabajar offline, descargá el bundle a `/assets/`.
- **Drag & drop**: HTML5 nativo, sin librerías.
- **Heatmap**: divs con CSS grid (no SVG), 12px cells.
- **Detección de recurrentes**: word-overlap + substring (umbral 0.65). No es semántico, es léxico — lo justo para flagging.
- **Detección de follow-ups**: keyword match en observación (pendiente, consultar, verificar, revisar, seguimiento, etc).

---

## Posibles próximos pasos

- Importador directo de `.xlsx` (con `xlsx.full.min.js` o SheetJS) en lugar del JSON pre-procesado.
- Modo timeline / Gantt para tareas con duración planificada.
- Vista calendario mensual.
- Sincronización bidireccional con Calendar (no solo recordatorios).
- Auth con Google Sign-In en lugar de token estático.
- Métricas semanales por email vía trigger de Apps Script.
- Exportar reporte a Power BI vía conexión Web (la sheet ya está estructurada para eso).

---

*v1.0 · Mayo 2026 · Mendoza, Argentina*
