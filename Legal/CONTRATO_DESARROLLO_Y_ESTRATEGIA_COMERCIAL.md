# TFTE Voice Assistant — Contrato de Desarrollo y Estrategia Comercial

Última actualización: 2026-08-11
Titular del producto: Maxi Vargas (maxjvargas@gmail.com)

> **Nota importante antes de leer esto:** este documento lo redactó una IA (Claude) a pedido tuyo, para que tengas un marco claro y accionable. **No es asesoramiento legal formal.** Antes de usarlo con usuarios reales de pago (aunque sea €5/mes), pasalo por un gestor/abogado — sobre todo la parte de responsabilidad, porque el producto ejecuta cambios reales de código en la máquina del usuario. Es barato hacerlo una vez al principio; es caro no haberlo hecho si algo sale mal.

---

## 1. Objeto de este documento

Dos cosas en un solo lugar:

1. **Contrato de desarrollo**: quién es dueño de qué, bajo qué términos se usa el software, y qué responsabilidad asume cada parte (vos como desarrollador, el usuario que lo instala).
2. **Estrategia de comercio**: cómo pasar de "0 usuarios" a "gente paga una suscripción", con los pasos concretos y en qué orden.

Se apoya en los dos documentos que ya tenías (`TFTE Voice Assistant - Business Scenarios.md` y `TFTE Voice Assistant - Competitive Analysis.md`), los junta, y agrega las precondiciones técnicas que faltaban antes de poder publicar esto de verdad.

---

## 2. Qué es el producto (y qué NO es, esto importa legalmente)

**TFTE Voice Assistant** es una aplicación que se **instala y corre en la PC de cada usuario**, no un servicio central al que todos se conectan. Cada instalación:

- Usa la **propia carpeta de proyecto** que el usuario elige (no `C:\TFTE`, eso era solo tu instalación personal).
- Usa la **propia API key de Groq** del usuario (gratis, se saca en groq.com en 2 minutos).
- Usa **su propia sesión logueada** de Claude Code CLI o Antigravity/Gemini CLI para el Modo Agente.
- Se expone a internet con **su propio túnel** (ngrok/Cloudflare gratis) si quiere acceder desde el celular/iPad.

**Por qué esto es la decisión correcta y no un capricho técnico:** si en cambio publicás una única URL donde cualquiera se conecta a un servidor central tuyo, ese servidor tendría que ejecutar el Modo Agente con TU clave de Groq y TU sesión de Claude/Gemini logueada — es decir, cualquier desconocido con el link podría gastar tu cuota, leer o escribir código con tu cuenta, sin ningún login de por medio (hoy el servidor no tiene autenticación). Eso no es "lanzar rápido", es un agujero de seguridad real. El modelo de instalación local resuelve esto solo: cada uno usa lo suyo.

**Consecuencia legal:** vos distribuís software, no operás un servicio. Eso reduce mucho tu responsabilidad respecto de lo que un usuario haga con su propia instalación (como cualquier editor de código o CLI que se descarga). Seguís siendo responsable de que el software haga lo que dice que hace y no tenga puertas traseras — no de lo que el usuario decida pedirle a su propio agente.

---

## 3. Propiedad intelectual

- Vos (Maxi Vargas) sos el único titular del código, marca ("TFTE Voice Assistant") y todo el contenido de este repositorio.
- El código se publica en tu cuenta de GitHub (`github.com/Maxjv/tfte`) por razones de distribución (para que la gente lo pueda descargar/clonar), **no** implica que renunciás a la titularidad. Recomendación: agregar un archivo `LICENSE` explícito — el más simple para tu caso es una licencia "source-available" tipo *"código visible, uso personal permitido, uso comercial de terceros (revenderlo, ofrecerlo como servicio) requiere tu autorización escrita"*. Esto es distinto de una licencia MIT/Apache totalmente abierta, que sí permitiría a cualquiera revenderlo compitiendo con vos.
- Cualquier contribución externa (si alguien manda una mejora por GitHub) te cede los derechos a vos por default, salvo que digas lo contrario — esto también conviene dejarlo escrito en el `LICENSE` o un `CONTRIBUTING.md` el día que pase.

---

## 4. Modelo de acceso: Gratis → Pro

Basado en la Fase 1 de tu propio documento de escenarios financieros, pero con el límite técnico bien definido (antes decía "gratis" sin más detalle — así es más fácil de vender después):

| | **Free** | **Pro** (futuro, todavía no construido) |
|---|---|---|
| Instalación local + túnel propio | ✅ | ✅ |
| Chat rápido de solo lectura (botón micrófono/teclado) | ✅ | ✅ |
| Modo Agente (Claude/Gemini, lectura y escritura) | ✅, con tu propio login de Claude/Gemini | ✅ |
| URL fija que nunca cambia (sin pelear con ngrok/Avast) | ❌ (hoy depende de cloudflared, URL random) | ✅ — este es el gancho de pago #1 |
| Backups automáticos antes de cada cambio del agente | ❌ | ✅ — gancho de pago #2 |
| Setup en un solo click (sin tocar PowerShell) | Parcial (instalador incluido en `Production/installer/`) | ✅ instalador firmado + auto-actualización |
| Soporte / ayuda para configurarlo | Comunidad / lo que puedas dar vos | Prioritario |

**El gancho real no es "features ocultas"**, es fricción: la versión gratis funciona pero tenés que lidiar con túneles inestables y configurarlo vos mismo. La versión paga elimina esa fricción. Es exactamente el mismo patrón que usa Omnara (tu competencia directa, ver Competitive Analysis) con su "Cloud Handoff".

