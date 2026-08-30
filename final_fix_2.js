const fs = require('fs');

// 1. Fix server.js to use clean powershell invocation
let serverJs = fs.readFileSync('server.js', 'utf8');

const apiStart = serverJs.indexOf("app.get('/api/select-folder'");
if (apiStart !== -1) {
    let braceCount = 0;
    let endIdx = -1;
    let foundFirstBrace = false;
    for (let i = apiStart; i < serverJs.length; i++) {
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
        const psEndpoint = `app.get('/api/select-folder', (req, res) => {
    const os = require('os');
    const path = require('path');
    const tempPs1 = path.join(os.tmpdir(), 'folder_picker_' + Date.now() + '.ps1');
    const tempOut = path.join(os.tmpdir(), 'folder_out_' + Date.now() + '.txt');
    const psCode = \`
Add-Type -AssemblyName System.windows.forms
$f = New-Object System.Windows.Forms.FolderBrowserDialog
$f.Description = 'Selecciona la carpeta'
$f.ShowNewFolderButton = $true
$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
if ($f.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK) {
    Set-Content -Path '\${tempOut}' -Value $f.SelectedPath
}
    \`.trim();

    try {
        const fs = require('fs');
        fs.writeFileSync(tempPs1, psCode);
        const { exec } = require('child_process');
        exec('powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + tempPs1 + '"', { timeout: 60000 }, (err) => {
            try { fs.unlinkSync(tempPs1); } catch (e) { }
            try {
                if (fs.existsSync(tempOut)) {
                    const p = fs.readFileSync(tempOut, 'utf8').trim();
                    fs.unlinkSync(tempOut);
                    if (p) return res.json({ path: p });
                }
            } catch (e) { }
            res.json({ error: 'Cancelado o no se selecciono nada' });
        });
    } catch (e) {
        res.status(500).json({ error: 'Error interno: ' + e.message });
    }
});`;
        serverJs = serverJs.substring(0, apiStart) + psEndpoint + serverJs.substring(endIdx);
        fs.writeFileSync('server.js', serverJs);
        console.log('Fixed server.js (PowerShell Hidden TopMost)');
    }
}

// 2. Add error alert to gallery.html
let galleryHtml = fs.readFileSync('public/gallery.html', 'utf8');
const fetchBlock = `        btnAddExtFolder.onclick = () => {
            fetch('/api/select-folder')
                .then(r => r.json())
                .then(data => {
                    if (data.error) {
                        alert('Selección cancelada o error: ' + data.error);
                        return;
                    }
                    if (data.path) {
                        const name = data.path.split(/[\\/\\\\]/).pop();
                        if (!externalFolders.find(f => f.path === data.path)) {
                            externalFolders.push({ name, path: data.path });
                            localStorage.setItem('tfte_ext_folders', JSON.stringify(externalFolders));
                        }
                        load('', data.path); // Load it immediately
                        renderExternalFolders();
                    }
                })
                .catch(err => alert('Error crítico al abrir el selector: ' + err.message));
        };`;

// Replace the old onclick block
const oldOnclickRegex = /btnAddExtFolder\.onclick\s*=\s*\(\)\s*=>\s*\{[\s\S]*?renderExternalFolders\(\);\s*\}\s*\}\)\s*;/g;
if (oldOnclickRegex.test(galleryHtml)) {
    galleryHtml = galleryHtml.replace(oldOnclickRegex, fetchBlock);
    fs.writeFileSync('public/gallery.html', galleryHtml);
    console.log('Fixed gallery.html (Added error alerts)');
} else {
    console.log('Could not find old onclick block in gallery.html');
}

// Sync to dist
fs.copyFileSync('server.js', 'dist_production/server.js');
fs.copyFileSync('public/gallery.html', 'dist_production/public/gallery.html');
console.log('Synced files to dist_production');
