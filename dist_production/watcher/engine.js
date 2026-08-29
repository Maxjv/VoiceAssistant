const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
let currentChildProcess = null;
const POLL_MS = 1000;
// Aumentamos el timeout a 10 minutos para dar margen a cambios de código pesados
const TIMEOUT_MS = 900000;

function startWatcher(config) {
    if (!fs.existsSync(config.dir)) {
        fs.mkdirSync(config.dir, { recursive: true });
    }

    const INSTR_FILE = path.join(config.dir, 'instruccion.txt');
    const RESP_FILE = path.join(config.dir, 'respuesta.txt');
    const ESTADO_FILE = path.join(config.dir, 'estado.json');
    const ALCANCE_FILE = path.join(config.dir, 'alcance.txt');
    const HISTORIAL_FILE = path.join(config.dir, 'historial.txt');

    try { fs.writeFileSync(RESP_FILE, ''); } catch (e) { }
    try { fs.writeFileSync(INSTR_FILE, ''); } catch (e) { }
    try { fs.writeFileSync(ESTADO_FILE, JSON.stringify({ status: 'idle', pendingInstruction: null, pendingScopeDir: null })); } catch (e) { }

    let lastMtimeMs = 0;
    let estado = { status: 'idle', pendingInstruction: null, pendingScopeDir: null };

    function resolverScopeDir() {
        let alcance = '';
        try { alcance = fs.readFileSync(ALCANCE_FILE, 'utf-8').trim(); } catch (e) { }
        if (!alcance) return config.projectDir;
        const candidato = path.resolve(config.projectDir, alcance);
        if (!candidato.toLowerCase().startsWith(config.projectDir.toLowerCase())) {
            log('alcance fuera de projectDir, ignorado: ' + alcance);
            return config.projectDir;
        }
        return candidato;
    }

    function log(msg) {
        console.log(`[watcher:${config.backendName}] ${msg}`);
    }

    function writeEstado() {
        fs.writeFileSync(ESTADO_FILE, JSON.stringify(estado, null, 2), 'utf-8');
    }
    function writeRespuesta(texto) {
        fs.writeFileSync(RESP_FILE, texto, 'utf-8');
        appendHistorial('ASISTENTE', texto);
    }
    function appendHistorial(rol, texto) {
        const ts = new Date().toLocaleString('es-AR', { hour12: false });
        const linea = `[${ts}] ${rol}: ${(texto || '').replace(/\r?\n/g, ' ')}\n`;
        fs.appendFileSync(HISTORIAL_FILE, linea, 'utf-8');
    }

    function ejecutarComando(prompt, fase, scopeDir, cb) {
        const { cmd, args, opts, useStdin } = config.buildCommand(prompt, fase);
        const child = spawn(cmd, args, { cwd: scopeDir || config.projectDir, windowsHide: true, ...opts });
        currentChildProcess = child;

        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => child.kill(), TIMEOUT_MS);

        child.stdout.on('data', (d) => {
            process.stdout.write(d);
            stdout += d;
        });
        child.stderr.on('data', (d) => {
            process.stderr.write(d);
            stderr += d;
        });
        child.on('error', (err) => {
            clearTimeout(timer);
            log('error de proceso: ' + err.message);
            cb(null, err);
        });
        child.on('exit', (code) => {
            if (currentChildProcess === child) currentChildProcess = null;
            clearTimeout(timer);
            if (code !== 0) {
                log(`terminó con código ${code}: ${stderr.slice(0, 2000)}`);
                cb(null, new Error('Exit code ' + code + ' - ' + stderr.slice(0, 500)));
                return;
            }
            cb(stdout.trim(), null);
        });

        if (useStdin) {
            child.stdin.write(prompt);
            child.stdin.end();
        }
    }

    function procesarInstruccion(textoUsuario) {
        appendHistorial('USUARIO', textoUsuario);

        if (textoUsuario.trim().toLowerCase() === 'cancelar') {
            if (currentChildProcess) {
                currentChildProcess.kill();
                currentChildProcess = null;
            }
            exec('taskkill /F /IM agy.exe', () => { });
            estado = { status: 'idle', pendingInstruction: null, pendingScopeDir: null };
            writeEstado();
            writeRespuesta('Instrucción cancelada.');
            return;
        }

        if (estado.status === 'pensando' || estado.status === 'ejecutando') {
            log('ocupado, ignorando instrucción nueva por ahora.');
            return;
        }

        const scopeDir = resolverScopeDir();
        log('ejecutando directo: ' + textoUsuario);
        estado = { status: 'ejecutando', pendingInstruction: textoUsuario, pendingScopeDir: scopeDir };
        writeEstado();

        const alcanceTxt = scopeDir !== config.projectDir
            ? ` (limitate a la carpeta "${scopeDir}" y sus subcarpetas)`
            : '';

        const prompt = `INSTRUCCIÓN DEL USUARIO: "${textoUsuario}"

Sos Antigravity, un programador experto IA. Tu workspace actual es "${scopeDir}"${alcanceTxt}.

REGLAS ESTRICTAS DE EJECUCIÓN DIRECTA:
1. NO PIDAS PERMISO NUNCA. NO PREGUNTES "¿Lo hago?". Aplica los cambios en el código inmediatamente.
2. Si la instrucción es conversacional o una duda técnica, responde directamente sin modificar archivos.
3. Si la instrucción requiere modificar, crear o eliminar archivos, realiza los cambios y luego avisa que terminaste.
4. Tu respuesta final DEBE ser en español, extremadamente concisa (máximo 2 oraciones cortas) porque será leída por un sintetizador de voz. Resume lo que hiciste o responde la duda.`;

        log('Iniciando ejecución directa (accept-edits)...');
        // Ejecutamos directamente en modo accept-edits sin pasar por plan, para ahorrar el 50% del tiempo
        ejecutarComando(prompt, 'ejecutar', scopeDir, (respuesta, err) => {
            // Si fue cancelado forzosamente, el exit code será null. 
            // Ya escribimos "Instrucción cancelada." en la función de cancelar, así que evitamos sobreescribir.
            if (err && err.message.includes('Exit code null')) {
                return;
            }
            estado = { status: 'idle', pendingInstruction: null, pendingScopeDir: null };
            writeEstado();

            const textoFinal = err ? 'Hubo un error técnico con el Agente: ' + (err.message || err) : (respuesta || 'Listo, cambios aplicados.');
            writeRespuesta(textoFinal);

            log('terminado.');
        });
    }

    function chequear() {
        fs.stat(INSTR_FILE, (err, stats) => {
            if (err) return;
            if (stats.mtimeMs <= lastMtimeMs) return;
            lastMtimeMs = stats.mtimeMs;
            fs.readFile(INSTR_FILE, 'utf-8', (err2, contenido) => {
                if (err2) return;
                const texto = contenido.trim();
                if (texto) procesarInstruccion(texto);
            });
        });
    }

    if (!fs.existsSync(config.dir)) fs.mkdirSync(config.dir, { recursive: true });
    if (!fs.existsSync(INSTR_FILE)) fs.writeFileSync(INSTR_FILE, '', 'utf-8');
    if (!fs.existsSync(RESP_FILE)) fs.writeFileSync(RESP_FILE, '', 'utf-8');
    if (!fs.existsSync(ALCANCE_FILE)) fs.writeFileSync(ALCANCE_FILE, '', 'utf-8');
    if (!fs.existsSync(HISTORIAL_FILE)) fs.writeFileSync(HISTORIAL_FILE, '', 'utf-8');
    writeEstado();

    log('activo. Escuchando ' + INSTR_FILE);
    setInterval(chequear, POLL_MS);
}

module.exports = { startWatcher };