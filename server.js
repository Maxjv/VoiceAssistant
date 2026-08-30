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
    const exempted = ['/api/login', '/api/save-next-steps', '/api/control/save', '/api/tasks/pending'];
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

// --- INICIO SISTEMA DE LICENCIAS (TRIAL DE 7 DÍAS) ---
const LICENSE_FILE = path.join(BASE_DIR, '.tfte_license.json');
const TRIAL_DAYS = 7;

const crypto = require('crypto');

// Variable para cache de licencia
let cachedLicenseStatus = null;
let lastLicenseCheck = 0;

async function getLicenseStatus() {
    // Si estamos en entorno de desarrollo local, bypass total de la licencia
    if (process.env.ENV === 'development') {
        return { status: 'pro', daysLeft: 999, isPro: true };
    }

    // Obtener MAC Address para vincular la licencia a hardware real
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

    // Usar caché si han pasado menos de 5 minutos
    if (cachedLicenseStatus && (Date.now() - lastLicenseCheck < 5 * 60 * 1000)) {
        return cachedLicenseStatus;
    }

    if (!fs.existsSync(LICENSE_FILE)) {
        const initialState = {
            machineId: hwId,
            startDate: new Date().toISOString(),
            isPro: false,
            licenseKey: null
        };
        fs.writeFileSync(LICENSE_FILE, JSON.stringify(initialState, null, 2), 'utf8');
    }

    const data = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'));

    // Validación externa contra Base de Datos Central
    try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseKey) {
            const res = await fetch(`${supabaseUrl}/rest/v1/licenses?hwid=eq.${hwId}&select=is_active`, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            });
            const sbData = await res.json();

            if (Array.isArray(sbData) && sbData.length > 0 && sbData[0].is_active === true) {
                data.isPro = true;
                fs.writeFileSync(LICENSE_FILE, JSON.stringify(data, null, 2), 'utf8');
                cachedLicenseStatus = { status: 'pro', daysLeft: 0, isPro: true, message: "Licencia verificada online" };
                lastLicenseCheck = Date.now();
                return cachedLicenseStatus;
            } else {
                // Si el servidor dice que no es válida o no existe, revocamos
                if (data.isPro) {
                    data.isPro = false;
                    fs.writeFileSync(LICENSE_FILE, JSON.stringify(data, null, 2), 'utf8');
                }
            }
        }
    } catch (e) {
        // Silencioso, seguimos con validación local si el server está caído
    }

    if (data.isPro) {
        cachedLicenseStatus = { status: 'pro', daysLeft: 0, isPro: true };
    } else {
        const start = new Date(data.startDate);
        const now = new Date();
        const diffTime = Math.abs(now - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const daysLeft = TRIAL_DAYS - diffDays;

        if (daysLeft <= 0) {
            cachedLicenseStatus = { status: 'expired', daysLeft: 0, isPro: false };
        } else {
            cachedLicenseStatus = { status: 'active', daysLeft, isPro: false };
        }
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

const PREVIEW_DIR = ROOT_DIR;
app.use('/preview', express.static(PREVIEW_DIR));

app.use('/react', createProxyMiddleware({
    target: `http://127.0.0.1:${TARGET_PORT}`,
    changeOrigin: true,
    pathRewrite: { '^/react': '/' },
    ws: true
}));

app.get('/', (req, res) => {
    // CORRECCIÓN ENOENT: Usamos __dirname
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
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

    // Modificar el .env real en disco (usando BASE_DIR)
    const envFile = path.join(BASE_DIR, '.env');

    try {
        let contextChanged = false;
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

            if (projectName) {
                if (envData.match(/^PROJECT_NAME=.*$/m)) {
                    const currentProjectName = envData.match(/^PROJECT_NAME=(.*)$/m)[1];
                    if (currentProjectName !== projectName) {
                        envData = envData.replace(/^PROJECT_NAME=.*$/m, `PROJECT_NAME=${projectName}`);
                        contextChanged = true;
                    }
                } else {
                    envData += `\nPROJECT_NAME=${projectName}`;
                    contextChanged = true;
                }
            }
            if (contextChanged) {
                fs.writeFileSync(envFile, envData, 'utf8');
            }
        } else {
            let newEnvData = `CONTEXT_PATH=${contextPath}\n`;
            if (projectName) newEnvData += `PROJECT_NAME=${projectName}\n`;
            fs.writeFileSync(envFile, newEnvData, 'utf8');
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

app.get('/api/select-folder', (req, res) => {
    const tempPs1 = path.join(require('os').tmpdir(), `folder_picker_${Date.now()}.ps1`);
    const psCode = `
Add-Type -AssemblyName System.windows.forms
$f = New-Object System.Windows.Forms.FolderBrowserDialog
$f.Description = 'Selecciona la carpeta con tus imágenes'
$f.ShowNewFolderButton = $true
$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
if ($f.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-Output $f.SelectedPath
}
    `.trim();

    try {
        fs.writeFileSync(tempPs1, psCode);
        exec(`powershell.exe -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "${tempPs1}"`, (err, stdout) => {
            try { fs.unlinkSync(tempPs1); } catch (e) {} // Cleanup
            const p = stdout.trim();
            if (p) {
                res.json({ path: p });
            } else {
                res.json({ error: 'Cancelado' });
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/init-react', (req, res) => {
    const root = (process.env.CONTEXT_PATH || '').replace(/'/g, "''");
    if (!root || !fs.existsSync(root)) return res.status(400).json({error: "CONTEXT_PATH inválido"});
    
    const batPath = path.join(root, 'init-react.bat');
    const batContent = `
@echo off
color 0B
echo Iniciando creacion de Proyecto React (Vite)...
call npm create vite@latest webapp -- --template react
if exist "webapp" (
    cd webapp
    color 0E
    echo.
    echo Instalando dependencias (esto tomara unos minutos)...
    call npm install
    color 0A
    echo.
    echo Finalizado exitosamente! Tu asistente lo detectara en breve.
) else (
    color 0C
    echo Error al crear la carpeta webapp.
)
echo.
pause
del "%~f0"
    `.trim();

    try {
        fs.writeFileSync(batPath, batContent);
        exec(`start "Creando React" cmd.exe /c "${batPath}"`, { cwd: root }, (err) => {
            if (err) return res.status(500).json({error: err.message});
            res.json({success: true});
        });
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

app.get('/api/serve-img', (req, res) => {
    if (!req.query.path) return res.status(400).send('No path');
    try {
        const p = path.resolve(req.query.path);
        if (!fs.existsSync(p)) return res.status(404).send('Not found');
        if (!IMG_EXT.has(path.extname(p).toLowerCase())) return res.status(400).send('Not image');
        res.sendFile(p);
    } catch(e) {
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
        const planPath = 'C:\\TFTE\\VoiceAssistant\\VoiceAssistant_Plan.html';

        if (fs.existsSync(planPath)) {
            try {
                const content = fs.readFileSync(planPath, 'utf-8');
                const match = content.match(/let\s+data\s*=\s*([\s\S]*?)\/\*\s*__DATA_INJECTION_POINT__\s*\*\//);
                if (match) {
                    let jsonStr = match[1].trim();
                    if (jsonStr.endsWith(';')) jsonStr = jsonStr.slice(0, -1);
                    const data = JSON.parse(jsonStr);
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
                }
            } catch (err) {
                console.error("Error parseando VoiceAssistant_Plan.html", err);
            }
        }

        // Novedad: Extraer tareas del nuevo Control Board
        const controlPath = path.join(BASE_DIR, CONTROL_FILENAME);
        if (fs.existsSync(controlPath)) {
            const controlContent = fs.readFileSync(controlPath, 'utf-8');
            const controlMatch = controlContent.match(/let\s+controlData\s*=\s*([\s\S]*?)\/\*\s*__DATA_INJECTION_POINT__\s*\*\//);
            if (controlMatch) {
                try {
                    let jsonString = controlMatch[1].trim();
                    if (jsonString.endsWith(';')) {
                        jsonString = jsonString.slice(0, -1);
                    }
                    const cData = JSON.parse(jsonString);
                    function extractTasks(nodes, pathStr) {
                        nodes.forEach(node => {
                            const currentPath = pathStr ? `${pathStr} > ${node.title}` : node.title;
                            if (node.instruction && node.instruction.trim() !== '') {
                                pending.push({
                                    subApp: 'Control Board',
                                    field: currentPath,
                                    status: 'Pendiente',
                                    text: node.instruction
                                });
                            }
                            if (node.children && node.children.length > 0) {
                                extractTasks(node.children, currentPath);
                            }
                        });
                    }
                    extractTasks(cData, '');
                } catch (e) {
                    console.error("Error parseando Project_Control:", e);
                }
            }
        }
        res.json(pending);
    } catch (e) {
        console.error("Error loading pending tasks:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/tasks/complete', express.json(), (req, res) => {
    try {
        const { text, subApp } = req.body;
        const PROJECT_ROOT = process.env.PROJECT_ROOT || 'C:\\TFTE';
        const filePath = path.join(PROJECT_ROOT, 'TFTE Next Steps MainApp 2.html');
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

// --- ENDPOINT PARA AUTO-PUSH A GITHUB ---
app.post('/api/git-sync', express.json(), (req, res) => {
    try {
        const timestamp = new Date().toLocaleString('es-ES');
        const commitMessage = `Auto-sync via TFTE Voice Assistant: ${timestamp}`;

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
    try {
        const PROJECT_ROOT = process.env.PROJECT_ROOT || 'C:\\TFTE';
        const filePath = path.join(PROJECT_ROOT, 'TFTE Next Steps MainApp 2.html');
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
    changeOrigin: true,
    ws: true
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
        if (!filename) return;
        if (filename.includes('node_modules') || filename.includes('.git') || filename.includes('VoiceAssistant')) return;
        if (filename && (filename.endsWith('.js') || filename.endsWith('.jsx') || filename.endsWith('.tsx') || filename.endsWith('.ts') || filename.endsWith('.css') || filename.endsWith('.html'))) {
            // Ignorar node_modules y archivos de build
            if (filename.includes('.next') || filename.includes('build')) return;
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
                        from: '"TFTE Assistant" <' + (process.env.SMTP_USER || 'no-reply@tfte.local') + '>',
                        to: targetEmail,
                        subject: "Túnel Restaurado: Nueva URL de TFTE Assistant",
                        text: `El sistema ha sido reiniciado.\n\nNueva URL de acceso: ${newUrl}\n\nPor favor, actualiza tu navegador.`,
                        html: `<h2>TFTE Assistant en Línea</h2>
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
// ARRANQUE DEL SERVIDOR
// ==========================================
const server = app.listen(port, () => {
    console.log(`🚀 Servidor escuchando en http://localhost:${port}`);
});

server.on('upgrade', (req, socket, head) => {
    if (req.url.startsWith('/react/')) {
        req.url = req.url.replace('/react', '');
    }
    catchAllProxy.upgrade(req, socket, head);
});