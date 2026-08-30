const fs = require('fs');
const path = require('path');

// 1. REWRITE /api/select-folder to use VBScript (wscript) properly without accents
let serverJs = fs.readFileSync('server.js', 'utf8');

const psCodeStart = serverJs.indexOf("app.get('/api/select-folder'");
if (psCodeStart !== -1) {
    let braceCount = 0;
    let endIdx = -1;
    let foundFirstBrace = false;
    for (let i = psCodeStart; i < serverJs.length; i++) {
        if (serverJs[i] === '{') { braceCount++; foundFirstBrace = true; }
        if (serverJs[i] === '}') { braceCount--; }
        if (foundFirstBrace && braceCount === 0) {
            const rest = serverJs.substring(i);
            const closeMatch = rest.indexOf(');');
            if (closeMatch !== -1) {
                endIdx = i + closeMatch + 2;
                break;
            }
        }
    }

    if (endIdx !== -1) {
        const vbsEndpoint = `app.get('/api/select-folder', (req, res) => {
    const os = require('os');
    const tempVbs = path.join(os.tmpdir(), 'folder_picker_' + Date.now() + '.vbs');
    const tempOut = path.join(os.tmpdir(), 'folder_out_' + Date.now() + '.txt');
    
    const vbsCode = [
        'Set objShell = CreateObject("Shell.Application")',
        'Set objFolder = objShell.BrowseForFolder(0, "Selecciona la carpeta", &H0051, "")',
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
        exec('wscript //nologo "' + tempVbs + '"', { timeout: 60000 }, (err) => {
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
        serverJs = serverJs.substring(0, psCodeStart) + vbsEndpoint + serverJs.substring(endIdx);
        fs.writeFileSync('server.js', serverJs);
        console.log('Fixed server.js (VBScript wscript)');
    }
}

// 2. REWRITE app.js "Crear React" button to ensure it works
let appJs = fs.readFileSync('public/app.js', 'utf8');

// Wipe out any existing btnInitReact logic to avoid duplicates
appJs = appJs.replace(/const btnInitReact = [\s\S]+?(?=function showActionStatus|$)/g, '');

const reactLogic = `
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
        
        if (typeof showActionStatus === 'function') showActionStatus('Inicializando...', 'bolt');
        
        fetch('/api/init-react', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                if(data.success) {
                    if (typeof addTranscriptText === 'function') addTranscriptText('Se abrió una ventana para instalar React. El panel lo detectará cuando finalice.', 'ai');
                    setTimeout(() => { if (typeof hideActionStatus === 'function') hideActionStatus(); }, 3000);
                } else {
                    alert('Error: ' + data.error);
                    if (typeof hideActionStatus === 'function') hideActionStatus();
                }
            })
            .catch(err => {
                alert('Error de conexión');
                if (typeof hideActionStatus === 'function') hideActionStatus();
            });
    });
}

`;

appJs += reactLogic;
fs.writeFileSync('public/app.js', appJs);
console.log('Fixed public/app.js (React Modal)');

// 3. Sync to dist_production using clean File System Copy to avoid encoding corruption
const filesToCopy = ["app.html", "app.js", "style.css", "gallery.html", "plan.html", "Control_Template.html"];
filesToCopy.forEach(f => {
    fs.copyFileSync(path.join(__dirname, 'public', f), path.join(__dirname, 'dist_production', 'public', f));
});
fs.copyFileSync(path.join(__dirname, 'server.js'), path.join(__dirname, 'dist_production', 'server.js'));
console.log('Synced files to dist_production');
