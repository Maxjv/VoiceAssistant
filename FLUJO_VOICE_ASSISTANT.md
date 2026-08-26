# Flujo de Procesos: TFTE Voice Assistant

Este documento describe detalladamente la secuencia de eventos, interacciones de usuario y procesamiento de datos que ocurren en la aplicación TFTE Voice Assistant, desde el momento en que se ingresa a la URL hasta que el asistente responde con voz.

## 1. Carga Inicial, Persistencia y Contexto

1. **Ingreso a la URL:** El usuario accede a la URL (ej. `http://localhost:4000/` o mediante un túnel como Cloudflare o Ngrok).
2. **Servidor Express:** El archivo `server.js` intercepta la petición y sirve la interfaz principal (`app.html`), junto con la lógica del lado del cliente (`app.js`).
3. **Persistencia de Sesión (F5 Inteligente):** Al cargar, el sistema lee `localStorage` (`tfte_session_active`). Si es la primera vez que se ingresa, se muestra un Modal oscuro gigante. Si el usuario ya había iniciado sesión y recargó la página (F5), se saltea este paso para no volver a enviar el contexto, ahorrando créditos de la API (tokens) y reanudando la conversación (`--continue`) de inmediato.
4. **Vinculación (Primer Inicio):** Al hacer clic en "Cargar Contexto", se vincula al Agente (Gemini Pro High) y se desbloquea el subsistema de audio de iOS (TTS).
5. **Reseteo de Sesión:** Si el usuario desea purgar el historial y comenzar una sesión en blanco con el Agente, puede abrir el Repositorio de Tareas y utilizar el botón "Limpiar Historial" (Tacho de basura), lo cual purga la sesión y vuelve a requerir la carga del contexto.

## 2. Interfaz de Usuario (UI) y Controles Principales

La interfaz está diseñada para ser un overlay sobre la aplicación en desarrollo (ej. React) cargada mediante un `iframe` central.

*   **Botón de Micrófono (`micBtn`):** Control principal para iniciar/detener la captura de voz.
*   **Botón de Teclado (`keyboardBtn`):** Despliega un panel lateral (`textPanel`) para escribir instrucciones manualmente.
*   **Botón de Repetir (`lastMessageBtn`):** Vuelve a reproducir por audio la última respuesta del asistente.
*   **Repositorio de Tareas:** Panel que registra el historial de las acciones ejecutadas. Posee un "Backdrop" (capa invisible) que permite que se cierre automáticamente al tocar fuera del panel (incluso sobre el iframe).

## 3. Captura de Audio, Transcripción y Cola (Whisper)

1. **Interacción y Grabación:** El usuario toca el Micrófono. Comienza a grabar usando `MediaRecorder` mientras el motor de voz escucha. La interfaz muestra "Escuchando...".
2. **Corte Rápido (Silence Timeout):** Si el usuario deja de hablar por **2 segundos**, la grabación se corta automáticamente para acelerar la interacción (el motor detecta silencio real). También puede cortarse forzadamente con otro toque manual al botón.
3. **Operación Silenciosa (Whisper):** El audio crudo (Blob) va al servidor (`POST /api/transcribe`) y se deriva al modelo Whisper. No se despliegan ventanas de edición invasivas; Whisper corrige el texto en segundo plano y muestra directamente el resultado final y perfecto en la interfaz inferior (etiqueta del globo).
4. **Cola de Retención (Delay de Cancelación):** El mensaje transcrito NO se envía instantáneamente al agente. Se introduce en una **cola de 3.5 segundos**. 
5. **Botón Abortar (Cruz Roja ❌):** Durante esos 3.5 segundos, el usuario tiene tiempo de leer lo que Whisper tradujo. Si hay un error, puede tocar la **"X" roja** junto al mensaje para abortarlo, sacarlo de la cola y evitar que el Agente se ponga a trabajar en algo erróneo. Incluso si el Agente ya empezó a pensar, la "X" roja inyecta un comando de aborto al CLI.

