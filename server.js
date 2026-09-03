const { execSync } = require('child_process');

function killPort(portToKill) {
    if (process.platform !== 'win32' || !portToKill) return;
    try {
        const out = execSync(`netstat -ano | findstr ":${portToKill} " | findstr "LISTENING"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        const lines = out.trim().split('\n');
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parseInt(parts[parts.length - 1], 10);
            if (pid && pid !== process.pid) {
                try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }); } catch (e) { }
            }
        }
    } catch (e) { }
}

// --- SISTEMA DE ARRANQUE EN FRÍO (LIMPIEZA DE ZOMBIES) ---
console.log("[Boot] Limpiando memoria y procesos anteriores...");
if (process.platform === 'win32') {
    [3000, 5173, 4000, 8080].forEach(killPort);
    try { execSync('taskkill /F /IM cloudflared.exe', { stdio: 'ignore' }); } catch (e) { }
}
// ---------------------------------------------------------

// A partir de aquí sigue tu código normal (const express = require('express'), etc...)

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
const http = require('http');

// RUTA BASE REAL (Para escribir archivos: .env, watcher, etc.)
const BASE_DIR = process.pkg ? path.dirname(process.execPath) : process.cwd();

// Polyfill de crypto Web API para msedge-tts en Node 18 (entorno pkg)
const _crypto = require('crypto');
if (!global.crypto) {
    global.crypto = _crypto.webcrypto;
}

require('dotenv').config({ path: path.join(BASE_DIR, '.env') });

const TTS_VOICE = 'es-AR-ElenaNeural';

const app = express();
const port = process.env.PORT || 4000;

// CORS para todo
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Private-Network', 'true');
    next();
});

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

app.get('/favicon.ico', (req, res) => {
    const fav = path.join(BASE_DIR, 'public', 'favicon.ico');
    if (fs.existsSync(fav)) {
        res.setHeader('Content-Type', 'image/x-icon');
        return res.sendFile(fav);
    }
    res.status(204).end();
});

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
    // Exenciones de seguridad absolutas para evitar fallos de fetch sin cookies
    const exempted = [
        '/api/login',
        '/api/ready-url',
        '/api/check-target',
        '/splash.html',
        '/logo.png',
        '/favicon.ico',
        '/app.ico',
        '/api/save-next-steps',
        '/api/control/save',
        '/api/tasks/pending'
    ];
    if (exempted.includes(req.path)) return next();

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
            <title>AnywhereDesign - Sincronización</title>
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
                <h2>AnywhereDesign</h2>
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
let ROOT_DIR = process.env.CONTEXT_PATH || process.env.PROJECT_ROOT || process.cwd();

// --- INICIO SISTEMA DE LICENCIAS (TRIAL DE 7 DÍAS) ---
const LICENSE_FILE = path.join(BASE_DIR, '.tfte_license.json');
const TRIAL_DAYS = 7;

const crypto = require('crypto');

// Variable para cache de licencia
let cachedLicenseStatus = null;
let lastLicenseCheck = 0;

async function getLicenseStatus() {
    console.log("[LICENSE DEBUG] Entrando a getLicenseStatus(). ENV=", process.env.ENV);
    if (process.env.ENV === 'development') {
        return { status: 'pro', daysLeft: 999, isPro: true };
    }

    const interfaces = os.networkInterfaces();
    let macs = [];
    for (const key in interfaces) {
        for (const net of interfaces[key]) {
            if (net.mac && net.mac !== '00:00:00:00:00:00') {
                macs.push(net.mac);
            }
        }
    }
    const rawMacs = macs.sort().join('|') || os.hostname();
    const hwId = 'HWID-' + crypto.createHash('sha256').update(rawMacs).digest('hex').substring(0, 16);

    if (cachedLicenseStatus && (Date.now() - lastLicenseCheck < 5 * 60 * 1000)) {
        return cachedLicenseStatus;
    }

    try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseKey) {
            console.log("[LICENSE DEBUG] Consultando RPC check_license...");
            const res = await fetch(`${supabaseUrl}/rest/v1/rpc/check_license`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                },
                body: JSON.stringify({ p_hwid: hwId })
            });
            console.log("[LICENSE DEBUG] Respuesta check_license HTTP:", res.status);

            if (res.ok) {
                const sbData = await res.json();
                console.log("[LICENSE DEBUG] Datos de Supabase:", sbData);

                cachedLicenseStatus = {
                    status: sbData.status,
                    daysLeft: sbData.days_left,
                    isPro: sbData.is_pro,
                    message: sbData.message
                };
                lastLicenseCheck = Date.now();
                return cachedLicenseStatus;
            } else {
                const errText = await res.text();
                console.log("[LICENSE DEBUG] Error de Supabase:", errText);
            }
        }
    } catch (e) {
        console.error("[LICENSE DEBUG] Error de red:", e);
    }

    console.log("[LICENSE DEBUG] FALLBACK OFFLINE LOCAL");
    if (!fs.existsSync(LICENSE_FILE)) {
        const initialState = { machineId: hwId, startDate: new Date().toISOString(), isPro: false, licenseKey: null };
        fs.writeFileSync(LICENSE_FILE, JSON.stringify(initialState, null, 2), 'utf8');
    }
    const data = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'));
    if (data.isPro) {
        cachedLicenseStatus = { status: 'pro', daysLeft: 999, isPro: true, message: "Licencia local verificada." };
        lastLicenseCheck = Date.now();
        return cachedLicenseStatus;
    }
    const startDate = new Date(data.startDate);
    const now = new Date();
    const daysLeft = Math.max(0, 7 - Math.floor((now - startDate) / (1000 * 60 * 60 * 24)));

    if (daysLeft === 0) {
        cachedLicenseStatus = { status: 'expired', daysLeft: 0, isPro: false, message: "Trial local expirado." };
    } else {
        cachedLicenseStatus = { status: 'trial', daysLeft, isPro: false, message: "Trial local activo." };
    }
    lastLicenseCheck = Date.now();
    return cachedLicenseStatus;
}

async function licenseMiddleware(req, res, next) {
    const status = await getLicenseStatus();
    if (status.status === 'expired') {
        return res.status(403).json({ error: 'Tu periodo de prueba ha expirado. Por favor, adquiere una licencia para continuar.' });
    }
    next();
}

app.get('/api/license/status', async (req, res) => {
    res.json(await getLicenseStatus());
});

app.post('/api/license/verify', async (req, res) => {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'Clave no proporcionada.' });

    try {
        const hwId = await getHwId();
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseKey) {
            // Llamar a la función RPC en Supabase para activar la licencia
            const response = await fetch(`${supabaseUrl}/rest/v1/rpc/activate_license`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                },
                body: JSON.stringify({ p_key: key, p_hwid: hwId })
            });

            const data = await response.json();

            if (response.ok && data === true) {
                // ¡Éxito! La licencia fue asignada a este HWID
                const localData = fs.existsSync(LICENSE_FILE) ? JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8')) : {};
                localData.isPro = true;
                localData.licenseKey = key;
                fs.writeFileSync(LICENSE_FILE, JSON.stringify(localData, null, 2), 'utf8');
                return res.json({ ok: true, message: '¡Licencia activada con éxito en la nube!' });
            } else {
                return res.status(400).json({ error: data.message || 'La clave es inválida o ya está en uso por otro equipo.' });
            }
        } else {
            // Fallback si no hay config de Supabase
            if (key.startsWith('ANYWHERE-PRO-')) {
                if (fs.existsSync(LICENSE_FILE)) {
                    const localData = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'));
                    localData.isPro = true;
                    localData.licenseKey = key;
                    fs.writeFileSync(LICENSE_FILE, JSON.stringify(localData, null, 2), 'utf8');
                    return res.json({ ok: true, message: '¡Licencia (Local) activada con éxito!' });
                }
            }
            res.status(400).json({ error: 'Clave de licencia inválida.' });
        }
    } catch (e) {
        console.error("Error en verify license:", e);
        res.status(500).json({ error: 'Error del servidor de licencias.' });
    }
});
// --- FIN SISTEMA DE LICENCIAS ---

// --- ESCÁNER DE ARRANQUE (AUTO-DETECTA WEB O REACT AL INICIAR) ---
// --- ESCÁNER DE ARRANQUE (OMNIDIRECCIONAL: ARRIBA Y ABAJO) ---
// --- ESCÁNER Y AUTO-LANZADOR UNIVERSAL (CERO CLICS) ---
let activeAppProcess = null;

function detectAndLaunchProject(startDir) {
    let isNodeProject = false;
    let targetPort = 3000;
    let finalDir = startDir;

    const isAssistant = (dir, pJson) => {
        if (!dir) return true;
        const norm = path.resolve(dir).toLowerCase();
        if (norm === path.resolve(BASE_DIR).toLowerCase()) return true;
        if (norm.endsWith('\\voiceassistant') || norm.endsWith('/voiceassistant')) return true;
        if (norm.includes('anywheredesign')) return true;
        if (pJson && (pJson.name === 'voiceassistant' || pJson.name === 'anywheredesign')) return true;
        return false;
    };

    // Escáner agnóstico: no le importa si es React, Vue o Angular. Solo busca package.json
    const checkPkg = (p) => {
        if (fs.existsSync(p)) {
            try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch (e) { }
        }
        return null;
    };

    let pkg = checkPkg(path.join(startDir, 'package.json'));
    if (pkg && isAssistant(startDir, pkg)) pkg = null;

    // 1. BUSCAR HACIA ABAJO PRIMERO (subdirectorios inmediatos como voice-command-dev, frontend, app)
    if (!pkg) {
        try {
            const subdirs = fs.readdirSync(startDir, { withFileTypes: true })
                .filter(d => d.isDirectory() && d.name !== 'node_modules' && !d.name.startsWith('.'));
            for (const sub of subdirs) {
                const subPath = path.join(startDir, sub.name);
                const p = checkPkg(path.join(subPath, 'package.json'));
                if (p && !isAssistant(subPath, p)) {
                    pkg = p;
                    finalDir = subPath;
                    break;
                }
            }
        } catch (e) { }
    }

    // 2. SI NO ESTÁ ABAJO, buscar hacia arriba (padres)
    if (!pkg) {
        let parentDir = path.dirname(startDir);
        let curr = startDir;
        while (curr !== parentDir) {
            const p = checkPkg(path.join(parentDir, 'package.json'));
            if (p && !isAssistant(parentDir, p)) {
                pkg = p;
                finalDir = parentDir;
                break;
            }
            curr = parentDir;
            parentDir = path.dirname(curr);
        }
    }

    if (pkg) {
        isNodeProject = true;
        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        const scripts = pkg.scripts || {};

        // Auto-detectar puerto
        if (deps['vite']) targetPort = 5173;
        else {
            const startScript = scripts.dev || scripts.start || '';
            const match = startScript.match(/(?:--port\s*=?|PORT=)(\d+)/i);
            if (match && match[1]) targetPort = parseInt(match[1], 10);
        }

        // =========================================================
        // LA MAGIA AUTOMÁTICA: LEVANTAR EL SERVIDOR DEL USUARIO
        // =========================================================
        console.log(`[Auto-Launch] Proyecto Node detectado en ${finalDir}. Arrancando automáticamente...`);

        // Matar cualquier proceso previo si existe
        if (activeAppProcess) {
            try { exec(`taskkill /pid ${activeAppProcess.pid} /t /f`); } catch (e) { }
        }

        const installCmd = fs.existsSync(path.join(finalDir, 'node_modules')) ? '' : 'npm install && ';
        let runCmd = '';
        if (deps['vite']) {
            targetPort = 5173;
            runCmd = scripts.dev ? 'npm run dev -- --port 5173' : 'npm start';
        } else if (scripts.start) {
            runCmd = 'npm start';
        } else if (scripts.dev) {
            runCmd = 'npm run dev';
        }

        // Limpiar el puerto objetivo antes de arrancar para evitar "Something is already running on port..."
        killPort(targetPort);

        if (runCmd) {
            // Ejecutamos en segundo plano, 100% oculto (CI: 'true' evita prompts interactivos de React)
            activeAppProcess = exec(`${installCmd}${runCmd}`, {
                cwd: finalDir,
                windowsHide: true,
                env: { ...process.env, BROWSER: 'none', PORT: targetPort, CI: 'true' }
            });
            activeAppProcess.stdout.on('data', (d) => {
                const text = d.toString();
                console.log('[App]', text.trim());
                const match = text.match(/(?:localhost|127\.0\.0\.1):(\d+)/i);
                if (match && match[1]) {
                    const detected = parseInt(match[1], 10);
                    if (detected && detected !== TARGET_PORT) {
                        console.log(`[Sistema] ¡Puerto real detectado en vivo!: ${detected} (reemplazando ${TARGET_PORT})`);
                        TARGET_PORT = detected;
                    }
                }
            });
            activeAppProcess.stderr.on('data', (d) => console.error('[App]', d.trim()));
        }
    }

    return { type: isNodeProject ? 'node' : 'web', port: targetPort, dir: finalDir };
}

const projectInfo = detectAndLaunchProject(ROOT_DIR);
let PROJECT_TYPE = projectInfo.type;
let TARGET_PORT = projectInfo.port;

// Si NO es un proyecto Node (no hay package.json), asumimos Web Estática
if (PROJECT_TYPE === 'web') {
    TARGET_PORT = 8080;
    const webApp = express();

    // 1. Buscar si ya existe index.html en root, /public o /dist
    let staticDir = ROOT_DIR;
    let foundHtml = null;

    if (fs.existsSync(path.join(ROOT_DIR, 'index.html'))) {
        staticDir = ROOT_DIR;
        foundHtml = path.join(ROOT_DIR, 'index.html');
    } else if (fs.existsSync(path.join(ROOT_DIR, 'public', 'index.html'))) {
        staticDir = path.join(ROOT_DIR, 'public');
        foundHtml = path.join(staticDir, 'index.html');
    } else if (fs.existsSync(path.join(ROOT_DIR, 'dist', 'index.html'))) {
        staticDir = path.join(ROOT_DIR, 'dist');
        foundHtml = path.join(staticDir, 'index.html');
    } else {
        // 2. Si no se llama index.html, buscar si existe CUALQUIER otro archivo .html en la carpeta
        try {
            const files = fs.readdirSync(ROOT_DIR);
            const anyHtml = files.find(f => f.toLowerCase().endsWith('.html'));
            if (anyHtml) {
                staticDir = ROOT_DIR;
                foundHtml = path.join(ROOT_DIR, anyHtml);
            }
        } catch (e) { }
    }

    // 3. REGLA DE ORO: SI YA TIENE LO SUFICIENTE, NO CREAR NADA.
    // Solo si NO existe NINGÚN archivo HTML en absoluto, construimos el entry point necesario:
    let targetIndex = foundHtml;
    if (!targetIndex) {
        targetIndex = path.join(staticDir, 'index.html');
        let scriptTags = '';
        let styleTags = '';
        try {
            const files = fs.readdirSync(staticDir);
            const jsFiles = files.filter(f => f.match(/\.(js|mjs)$/i));
            const cssFiles = files.filter(f => f.match(/\.css$/i));
            cssFiles.forEach(c => { styleTags += `\n    <link rel="stylesheet" href="./${c}">`; });
            jsFiles.forEach(j => { scriptTags += `\n    <script src="./${j}"></script>`; });
        } catch (e) { }

        const initialHtml = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${process.env.PROJECT_NAME || 'Mi Proyecto'}</title>${styleTags}
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0b0f19;
            color: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            text-align: center;
        }
        .card {
            background: #1e293b;
            padding: 2.5rem 3rem;
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.08);
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            max-width: 500px;
        }
        h1 { color: #38bdf8; margin: 0 0 10px 0; font-size: 2rem; }
        p { color: #94a3b8; font-size: 1rem; line-height: 1.5; margin: 0 0 15px 0; }
        .badge { display: inline-block; background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; }
    </style>
</head>
<body>
    <div class="card">
        <h1>${process.env.PROJECT_NAME || 'Mi Proyecto'}</h1>
        <p>Entorno web inicializado y conectado a AnywhereDesign.</p>
        <span class="badge">Listo para diseñar</span>
    </div>${scriptTags}
</body>
</html>`;
        try {
            fs.writeFileSync(targetIndex, initialHtml, 'utf8');
            console.log(`[Sistema] No existía HTML previo. Generado entry point: ${targetIndex}`);
        } catch (e) {
            console.error("Error creando index.html:", e);
        }
    }

    webApp.use(express.static(staticDir));

    webApp.use((req, res) => {
        res.sendFile(targetIndex);
    });
    webApp.listen(TARGET_PORT, '127.0.0.1', () => console.log(`[Sistema] Servidor Web Interno listo en ${TARGET_PORT}`));
}

app.use(cors());
app.use(express.json());

// Endpoint para que el Frontend sepa en qué tipo de proyecto está
app.get('/api/project-info', (req, res) => {
    res.json({ type: PROJECT_TYPE, name: process.env.PROJECT_NAME || 'Mi Proyecto' });
});

// Endpoint de Autenticación Cero Fricción
app.post('/api/auth-cli', (req, res) => {
    const cmd = req.body.backend === 'claude' ? 'claude login' : 'agy';

    // Ejecuta "start cmd /k" para que se abra una ventana real y visible 
    // donde el usuario pueda ver el proceso de Login y autorizar en su navegador.
    exec(`start cmd /k "${cmd}"`, (err) => {
        if (err) console.error("Error abriendo CMD de login:", err);
    });

    res.json({ ok: true, message: "Consola de Login abierta. Revisa tu navegador." });
});

// CORRECCIÓN ENOENT: Usamos __dirname para leer el frontend de adentro del .exe
app.use(express.static(path.join(__dirname, 'public')));

const PREVIEW_DIR = ROOT_DIR;
app.use('/preview', express.static(PREVIEW_DIR));

// Sensor estricto y SEGURO (Evita crash por doble respuesta)
app.get('/api/check-target', (req, res) => {
    const request = http.get(`http://127.0.0.1:${TARGET_PORT}/`, (response) => {
        response.on('data', () => { });
        response.on('end', () => {
            if (!res.headersSent) res.json({ ready: response.statusCode >= 200 && response.statusCode < 400 });
        });
    }).on('error', (err) => {
        if (!res.headersSent) res.json({ ready: false });
    });

    // Si React está compilando, la petición colgará. A los 1.5s abortamos seguro.
    request.setTimeout(1500, () => {
        request.destroy();
        if (!res.headersSent) res.json({ ready: false });
    });
});

// Endpoint para el Splash: solo redirige cuando Cloudflare y el proyecto están 100% listos
app.get('/api/ready-url', (req, res) => {
    const urlPath = path.join(__dirname, 'current-url.txt');
    let cfUrl = '';
    if (fs.existsSync(urlPath)) {
        try {
            cfUrl = fs.readFileSync(urlPath, 'utf8').trim();
        } catch (e) { }
    }

    if (!cfUrl || !cfUrl.startsWith('http')) {
        return res.json({ ready: false });
    }

    const request = http.get(`http://127.0.0.1:${TARGET_PORT}/`, (response) => {
        response.on('data', () => { });
        response.on('end', () => {
            if (!res.headersSent) {
                if (response.statusCode >= 200 && response.statusCode < 400) {
                    const ctx = projectContextPath ? `?context=${encodeURIComponent(projectContextPath)}` : '';
                    const finalUrl = `${cfUrl}/${ctx}`;
                    res.json({ ready: true, url: finalUrl });
                } else {
                    res.json({ ready: false });
                }
            }
        });
    }).on('error', () => {
        if (!res.headersSent) res.json({ ready: false });
    });

    request.setTimeout(1500, () => {
        request.destroy();
        if (!res.headersSent) res.json({ ready: false });
    });
});

const reactProxy = createProxyMiddleware({
    target: `http://127.0.0.1:${TARGET_PORT}`,
    router: () => `http://127.0.0.1:${TARGET_PORT}`,
    changeOrigin: true,
    pathRewrite: { '^/react': '/' },
    ws: false,
    onError: (err, req, res) => {
        if (!res.headersSent) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <div style="background-color:#0f172a; color:white; font-family:sans-serif; text-align:center; height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                    <h2 style="color:#38bdf8;">Levantando Servidor...</h2>
                    <p style="color:#94a3b8;">Tu proyecto se está compilando en segundo plano. Tomará unos instantes.</p>
                    <div style="width: 40px; height: 40px; border: 4px solid rgba(56, 189, 248, 0.3); border-top-color: #38bdf8; border-radius: 50%; animation: spin 1s linear infinite; margin-top: 20px;"></div>
                    <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
                    <script>
                        setInterval(() => {
                            fetch('/api/check-target')
                                .then(r => r.json())
                                .then(d => { if (d.ready) location.reload(); })
                                .catch(() => {});
                        }, 2000);
                    </script>
                </div>
            `);
        }
    }
});

app.use('/react', reactProxy);

app.get('/', (req, res) => {
    // CORRECCIÓN ENOENT: Usamos __dirname
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.get(['/favicon.ico', '/app.ico'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'app.ico'));
});

app.get('/api/get-context', (req, res) => {
    res.json({
        contextPath: ROOT_DIR,
        projectName: process.env.PROJECT_NAME || 'React App'
    });
});

app.post('/api/set-context', (req, res) => {
    const { contextPath, projectName } = req.body;
    if (!contextPath) return res.status(400).json({ error: 'Contexto requerido' });

    const envFile = path.join(BASE_DIR, '.env');
    let projectType = 'web'; // Por defecto asumimos Web Estática

    try {
        // 1. Detección Inteligente de React/Vite/Next
        const pkgPath = path.join(contextPath, 'package.json');
        if (fs.existsSync(pkgPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
                if (deps['react'] || deps['next'] || deps['vite']) {
                    projectType = 'react';
                }
            } catch (e) { console.warn("Aviso: package.json no es un JSON válido."); }
        }

        // 2. Modificación limpia del .env
        let envData = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
        const updateEnv = (key, val) => {
            const regex = new RegExp(`^${key}=.*$`, 'm');
            if (regex.test(envData)) envData = envData.replace(regex, `${key}=${val}`);
            else envData += `\n${key}=${val}`;
        };

        updateEnv('CONTEXT_PATH', contextPath);
        if (projectName) updateEnv('PROJECT_NAME', projectName);
        updateEnv('PROJECT_TYPE', projectType);

        fs.writeFileSync(envFile, envData.trim() + '\n', 'utf8');

        // 3. CAMBIO DE CONTEXTO EN CALIENTE (Sin matar Node ni tumbar Cloudflare)
        console.log(`[Sistema] Cambiando en caliente a ${projectType.toUpperCase()} en: ${contextPath}...`);
        ROOT_DIR = contextPath;
        const newProj = detectAndLaunchProject(ROOT_DIR);
        PROJECT_TYPE = newProj.type;
        TARGET_PORT = newProj.port;

        res.json({ ok: true, type: projectType, port: TARGET_PORT });

    } catch (err) {
        console.error("Error modificando .env:", err);
        res.status(500).json({ error: "No se pudo guardar el nuevo contexto" });
    }
});

// --- FASE 2.2: CONTROL DINÁMICO ---
const CONTROL_FILENAME = 'Project_Control.html';

app.get('/api/control/check', (req, res) => {
    try {
        if (process.env.ENV === 'development') {
            return res.json({ exists: true, url: `/preview/${CONTROL_FILENAME}` });
        }
        const controlPath = path.join(ROOT_DIR, CONTROL_FILENAME);
        if (fs.existsSync(controlPath)) {
            res.json({ exists: true, url: `/preview/${CONTROL_FILENAME}` });
        } else {
            res.json({ exists: false });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/control/create', (req, res) => {
    try {
        const controlPath = path.join(BASE_DIR, CONTROL_FILENAME);
        const templatePath = path.join(__dirname, 'public', 'Control_Template.html');

        let templateHtml = '';
        if (fs.existsSync(templatePath)) {
            templateHtml = fs.readFileSync(templatePath, 'utf-8');
        } else {
            templateHtml = `<!DOCTYPE html><html><body><h2>Error</h2><p>No se encontró Control_Template.html</p></body></html>`;
        }

        if (!fs.existsSync(controlPath)) {
            fs.writeFileSync(controlPath, templateHtml, 'utf-8');
        }

        res.json({ ok: true, url: `/control-board` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/control/save', express.json(), (req, res) => {
    try {
        const controlPath = path.join(BASE_DIR, CONTROL_FILENAME);
        console.log("-> /api/control/save RECEIVED DATA:", JSON.stringify(req.body.data));
        if (fs.existsSync(controlPath)) {
            let content = fs.readFileSync(controlPath, 'utf-8');
            const dataStr = JSON.stringify(req.body.data || [], null, 2);
            const originalContent = content;
            content = content.replace(/let\s+controlData\s*=\s*[\s\S]*?\/\*\s*__DATA_INJECTION_POINT__\s*\*\//, `let controlData = ${dataStr};\n/* __DATA_INJECTION_POINT__ */`);
            if (content === originalContent) {
                console.log("-> REGEX REPLACE FAILED! No changes made.");
            } else {
                console.log("-> REGEX REPLACE SUCCESS! Writing to file...");
            }
            fs.writeFileSync(controlPath, content, 'utf-8');
            res.json({ ok: true });
        } else {
            res.status(404).json({ error: 'Control no encontrado' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.get('/api/check-control', (req, res) => {
    const controlPath = path.join(BASE_DIR, CONTROL_FILENAME);
    res.json({ exists: fs.existsSync(controlPath) });
});

app.get('/control-board', (req, res) => {
    const controlPath = path.join(BASE_DIR, CONTROL_FILENAME);
    const templatePath = path.join(__dirname, 'public', 'Control_Template.html');

    if (fs.existsSync(controlPath) && fs.existsSync(templatePath)) {
        try {
            // Leer el template siempre fresco
            let templateContent = fs.readFileSync(templatePath, 'utf-8');

            // Leer los datos del usuario
            const userContent = fs.readFileSync(controlPath, 'utf-8');
            const dataMatch = userContent.match(/let\s+controlData\s*=\s*([\s\S]*?)\/\*\s*__DATA_INJECTION_POINT__\s*\*\//);

            if (dataMatch) {
                // Inyectar los datos en el template fresco
                templateContent = templateContent.replace(
                    /\/\*\s*__DATA_INJECTION_POINT__\s*\*\//,
                    `controlData = ${dataMatch[1]}/* __DATA_INJECTION_POINT__ */`
                );
            }

            res.send(templateContent);
        } catch (e) {
            res.status(500).send('Error generando control board: ' + e.message);
        }
    } else {
        res.status(404).send('No se ha creado el entorno de control o falta el template.');
    }
});

// -----------------------------------

async function getTtsClient() {
    const ttsClient = new MsEdgeTTS();
    await ttsClient.setMetadata(TTS_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {});
    return ttsClient;
}

app.get('/api/tts', async (req, res) => {
    const text = req.query.text;
    if (!text) return res.status(400).send('No text');

    let tts = null;
    try {
        tts = new MsEdgeTTS();
        await tts.setMetadata(TTS_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {});
        const { audioStream } = tts.toStream(text);

        res.set('Content-Type', 'audio/mpeg');
        res.set('Cache-Control', 'no-cache');

        audioStream.pipe(res);

        audioStream.on('end', () => {
            if (tts && typeof tts.close === 'function') tts.close();
        });

        res.on('close', () => {
            if (tts && typeof tts.close === 'function') tts.close();
        });

        audioStream.on('error', (e) => {
            console.error('TTS stream error:', e.message);
            if (tts && typeof tts.close === 'function') tts.close();
        });
    } catch (e) {
        console.error('TTS error:', e.message);
        res.status(500).send('TTS error');
        if (tts && typeof tts.close === 'function') tts.close();
    }
});

const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);

app.get('/api/browse', (req, res) => {
    let target = '';
    let rel = '';
    if (req.query.abs_dir) {
        target = req.query.abs_dir;
        rel = target;
    } else {
        rel = (req.query.dir || '').replace(/^[/\\]+/, '');
        target = path.resolve(ROOT_DIR, rel);
        if (!target.startsWith(ROOT_DIR)) return res.status(400).json({ error: 'Ruta inválida' });
    }

    try {
        const entries = fs.readdirSync(target, { withFileTypes: true });
        let folders = [];
        let images = [];

        for (const e of entries) {
            if (e.name === 'node_modules' || e.name === '.git' || e.name === '.next' || e.name === 'dist') continue;

            if (e.isDirectory()) {
                folders.push(e.name);
            } else if (e.isFile() && IMG_EXT.has(path.extname(e.name).toLowerCase())) {
                images.push(e.name);
            }
        }

        res.json({ dir: rel, folders: folders.sort(), images: images.sort(), isAbsolute: !!req.query.abs_dir });
    } catch (e) {
        res.status(404).json({ error: 'No se pudo leer: ' + e.message });
    }
});

app.get('/api/explore-folders', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const target = req.query.dir || '';

    try {
        if (!target) {
            // Si está vacío, le mostramos los discos duros locales (C:\, D:\)
            const { execSync } = require('child_process');
            let drives = [];
            try {
                const stdout = execSync('wmic logicaldisk get name').toString();
                drives = stdout.split('\n')
                    .map(d => d.trim())
                    .filter(d => d.length === 2 && d.endsWith(':'))
                    .map(d => d + '\\');
            } catch (e) {
                drives = ['C:\\']; // Fallback de seguridad
            }
            return res.json({ current: '', folders: drives });
        }

        // Navegar dentro de la carpeta solicitada
        const resolved = path.resolve(target);
        const entries = fs.readdirSync(resolved, { withFileTypes: true });

        // Filtramos para mostrar solo carpetas (ocultando archivos y carpetas de sistema bloqueadas)
        const folders = entries
            .filter(e => e.isDirectory() && !e.name.startsWith('$') && !e.name.startsWith('System Volume Information'))
            .map(e => e.name)
            .sort((a, b) => a.localeCompare(b));

        // Determinar quién es la carpeta padre (para el botón de "Volver atrás")
        const parent = path.dirname(resolved) === resolved ? '' : path.dirname(resolved);

        res.json({ current: resolved, parent: parent, folders });
    } catch (e) {
        // Si hay error de permisos de Windows, lo devolvemos suavemente
        res.status(500).json({ error: 'Carpeta bloqueada por Windows o inaccesible.' });
    }
});



app.get('/api/serve-img', (req, res) => {
    if (!req.query.path) return res.status(400).send('No path');
    try {
        const p = path.resolve(req.query.path);
        if (!fs.existsSync(p)) return res.status(404).send('Not found');
        if (!IMG_EXT.has(path.extname(p).toLowerCase())) return res.status(400).send('Not image');
        res.sendFile(p);
    } catch (e) {
        res.status(500).send(e.message);
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
            description: "Lee un archivo. Ej: filepath='Project_Control.html'",
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
        if (process.env.ENV === 'development') {
            const devPlanPath = path.join(BASE_DIR, 'VoiceAssistant_Plan.html');
            if (fs.existsSync(devPlanPath)) {
                return res.json({ plan: fs.readFileSync(devPlanPath, 'utf-8') });
            }
        }

        let latestPlanPath = null;
        let latestMtime = 0;

        // 1. Buscar en ROOT_DIR/.brain (Contexto local del proyecto)
        const localBrainDirs = [
            path.join(ROOT_DIR, '.brain'),
            path.join(BASE_DIR, '.brain') // Fallback al directorio de instalación
        ];

        for (const localBrainDir of localBrainDirs) {
            if (fs.existsSync(localBrainDir)) {
                // Asumimos que puede haber un implementation_plan.md directo o en subcarpetas
                const directPlan = path.join(localBrainDir, 'implementation_plan.md');
                if (fs.existsSync(directPlan)) {
                    latestPlanPath = directPlan;
                    latestMtime = fs.statSync(directPlan).mtimeMs;
                } else {
                    const subDirs = fs.readdirSync(localBrainDir, { withFileTypes: true })
                        .filter(dirent => dirent.isDirectory())
                        .map(dirent => dirent.name);
                    for (const dirName of subDirs) {
                        const planPath = path.join(localBrainDir, dirName, 'implementation_plan.md');
                        if (fs.existsSync(planPath)) {
                            const stat = fs.statSync(planPath);
                            if (stat.mtimeMs > latestMtime) {
                                latestMtime = stat.mtimeMs;
                                latestPlanPath = planPath;
                            }
                        }
                    }
                }
            }
        }

        if (!latestPlanPath) {
            // No existe plan local en este proyecto ni en la instalación
            return res.status(404).json({ error: "No se encontraron planes de implementación activos ni en el proyecto local ni en la carpeta de instalación." });
        }

        if (latestPlanPath) {
            const planContent = fs.readFileSync(latestPlanPath, 'utf-8');
            res.json({ plan: planContent });
        } else {
            // Fallback a la última respuesta cruda
            const paths = watcherPaths('gemini');
            if (fs.existsSync(paths.resp)) {
                const respuesta = fs.readFileSync(paths.resp, 'utf-8');
                res.json({ plan: respuesta });
            } else {
                // 404 claro para UX amigable
                res.status(404).json({ error: "No se encontraron planes de implementación activos en este proyecto." });
            }
        }
    } catch (e) {
        console.error("Error leyendo plan de implementación:", e);
        res.status(500).json({ error: "Error interno al leer el plan." });
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
        const pending = [];
        const controlPath = path.join(BASE_DIR, CONTROL_FILENAME);
        if (fs.existsSync(controlPath)) {
            const controlContent = fs.readFileSync(controlPath, 'utf-8');
            const controlMatch = controlContent.match(/let\s+controlData\s*=\s*([\s\S]*?)\/\*\s*__DATA_INJECTION_POINT__\s*\*\//);
            if (controlMatch) {
                try {
                    let jsonString = controlMatch[1].trim();
                    if (jsonString.endsWith(';')) jsonString = jsonString.slice(0, -1);
                    const cData = JSON.parse(jsonString);
                    function extractTasks(nodes, pathStr) {
                        nodes.forEach(node => {
                            const currentPath = pathStr ? `${pathStr} > ${node.title}` : node.title;
                            if (node.instruction && node.instruction.trim() !== '') {
                                pending.push({ subApp: 'Control Board', field: currentPath, status: 'Pendiente', text: node.instruction });
                            }
                            if (node.children && node.children.length > 0) extractTasks(node.children, currentPath);
                        });
                    }
                    extractTasks(cData, '');
                } catch (e) { console.error("Error parseando Project_Control:", e); }
            }
        }
        res.json(pending);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/tasks/complete', express.json(), (req, res) => {
    try {
        const { text } = req.body;
        // Ahora apunta al Control Board universal que genera la app
        const filePath = path.join(BASE_DIR, CONTROL_FILENAME);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Control Board no encontrado" });

        let content = fs.readFileSync(filePath, 'utf-8');
        const match = content.match(/let\s+controlData\s*=\s*([\s\S]*?)\/\*\s*__DATA_INJECTION_POINT__\s*\*\//);
        if (!match) return res.status(500).json({ error: "No se encontraron datos en el Control" });

        const data = JSON.parse(match[1]);
        let found = false;

        const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const textNorm = normalize(text);

        // Buscar la tarea en el árbol del Control Board y marcarla
        function searchAndComplete(nodes) {
            nodes.forEach(node => {
                if (node.instruction && (normalize(node.instruction).includes(textNorm) || textNorm.includes(normalize(node.instruction)))) {
                    node.instruction = node.instruction + " [COMPLETADO]"; // Marca visual
                    found = true;
                }
                if (node.children && node.children.length > 0) searchAndComplete(node.children);
            });
        }
        searchAndComplete(data);

        if (found) {
            const newDataStr = JSON.stringify(data, null, 2);
            content = content.replace(match[1], newDataStr + '\n');
            fs.writeFileSync(filePath, content, 'utf-8');
            return res.json({ ok: true, message: "Marcado como Terminado en el Control Board" });
        }
        res.json({ ok: false, error: "No se encontró la tarea exacta" });
    } catch (e) {
        console.error("Error completing task:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- ENDPOINT PARA AUTO-PUSH A GITHUB ---
app.post('/api/git-sync', express.json(), (req, res) => {
    try {
        const timestamp = new Date().toLocaleString('es-ES');
        const commitMessage = `Auto-sync via AnywhereDesign: ${timestamp}`;

        // Secuencia: Add todo -> Commit -> Push
        const command = `git add . && git commit -m "${commitMessage}" && git push`;

        exec(command, { cwd: __dirname }, (error, stdout, stderr) => {
            if (error) {
                const output = (stdout + stderr).toLowerCase();
                // Si falla porque no hay cambios, no es un error real
                if (output.includes('nothing to commit') || output.includes('nada para hacer commit') || output.includes('clean')) {
                    return res.json({ ok: true, message: 'El repositorio ya está actualizado. No hay cambios nuevos para subir.' });
                }
                console.error('Git sync error:', error);
                return res.status(500).json({ ok: false, error: 'Fallo al subir a GitHub. Revisa la consola.', details: stderr });
            }
            res.json({ ok: true, message: '¡Código sincronizado con GitHub exitosamente!' });
        });
    } catch (e) {
        console.error("Error en Git Sync:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/save-next-steps', express.json(), (req, res) => {
    // Endpoint obsoleto neutralizado: El guardado real ahora ocurre en /api/control/save
    res.json({ ok: true, message: "Migrado a Control Board." });
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
    router: () => `http://127.0.0.1:${TARGET_PORT}`,
    changeOrigin: true,
    ws: true,
    pathRewrite: { '^/react': '' },
    onError: (err, req, res) => {
        if (!res.headersSent) {
            const splashFile = path.join(BASE_DIR, 'public', 'splash.html');
            if (fs.existsSync(splashFile)) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                return res.end(fs.readFileSync(splashFile, 'utf8'));
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`<!DOCTYPE html><html><body style="background:#0f172a;color:#38bdf8;text-align:center;padding-top:20vh;font-family:sans-serif;"><h2>Levantando proyecto...</h2><script>setTimeout(()=>location.reload(),1000);</script></body></html>`);
        }
    }
});

// Forzamos que el proxy NUNCA intercepte el frontend
app.use((req, res, next) => {
    const isFrontend = req.path === '/' ||
        req.path.startsWith('/preview') ||
        req.path.startsWith('/api') ||
        req.path === '/app.html' ||
        req.path === '/app.js' ||
        req.path === '/style.css' ||
        req.path === '/favicon.ico' ||
        req.path === '/app.ico';
    if (isFrontend) {
        return next();
    }
    return catchAllProxy(req, res, next);
});

// Endpoint para instalar las CLI de IA si fallan en la PC nueva
app.post('/api/install-cli', (req, res) => {
    // Abre una consola verde para que el usuario vea la instalación
    const cmd = `start cmd /k "color 0A && title Instalando Motores de IA && echo Instalando Antigravity y Claude (esto puede tardar unos minutos)... && npm install -g @google/antigravity @anthropic-ai/claude-code --force && echo. && echo Instalacion finalizada con exito. Ya puedes cerrar esta ventana y loguearte."`;
    exec(cmd, (err) => {
        if (err) console.error("Error abriendo CMD de instalación:", err);
    });
    res.json({ ok: true });
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
        if (!filename) return;
        if (filename.includes('node_modules') || filename.includes('.git') || filename.includes('VoiceAssistant') || filename.includes('.vite') || filename.includes('.nitro') || filename.includes('.tanstack') || filename.includes('.gen.')) return;
        if (filename && (filename.endsWith('.js') || filename.endsWith('.jsx') || filename.endsWith('.tsx') || filename.endsWith('.ts') || filename.endsWith('.css') || filename.endsWith('.html'))) {
            // Ignorar node_modules y archivos de build
            if (filename.includes('.next') || filename.includes('build') || filename.includes('dist')) return;
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
// FASE 3.2: NOTIFICACIÓN POR CORREO (NUEVA URL)
// ==========================================
try {
    const urlFilePath = path.join(BASE_DIR, 'current-url.txt');
    let lastKnownUrl = '';

    if (fs.existsSync(urlFilePath)) {
        lastKnownUrl = fs.readFileSync(urlFilePath, 'utf-8').trim();
    }

    setInterval(async () => {
        try {
            if (!fs.existsSync(urlFilePath)) return;

            const newUrl = fs.readFileSync(urlFilePath, 'utf-8').trim();
            if (newUrl && newUrl !== lastKnownUrl) {
                lastKnownUrl = newUrl;
                console.log(`[Sistema] Nueva URL detectada: ${newUrl}. Preparando correo...`);


                const targetEmail = process.env.USER_EMAIL || process.env.NOTIFY_EMAIL;
                if (!targetEmail) {
                    console.log("[Sistema] No se configuró USER_EMAIL en .env. Omitiendo envío de correo.");
                    return;
                }

                try {
                    const nodemailer = require('nodemailer');
                    // Configurar transporter 
                    const transporter = nodemailer.createTransport({
                        host: process.env.SMTP_HOST || 'smtp.ethereal.email',
                        port: process.env.SMTP_PORT || 587,
                        secure: false, // true for 465, false for other ports
                        tls: { rejectUnauthorized: false },
                        auth: {
                            user: process.env.SMTP_USER || 'fake@ethereal.email',
                            pass: process.env.SMTP_PASS || 'fakepass'
                        }
                    });

                    await transporter.sendMail({
                        from: '"AnywhereDesign" <' + (process.env.SMTP_USER || 'no-reply@anywheredesign.local') + '>',
                        to: targetEmail,
                        subject: "Túnel Restaurado: Nueva URL de AnywhereDesign",
                        text: `El sistema ha sido reiniciado.\n\nNueva URL de acceso: ${newUrl}\n\nPor favor, actualiza tu navegador.`,
                        html: `<h2>AnywhereDesign en Línea</h2>
                               <p>El sistema de resiliencia ha restaurado la conexión.</p>
                               <p>Tu nueva URL de acceso es: <br/><b><a href="${newUrl}">${newUrl}</a></b></p>`
                    });
                    console.log(`[Sistema] Correo enviado exitosamente a ${targetEmail}`);
                } catch (err) {
                    console.error("[Sistema] Error enviando correo (Fase 3.2):", err.message);
                }
            }
        } catch (err2) {
            // ignorar errores de lectura temporal
        }
    }, 2000);
} catch (err) {
    console.error("[Sistema] Error configurando notificaciones (Fase 3.2):", err.message);
}

// ==========================================
// API PARA EL SPLASH SCREEN Y EL INSTALADOR
// ==========================================
app.get('/api/ready-url', (req, res) => {
    try {
        const urlFile = path.join(BASE_DIR, 'current-url.txt');
        if (!fs.existsSync(urlFile)) return res.json({ ready: false });

        const current = fs.readFileSync(urlFile, 'utf-8').trim();
        if (!current.includes('trycloudflare.com')) return res.json({ ready: false });

        const request = http.get(`http://127.0.0.1:${TARGET_PORT}/`, (response) => {
            // Apenas responde con código 200, damos luz verde y DESTRUIMOS la conexión
            if (response.statusCode >= 200 && response.statusCode < 400) {
                if (!res.headersSent) res.json({ ready: true, url: current });
            } else {
                if (!res.headersSent) res.json({ ready: false });
            }
            request.destroy(); // <-- ESTO EVITA EL BUCLE INFINITO
        }).on('error', () => {
            if (!res.headersSent) res.json({ ready: false });
        });

        request.setTimeout(1500, () => {
            request.destroy();
            if (!res.headersSent) res.json({ ready: false });
        });
    } catch (e) {
        if (!res.headersSent) res.json({ ready: false });
    }
});

// ==========================================
// ARRANQUE DEL SERVIDOR (MODO DIOS)
// ==========================================
const server = app.listen(port, '127.0.0.1', () => {
    console.log(`🚀 Servidor escuchando en http://localhost:${port}`);

    if (process.platform === 'win32') {
        const { spawn, exec } = require('child_process');

        // 1. NODE ENCIENDE CLOUDFLARE SOLO EN DESARROLLO (EN PRODUCCIÓN LO GESTIONA WATCHDOG)
        if (process.env.ENV !== 'production') {
            const cloudflarePath = path.join(BASE_DIR, 'cloudflared.exe');
            if (fs.existsSync(cloudflarePath)) {
                console.log('[Boot] Levantando túnel de Cloudflare...');
                const cf = spawn(cloudflarePath, ['tunnel', '--url', `http://localhost:${port}`], { windowsHide: true });

                // Leemos lo que escupe Cloudflare para extraer la URL viva
                cf.stderr.on('data', (data) => {
                    const output = data.toString();
                    const urlMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
                    if (urlMatch) {
                        fs.writeFileSync(path.join(BASE_DIR, 'current-url.txt'), urlMatch[0]);
                    }
                });
            }
        }

        // 2. SOLO ABRE EL SPLASH SI FUE LLAMADO DESDE EL ACCESO DIRECTO
        if (process.argv.includes('--ui')) {
            setTimeout(() => {
                exec(`start http://localhost:${port}/splash.html`);
            }, 500);
        }
    }
});

server.on('upgrade', (req, socket, head) => {
    socket.on('error', () => {});
    if (req.url.startsWith('/react/') || req.url.startsWith('/react?') || req.url === '/react') {
        req.url = req.url.replace('/react', '') || '/';
    }
    if (catchAllProxy && catchAllProxy.upgrade) {
        catchAllProxy.upgrade(req, socket, head);
    }
});