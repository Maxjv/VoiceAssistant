# TFTE Voice Assistant — Documento técnico

Última actualización: 2026-08-11

## 1. Qué es esto

Una app web (Node.js + HTML/JS plano, sin framework) que corre en la PC de Maxi y se expone a internet por un túnel, para que desde el iPad (u otro dispositivo) se pueda:

1. Ver la app principal de TFTE (la de React, `npm start`) y el mockup HTML de control, sin estar en la misma red.
2. Hablarle o escribirle a un asistente de voz que responde en texto y audio.
3. Activar un "Modo Agente" que dispara un agente de código real (Claude Code CLI o Antigravity/Gemini CLI) con permiso de lectura **y escritura** sobre `C:\TFTE`, con un paso de confirmación de por medio.

No es un servicio en la nube: todo corre localmente en la PC. El túnel es lo único que lo hace accesible desde afuera.

## 2. Procesos y puertos

| Proceso | Qué es | Puerto / notas |
|---|---|---|
| `npm start` (fuera de esta carpeta, en `C:\TFTE`) | La app real de TFTE (Create React App) | `localhost:3000`. No se toca desde acá, es un proceso aparte que el usuario ya tiene corriendo. |
| `node server.js` | El servidor de este asistente | `localhost:4000`. Es el **único puerto que se expone a internet**. |
| Túnel (ngrok o cloudflared) | Expone el puerto 4000 a una URL pública | Ver sección 4. |
| `node watcher/watch-claude.js` | Puente hacia el CLI de Claude Code | Sin puerto propio; se comunica con `server.js` por archivos (ver sección 6). |
| `node watcher/watch-gemini.js` | Puente hacia el CLI de Antigravity (`agy.exe`) | Ídem. |
| `watchdog.ps1` | Supervisor que levanta y reinicia los 4 procesos de arriba si se caen | Ver sección 5. |

`server.js` hace de "portero" único: sirve la interfaz de este asistente, expone `C:\TFTE` en crudo bajo `/preview`, y hace de proxy transparente hacia `localhost:3000` en `/react` y en la ruta raíz — así el dispositivo remoto nunca necesita saber que existe el puerto 3000.

## 3. Estructura de archivos

```
VoiceAssistant/
├── server.js              Servidor Express (todo el backend)
├── public/                 Frontend servido por Express
│   ├── app.html             Shell de la interfaz (riel inferior + botones flotantes)
│   ├── app.js                Toda la lógica del cliente (mic, cola de mensajes, zoom, etc.)
│   ├── style.css              Estilos
│   └── gallery.html           Galería de FrontImgs (botón "Imgs")
├── watcher/
│   ├── engine.js              Motor genérico del protocolo de Modo Agente (compartido)
│   ├── watch-claude.js         Config específica del backend Claude
│   ├── watch-gemini.js         Config específica del backend Gemini
│   ├── claude/                 instruccion.txt / alcance.txt / respuesta.txt / estado.json
│   └── gemini/                 (mismos 4 archivos, backend separado)
├── start.ps1               Arranque manual (server + ngrok + 2 watchers), sin auto-recuperación
├── stop.ps1                 Apaga todo, sea como se haya iniciado
├── watchdog.ps1              Arranque supervisado (recomendado): auto-reinicia lo que se caiga
├── register-watchdog-task.ps1  Registra watchdog.ps1 en el Programador de tareas de Windows
├── current-url.txt          La URL pública activa ahora mismo (la actualiza el watchdog)
├── .env                      GROQ_API_KEY (no versionado, ver sección 9)
└── package.json
```

## 4. Túnel público: ngrok vs Cloudflare

Ninguno de los dos requiere pagar. La diferencia es la estabilidad de la URL:

