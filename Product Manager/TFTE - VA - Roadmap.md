# Lista de Tareas: TFTE Voice Assistant (Go-to-Market & Finalización)

- `[x]` **EULA e Instalador**: Crear `licencia.txt` e integrarlo en el instalador `.iss` (Protección básica de propiedad intelectual).
- `[x]` **Documentación de Lanzamiento**: Crear `README.md` público detallando qué es, cómo usar la clave BYOK y el aviso de *SmartScreen* de Windows.
- `[ ]` **Landing Page / Web**: Crear una web minimalista (ej. en Vercel, Framer o HTML simple) con el titular, el video demostrativo y el botón de descarga.
- `[ ]` **Video "Aha! Moment"**: Grabar la pantalla (60-90 segundos) mostrando el uso real del asistente controlando el código/diseño localmente por voz. Este video irá en la Landing Page y en Product Hunt.
- `[ ]` **Plataforma de Descarga & Recolección de Emails**: Configurar el archivo `.exe` en una plataforma como Lemon Squeezy, Gumroad o Stripe Payment Links (a precio $0 inicial) para capturar el email de los usuarios interesados.
- `[x]` **Integración del Free Trial (Hardware ID)**:
  - Investigar e implementar la verificación de licencia por `Machine ID` usando Lemon Squeezy (o Keygen.sh) en el servidor Node.js.
  - Implementar la lógica en `server.js` para limitar el uso después de 14 días si la clave no es validada.
  - Actualizar `app.html`/`app.js` para mostrar el campo de "Ingresar Clave de Licencia" o el aviso de Trial caducado.
- `[ ]` **Lanzamiento Soft (Semana 2)**:
  - Publicar el repositorio (solo el README.md y los Releases del .exe) en GitHub de forma pública.
  - Compartir la herramienta en subreddits de nicho (ej. `r/LocalLLaMA`, `r/ChatGPTCoding`) pidiendo feedback inicial.
- `[ ]` **Lanzamiento Hard (Semana 3)**:
  - Preparar el post para *Hacker News* ("Show HN").
  - Configurar el lanzamiento oficial en *Product Hunt*.
- `[ ]` **Iteración de Compilador**: Volver a compilar el instalador `.exe` con Inno Setup una vez que las validaciones de licencia estén añadidas y comprobadas localmente.
