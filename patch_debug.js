const fs = require('fs');

let code = fs.readFileSync('server.js', 'utf8');

// We will add console logs to getLicenseStatus to debug.
// Replace `try {` inside getLicenseStatus with logs.

const regex = /try\s*\{\s*const supabaseUrl = process\.env\.SUPABASE_URL;/;
const replacement = `try {
        console.log("[LICENSE DEBUG] hwId:", hwId);
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;
        console.log("[LICENSE DEBUG] Supabase URL:", supabaseUrl ? "Exists" : "Missing");
        console.log("[LICENSE DEBUG] Supabase Key:", supabaseKey ? "Exists" : "Missing");`;

if (code.match(regex)) {
    code = code.replace(regex, replacement);
}

const regex2 = /await fetch\(\`\\\$\\{supabaseUrl\\}\/rest\/v1\/rpc\/register_trial\`[\s\S]*?\}\)\.catch\(\(\) => \{\}\);/m;
const replacement2 = `console.log("[LICENSE DEBUG] Llamando a register_trial...");
            const trialRes = await fetch(\`\${supabaseUrl}/rest/v1/rpc/register_trial\`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseKey,
                    'Authorization': \`Bearer \${supabaseKey}\`
                },
                body: JSON.stringify({ p_hwid: hwId })
            });
            console.log("[LICENSE DEBUG] Respuesta register_trial HTTP:", trialRes.status);
            const trialText = await trialRes.text();
            console.log("[LICENSE DEBUG] Respuesta register_trial TEXT:", trialText);`;
            
// Instead of complex regex replacing, let's just create a full replacement for getLicenseStatus to be 100% sure.

const newGetLicenseStatus = `async function getLicenseStatus() {
    console.log("[LICENSE DEBUG] Entrando a getLicenseStatus(). ENV=", process.env.ENV);
    if (process.env.ENV === 'development') {
        console.log("[LICENSE DEBUG] Bypassing por development");
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
    console.log("[LICENSE DEBUG] Calculado HWID:", hwId);

    if (cachedLicenseStatus && (Date.now() - lastLicenseCheck < 5 * 60 * 1000)) {
        console.log("[LICENSE DEBUG] Devolviendo de cache:", cachedLicenseStatus);
        return cachedLicenseStatus;
    }

    try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;
        console.log("[LICENSE DEBUG] credenciales Supabase:", supabaseUrl ? "OK" : "FALTA", supabaseKey ? "OK" : "FALTA");

        if (supabaseUrl && supabaseKey) {
            console.log("[LICENSE DEBUG] Llamando a register_trial...");
            const trialRes = await fetch(\`\${supabaseUrl}/rest/v1/rpc/register_trial\`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseKey,
                    'Authorization': \`Bearer \${supabaseKey}\`
                },
                body: JSON.stringify({ p_hwid: hwId })
            });
            console.log("[LICENSE DEBUG] register_trial STATUS:", trialRes.status);
            
            // 2. Buscar las licencias asociadas a este HWID usando nuestra RPC segura
            // En vez de hacer un SELECT directo (que bloquea RLS), usaremos una nueva consulta o ignoraremos RLS temporalmente
            console.log("[LICENSE DEBUG] Consultando licencias...");
            const res = await fetch(\`\${supabaseUrl}/rest/v1/licenses?hwid=eq.\${hwId}&select=is_active,expires_at,license_key\`, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': \`Bearer \${supabaseKey}\`
                }
            });
            console.log("[LICENSE DEBUG] GET licencias STATUS:", res.status);
            const sbData = await res.json();
            console.log("[LICENSE DEBUG] Datos de Supabase para este HWID:", sbData);

            if (Array.isArray(sbData) && sbData.length > 0) {
                let bestLicense = null;
                let maxDays = -1;

                for (const lic of sbData) {
                    if (!lic.is_active) continue;
                    if (!lic.expires_at) {
                        bestLicense = lic;
                        maxDays = 9999;
                        break;
                    }
                    const expiresAt = new Date(lic.expires_at);
                    const daysLeft = Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24));
                    if (daysLeft > maxDays) {
                        maxDays = daysLeft;
                        bestLicense = lic;
                    }
                }

                if (bestLicense && maxDays > 0) {
                    const isPro = maxDays > 30 || !bestLicense.license_key.startsWith('TRIAL-');
                    cachedLicenseStatus = { status: isPro ? 'pro' : 'trial', daysLeft: maxDays, isPro: isPro, message: isPro ? "Licencia PRO verificada." : "Período de prueba activo." };
                    lastLicenseCheck = Date.now();
                    console.log("[LICENSE DEBUG] Final status:", cachedLicenseStatus);
                    return cachedLicenseStatus;
                }
            }
            
            console.log("[LICENSE DEBUG] No hay licencias válidas en DB. Bloqueando.");
            cachedLicenseStatus = { status: 'expired', daysLeft: 0, isPro: false, message: "Período de prueba expirado. Ingrese una clave válida." };
            lastLicenseCheck = Date.now();
            return cachedLicenseStatus;
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
}`;

// split technique
const parts = code.split('async function getLicenseStatus() {');
if (parts.length > 1) {
    const postParts = parts[1].split("async function licenseMiddleware");
    if (postParts.length > 1) {
        code = parts[0] + newGetLicenseStatus + "\n\nasync function licenseMiddleware" + postParts[1];
        fs.writeFileSync('server.js', code, 'utf8');
        console.log("Patched debug logs");
    }
}