- **ngrok con dominio fijo** (`identical-swarm-collector.ngrok-free.dev`, gratis, `--url` en el comando): la URL nunca cambia. **Bloqueado actualmente por Avast**, que intercepta el tráfico HTTPS con su propio certificado; ngrok directamente rechaza la conexión al detectarlo como un posible ataque de intermediario (esto es intencional de ngrok, no hay forma de "permitirlo" desde su lado). Requiere que el usuario desactive los escudos de Avast antes de levantar ngrok. Ver memoria de sesión para el detalle de qué se probó.
- **cloudflared, túnel anónimo** (`cloudflared tunnel --url http://localhost:4000`): no choca con Avast (usa QUIC/UDP, que Avast no intercepta), pero la URL es **aleatoria y cambia cada vez que se reinicia el proceso**. Es el que está en uso hoy.

El watchdog usa cloudflared y guarda la URL vigente en `current-url.txt` cada vez que la detecta.

Para tener una URL de Cloudflare que nunca cambie hace falta un dominio propio dado de alta en Cloudflare (`cloudflared tunnel create` + registro DNS) — no se hizo porque implica comprar un dominio.

## 5. Arranque y auto-recuperación (watchdog)

`watchdog.ps1` es un loop de PowerShell que:

1. Arranca `server.js`, `watch-claude.js`, `watch-gemini.js` y `cloudflared` en background.
2. Cada 20 segundos comprueba que los 4 sigan vivos (por PID) y reinicia el que se haya caído.
3. Cuando `cloudflared` arranca o se reinicia, lee su log, extrae la URL nueva (`https://algo.trycloudflare.com`) y la escribe en `current-url.txt`.

Está registrado como tarea programada de Windows (`TFTE-VoiceAssistant-Watchdog`, creada con `register-watchdog-task.ps1`) con disparador **"al iniciar sesión"** — corre tanto en un login local como en uno remoto (Escritorio Remoto de Chrome). El servicio `chromoting` (Escritorio Remoto de Chrome, modo "acceso remoto" con PIN) ya está instalado y en arranque automático, así que después de un reinicio de la PC:

1. Windows bootea a la pantalla de login (nadie logueado).
2. El servicio de Escritorio Remoto ya está escuchando desde ese momento.
3. Alguien se conecta remoto y entra con el PIN → eso cuenta como login → dispara la tarea programada → el watchdog levanta todo.
4. La URL nueva queda en `current-url.txt`.

`start.ps1`/`stop.ps1` siguen existiendo para arranque/apagado manual puntual (sin auto-recuperación); `stop.ps1` sabe apagar todo sea cual sea el método que lo levantó (watchdog o manual).

## 6. Protocolo de Modo Agente

Cuando el usuario activa el "Modo Agente" (mantener presionado el botón robot, elegir Claude o Gemini) y habla o escribe:

1. El cliente hace `POST /api/agente` con `{ message, backend, folder }`.
2. `server.js` valida `folder` (debe quedar dentro de `C:\TFTE`) y escribe `message` en `watcher/<backend>/instruccion.txt` y `folder` en `watcher/<backend>/alcance.txt`.
3. El watcher correspondiente (polling cada 1s sobre `instruccion.txt`) detecta el cambio y arranca el ciclo de dos fases:
   - **Interpretar** (`--mode plan`, no escribe nada): le pide al agente real que explore lo necesario y explique qué entendió, en español rioplatense y máximo 2 oraciones (se va a leer en voz alta). Escribe la respuesta en `respuesta.txt` y pasa `estado.json` a `esperando_confirmacion`.
   - **Ejecutar** (`--mode accept-edits`, si el usuario confirma con una palabra tipo "dale"/"sí"): ahí sí el agente modifica archivos de verdad. Al terminar, vuelve a `idle`.
4. Si `folder`/`alcance.txt` no está vacío, el agente corre con ese directorio como `cwd` real (no es solo una sugerencia en el prompt) — así se puede limitar el alcance a una subcarpeta en vez de todo `C:\TFTE`.
5. El cliente hace polling de `GET /api/agente/estado?backend=X` cada 1.5s hasta ver una `respuesta` nueva, la muestra y la lee en voz alta.
6. Si la pestaña se cierra/recarga mientras el agente está pensando, la respuesta queda escrita en el archivo igual — al volver a abrir la app, `retomarAgentePendiente()` chequea el estado al cargar y la muestra si quedó pendiente (antes se perdía en silencio).

