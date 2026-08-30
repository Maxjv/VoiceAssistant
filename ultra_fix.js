const fs = require('fs');
const path = require('path');

// 1. Fix style.css
let css = fs.readFileSync('public/style.css', 'utf8');
if (css.includes('.hidden { display: none !important; }')) {
    css = css.replace('.hidden { display: none !important; }', '');
    fs.writeFileSync('public/style.css', css);
    console.log('Fixed style.css (Removed breaking .hidden rule)');
}

// 2. Fix server.js VBScript
let serverJs = fs.readFileSync('server.js', 'utf8');

const oldEndpointStart = serverJs.indexOf("app.get('/api/select-folder'");
if (oldEndpointStart !== -1) {
    let braceCount = 0;
    let endIdx = -1;
    let foundFirstBrace = false;
    for (let i = oldEndpointStart; i < serverJs.length; i++) {
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
        const newEndpoint = `app.get('/api/select-folder', (req, res) => {
    const os = require('os');
    const tempVbs = path.join(os.tmpdir(), 'folder_picker_' + Date.now() + '.vbs');
    const tempOut = path.join(os.tmpdir(), 'folder_out_' + Date.now() + '.txt');
    
    const vbsCode = [
        'Set objShell = CreateObject("Shell.Application")',
        'Set objFolder = objShell.BrowseForFolder(0, "Selecciona la carpeta con tus imagenes", &H0051, "")',
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
        serverJs = serverJs.substring(0, oldEndpointStart) + newEndpoint + serverJs.substring(endIdx);
        fs.writeFileSync('server.js', serverJs);
        console.log('Fixed server.js (Migrated to wscript without accents)');
    }
}
