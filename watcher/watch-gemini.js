require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { startWatcher } = require('./engine');

// Default: ruta estándar de instalación de Antigravity en Windows (%LOCALAPPDATA%\agy\bin\agy.exe).
// Configurable con AGY_PATH por si el usuario lo instaló en otro lado.
const AGY_PATH = process.env.AGY_PATH || path.join(process.env.LOCALAPPDATA || '', 'agy', 'bin', 'agy.exe');

// Arranca en false: la primera instrucción de voz no tiene conversación previa
// que continuar. A partir de ahí queda en true, así cada turno nuevo sigue la
// conversación anterior de agy (--continue) en vez de arrancar en blanco cada vez.
let huboConversacionPrevia = false;

function getModelToUse() {
    try {
        const modelPath = path.join(__dirname, 'gemini', 'modelo.txt');
        const content = fs.readFileSync(modelPath, 'utf-8').trim();
        if (content) return content;
    } catch (e) {
        // Fallback default si no existe el archivo
    }
    return 'gemini-3.1-pro-high';
}

startWatcher({
    backendName: 'gemini',
    dir: path.join(__dirname, 'gemini'),
    projectDir: process.env.PROJECT_ROOT || 'C:\\TFTE',
    buildCommand: (prompt, fase) => {
        const args = [
            '--add-dir', '.',
            '--dangerously-skip-permissions',
            '--model', getModelToUse(),
            '--output-format', 'text',
            '--mode', fase === 'interpretar' ? 'plan' : 'accept-edits',
        ];
        if (huboConversacionPrevia) args.push('--continue');
        huboConversacionPrevia = true;
        return {
            cmd: `"${AGY_PATH}"`,
            args,
            opts: { shell: true },
            useStdin: true,
        };
    },
});
