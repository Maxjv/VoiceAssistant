const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');
// dotenv config moved down
const path = require('path');
const fs = require('fs');
const os = require('os');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const { exec } = require('child_process');

// RUTA BASE REAL (Para escribir archivos: .env, watcher, etc.)
const BASE_DIR = process.pkg ? path.dirname(process.execPath) : process.cwd();

require('dotenv').config({ path: path.join(BASE_DIR, '.env') });

const TTS_VOICE = 'es-AR-ElenaNeural';

const app = express();
const port = process.env.PORT || 4000;

// --- INICIO MIDDLEWARE DE SEGURIDAD MODERNO (Con pantalla de Login visual) ---
const ACCESS_PIN = process.env.ACCESS_PIN || '1234';

function parseCookies(req) {
    const list = {};
    const rc = req.headers.cookie;
    if (rc) {
        rc.split(';').forEach(cookie => {
            const parts = cookie.split('=');
            list[parts.shift().trim()] = decodeURI(parts.join('='));
        });
    }
    return list;
}

app.use(express.urlencoded({ extended: true }));
app.post('/api/login', (req, res) => {
    const { pin } = req.body;
    if (pin === ACCESS_PIN) {
        res.setHeader('Set-Cookie', `tfte_session=${ACCESS_PIN}; Path=/; Max-Age=2592000; HttpOnly`);
        return res.redirect('/');
    }
    res.send(`
        <script>
            alert('PIN incorrecto. Inténtalo de nuevo.');
            window.location.href = '/';
        </script>
    `);
});

