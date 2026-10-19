# TASK-29 — Envío en vivo de canciones a la app abierta

| Campo | Valor |
|---|---|
| Task-ID | TASK-29 |
| Sprint | 4 — Baterías y canciones |
| Estado | TODO |
| Prioridad | P2 |
| Estimación | 4–5h |
| Dependencias | TASK-25, TASK-28 |
| Capacidades relacionadas | CAP-NLM-018 · Uso desde Claude Code / clientes MCP |

---

## Contexto

Strudel solo suena en el navegador, así que el MCP no puede reproducir por sí mismo. Para
tener el bucle "pido, escucho, ajusto" desde Claude, el MCP envía la canción a la pestaña
de NLMusic que esté abierta, y esta la carga y la reproduce en el siguiente compás.

## Acceptance Criteria

**AC-1 — Endpoint de entrada** en el servidor de desarrollo (`/api/songs/push`, POST) que valida la canción con la validación compartida y la deja en una cola en memoria. Solo acepta peticiones desde localhost (y documentar que el dev server se arranca con `-H 0.0.0.0`: comprobar que la restricción es real, no basada en cabeceras falsificables).

**AC-2 — Canal hacia el navegador**: `/api/songs/stream` (SSE) al que se suscribe la app. Reconexión automática. Indicador discreto en la UI ("Conectado a Claude / sin conexión").

**AC-3 — Aplicación en el cliente**: al recibir una canción, la app muestra un aviso con acción "Cargar", o la carga directamente si hay un ajuste "Aceptar canciones enviadas automáticamente" (desactivado por defecto). La carga respeta BR-001: si hay audio, entra en el siguiente compás; si no, no arranca solo salvo opción explícita.

**AC-4 — Herramienta MCP `play_in_app(song | name, autoplay?)`**: envía al endpoint y devuelve si hay alguna pestaña conectada. Si no la hay, lo dice con claridad (y que la canción queda guardada).

**AC-5 — Estado y edición manual**: la canción cargada queda en el store como cualquier otra (grid editable, BR-008; coherencia con código, BR-009). Si el usuario tiene ediciones manuales de código sin aplicar, se pide confirmación antes de reemplazar.

**AC-6 — Tests**: endpoint (válida/inválida, no local), cola/SSE, y el hook del cliente con un `EventSource` simulado.

## Riesgos
- Dos pestañas abiertas: v1 envía a todas; documentar o limitar a la última conectada.
- Es una puerta de entrada nueva: mantener la validación estricta y la restricción a localhost.

## Fuera de alcance
Enviar desde la app hacia Claude, control de transporte remoto (play/stop desde el MCP).