## 4. Procesamiento del Agente y Lógica [REQUIERE_CONFIRMACION]

1. **Delegación al Watcher:** Si el mensaje supera la cola de los 3.5s, se envía al servidor mediante `POST /api/agente` y es atrapado por el *Watcher* (ej. `engine.js` + `watch-gemini.js`).
2. **Inyección en el CLI (Antigravity):** El mensaje va al motor subyacente. El Frontend hace *polling* constante para mostrar "Pensando..." o "Ejecutando...".
3. **Detección Conversacional vs Modificación:** 
    *   **Conversaciones (Por defecto):** Si el usuario hace una simple pregunta ("¿Quién eres?", "¿Cómo funciona esto?"), el Agente responde naturalmente. El backend lo detecta y asume un estado `idle`, sin molestar al usuario con pedidos de confirmación innecesarios.
    *   **Modificaciones Estrictas:** Si (y solo si) el agente decide que va a MODIFICAR, ELIMINAR o CREAR archivos, está entrenado mediante inyección de *System Prompt* para colocar obligatoriamente la etiqueta `[REQUIERE_CONFIRMACION]` al final de su plan de 2 oraciones.
4. **Pausa y Confirmación:** Al detectar la etiqueta `[REQUIERE_CONFIRMACION]`, el backend entra en pausa (`esperando_confirmacion`). El usuario debe responder "Sí", "Dale", "Procedé" (ya sea por voz o texto) para autorizar los cambios en `C:\TFTE`.

## 5. Contestación y Síntesis de Voz (Texto a Audio)

1. **Resumen y Presentación:** El Agente devuelve su reporte final.
2. **Generación de Voz (TTS):** Se invoca `playAgentAudio()`. Como se usa la API de Windows/Browser nativa (`window.speechSynthesis`) es completamente instantánea (sin demoras). Si se utiliza un motor en la nube (como OpenAI TTS/Google), requeriría generar un MP3 pero daría voces humanas realistas.
3. **Interrupción (Barge-in / Corte):** Si mientras la IA está hablando el usuario toca la cruz roja "X" del globo, o interactúa con el botón de micrófono, el audio de síntesis se corta inmediatamente para no entorpecer el flujo de trabajo.

## 6. Boton Nube Github
¿Cómo funciona todo esto ahora y por qué actualiza el Puerto 3000?
A partir de que guardes y recargues la web, la herramienta tiene dos "cerebros":

El flujo de conexión inicial (La primera vez):
Cuando un usuario nuevo haga clic en la nube, el frontend (app.js) detectará que no hay configuración previa. Le pedirá un Token de GitHub y un nombre. Esto se envía a server.js (/api/git-init). El servidor usa la API oficial de GitHub para crear un repositorio privado real. Luego, se mete literalmente en la carpeta del puerto 3000 (gracias a que le pasamos la instrucción { cwd: ROOT_DIR }, donde ROOT_DIR es tu proyecto de React, no el asistente), inicializa Git ahí adentro, lo conecta con el repositorio recién creado en la nube y sube todo el código.

El flujo del día a día (Las veces siguientes):
Una vez vinculado, la herramienta se acuerda. Si tocas la nube manualmente, simplemente ejecuta un commit y un push apuntando nuevamente a { cwd: ROOT_DIR } (tu proyecto React).

El Piloto Automático (La casilla "Auto"):
Si marcas la casilla de "Auto", el frontend empieza a escuchar a tu radar de archivos (/api/live-reload). Cada vez que en Antigravity IDE presionas Ctrl+S (editando ComparePlayersBI.js u otro), el radar recarga el iframe y arranca una cuenta regresiva invisible de 10 segundos (la nube se pone color naranja). Si sigues programando y vuelves a guardar en el segundo 8, la cuenta se reinicia a 10. Cuando por fin dejas de guardar por 10 segundos seguidos, la cuenta llega a 0 y dispara sola un "clic" en la nube. Todo