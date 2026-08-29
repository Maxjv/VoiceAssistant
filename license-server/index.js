const express = require('express');
const app = express();

app.use(express.json());

// Base de datos simulada de licencias válidas (HWIDs)
// En producción, esto debería estar en una base de datos real (MongoDB, Postgres, etc.)
const validLicenses = {
    "VALID-MAC-ADDRESS-12345": { status: "active", expiresAt: "2027-12-31" },
    // "B4-2E-99-...": { status: "active", expiresAt: "2026-12-31" }
};

app.post('/api/license/verify', (req, res) => {
    const { hwid } = req.body;

    if (!hwid) {
        return res.status(400).json({ valid: false, error: "Falta HWID" });
    }

    const license = validLicenses[hwid];

    if (license) {
        if (license.status === 'active') {
            // Verificar expiración si existe
            if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
                return res.json({ valid: false, message: "Licencia expirada" });
            }
            return res.json({ valid: true, message: "Licencia validada correctamente" });
        } else {
            return res.json({ valid: false, message: `Estado de licencia: ${license.status}` });
        }
    } else {
        // En modo "permisivo inicial" (opcional), podrías registrar el HWID y dar una trial
        return res.json({ valid: false, message: "Licencia no encontrada. Por favor contacta a soporte para activar tu HWID: " + hwid });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`License Server running on port ${PORT}`);
});