---

## 5. Términos de uso (resumen para el usuario final)

Esto es lo que le mostrás al usuario antes de que instale (va también en la landing page):

1. El software corre en tu propia PC y accede a la carpeta de proyecto que vos elijas. Vos sos responsable de lo que le pidas al agente que haga.
2. El Modo Agente puede **modificar y borrar archivos reales** de tu proyecto. Se pide confirmación antes de ejecutar, pero una vez confirmado, el cambio es real. Se recomienda usar control de versiones (Git) en cualquier proyecto donde lo uses, para poder deshacer cambios.
3. Necesitás tus propias cuentas: Groq (gratis) para el chat rápido, y Claude Code / Antigravity ya logueados en tu máquina para el Modo Agente.
4. Si exponés el servidor a internet con un túnel, **cualquiera que tenga esa URL tiene acceso completo** (no hay usuario/contraseña en la versión actual). No compartas la URL públicamente.
5. El software se entrega "tal cual" (as-is), sin garantía de disponibilidad ni de que el resultado del agente sea siempre correcto.

---

## 6. Estrategia comercial: las 3 fases (resumen accionable)

Tus dos documentos ya tenían esto bien pensado — acá está condensado en algo que podés ejecutar sin perderte:

### Fase 1 — Validación (mes 1-3, ~€5/mes de costo)
- [ ] Publicar el repo y la landing page.
- [ ] Postear en LinkedIn (texto ya armado en `landing/index.html`, sección de instrucciones).
- [ ] Conseguir 10-20 beta testers.
- [ ] Medir: ¿lo instalan? ¿vuelven a usarlo? ¿qué piden?
- **No cobrás nada en esta fase.**

### Fase 2 — Arranque (mes 4-8)
- [ ] Con el feedback de la Fase 1, decidís si el dolor real es "URL inestable" (→ construís el plan Pro con túnel fijo hosteado por vos) o resulta que la gente quiere otra cosa (→ pivotás sin haber gastado meses).
- [ ] Con 5 usuarios pagando €10/mes ya cubrís los costos fijos (ver tabla de breakeven en el documento original).
- [ ] Stripe para cobrar.

### Fase 3 — Escala (mes 12+)
- [ ] Solo si la Fase 2 mostró tracción real. No hay que apurar esto.
- [ ] Acá es donde entra la posibilidad de pivotar a nicho ("Asistente de Voz para Gestión Deportiva", como sugería tu Competitive Analysis) si el mercado genérico de coding assistants por voz resulta muy cuesta arriba contra Omnara.

**Decisión de secuencia (mía, no hace falta que la valides):** construir la app móvil nativa (Android/iOS) **no entra en la Fase 1**. Hoy el acceso por navegador ya cubre el 90% del caso de uso (iPad, celular, cualquier dispositivo con navegador) sin pedir permisos de instalación ni pasar por una tienda de apps. Construir una app nativa antes de saber si hay 10 personas interesadas sería semanas de trabajo sin validar nada primero. Queda documentado como Fase 4 más abajo.

---

## 7. Precondiciones técnicas antes de anunciar en LinkedIn (importante)

Esto es lo único que te pido que confirmes vos, porque no es una decisión técnica sino de qué tan público lo hacés:

- **El repo `github.com/Maxjv/tfte` contiene también tu producto principal de TFTE** (la plataforma de scouting de fútbol) además de VoiceAssistant. Si hacés público ese repo para que la gente descargue VoiceAssistant, también hacés pública la otra app. Mi recomendación (ya aplicada en lo que armé): **la carpeta `Production/` está pensada para poder distribuirse aparte** — como Release de GitHub o como ZIP descargable — sin depender de que todo el repo `tfte` sea público. Vos decidís cuándo (o si) hacer público el repo completo; yo no voy a cambiar la visibilidad del repo por mi cuenta.
- El servidor no tiene autenticación propia todavía (ver Sección 5, punto 4). Para uso personal / beta con gente de confianza está bien. Si esto escala a cientos de instalaciones expuestas a internet sin contraseña, es cuestión de tiempo hasta que alguien la use mal — no es un bloqueante para lanzar la Fase 1 (cada usuario decide si expone su túnel), pero si en algún momento volvés a un modelo de servidor central compartido, ahí sí es un bloqueante real y hay que resolverlo antes.

---

## 8. Roadmap de plataformas

| Plataforma | Estado |
|---|---|
| Navegador (PWA, cualquier dispositivo) | ✅ Ya funciona hoy |
| Windows (instalador de escritorio) | ✅ Armado en `Production/installer/` |
| Android | 🔜 Fase 4 — Trusted Web Activity (envolver la PWA actual) es el camino más corto, no hace falta reescribir nada |
| iOS / Apple | 🔜 Fase 4 o más adelante — requiere cuenta de Apple Developer (€99/año) y pasar la revisión de App Store, que es más estricta con apps que ejecutan cambios de código arbitrarios. Se evalúa cuando haya usuarios reales pidiéndolo. |

---

## 9. Disclaimer final

Este documento fue generado para darte estructura y velocidad, no para reemplazar a un profesional. Los puntos donde SÍ conviene una revisión humana antes de cobrar dinero de verdad:
- Los términos de uso (Sección 5) como documento legal formal (Términos y Condiciones + Política de Privacidad).
- La licencia de software (Sección 3) si te preocupa que alguien clone y revenda tu trabajo.
- Alta como autónomo/sociedad cuando llegues a los umbrales de la Sección 6 (ya estaba bien identificado en tu documento original de escenarios financieros).
