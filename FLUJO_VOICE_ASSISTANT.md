# Flujo de Procesos: TFTE Voice Assistant

Este documento describe detalladamente la secuencia de eventos, arquitectura de licenciamiento, interacciones de usuario y procesamiento de datos que ocurren en la aplicación TFTE Voice Assistant, desde su instalación hasta la ejecución de instrucciones por voz.

## 1. Arranque, Licenciamiento y Anti-Piratería (DRM)

1. **Instalación (`.exe`):** El usuario instala el software. Durante la instalación, Inno Setup solicita el correo electrónico del usuario y lo inyecta dinámicamente en el archivo `.env`. No se realizan validaciones de licencia en esta etapa para evitar falsificaciones al clonar la carpeta.
2. **Ejecución y Generación de HWID:** Al iniciar el servidor Node.js (`server.js`), el sistema obtiene la Dirección MAC nativa de la máquina (usando `os.networkInterfaces()`) y genera un Hash único (HWID).
3. **Validación Nube vs Local:** 
   - El sistema hace una petición silenciosa a la base de datos **Supabase** (Servidor Madre) preguntando: *"¿Este HWID tiene `is_active = TRUE`?"*.
   - Si la respuesta es **SÍ**, el Asistente se desbloquea en modo "Premium" permanente.
   - Si la respuesta es **NO** (o no hay internet), el sistema recurre al archivo local `.tfte_license.json`. Si es la primera vez que se abre, inicia un **Free Trial de 7 días** asociado a ese HWID. Si pasaron los 7 días, el servidor bloquea todas las peticiones a la IA y muestra un mensaje de "Licencia Expirada".

## 2. Auto-Túnel y Notificación por Correo

1. **Túnel Resiliente:** Un script en segundo plano (`watchdog.ps1` o `tunnel_monitor.ps1`) garantiza que `cloudflared.exe` esté siempre corriendo. Si Cloudflare se cae, el script lo reinicia automáticamente.
2. **Extracción de URL:** El sistema escanea los logs de Cloudflare en tiempo real para atrapar la nueva URL pública (ej. `https://random-words.trycloudflare.com`).
3. **Envío de Email (Nodemailer):** Una vez obtenida la nueva URL, el servidor utiliza las credenciales corporativas y el correo del cliente (guardado en el `.env`) para enviarle un correo automático diciendo: *"Tu asistente está listo. Accede desde tu iPad aquí: [URL]"*.

## 3. Interfaz de Usuario (UI) y Tablero de Control

El frontend principal (`app.html`) se sirve desde el servidor local. 
1. **Doble Cerebro:** El panel superior muestra un `iframe` que puede alternar entre la aplicación en desarrollo (ej. React en puerto 3000) o el **Tablero de Control** (`Project_Control.html`).
2. **Tablero Dinámico:** En el Tablero de Control, el usuario puede arrastrar componentes (Screens, Cards, Modales) desde una paleta izquierda de 140px. Cada componente permite dictar o escribir instrucciones específicas.
3. **Guardado Invisible:** Al hacer clic fuera de cualquier cuadro de texto o al terminar de dictar por voz, el tablero se guarda silenciosamente en el disco duro del cliente mediante un POST al servidor, sin botones de "Guardar".
4. **Cola de Tareas Centralizada:** Todo lo que se escriba en el Tablero de Control, junto con el archivo de Next Steps antiguo, se consolida mágicamente en la pestaña inferior **"Próximas Tareas"**. Esto permite enviar las tareas a la IA con un solo clic.

## 4. Captura de Audio, Transcripción (Whisper) y Live Reload

1. **Interacción y Grabación:** El usuario toca el Micrófono (`micBtn`). Se graba usando `MediaRecorder`.
2. **Corte Rápido (Silence Timeout):** Si hay 2 segundos de silencio absoluto, el audio se corta solo.
3. **Operación Silenciosa (Whisper):** El audio crudo va a `/api/transcribe`. Se utiliza Whisper para una corrección gramatical perfecta en segundo plano.
4. **Cola de Retención (3.5s):** El texto transcrito se muestra en la pantalla durante 3.5 segundos, permitiendo al usuario cancelarlo con una "X" roja antes de que llegue a la IA.
5. **Live Reload Transparente:** Si la IA o el usuario modifican el código de la app, el frontend hace un "Double Buffering" del iframe (intercambio de opacidad) para recargar la vista sin pantallazos blancos, manteniendo el estado de navegación activo guardado en `sessionStorage`.

## 5. El Agente Inteligente (Antigravity) y Confirmaciones

1. **Modo Conversacional vs Modificación:** Si el usuario hace una pregunta, la IA responde y habla mediante `window.speechSynthesis` (instantáneo).
2. **Confirmaciones Restrictivas:** Si la IA planea modificar, crear o eliminar un archivo, su *System Prompt* la obliga a inyectar la etiqueta `[REQUIERE_CONFIRMACION]`. El backend entra en pausa y el usuario debe autorizar ("Sí", "Dale") para que los cambios se efectúen en el disco duro.
3. **Integración Git Automatizada:** Tras 10 segundos de inactividad luego de guardar archivos, el sistema dispara automáticamente un commit y un push al repositorio privado de GitHub del cliente, manteniendo un backup constante y silencioso.