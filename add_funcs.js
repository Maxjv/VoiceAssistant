const fs = require('fs');
let c = fs.readFileSync('public/app.js', 'utf8');
if (!c.includes('function showActionStatus')) {
    c += `
function showActionStatus(text, icon) {
    const el = document.getElementById('actionStatusLabel');
    if (el) {
        el.innerHTML = '<span class="material-icons-round" style="font-size:1rem;">' + icon + '</span> ' + text;
        el.style.display = 'flex';
    }
}
function hideActionStatus() {
    const el = document.getElementById('actionStatusLabel');
    if (el) el.style.display = 'none';
}
`;
    fs.writeFileSync('public/app.js', c);
    console.log('Added showActionStatus');
}
