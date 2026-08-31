const fs = require('fs');

let code = fs.readFileSync('server.js', 'utf8');

const newGetLicenseStatus = `async function getLicenseStatus() {
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
            const res = await fetch(\`\${supabaseUrl}/rest/v1/rpc/check_license\`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseKey,
                    'Authorization': \`Bearer \${supabaseKey}\`
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
}`;

const parts = code.split('async function getLicenseStatus() {');
if (parts.length > 1) {
    const postParts = parts[1].split("async function licenseMiddleware");
    if (postParts.length > 1) {
        code = parts[0] + newGetLicenseStatus + "\n\nasync function licenseMiddleware" + postParts[1];
        fs.writeFileSync('server.js', code, 'utf8');
        console.log("Patched server.js with check_license RPC");
    }
}