app.use((req, res, next) => {
    if (req.path === '/api/login') return next();

    const cookies = parseCookies(req);
    if (cookies.tfte_session === ACCESS_PIN) {
        return next();
    }

    res.status(401).send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>TFTE - Sincronización</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    background-color: #0f172a;
                    color: #f8fafc;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                }
                .sync-card {
                    background: #1e293b;
                    padding: 2.5rem;
                    border-radius: 1rem;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
                    width: 100%;
                    max-width: 380px;
                    text-align: center;
                }
                h2 { margin-bottom: 0.5rem; color: #38bdf8; }
                p { color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem; }
                .keypad-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 10px;
                    margin-bottom: 1.5rem;
                }
                .key-btn {
                    background: #334155;
                    color: white;
                    border: none;
                    padding: 15px;
                    font-size: 1.25rem;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                .key-btn:hover { background: #475569; }
                .key-btn:active { background: #38bdf8; color: #0f172a; }
                .display-box {
                    background: #0f172a;
                    border: 1px solid #334155;
                    border-radius: 8px;
                    padding: 15px;
                    font-size: 1.5rem;
                    letter-spacing: 0.5rem;
                    margin-bottom: 1.5rem;
                    min-height: 28px;
                    color: #38bdf8;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                .action-btn {
                    width: 100%;
                    padding: 0.75rem;
                    border-radius: 0.5rem;
                    border: none;
                    background: #38bdf8;
                    color: #0f172a;
                    font-weight: bold;
                    font-size: 1rem;
                    cursor: pointer;
                }
                .action-btn:hover { background: #0ea5e9; }
            </style>
        </head>
        <body>
            <div class="sync-card">
                <h2>TFTE Assistant</h2>
                <p>Verificación de Instancia</p>
                <div class="display-box" id="pinDisplay"></div>
                <div class="keypad-grid">
                    <button class="key-btn" onclick="addNum(1)">1</button>
                    <button class="key-btn" onclick="addNum(2)">2</button>
                    <button class="key-btn" onclick="addNum(3)">3</button>
                    <button class="key-btn" onclick="addNum(4)">4</button>
                    <button class="key-btn" onclick="addNum(5)">5</button>
                    <button class="key-btn" onclick="addNum(6)">6</button>
                    <button class="key-btn" onclick="addNum(7)">7</button>
                    <button class="key-btn" onclick="addNum(8)">8</button>
                    <button class="key-btn" onclick="addNum(9)">9</button>
                    <button class="key-btn" style="background:#ef4444;" onclick="clearNum()">C</button>
                    <button class="key-btn" onclick="addNum(0)">0</button>
                    <button class="key-btn" style="background:#10b981;" onclick="submitPin()">OK</button>
                </div>
            </div>
            <script>
                let currentPin = '';
                const display = document.getElementById('pinDisplay');
                
                function addNum(n) {
                    if (currentPin.length < 8) {
                        currentPin += n;
                        updateDisplay();
                    }
                }
                
                function clearNum() {
                    currentPin = '';
                    updateDisplay();
                }
                
                function updateDisplay() {
                    display.textContent = '•'.repeat(currentPin.length);
                }
                
                function submitPin() {
                    if(!currentPin) return;
                    fetch('/api/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: 'pin=' + encodeURIComponent(currentPin)
                    }).then(res => {
                        if (res.redirected) {
                            window.location.href = res.url;
                        } else {
                            res.text().then(html => {
                                document.open();
                                document.write(html);
                                document.close();
                            });
                        }
                    });
                }
            </script>
        </body>
        </html>
    `);
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const ROOT_DIR = process.env.CONTEXT_PATH || process.env.PROJECT_ROOT || process.cwd();

// --- INICIO SISTEMA DE LICENCIAS (TRIAL DE 14 DÍAS) ---
const LICENSE_FILE = path.join(BASE_DIR, '.tfte_license.json');
const TRIAL_DAYS = 14;

function getLicenseStatus() {
    let hwId = 'HWID-' + os.hostname();

    if (!fs.existsSync(LICENSE_FILE)) {
        const initialState = {
            machineId: hwId,
            startDate: new Date().toISOString(),
            isPro: false,
            licenseKey: null
        };
        fs.writeFileSync(LICENSE_FILE, JSON.stringify(initialState, null, 2), 'utf8');
        return { status: 'active', daysLeft: TRIAL_DAYS, isPro: false };
    }

    const data = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'));
    if (data.isPro) return { status: 'pro', daysLeft: 0, isPro: true };

    const start = new Date(data.startDate);
    const now = new Date();
    const diffTime = Math.abs(now - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const daysLeft = TRIAL_DAYS - diffDays;

    if (daysLeft <= 0) {
        return { status: 'expired', daysLeft: 0, isPro: false };
    }

    return { status: 'active', daysLeft, isPro: false };
}

function licenseMiddleware(req, res, next) {
    const status = getLicenseStatus();
    if (status.status === 'expired') {
        return res.status(403).json({ error: 'Tu periodo de prueba de 14 días ha expirado. Por favor, adquiere una licencia para continuar.' });
    }
    next();
}

app.get('/api/license/status', (req, res) => {
    res.json(getLicenseStatus());
});

app.post('/api/license/verify', (req, res) => {
    const { key } = req.body;
    // Simulación de API: acepta cualquier clave que empiece por TFTE-PRO-
    if (key && key.startsWith('TFTE-PRO-')) {
        if (fs.existsSync(LICENSE_FILE)) {
            const data = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'));
            data.isPro = true;
            data.licenseKey = key;
            fs.writeFileSync(LICENSE_FILE, JSON.stringify(data, null, 2), 'utf8');
            return res.json({ ok: true, message: '¡Licencia activada con éxito!' });
        }
    }
    res.status(400).json({ error: 'Clave de licencia inválida.' });
});
// --- FIN SISTEMA DE LICENCIAS ---

function detectUserAppPort() {
    try {
        const pkgPath = path.join(ROOT_DIR, 'package.json');
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            const startScript = (pkg.scripts && (pkg.scripts.start || pkg.scripts.dev)) || '';
            const match = startScript.match(/(?:--port\s*=?|PORT=)(\d+)/i);
            if (match && match[1]) {
                console.log(`[Auto-Port]: Detectado puerto ${match[1]} desde package.json`);
                return parseInt(match[1], 10);
            }
        }
    } catch (e) {
        console.warn('[Auto-Port]: No se pudo leer package.json, usando puerto por defecto.');
    }
    return 3000;
}

const TARGET_PORT = detectUserAppPort();

app.use(cors());
app.use(express.json());

// CORRECCIÓN ENOENT: Usamos __dirname para leer el frontend de adentro del .exe
app.use(express.static(path.join(__dirname, 'public')));

app.use('/preview', express.static(ROOT_DIR));

app.use('/react', createProxyMiddleware({
    target: `http://127.0.0.1:${TARGET_PORT}`,
    changeOrigin: true,
    pathRewrite: { '^/react': '/' }
}));

app.get('/', (req, res) => {
    // CORRECCIÓN ENOENT: Usamos __dirname
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.get('/api/get-context', (req, res) => {
    res.json({ contextPath: ROOT_DIR });
});

app.post('/api/set-context', (req, res) => {
    const { contextPath } = req.body;
    if (!contextPath) return res.status(400).json({ error: 'Contexto requerido' });

    // Modificar el .env real en disco (usando BASE_DIR)
    const envFile = path.join(BASE_DIR, '.env');
    let contextChanged = false; // 🔥 SOLUCIÓN AL BUG: Declaramos la variable globalmente aquí

    try {
        if (fs.existsSync(envFile)) {
            let envData = fs.readFileSync(envFile, 'utf8');
            if (envData.match(/^CONTEXT_PATH=.*$/m)) {
                const currentContext = envData.match(/^CONTEXT_PATH=(.*)$/m)[1];
                if (currentContext !== contextPath) {
                    envData = envData.replace(/^CONTEXT_PATH=.*$/m, `CONTEXT_PATH=${contextPath}`);
                    contextChanged = true;
                }
            } else {
                envData += `\nCONTEXT_PATH=${contextPath}`;
                contextChanged = true;
            }
            if (contextChanged) {
                fs.writeFileSync(envFile, envData, 'utf8');
            }
        } else {
            fs.writeFileSync(envFile, `CONTEXT_PATH=${contextPath}\n`, 'utf8');
            contextChanged = true;
        }

        res.json({ ok: true });

        if (contextChanged) {
            setTimeout(() => {
                console.log(`[Sistema] Cambiando contexto a: ${contextPath}. Reiniciando motores...`);
                exec('taskkill /F /IM node.exe', () => {
                    process.exit(0);
                });
            }, 1500);
        }

    } catch (err) {
        console.error("Error modificando .env:", err);
        // Evitamos crashear usando return para asegurar que no se envíen headers dobles
        return res.status(500).json({ error: "No se pudo guardar el nuevo contexto" });
    }
});

let ttsClient = null;
async function getTtsClient() {
    if (!ttsClient) ttsClient = new MsEdgeTTS();
    await ttsClient.setMetadata(TTS_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {});
    return ttsClient;
}

app.get('/api/tts', async (req, res) => {
    const text = req.query.text;
    if (!text) return res.status(400).send('No text');

    try {
        const tts = await getTtsClient();
        const { audioStream } = tts.toStream(text);

        res.set('Content-Type', 'audio/mpeg');
        res.set('Cache-Control', 'no-cache');

        audioStream.on('data', (chunk) => res.write(chunk));
        audioStream.on('close', () => res.end());
        audioStream.on('error', (e) => {
            console.error('TTS stream error:', e.message);
            res.end();
        });
    } catch (e) {
        console.error('TTS error:', e.message);
        res.status(500).send('TTS error');
    }
});

const FRONTIMGS_DIR = path.join(ROOT_DIR, 'FrontImgs');
const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);

app.get('/api/browse', (req, res) => {
    const rel = (req.query.dir || '').replace(/^[/\\]+/, '');
    const target = path.resolve(FRONTIMGS_DIR, rel);
    if (!target.startsWith(FRONTIMGS_DIR)) return res.status(400).json({ error: 'Fuera de FrontImgs' });

    try {
        const entries = fs.readdirSync(target, { withFileTypes: true });
        const folders = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
        const images = entries
            .filter(e => e.isFile() && IMG_EXT.has(path.extname(e.name).toLowerCase()))
            .map(e => e.name)
            .sort();
        res.json({ dir: rel, folders, images });
    } catch (e) {
        res.status(404).json({ error: 'No se pudo leer: ' + e.message });
    }
});

const TRACKER_FILE = path.join(ROOT_DIR, 'tracker-data.json');

app.get('/api/tracker', (req, res) => {
    try {
        res.json(JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf-8')));
    } catch (e) {
        res.status(500).json({ error: 'No se pudo leer tracker-data.json: ' + e.message });
    }
});

app.post('/api/tracker', (req, res) => {
    try {
        fs.writeFileSync(TRACKER_FILE, JSON.stringify(req.body, null, 2), 'utf-8');
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: 'No se pudo guardar tracker-data.json: ' + e.message });
    }
});

const toolsConfig = [
    {
        type: "function",
        function: {
            name: "list_dir",
            description: `Lista archivos en ${ROOT_DIR}. Ej: path='public'`,
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "Ruta relativa a listar. Ej: '.' o 'public'" }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "read_file",
            description: "Lee un archivo. Ej: filepath='TFTE Next Steps MainApp 2.html'",
            parameters: {
                type: "object",
                properties: {
                    filepath: { type: "string", description: "Ruta relativa del archivo" }
                },
                required: ["filepath"]
            }
        }
    }
];

function executeTool(name, args) {
    try {
        if (name === 'list_dir') {
            const target = path.resolve(ROOT_DIR, args.path || '.');
            if (!target.startsWith(ROOT_DIR)) return `Fuera de ${ROOT_DIR}`;
            return fs.readdirSync(target).join('\n');
        } else if (name === 'read_file') {
            const target = path.resolve(ROOT_DIR, args.filepath);
            if (!target.startsWith(ROOT_DIR)) return `Fuera de ${ROOT_DIR}`;
            return fs.readFileSync(target, 'utf-8');
        }
        return "Tool no encontrada";
    } catch (e) {
        return "Error: " + e.message;
    }
}

app.post('/api/chat', licenseMiddleware, async (req, res) => {
    try {
        const userMessage = req.body.message;
        if (!userMessage) return res.status(400).json({ error: 'Mensaje requerido' });

        const systemPrompt = `Eres un Agente Programador Autónomo de élite, conectado directamente al proyecto en ${ROOT_DIR}.
TIENES PERMISO DE LECTURA MEDIANTE TUS HERRAMIENTAS.
Puedes usar list_dir y read_file para explorar el código y entenderlo.
NUNCA PUEDES MODIFICAR ARCHIVOS.

EL MENSAJE DEL USUARIO VIENE DE UNA TRANSCRIPCIÓN DE VOZ AUTOMÁTICA.
REGLAS:
1. NUNCA uses listas numeradas ni viñetas.
2. NUNCA excedas las 3 oraciones de longitud.
3. ESTÁS EN UNA LLAMADA TELEFÓNICA. Sé extremadamente conciso, directo.
4. Responde siempre en español normal y claro.
5. Sé muy útil pero como un colega que habla rápido.`;

        let messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
        ];

        let finalResponse = "";
        let maxLoops = 5;

        while (maxLoops > 0) {
            maxLoops--;
            const chatCompletion = await groq.chat.completions.create({
                messages: messages,
                model: "llama-3.3-70b-versatile",
                temperature: 0.2,
                tools: toolsConfig,
                tool_choice: "auto",
            }, { timeout: 15000 });

            const responseMessage = chatCompletion.choices[0]?.message;
            if (!responseMessage) break;

            messages.push(responseMessage);

            if (responseMessage.tool_calls) {
                for (const toolCall of responseMessage.tool_calls) {
                    const args = JSON.parse(toolCall.function.arguments);
                    const result = executeTool(toolCall.function.name, args);
                    messages.push({
                        tool_call_id: toolCall.id,
                        role: "tool",
                        name: toolCall.function.name,
                        content: result,
                    });
                }
            } else {
                finalResponse = responseMessage.content || "";
                break;
            }
        }

        res.json({ response: finalResponse });
    } catch (error) {
        console.error("Error en la API de chat:", error.message);
        if (error.status === 401 || error.status === 403) return res.status(401).json({ error: error.message });
        if (error.status === 429) return res.status(429).json({ error: error.message });
        res.status(500).json({ error: 'Hubo un error al procesar tu solicitud.' });
    }
});