Backend Gemini específicamente: a partir del segundo llamado dentro de la misma sesión del watcher, se agrega `--continue` al comando de `agy.exe`, así encadena contexto entre turnos en vez de arrancar en blanco cada vez (se pierde si se reinicia el watcher).

## 7. Cola de mensajes del cliente

`app.js` mantiene una cola FIFO (`messageQueue`) para que mandar un mensaje de voz y, mientras se espera la respuesta, mandar uno de texto (o viceversa) no pise ni descarte ninguno de los dos. Cada mensaje se procesa de a uno: se muestra el texto, se espera la respuesta completa (texto + audio terminado de sonar), y recién ahí arranca el siguiente.

## 8. Reconocimiento de voz (STT) — por qué es poco confiable y cómo se mitiga

El navegador usa la Web Speech API (`webkitSpeechRecognition`), que en iOS/iPadOS corre siempre sobre el motor de WebKit sin importar qué navegador se use (Safari, Chrome, etc. — Apple obliga a todos los navegadores de iOS a usar el mismo motor interno). Ese motor tiene dos comportamientos problemáticos que `app.js` compensa a mano:

- **Corta la sesión por su cuenta** aunque se pida `continuous: true`, a veces sin disparar ningún evento de error — simplemente deja de mandar resultados nuevos. Un "vigilante" (`startWatchdog`, intervalo cada 800ms) detecta cuánto hace que no llega un resultado: si pasan 3.6s asume que se colgó y reinicia solo (sin perder lo ya dicho); solo si pasan 4.5s completos sin ningún resultado nuevo asume silencio real y manda el mensaje. Tiene un tope de 3 reintentos seguidos sin progreso para nunca quedar trabado.
- **Reiniciar la sesión inmediatamente después de que corta** hace que iOS no llegue a soltar el micrófono a tiempo, y el indicador de permiso de micrófono queda parpadeando. Por eso hay una pausa de 300ms antes de cada reintento.

Como alternativa, existe el panel de texto (botón teclado) que salta el reconocimiento de voz por completo — útil cuando la precisión de la transcripción es mala.

## 9. Seguridad / secretos

- `.env` tiene `GROQ_API_KEY` (usada por el modo rápido, `/api/chat`, vía Groq/Llama). **No está en git** — este repo (`VoiceAssistant/.git`) es local, sin remote, así que no hay riesgo de subirlo a ningún lado por accidente, pero igual conviene no compartir este archivo.
- `ngrok.yml` (`%LOCALAPPDATA%\ngrok\ngrok.yml`) tiene el authtoken de la cuenta de ngrok del usuario.
- Ningún endpoint de este servidor tiene autenticación propia — quien tenga la URL del túnel tiene acceso completo, incluido Modo Agente (lectura/escritura de `C:\TFTE`). La "seguridad" hoy es que la URL no es públicamente descubrible (cloudflared) o requiere pasar por Avast (ngrok). No hay usuario/contraseña.

## 10. Dependencias externas y sus limitaciones conocidas

- **Groq** (`/api/chat`, modo rápido): modelo `llama-3.3-70b-versatile`, con herramientas de solo lectura (`list_dir`, `read_file`) sobre `C:\TFTE`.
- **msedge-tts** (`/api/tts`): conexión WebSocket no oficial al servicio de voz de Microsoft Edge (voz `es-AR-ElenaNeural`). Se reutiliza una única instancia entre pedidos (antes se creaba una nueva por pedido, agregando ~1s de reconexión a cada audio).
- **Claude Code CLI** (`claude`) y **Antigravity CLI** (`agy.exe`, en `%LOCALAPPDATA%\agy\bin\`): deben estar instalados y logueados en la cuenta del usuario en esta PC — el watcher los invoca como procesos hijos.
- **Avast Antivirus**: bloquea la conexión de ngrok (ver sección 4). No se tocó su configuración de forma unilateral en ningún momento; cualquier cambio ahí lo hizo el usuario a propósito.
