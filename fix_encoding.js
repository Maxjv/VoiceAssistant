const fs = require('fs');
const glob = require('glob'); // Note: we might not have glob, better to use fs.readdirSync recursively
const path = require('path');

function fixEncoding(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    
    // Mappings for UTF-8 bytes that were read as Windows-1252
    const map = {
        'á': 'á',
        'é': 'é',
        'í': 'í',
        'ó': 'ó',
        'ú': 'ú',
        'ñ': 'ñ',
        'Á': 'Á',
        'É': 'É',
        'Í': 'Í',
        'Ó': 'Ó',
        'Ú': 'Ú',
        'Ñ': 'Ñ',
        '¿': '¿',
        '¡': '¡',
        '—': '—',
        'á': 'á',
        'é': 'é',
        '├â¡': 'í',
        'ó': 'ó',
        'ú': 'ú',
        'ñ': 'ñ',
        '🤖': '🤖',
        '🪙': '🪙',
        '🔑': '🔑',
        '⚠️': '⚠️',
        '⏳': '⏳'
    };

    for (const [bad, good] of Object.entries(map)) {
        content = content.split(bad).join(good);
    }

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Fixed: ${filePath}`);
    }
}

function scanDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && file !== 'node_modules' && file !== '.git') {
            scanDir(fullPath);
        } else if (fullPath.endsWith('.html') || fullPath.endsWith('.js') || fullPath.endsWith('.md')) {
            fixEncoding(fullPath);
        }
    }
}

scanDir(__dirname);
console.log("Encoding fix completed.");
