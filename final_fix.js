const fs = require('fs');
const path = require('path');

console.log('=== APLICANDO FIXES DEFINITIVOS ===');

// ============================================
// FIX 1: Insertar modal de React CENTRADO en app.html
// ============================================
let appHtml = fs.readFileSync('public/app.html', 'utf8');

const modalHtml = `
    <!-- MODAL CREAR REACT -->
    <div id="initReactModal" class="hidden" style="display:none; background: rgba(0,0,0,0.8); z-index: 50; align-items:center; justify-content:center; position:fixed; inset:0;">
        <div style="background: #1e293b; padding: 24px; border-radius: 12px; max-width: 400px; width: 90%; text-align: center; border: 1px solid rgba(255,255,255,0.1);">
            <span class="material-icons-round" style="font-size: 3rem; color: #f59e0b; margin-bottom: 12px; display:block;">bolt</span>
            <h3 style="margin-bottom: 8px; color: white;">Crear Proyecto React</h3>
            <p style="font-size: 0.9rem; color: #94a3b8; margin-bottom: 20px;">Esto generará los archivos base de React usando Vite en la carpeta front_react y hará npm install. ¿Deseas continuar?</p>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button id="cancelInitReactBtn" class="rail-btn" style="background: rgba(255,255,255,0.1); color: white; padding: 8px 20px; border-radius: 8px; border: none; cursor: pointer;">Cancelar</button>
                <button id="confirmInitReactBtn" class="rail-btn" style="background: #3b82f6; color: white; font-weight: bold; padding: 8px 20px; border-radius: 8px; border: none; cursor: pointer;">Continuar</button>
            </div>
        </div>
    </div>`;

if (!appHtml.includes('initReactModal')) {
    // Insertar justo ANTES de <script src="app.js...">
    const scriptTag = '<script src="app.js?v=20260830_v5"></script>';
    if (appHtml.includes(scriptTag)) {
        appHtml = appHtml.replace(scriptTag, modalHtml + '\n    ' + scriptTag);
        fs.writeFileSync('public/app.html', appHtml);
        console.log('[OK] Modal de React insertado antes de app.js, centrado correctamente');
    } else {
        console.log('[ERROR] No encontre el tag <script src="app.js...">');
    }
} else {
    console.log('[SKIP] Modal ya existe en app.html');
}

// ============================================
// FIX 2: Asegurar que app.js tiene los handlers del modal y las funciones
// ============================================
let appJs = fs.readFileSync('public/app.js', 'utf8');

// Añadir funciones showActionStatus / hideActionStatus si no existen
if (!appJs.includes('function showActionStatus')) {
    appJs += `
// === Status Label Functions ===
function showActionStatus(text, icon) {
    console.log('[Status] ' + text);
}
function hideActionStatus() {
    // noop
}
`;
    console.log('[OK] Añadidas funciones showActionStatus/hideActionStatus');
}

// Añadir handler del modal de React si no existe
if (!appJs.includes('initReactModal')) {
    appJs += `
// === MODAL CREAR REACT ===
document.addEventListener('DOMContentLoaded', () => {
    const btnInitReact = document.getElementById('btnInitReact');
    const initReactModal = document.getElementById('initReactModal');
    const cancelInitReactBtn = document.getElementById('cancelInitReactBtn');
    const confirmInitReactBtn = document.getElementById('confirmInitReactBtn');

    if (btnInitReact && initReactModal) {
        btnInitReact.addEventListener('click', () => {
            initReactModal.classList.remove('hidden');
            initReactModal.style.display = 'flex';
        });
    }
    if (cancelInitReactBtn && initReactModal) {
        cancelInitReactBtn.addEventListener('click', () => {
            initReactModal.classList.add('hidden');
            initReactModal.style.display = 'none';
        });
    }
    if (confirmInitReactBtn && initReactModal) {
        confirmInitReactBtn.addEventListener('click', () => {
            initReactModal.classList.add('hidden');
            initReactModal.style.display = 'none';
            
            fetch('/api/init-react', { method: 'POST' })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        alert('Se abrió una ventana de comandos para instalar React. Espera a que finalice.');
                    } else {
                        alert('Error: ' + data.error);
                    }
                })
                .catch(err => {
                    alert('Error de conexión: ' + err.message);
                });
        });
    }
});
`;
    console.log('[OK] Añadido handler del modal React en app.js');
}

