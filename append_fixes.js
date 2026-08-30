const fs = require('fs');

// 1. Add modal to app.html
const modalHtml = `
<div id="initReactModal" class="lightbox hidden" style="background: rgba(0,0,0,0.8); z-index: 50; align-items:center; justify-content:center; position:fixed; inset:0; display: flex;">
    <div style="background: #1e293b; padding: 24px; border-radius: 12px; max-width: 400px; text-align: center; border: 1px solid rgba(255,255,255,0.1);">
        <span class="material-icons-round" style="font-size: 3rem; color: #f59e0b; margin-bottom: 12px;">bolt</span>
        <h3 style="margin-bottom: 8px;">Crear Proyecto React</h3>
        <p style="font-size: 0.9rem; color: #94a3b8; margin-bottom: 20px;">Esto generará los archivos base de React usando Vite en la carpeta front_react y hará npm install. ¿Deseas continuar?</p>
        <div style="display: flex; gap: 12px; justify-content: center;">
            <button id="cancelInitReactBtn" class="rail-btn" style="background: rgba(255,255,255,0.1); color: white;">Cancelar</button>
            <button id="confirmInitReactBtn" class="rail-btn" style="background: #3b82f6; color: white; font-weight: bold;">Continuar</button>
        </div>
    </div>
</div>
`;
let appHtml = fs.readFileSync('public/app.html', 'utf8');
if (!appHtml.includes('initReactModal')) {
    appHtml = appHtml.replace('</body>', modalHtml + '\n</body>');
    fs.writeFileSync('public/app.html', appHtml);
    console.log('Added modal to app.html');
}

// 2. Add css for collapsed
const cssRules = `
.task-card.collapsed .task-text,
.task-card.collapsed .repo-response,
.task-card.collapsed .task-row:not(:first-child) {
    display: none !important;
}
.task-card.collapsed .chevron-icon {
    transform: rotate(-90deg);
}
`;
let styleCss = fs.readFileSync('public/style.css', 'utf8');
if (!styleCss.includes('.collapsed')) {
    fs.appendFileSync('public/style.css', cssRules);
    console.log('Added collapsed rules to style.css');
}
