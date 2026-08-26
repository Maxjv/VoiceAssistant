# TFTE Voice Assistant — Guía de uso

Última actualización: 2026-08-11

## Qué es

Una app para entrar a TFTE desde el iPad (o cualquier dispositivo) sin estar en la misma red que la PC, y además hablarle o escribirle a un asistente que puede responderte, o directamente meterse en el código a hacer cambios reales si se lo pedís.

## Cómo entrar

Abrí la URL que te pasen (cambia cada vez que se reinicia el túnel — pedila si no la tenés a mano). Vas a ver tres partes:

- **Arriba/centro**: la app que estés viendo (el mockup de Control, la app real de TFTE, o la galería de imágenes).
- **Abajo**: una franja con botones.
- **Abajo a la derecha**: un robot, un micrófono grande, y un teclado — todos flotantes, siempre visibles.

## La franja de abajo

| Botón | Qué hace |
|---|---|
| **TFTE** (logo, arriba a la izquierda) | Solo decorativo, no hace nada. |
| **Control** | Muestra el mockup HTML de referencia del proyecto. |
| **TFTE** | Muestra la app real de TFTE (la de React), como si estuvieras en la compu. |
| **Imgs** | Galería navegable de las imágenes de referencia (`FrontImgs`) — carpetas y miniaturas, con lightbox al tocar una imagen. |
| 🔍➖ / **100%** / 🔍➕ | Zoom de la caja de arriba. Si algo se ve amontonado o no entra en la pantalla, achicá con el botón `-`. Queda guardado para la próxima vez que entres. |
| 💾 (guardar) | Solo tiene efecto en la vista "Control": activa el auto-guardado de ese documento. |
| 🔄 (recargar) | Recarga la vista actual. |
| ⛶ (pantalla completa) | Oculta las barras del navegador. |

## Hablarle al asistente (botón azul del micrófono)

1. Tocá el micrófono.
2. Hablá normal. Vas a ver el texto apareciendo en un cartel abajo a medida que te va escuchando.
3. Cuando dejes de hablar unos segundos, se corta solo y te contesta — en texto (el mismo cartel) y en voz.
4. Si te arrepentís a mitad de camino, tocá el micrófono de nuevo para cancelar sin mandar nada.

**Si la transcripción de voz falla seguido** (te entiende mal, corta antes de tiempo), usá el teclado en vez de pelearte con el micrófono — es más confiable.

## Escribir en vez de hablar (botón del teclado)

1. Tocá el ícono del teclado (al lado del micrófono).
2. Se abre un panel con un campo de texto y, arriba, un campo opcional de "Carpeta".
3. Escribí tu mensaje y tocá el botón de enviar (o Enter).

**El campo "Carpeta"** solo importa si tenés activado el Modo Agente (ver abajo): le decís al agente que se limite a trabajar en una carpeta puntual en vez de revisar todo el proyecto — por ejemplo `src/interface/apps/2mog/subapps`. Dejalo vacío para que trabaje sobre todo `C:\TFTE` como siempre.

**Podés mandar varios mensajes seguidos** (por voz o por texto, mezclados) sin esperar a que responda el anterior — se van a ir procesando y contestando uno por uno, en el orden en que los mandaste. No hace falta esperar.

## Modo Agente (el robot)

Esto es distinto al micrófono/teclado normal: en vez de un asistente rápido que solo puede leer y responder, prende un **agente de código real** (Claude o Gemini) que puede **modificar archivos de tu proyecto de verdad**.

- **Tocar** el robot: prende o apaga el Modo Agente.
- **Mantener presionado**: elegís si le hablás a Claude o a Gemini.

Cuando está activo, todo lo que hables o escribas va al agente, con este flujo:

1. Le pedís algo ("cambiame el color de tal botón", "agregame una carpeta con...", lo que sea).
2. El agente **primero explora tu proyecto para entender el pedido** — esto puede tardar bastante (segundos, a veces más de un minuto), no es instantáneo como el chat rápido.
3. Te explica en 1-2 oraciones qué entendió y te pregunta si lo hace.
4. Si le decís algo tipo "dale", "sí", "hacelo" → ejecuta el cambio de verdad.
5. Si le decís "no", "cancelá", "esperá" → no hace nada.
6. Si decís cualquier otra cosa que no sea ni sí ni no, lo toma como un pedido nuevo (descarta el anterior).

**Importante:** mientras el agente está pensando o ejecutando, podés cerrar la app o que se corte la conexión sin miedo — la respuesta te va a estar esperando la próxima vez que entres, no se pierde.

## Galería de imágenes (botón "Imgs")

Navegá las carpetas de `FrontImgs` como en un explorador de archivos, con miniaturas. Tocá una imagen para verla en grande; tocá afuera para cerrar.

## Problemas comunes

- **"No me entiende nada" hablando**: probá el teclado en vez del micrófono.
- **Algo se ve amontonado o cortado**: bajá el zoom con el botón `-`.
- **El robot no contesta nunca**: puede estar pensando (tarda de verdad en Modo Agente) — fijate el cartel de estado abajo, dice "pensando" o "ejecutando cambios" mientras trabaja.
- **La URL dejó de andar**: seguramente se reinició la PC o el túnel — pedí la URL nueva.
