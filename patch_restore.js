const fs = require('fs');
let serverCode = fs.readFileSync('server.js', 'utf8');

const missingCode = `
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

app.post('/api/license/verify'`;

serverCode = serverCode.replace("app.post('/api/license/verify'", missingCode);

fs.writeFileSync('server.js', serverCode, 'utf8');
console.log("Restored missing license code");
