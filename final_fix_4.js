const fs = require('fs');

let html = fs.readFileSync('public/gallery.html', 'utf8');

// 1. Remove the syntax error at line 160
html = html.replace(/\s*\}\);\s*\}\);\s*grid\.innerHTML = '';/g, "\n            });\n\n            grid.innerHTML = '';");

// 2. Add the alert to btnAddExtFolder.onclick if not there
if (!html.includes('alert(data.error)')) {
    const fetchBlock = `        btnAddExtFolder.onclick = () => {
            fetch('/api/select-folder')
                .then(r => r.json())
                .then(data => {
                    if (data.error) {
                        alert('Selección cancelada o error: ' + data.error);
                        return;
                    }
                    if (data.path) {
                        const name = data.path.split(/[\\\\/]/).pop();
                        if (!externalFolders.find(f => f.path === data.path)) {
                            externalFolders.push({ name, path: data.path });
                            localStorage.setItem('tfte_ext_folders', JSON.stringify(externalFolders));
                        }
                        load('', data.path); // Load it immediately
                        
                        // force re-render of external folders
                        const parts = data.path.split(/[\\\\/]/).filter(Boolean);
                        crumbsEl.innerHTML = '';
                        const rootBtn = document.createElement('button');
                        rootBtn.className = 'crumb current';
                        rootBtn.textContent = 'Proyecto';
                        rootBtn.onclick = () => load('');
                        crumbsEl.appendChild(rootBtn);
                    }
                })
                .catch(err => alert('Error crítico al abrir el selector: ' + err.message));
        };`;
        
    const oldOnclickRegex = /btnAddExtFolder\.onclick\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\}\s*\}\)\s*;/g;
    html = html.replace(oldOnclickRegex, fetchBlock);
}

fs.writeFileSync('public/gallery.html', html);
console.log('Fixed gallery.html syntax error and added alert');

fs.copyFileSync('public/gallery.html', 'dist_production/public/gallery.html');
console.log('Synced to dist_production');
