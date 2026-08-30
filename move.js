const fs = require('fs');
let appHtml = fs.readFileSync('public/app.html', 'utf8');

const modalStart = appHtml.indexOf('<div id="initReactModal"');
if (modalStart !== -1) {
    const endBody = appHtml.lastIndexOf('</body>');
    const modalHtml = appHtml.substring(modalStart, endBody).trim();
    appHtml = appHtml.substring(0, modalStart) + appHtml.substring(endBody);
    
    appHtml = appHtml.replace('<script src="app.js?v=20260830_v5"></script>', modalHtml + '\n    <script src="app.js?v=20260830_v5"></script>');
    fs.writeFileSync('public/app.html', appHtml);
    console.log('Moved modal before app.js successfully!');
}
