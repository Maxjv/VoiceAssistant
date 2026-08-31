const fs = require('fs');
const path = require('path');

// Colores para consola
const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    red: "\x1b[31m",
    cyan: "\x1b[36m"
};

console.log(`${colors.cyan}=================================================${colors.reset}`);
console.log(`${colors.cyan}  Iniciando Empaquetado de Voice Assistant (PROD) ${colors.reset}`);
console.log(`${colors.cyan}=================================================${colors.reset}\n`);

const ROOT_DIR = __dirname;
const DIST_DIR = path.join(ROOT_DIR, 'dist_production');

// 1. Limpiar y recrear dist_production
if (fs.existsSync(DIST_DIR)) {
    console.log(`${colors.yellow}[*] Eliminando carpeta dist_production anterior...${colors.reset}`);
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR);
console.log(`${colors.green}[+] Carpeta dist_production creada exitosamente.${colors.reset}`);

// 2. Archivos a copiar
const filesToCopy = [
    'VoiceAssistant_TFTE.exe',
    'cloudflared.exe',
    'node.exe',
    'watchdog.ps1',
    'start.ps1',
    'stop.ps1',
    'rescue.ps1',
    'rescue.bat',
    'Tfte_Rescue_Panel.pyw'
];

const dirsToCopy = [
    'public',
    'watcher',
    'node_modules'
];

// Función para copiar recursivamente
function copyRecursiveSync(src, dest) {
    try {
        if (fs.cpSync) {
            fs.cpSync(src, dest, { recursive: true, force: true });
        } else {
            const exists = fs.existsSync(src);
            const stats = exists && fs.statSync(src);
            const isDirectory = exists && stats.isDirectory();
            if (isDirectory) {
                if (!fs.existsSync(dest)) fs.mkdirSync(dest);
                fs.readdirSync(src).forEach(childItemName => {
                    copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
                });
            } else if (exists) {
                fs.copyFileSync(src, dest);
            }
        }
    } catch (err) {
        console.error(`\n${colors.red}[!] Error al copiar ${src}: ${err.message}${colors.reset}\n`);
    }
}

console.log(`\n${colors.blue}[*] Copiando archivos y directorios esenciales...${colors.reset}`);

filesToCopy.forEach(file => {
    const srcPath = path.join(ROOT_DIR, file);
    const destPath = path.join(DIST_DIR, file);
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`  - ${file} copiado.`);
    } else {
        console.log(`${colors.red}  [!] Advertencia: No se encontró ${file}${colors.reset}`);
    }
});

dirsToCopy.forEach(dir => {
    const srcPath = path.join(ROOT_DIR, dir);
    const destPath = path.join(DIST_DIR, dir);
    if (fs.existsSync(srcPath)) {
        copyRecursiveSync(srcPath, destPath);
        console.log(`  - Directorio /${dir} copiado.`);

        // Purgar basura si es la carpeta watcher
        if (dir === 'watcher') {
            const watcherDirs = ['claude', 'gemini'];
            watcherDirs.forEach(wd => {
                const wdPath = path.join(destPath, wd);
                if (fs.existsSync(wdPath)) fs.rmSync(wdPath, { recursive: true, force: true });
            });
            fs.readdirSync(destPath).forEach(f => {
                if (f.endsWith('.log')) fs.rmSync(path.join(destPath, f));
            });
            console.log(`    > Historial y logs de /watcher purgados.`);
        }
    } else {
        console.log(`${colors.red}  [!] Advertencia: No se encontró el directorio /${dir}${colors.reset}`);
    }
});

// 3. Purgar .env
console.log(`\n${colors.yellow}[*] Procesando y purgando archivo .env...${colors.reset}`);
const envPath = path.join(ROOT_DIR, '.env');
const distEnvPath = path.join(DIST_DIR, '.env');

if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');

    // Lista de variables a limpiar (vaciar su valor)
    const varsToPurge = ['GROQ_API_KEY', 'GEMINI_API_KEY', 'USER_EMAIL', 'CONTEXT_PATH', 'ANTHROPIC_API_KEY'];

    let lines = envContent.split(/\r?\n/);
    let purgedLines = lines.map(line => {
        let [key, ...rest] = line.split('=');
        if (key && varsToPurge.includes(key.trim())) {
            return `${key.trim()}=`;
        }
        if (key && key.trim() === 'ENV') {
            return 'ENV=production';
        }
        return line;
    });

    // Agregar variable de producción explícita si no estaba
    if (!purgedLines.some(l => l.startsWith('ENV='))) {
        purgedLines.push('ENV=production');
    }

    fs.writeFileSync(distEnvPath, purgedLines.join('\n'));
    console.log(`${colors.green}[+] Archivo .env limpio y seguro para distribución.${colors.reset}`);
} else {
    console.log(`${colors.red}[!] No se encontró archivo .env en la raíz.${colors.reset}`);
}

console.log(`\n${colors.cyan}=================================================${colors.reset}`);
console.log(`${colors.green}  ✔ EMPAQUETADO FINALIZADO CON ÉXITO ${colors.reset}`);
console.log(`${colors.cyan}=================================================${colors.reset}`);
console.log(`Directorio de salida: ${DIST_DIR}\n`);
