const jsdom = require('C:/Users/Maxi Vargas/AppData/Roaming/npm/node_modules/jsdom');
const { JSDOM } = jsdom;
const fs = require('fs');

const html = fs.readFileSync('public/app.html', 'utf8');
const js = fs.readFileSync('public/app.js', 'utf8');

// We need to provide a minimal mocked environment for app.js
const combinedHtml = html.replace(/<script src="app.js[^>]*><\/script>/g, '<script>' + js + '</script>');

const virtualConsole = new jsdom.VirtualConsole();
virtualConsole.on('error', (err) => { console.error('JS_ERROR:', err); });
virtualConsole.on('warn', (warn) => { console.warn('JS_WARN:', warn); });
virtualConsole.on('info', (info) => { console.info('JS_INFO:', info); });
virtualConsole.on('log', (log) => { console.log('JS_LOG:', log); });

const dom = new JSDOM(combinedHtml, {
    runScripts: 'dangerously',
    virtualConsole
});

console.log('JSDOM loaded.');
setTimeout(() => {
    console.log('Test complete.');
}, 2000);