fs.writeFileSync('public/app.js', appJs);

// ============================================
// FIX 3: Cambiar endpoint /api/select-folder de PowerShell a VBScript
// ============================================
let serverJs = fs.readFileSync('server.js', 'utf8');

// Buscar el bloque del endpoint select-folder que usa PowerShell
const selectFolderStart = serverJs.indexOf("app.get('/api/select-folder'");
if (selectFolderStart !== -1) {
    // Encontrar el final del handler (buscar el });  que cierra la ruta)
    let braceCount = 0;
    let endIdx = -1;
    let foundFirstBrace = false;
    for (let i = selectFolderStart; i < serverJs.length; i++) {
        if (serverJs[i] === '{') { braceCount++; foundFirstBrace = true; }
        if (serverJs[i] === '}') { braceCount--; }
        if (foundFirstBrace && braceCount === 0) {
            // Encontramos el cierre de la arrow function, ahora buscar ");"
            const rest = serverJs.substring(i);
            const closeMatch = rest.indexOf(');');
            if (closeMatch !== -1) {
                endIdx = i + closeMatch + 2;
                break;
            }
        }
    }
    
    if (endIdx !== -1) {
        const newEndpoint = `app.get('/api/select-folder', (req, res) => {
    const os = require('os');
    const tempVbs = path.join(os.tmpdir(), 'folder_picker_' + Date.now() + '.vbs');
    const tempOut = path.join(os.tmpdir(), 'folder_out_' + Date.now() + '.txt');
    
    const vbsCode = [
        'Set objShell = CreateObject("Shell.Application")',
        'Set objFolder = objShell.BrowseForFolder(0, "Selecciona la carpeta con tus imágenes", &H0051, "")',
        'If Not objFolder Is Nothing Then',
        '    Set fso = CreateObject("Scripting.FileSystemObject")',
        '    Set f = fso.CreateTextFile("' + tempOut.replace(/\\\\/g, '\\\\\\\\') + '", True)',
        '    f.WriteLine objFolder.Self.Path',
        '    f.Close',
        'End If',
    ].join('\\r\\n');
    
    try {
        fs.writeFileSync(tempVbs, vbsCode);
        const { exec } = require('child_process');
        exec('cscript //nologo "' + tempVbs + '"', { timeout: 60000 }, (err) => {
            try { fs.unlinkSync(tempVbs); } catch(e) {}
            try {
                if (fs.existsSync(tempOut)) {
                    const p = fs.readFileSync(tempOut, 'utf8').trim();
                    fs.unlinkSync(tempOut);
                    if (p) return res.json({ path: p });
                }
            } catch(e) {}
            res.json({ error: 'Cancelado' });
        });
    } catch(e) {
        res.status(500).json({ error: 'Error interno: ' + e.message });
    }
});`;
        
        serverJs = serverJs.substring(0, selectFolderStart) + newEndpoint + serverJs.substring(endIdx);
        fs.writeFileSync('server.js', serverJs);
        console.log('[OK] Endpoint /api/select-folder migrado de PowerShell a VBScript');
    } else {
        console.log('[ERROR] No pude encontrar el final del endpoint select-folder');
    }
} else {
    console.log('[ERROR] No encontré el endpoint /api/select-folder en server.js');
}

// ============================================
// FIX 4: Añadir CSS collapsed si no existe
// ============================================
let css = fs.readFileSync('public/style.css', 'utf8');
if (!css.includes('.task-card.collapsed')) {
    css += `
/* Collapsed task cards */
.task-card.collapsed .task-text,
.task-card.collapsed .repo-response,
.task-card.collapsed .task-row:not(:first-child) {
    display: none !important;
}
.task-card.collapsed .chevron-icon {
    transform: rotate(-90deg);
}
`;
    fs.writeFileSync('public/style.css', css);
    console.log('[OK] CSS collapsed añadido');
}

console.log('=== FIXES COMPLETADOS ===');