// --- Modo Agente ---
const WATCHER_DIR = path.join(BASE_DIR, 'watcher');
const BACKENDS_VALIDOS = ['claude', 'gemini'];

function ensureWatcherDir(backend) {
    const dir = path.join(WATCHER_DIR, backend);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

function watcherPaths(backend) {
    const dir = ensureWatcherDir(backend);
    return {
        instr: path.join(dir, 'instruccion.txt'),
        resp: path.join(dir, 'respuesta.txt'),
        estado: path.join(dir, 'estado.json'),
        alcance: path.join(dir, 'alcance.txt'),
        modelo: path.join(dir, 'modelo.txt'),
    };
}

app.post('/api/agente', licenseMiddleware, (req, res) => {
    try {
        const userMessage = req.body.message;
        const backend = BACKENDS_VALIDOS.includes(req.body.backend) ? req.body.backend : 'gemini';
        if (!userMessage) return res.status(400).json({ error: 'Mensaje requerido' });

        const folderRaw = (req.body.folder || '').trim();
        let folder = '';
        if (folderRaw) {
            const resolved = path.resolve(ROOT_DIR, folderRaw);
            if (!resolved.toLowerCase().startsWith(ROOT_DIR.toLowerCase())) {
                return res.status(400).json({ error: `Esa carpeta queda fuera de ${ROOT_DIR}` });
            }
            folder = path.relative(ROOT_DIR, resolved).replace(/\\/g, '/');
        }

        const paths = watcherPaths(backend);
        fs.writeFileSync(paths.resp, '', 'utf-8');
        const resetEstado = { status: 'idle', pendingInstruction: null, pendingScopeDir: null };
        fs.writeFileSync(paths.estado, JSON.stringify(resetEstado, null, 2), 'utf-8');
        fs.writeFileSync(paths.modelo, req.body.model || 'gemini-3.1-pro-high', 'utf-8');
        fs.writeFileSync(paths.instr, userMessage, 'utf-8');
        fs.writeFileSync(paths.alcance, folder, 'utf-8');

        res.json({ ok: true, backend, folder });
    } catch (err) {
        console.error("Error grave en /api/agente:", err);
        res.status(500).json({ error: `Fallo permisos: ${err.message} | DIR: ${BASE_DIR}` });
    }
});

app.get('/api/agente/estado', (req, res) => {
    const backend = BACKENDS_VALIDOS.includes(req.query.backend) ? req.query.backend : 'gemini';
    try {
        const paths = watcherPaths(backend);
        if (!fs.existsSync(paths.estado)) return res.json({ status: 'idle', respuesta: '', backend });

        const estado = JSON.parse(fs.readFileSync(paths.estado, 'utf-8'));
        const respuesta = fs.existsSync(paths.resp) ? fs.readFileSync(paths.resp, 'utf-8') : '';
        res.json({ status: estado.status, respuesta, backend });
    } catch (e) {
        res.json({ status: 'idle', respuesta: '', backend });
    }
});

app.get('/api/agente/plan', (req, res) => {
    try {
        const brainDir = path.join(os.homedir(), '.gemini', 'antigravity-ide', 'brain');
        if (!fs.existsSync(brainDir)) {
            return res.json({ plan: "No se encontró el directorio brain de Antigravity." });
        }

        const convDirs = fs.readdirSync(brainDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        let latestPlanPath = null;
        let latestMtime = 0;

        for (const dirName of convDirs) {
            const planPath = path.join(brainDir, dirName, 'implementation_plan.md');
            if (fs.existsSync(planPath)) {
                const stat = fs.statSync(planPath);
                if (stat.mtimeMs > latestMtime) {
                    latestMtime = stat.mtimeMs;
                    latestPlanPath = planPath;
                }
            }
        }

        if (latestPlanPath) {
            const planContent = fs.readFileSync(latestPlanPath, 'utf-8');
            res.json({ plan: planContent });
        } else {
            // Fallback a la última respuesta cruda
            const paths = watcherPaths('gemini');
            const respuesta = fs.existsSync(paths.resp) ? fs.readFileSync(paths.resp, 'utf-8') : 'No hay ningún plan de implementación disponible aún.';
            res.json({ plan: respuesta });
        }
    } catch (e) {
        console.error("Error leyendo plan de implementación:", e);
        res.json({ plan: "Error interno al leer el plan." });
    }
});

app.get('/api/agente/tareas', (req, res) => {
    const backend = BACKENDS_VALIDOS.includes(req.query.backend) ? req.query.backend : 'gemini';
    try {
        const dir = ensureWatcherDir(backend);
        const tareasFile = path.join(dir, 'tareas.json');
        if (fs.existsSync(tareasFile)) {
            const tareas = JSON.parse(fs.readFileSync(tareasFile, 'utf-8'));
            res.json(tareas);
        } else {
            res.json([]);
        }
    } catch (e) {
        res.json([]);
    }
});

app.get('/api/tasks/pending', (req, res) => {
    try {
        const filePath = path.join(ROOT_DIR, 'TFTE Next Steps MainApp 2.html');
        if (!fs.existsSync(filePath)) return res.json([]);

        const content = fs.readFileSync(filePath, 'utf-8');
        // Regex a prueba de balas: busca let data = [...] hasta el punto y coma final
        const match = content.match(/let\s+data\s*=\s*(\[[\s\S]*?\])\s*;/);

        if (!match) return res.json([]);

        const data = JSON.parse(match[1]);
        const pending = [];

        data.forEach(sub => {
            const subAppName = sub.subApp || 'General';
            if (sub.fields) {
                Object.keys(sub.fields).forEach(fieldKey => {
                    const field = sub.fields[fieldKey];
                    if (field && field.items) {
                        field.items.forEach(item => {
                            const st = (item.status || '').toLowerCase();
                            if (st.includes('pendiente') || st.includes('proceso') || st.includes('proximo')) {
                                if (item.text && item.text.trim() && item.text.trim() !== 'OK' && item.text.trim() !== '-') {
                                    pending.push({
                                        subApp: subAppName,
                                        field: fieldKey,
                                        status: item.status,
                                        text: item.text
                                    });
                                }
                            }
                        });
                    }
                });
            }
        });
        res.json(pending);
    } catch (e) {
        console.error("Error loading pending tasks:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/tasks/complete', express.json(), (req, res) => {
    try {
        const { text, subApp } = req.body;
        const filePath = path.join(ROOT_DIR, 'TFTE Next Steps MainApp 2.html');
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });

        let content = fs.readFileSync(filePath, 'utf-8');
        const match = content.match(/let\s+data\s*=\s*(\[[\s\S]*?\])\s*;/);
        if (!match) return res.status(500).json({ error: "No data block found" });

        const data = JSON.parse(match[1]);
        let found = false;

        // Normalización difusa para evitar fallos por espacios o comillas
        const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const textNorm = normalize(text);

        data.forEach(sub => {
            if (!subApp || sub.subApp === subApp) {
                if (sub.fields) {
                    Object.keys(sub.fields).forEach(fKey => {
                        const field = sub.fields[fKey];
                        if (field && field.items) {
                            field.items.forEach(item => {
                                if (item.text) {
                                    const itemNorm = normalize(item.text);
                                    if (itemNorm.includes(textNorm) || textNorm.includes(itemNorm)) {
                                        item.status = "Terminado";
                                        found = true;
                                    }
                                }
                            });
                        }
                    });
                }
            }
        });

        if (found) {
            const newDataStr = JSON.stringify(data, null, 2);
            content = content.replace(match[1], newDataStr);
            fs.writeFileSync(filePath, content, 'utf-8');
            return res.json({ ok: true, message: "Marcado como Terminado" });
        }
        res.json({ ok: false, error: "No se encontró la tarea exacta" });
    } catch (e) {
        console.error("Error completing task:", e);
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// ENDPOINTS DE GITHUB Y SINCRONIZACIÓN
// ==========================================

// --- ENDPOINT 1: CREAR REPO E INICIALIZAR (Primera vez) ---
app.post('/api/git-init', express.json(), async (req, res) => {
    try {
        const { token, repoName } = req.body;
        if (!token || !repoName) return res.status(400).json({ error: 'Faltan datos.' });

        // 🔥 CERO HARDCODING: Detección dinámica inteligente de la carpeta de código
        let gitTargetDir = ROOT_DIR;
        const srcPath = path.join(ROOT_DIR, 'src');
        if (fs.existsSync(srcPath) && fs.statSync(srcPath).isDirectory()) {
            gitTargetDir = srcPath; // Si existe la carpeta src, Git apunta ahí dinámicamente
        }

        const safeRepoName = repoName.trim().replace(/\s+/g, '-');

        // 1. AMNESIA AUTOMÁTICA
        const gitFolder = path.join(gitTargetDir, '.git');
        if (fs.existsSync(gitFolder)) {
            fs.rmSync(gitFolder, { recursive: true, force: true });
        }

        // 2. AUTO-CREAR .gitignore (Escudo de Computer Vision)
        const gitignorePath = path.join(gitTargetDir, '.gitignore');
        const gitignoreContent = `node_modules/\nbuild/\nvenv/\n__pycache__/\n*.pt\n*.weights\n*.onnx\n.env\n*.mp4\n*.avi\n*.mov\n*.mkv\n*.sqlite\n*.sqlite3\n*.db\ndatasets/\nruns/\n`;
        fs.writeFileSync(gitignorePath, gitignoreContent, 'utf8');

        // 3. Obtener el usuario dueño del Token
        const userRes = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `token ${token}` }
        });
        const userData = await userRes.json();
        if (!userRes.ok) throw new Error('Token de GitHub inválido o expirado.');
        const username = userData.login;

        // 4. Intentar crear el repositorio
        const ghRes = await fetch('https://api.github.com/user/repos', {
            method: 'POST',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: safeRepoName, private: true })
        });

        let cloneUrl = '';
        if (ghRes.ok) {
            const ghData = await ghRes.json();
            cloneUrl = ghData.clone_url.replace('https://', `https://${token}@`);
        } else if (ghRes.status === 422) {
            cloneUrl = `https://${token}@github.com/${username}/${safeRepoName}.git`;
        } else {
            const ghData = await ghRes.json();
            throw new Error(ghData.message || 'Error en GitHub API');
        }

        // 5. Iniciar Git y subir (Se ejecuta en la ruta dinámica resuelta)
        const cmd = `git init && git config user.name "TFTE Auto-Sync" && git config user.email "bot@tfte.local" && git add . && git commit -m "Initial commit via TFTE Voice Assistant" && git branch -M main && git remote add origin "${cloneUrl}" && git push -u origin main`;

        exec(cmd, { cwd: gitTargetDir }, (error, stdout, stderr) => {
            if (error && !stderr.includes('already exists')) {
                console.error("\n❌ ERROR DETALLADO DE GITHUB:");
                console.error(stderr);
                return res.status(500).json({ error: 'Revisa la terminal de Node.', details: stderr });
            }
            res.json({ ok: true, message: '¡Repositorio inicializado y código subido con éxito!' });
        });
    } catch (e) {
        console.error("Error en Git Init:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- ENDPOINT 2: SINCRONIZAR REPO (Actualizaciones futuras) ---
app.post('/api/git-sync', async (req, res) => {
    try {
        // 🔥 CERO HARDCODING: Detección dinámica
        let gitTargetDir = ROOT_DIR;
        const srcPath = path.join(ROOT_DIR, 'src');
        if (fs.existsSync(srcPath) && fs.statSync(srcPath).isDirectory()) {
            gitTargetDir = srcPath;
        }

        const cmd = `git add . && git commit -m "Auto-sync update via TFTE" && git push origin main`;

        exec(cmd, { cwd: gitTargetDir }, (error, stdout, stderr) => {
            if (error && !stdout.includes('nothing to commit') && !stderr.includes('nothing to commit')) {
                console.error("\n❌ ERROR DETALLADO DE GITHUB (SYNC):", stderr);
                return res.status(500).json({ error: 'Fallo al sincronizar', details: stderr });
            }
            res.json({ ok: true, message: 'Código sincronizado en la nube.' });
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});



app.post('/api/save-next-steps', express.json(), (req, res) => {
    try {
        const filePath = path.join(ROOT_DIR, 'TFTE Next Steps MainApp 2.html');
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "File not found" });
        }
        let content = fs.readFileSync(filePath, 'utf-8');
        const regex = /let data = \[[\s\S]*?\];\s*const mainContainer/m;
        const newStr = `let data = ${JSON.stringify(req.body, null, 2)};\n\n    const mainContainer`;

        if (regex.test(content)) {
            content = content.replace(regex, newStr);
            fs.writeFileSync(filePath, content, 'utf-8');
            res.json({ ok: true });
        } else {
            res.status(500).json({ error: "No se encontró el bloque de datos en el archivo HTML" });
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/agente/tareas', express.json(), (req, res) => {
    const backend = BACKENDS_VALIDOS.includes(req.body.backend) ? req.body.backend : 'gemini';
    try {
        const dir = ensureWatcherDir(backend);
        const tareasFile = path.join(dir, 'tareas.json');
        fs.writeFileSync(tareasFile, JSON.stringify(req.body.tasks || [], null, 2), 'utf-8');
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: "Error guardando tareas" });
    }
});

app.get('/api/historial', (req, res) => {
    const backend = BACKENDS_VALIDOS.includes(req.query.backend) ? req.query.backend : 'gemini';
    try {
        const dir = ensureWatcherDir(backend);
        const historialFile = path.join(dir, 'historial.txt');
        if (fs.existsSync(historialFile)) {
            const contenido = fs.readFileSync(historialFile, 'utf-8');
            res.json({ historial: contenido });
        } else {
            res.json({ historial: '' });
        }
    } catch (e) {
        res.status(500).json({ error: "Error leyendo historial" });
    }
});


const catchAllProxy = createProxyMiddleware({
    target: `http://127.0.0.1:${TARGET_PORT}`,
    changeOrigin: true
});

// Forzamos que el proxy NUNCA intercepte el frontend
app.use((req, res, next) => {
    const isFrontend = req.path === '/' ||
        req.path.startsWith('/preview') ||
        req.path.startsWith('/api') ||
        req.path === '/app.html' ||
        req.path === '/app.js' ||
        req.path === '/style.css';
    if (isFrontend) {
        return next();
    }
    return catchAllProxy(req, res, next);
});

// ==========================================
// LIVE RELOAD (RADAR ANTI-CLOUDFLARE)
// ==========================================
let lastUpdate = Date.now();

// El navegador consultará esta ruta cada 1 segundo
app.get('/api/check-reload', (req, res) => {
    res.json({ lastUpdate });
});

// Vigila el directorio del proyecto del usuario (ROOT_DIR), no una ruta hardcodeada
const watchPath = ROOT_DIR;
let reloadTimeout;

try {
    fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
        if (filename && (filename.endsWith('.js') || filename.endsWith('.jsx') || filename.endsWith('.tsx') || filename.endsWith('.ts') || filename.endsWith('.css') || filename.endsWith('.html'))) {
            // Ignorar node_modules y archivos de build
            if (filename.includes('node_modules') || filename.includes('.next') || filename.includes('build')) return;
            clearTimeout(reloadTimeout);
            reloadTimeout = setTimeout(() => {
                console.log(`[Live Reload] Archivo modificado: ${filename} -> Actualizando radar...`);
                lastUpdate = Date.now();
            }, 300);
        }
    });
    console.log(`👀 File Watcher (Radar) activado en: ${watchPath}`);
} catch (error) {
    console.error('Error iniciando el File Watcher:', error.message);
}

// ==========================================
// ARRANQUE DEL SERVIDOR
// ==========================================
const server = app.listen(port, () => {
    console.log(`🚀 Servidor escuchando en http://localhost:${port}`);
});

server.on('upgrade', (req, socket, head) => {
    console.log(`[WS Upgrade] ${req.url}`);
    // Reescribir /react/* a /* para que llegue al React dev server
    if (req.url.startsWith('/react/') || req.url.startsWith('/react?')) {
        req.url = req.url.replace('/react', '');
    }
    // Enviar TODOS los WebSocket upgrades al React dev server (HMR usa /ws)
    catchAllProxy.upgrade(req, socket, head);
});