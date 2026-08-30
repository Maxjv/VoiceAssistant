const fs = require('fs');

let serverJs = fs.readFileSync('server.js', 'utf8');

// Replace the old exec line with the one containing -STA
serverJs = serverJs.replace(
    /exec\('powershell\.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File "' \+ tempPs1 \+ '"',/g,
    'exec(\\\'powershell.exe -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File "\\\' + tempPs1 + \\\'"\\\','
);

// Wait, doing string replacement on complex quotes can be tricky. Let me just replace the exact substring.
// I'll re-read to avoid multiple replaces if I rerun.
serverJs = fs.readFileSync('server.js', 'utf8');
if (serverJs.includes("exec('powershell.exe -WindowStyle Hidden")) {
    serverJs = serverJs.replace(
        "exec('powershell.exe -WindowStyle Hidden",
        "exec('powershell.exe -STA -WindowStyle Hidden"
    );
    fs.writeFileSync('server.js', serverJs);
    console.log('Fixed STA in server.js');
} else {
    console.log('Could not find exec line in server.js');
}

fs.copyFileSync('server.js', 'dist_production/server.js');
console.log('Copied to dist_production');
