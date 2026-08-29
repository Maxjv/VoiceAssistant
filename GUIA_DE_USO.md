# TFTE Voice Assistant — Guía de Uso

Última actualización: 2026-08-29

## Qué es

Una aplicación revolucionaria para desarrollar y controlar tu proyecto desde el iPad (o cualquier dispositivo móvil) sin estar en la misma red que la PC. Te permite dictar o escribir instrucciones para que un Agente Inteligente las ejecute sobre el código de tu proyecto real, además de ofrecerte un entorno visual para diseñar componentes.

## 1. Instalación, Prueba Gratuita y Suscripción

1. **Prueba Gratis de 7 Días:** Al instalar el programa y ejecutarlo por primera vez en tu computadora, el sistema registra la huella digital única de tu hardware (HWID) y te otorga 7 días de acceso total sin costo.
2. **Expiración:** Pasados los 7 días, si intentas pedirle algo al asistente, te responderá que la licencia ha expirado. **Copiar la carpeta a otra PC no sirve**, ya que el hardware será distinto y el HWID cambiará, bloqueando el acceso.
3. **Suscripción Pro:** Cuando adquieras la licencia definitiva, el administrador del software agregará tu HWID a la base de datos maestra en la nube (Supabase).
4. **Activación Automática:** No necesitas meter ninguna clave. Apenas abras el Asistente de nuevo, se conectará a la nube, verá que tu HWID es VIP, y se desbloqueará de forma permanente al instante.

## 2. Cómo Entrar desde tu iPad

1. Tras encender la PC e iniciar el software, recibirás automáticamente un **correo electrónico** con un enlace temporal seguro de Cloudflare (ej. `https://palabras-al-azar.trycloudflare.com`).
2. Toca ese enlace desde tu iPad.
3. Verás la interfaz dividida en:
   - **Arriba:** El lienzo principal (Tablero de Control, tu aplicación React o la Galería).
   - **Abajo:** Barra inferior con la cola de **Próximas Tareas** y botones de acceso rápido.
   - **Flotante:** Botón del micrófono azul y acceso al Agente (robot).

## 3. Tablero de Control y Tareas (Nuevo)

Al presionar el botón **Control**, accederás a un constructor visual de tu aplicación:
1. **La Paleta Izquierda:** Encontrarás componentes como *Screen*, *Card*, *Modal*, etc. Arrástralos hacia el lienzo del medio.
2. **Dictado y Guardado Mágico:** Cada tarjeta que arrastres tiene una cajita para escribir una instrucción. Puedes tocar el mini-micrófono adentro de la tarjeta para dictarla. **No hay botón de guardar:** apenas tocas afuera de la caja, todo se guarda solo en tu disco duro.
3. **La Cola de Tareas:** Si prestas atención a la barra inferior ("Próximas Tareas"), verás que cada instrucción que escribiste en el lienzo mágico aparece listada abajo automáticamente.
4. **Ejecutar Tareas:** Toca el botón azul de "Enviar" al lado de una tarea para que el asistente de IA se ponga a programar esa instrucción por ti.

## 4. Hablarle al Asistente (Botón azul)

1. Toca el micrófono azul grande y habla normalmente.
2. Un algoritmo inteligente filtrará tus pausas. Si dejas de hablar por 2 segundos, cortará solo.
3. Tu voz se transcribe de forma ultra-precisa usando Whisper. Durante 3.5 segundos verás un cartel amarillo con tu texto y una **X roja**.
4. Si Whisper entendió mal o te arrepentiste, toca la X roja antes de que acabe el tiempo y se cancela. Si dejas que el tiempo pase, la orden viaja directo al código de tu programa.
5. El asistente te responderá *con voz humana* al terminar.

## 5. Modo Agente (El Robot Constructor)

A diferencia del micrófono rápido, el **Modo Agente** enciende un ingeniero de software real (Gemini o Claude) que entra a los archivos de tu proyecto y los modifica:

1. **Seguridad y Confirmación:** Si el Agente necesita modificar, borrar o crear un archivo, **siempre se va a pausar**. Te dirá: "Voy a modificar app.js para poner el botón rojo, ¿procedo?". Debes tocar el micrófono y decirle "Dale", "Sí", o escribirlo en el teclado para que te obedezca.
2. **A prueba de fallos:** Mientras el Agente "piensa" (puede tardar un minuto revisando archivos), puedes apagar la pantalla del iPad. El servidor en tu PC seguirá trabajando y te mostrará el resultado cuando vuelvas a entrar.

## 6. GitHub en Piloto Automático

En la barra de herramientas verás un ícono de una nube de GitHub. Si marcas la casilla "Auto", el sistema vigilará tu proyecto. Cuando termines de guardar cambios y dejes el teclado quieto por 10 segundos, el sistema subirá automáticamente una copia de seguridad perfecta a tu repositorio privado.
