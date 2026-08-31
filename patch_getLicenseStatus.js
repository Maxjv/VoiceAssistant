const fs = require('fs');

let serverCode = fs.readFileSync('server.js', 'utf8');

// The new implementation of getLicenseStatus
const newGetLicenseStatus = `async function getLicenseStatus() {
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
            // 1. Auto-registrar trial silenciosamente
            await fetch(\`\${supabaseUrl}/rest/v1/rpc/register_trial\`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseKey,
                    'Authorization': \`Bearer \${supabaseKey}\`
                },
                body: JSON.stringify({ p_hwid: hwId })
            }).catch(() => {}); // Ignorar errores silenciosamente

            // 2. Buscar las licencias asociadas a este HWID
            const res = await fetch(\`\${supabaseUrl}/rest/v1/licenses?hwid=eq.\${hwId}&select=is_active,expires_at,license_key\`, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': \`Bearer \${supabaseKey}\`
                }
            });
            const sbData = await res.json();

            if (Array.isArray(sbData) && sbData.length > 0) {
                // Puede haber varias (la de trial y la PRO si la compró). Buscamos la mejor.
                let bestLicense = null;
                let maxDays = -1;

                for (const lic of sbData) {
                    if (!lic.is_active) continue;
                    if (!lic.expires_at) {
                        bestLicense = lic;
                        maxDays = 9999; // Vitalicia
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
                    return cachedLicenseStatus;
                }
            }
            
            // Si llega aquí, todas expiraron o fueron revocadas
            cachedLicenseStatus = { status: 'expired', daysLeft: 0, isPro: false, message: "Período de prueba expirado. Ingrese una clave válida." };
            lastLicenseCheck = Date.now();
            return cachedLicenseStatus;
        }
    } catch (e) {
        console.error("Error conectando a Supabase para verificar licencia:", e);
    }

    // FALLBACK OFFLINE LOCAL (Sólo si no hay internet o Supabase falla)
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

// Replace the old function in server.js
const regex = /async function getLicenseStatus\(\) \{[\s\S]*?\/\/ --- FIN SISTEMA DE LICENCIAS ---/m;

if (regex.test(serverCode)) {
    // wait, we need to make sure we don't accidentally remove "app.post('/api/license/verify" which is BEFORE "FIN SISTEMA DE LICENCIAS"
    // So the regex should just replace the getLicenseStatus function block.
}

// A better way is to split on 'async function getLicenseStatus()' and then 'app.post(\'/api/license/verify\''
const parts = serverCode.split('async function getLicenseStatus() {');
if (parts.length > 1) {
    const postParts = parts[1].split("app.post('/api/license/verify'");
    if (postParts.length > 1) {
        serverCode = parts[0] + newGetLicenseStatus + "\n\napp.post('/api/license/verify'" + postParts[1];
        fs.writeFileSync('server.js', serverCode, 'utf8');
        fs.copyFileSync('server.js', 'dist_production/server.js');
        console.log("SUCCESS");
    } else {
        console.log("Could not find app.post('/api/license/verify' to delimit the end of the function");
    }
} else {
    console.log("Could not find async function getLicenseStatus() {");
}
