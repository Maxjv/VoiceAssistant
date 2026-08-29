require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { startWatcher } = require('./engine');

// Antes probamos --continue acá como con Gemini, pero es peligroso: significa
// "continuá la conversación MÁS RECIENTE EN ESTE DIRECTORIO", y C:\TFTE es el
// mismo directorio donde corren otras sesiones de Claude Code (por ejemplo,
// la sesión interactiva del usuario) -- se enganchó con una conversación
// ajena y tardó mucho más de lo normal devolviendo algo sin sentido.
//
// En vez de eso: una sesión con ID FIJO y propio del watcher, guardado en un
// archivo. --session-id <uuid> la crea la primera vez; --resume <uuid> la
// retoma después, apuntando siempre a ESA sesión puntual -- nunca puede
// cruzarse con ninguna otra porque el ID lo elegimos nosotros. Además
// sobrevive a un reinicio del watcher (--continue no lo hacía).
const SESSION_ID_FILE = path.join(__dirname, 'claude', 'session-id.txt');

function getOrCreateSessionId() {
    try {
        const existing = fs.readFileSync(SESSION_ID_FILE, 'utf-8').trim();
        if (existing) return { id: existing, isNew: false };
    } catch (e) { /* todavía no existe */ }
    const id = crypto.randomUUID();
    fs.writeFileSync(SESSION_ID_FILE, id, 'utf-8');
    return { id, isNew: true };
}

startWatcher({
    backendName: 'claude',
    dir: path.join(__dirname, 'claude'),
    projectDir: process.env.CONTEXT_PATH || process.env.PROJECT_ROOT || 'C:\\TFTE',
    buildCommand: (prompt, fase) => {
        const { id, isNew } = getOrCreateSessionId();
        const args = [
            '-y',
            '-p', prompt,
            '--model', process.env.MODEL || 'claude-3-5-sonnet-20241022',
            '--output-format', 'text',
            '--mode', fase === 'interpretar' ? 'plan' : 'accept-edits',
        ];
        args.push(isNew ? '--session-id' : '--resume', id);
        return {
            cmd: 'claude',
            args,
            // "claude" es un .cmd en Windows -> hace falta shell:true para poder lanzarlo.
            // El prompt va por stdin (no por argv) para que cmd.exe no le rompa
            // comillas/dos puntos/saltos de línea al re-parsear la línea de comando.
            opts: { shell: true },
            useStdin: true,
        };
    },
});
