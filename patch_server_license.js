const fs = require('fs');

let serverCode = fs.readFileSync('server.js', 'utf8');

const oldVerifyLogic = `app.post('/api/license/verify', (req, res) => {
    const { key } = req.body;
    // Simulacin de API: acepta cualquier clave que empiece por TFTE-PRO-
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
});`;

// Try to match the function regardless of exact whitespace/accents
const verifyRegex = /app\.post\('\/api\/license\/verify',\s*\(req,\s*res\)\s*=>\s*\{[\s\S]*?res\.status\(400\)\.json\(\{ error: 'Clave de licencia inv.*?lida\.' \}\);\s*\}\);/m;

const newVerifyLogic = `app.post('/api/license/verify', async (req, res) => {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'Clave no proporcionada.' });

    try {
        const hwId = await getHwId();
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseKey) {
            // Llamar a la función RPC en Supabase para activar la licencia
            const response = await fetch(\`\${supabaseUrl}/rest/v1/rpc/activate_license\`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseKey,
                    'Authorization': \`Bearer \${supabaseKey}\`
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
            if (key.startsWith('TFTE-PRO-')) {
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
});`;

if (verifyRegex.test(serverCode)) {
    serverCode = serverCode.replace(verifyRegex, newVerifyLogic);
    fs.writeFileSync('server.js', serverCode, 'utf8');
    fs.copyFileSync('server.js', 'dist_production/server.js');
    console.log("SUCCESS");
} else {
    console.log("FAILED to find regex match in server.js");
}
