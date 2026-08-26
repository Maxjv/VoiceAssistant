const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Iniciando Cloudflare Tunnel...');
const cloudflared = spawn('npx', ['cloudflared', 'tunnel', '--url', 'http://127.0.0.1:4000'], {
    shell: true
});

let urlFound = false;

cloudflared.stderr.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(output); // Print to console

    // Extraer la URL de trycloudflare.com
    const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    
    if (match && !urlFound) {
        const tunnelUrl = match[0];
        console.log('\n======================================================');
        console.log('✅ URL DEL TÚNEL ENCONTRADA: ' + tunnelUrl);
        console.log('======================================================\n');
        
        // Crear el archivo HTML con redirección automática
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Voice Assistant Link</title>
    <meta http-equiv="refresh" content="0; url=${tunnelUrl}">
    <style>
        body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: white; }
        a { color: #38bdf8; text-decoration: none; font-size: 1.2rem; }
    </style>
</head>
<body>
    <h2>Redirigiendo a tu servidor...</h2>
    <p>Si no te redirige automáticamente, haz clic abajo:</p>
    <a href="${tunnelUrl}">${tunnelUrl}</a>
</body>
</html>`;
        
        const filePath = path.join(__dirname, 'ipad_link.html');
        fs.writeFileSync(filePath, htmlContent, 'utf8');
        console.log(`✅ Archivo generado exitosamente en: ${filePath}`);
        
        urlFound = true;
    }
});

cloudflared.on('close', (code) => {
    console.log(`Cloudflared tunnel se cerró con código ${code}`);
});
