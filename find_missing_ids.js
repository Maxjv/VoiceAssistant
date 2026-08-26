const fs = require('fs');
const jsCode = fs.readFileSync('public/app.js', 'utf8');
const htmlCode = fs.readFileSync('public/app.html', 'utf8');

const regex = /document\.getElementById\('([^']+)'\)/g;
let match;
const missing = [];

while ((match = regex.exec(jsCode)) !== null) {
    const id = match[1];
    if (!htmlCode.includes('id=\"' + id + '\"') && !htmlCode.includes('id=\'' + id + '\'')) {
        missing.push(id);
    }
}
console.log('Missing IDs:', [...new Set(missing)]);
