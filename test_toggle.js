const fs = require('fs');
const jsCode = fs.readFileSync('public/app.js', 'utf8');

const dummyElement = {
    addEventListener: () => {},
    classList: { add: ()=>{}, remove: ()=>{}, toggle: ()=>{}, contains: ()=>false },
    style: {},
    querySelector: () => dummyElement,
    querySelectorAll: () => [],
    appendChild: () => {},
    prepend: () => {},
    innerHTML: '',
    innerText: '',
    textContent: '',
    value: '',
    className: '',
    closest: () => dummyElement,
    contentDocument: { getElementById: () => dummyElement }
};

global.window = {
    addEventListener: () => {},
    setTimeout: setTimeout,
    setInterval: setInterval,
    clearTimeout: clearTimeout,
    clearInterval: clearInterval,
    localStorage: { getItem: ()=>null, setItem: ()=>{} },
    location: { reload: ()=>{} }
};

const htmlCode = fs.readFileSync('public/app.html', 'utf8');

global.document = {
    getElementById: (id) => {
        if (!htmlCode.includes('id=\"' + id + '\"') && !htmlCode.includes('id=\'' + id + '\'')) {
            return null; // Return null if it doesn't exist in HTML, exactly like browser!
        }
        return dummyElement;
    },
    querySelector: (sel) => dummyElement,
    querySelectorAll: (sel) => [],
    addEventListener: (ev, cb) => {
        if(ev === 'DOMContentLoaded') {
            global.onDOMContentLoaded = cb;
        }
    },
    createElement: () => dummyElement
};

global.localStorage = global.window.localStorage;
global.fetch = () => Promise.resolve({ json: ()=>Promise.resolve({}) });

try {
    eval(jsCode);
    console.log('Top level execution finished successfully.');
    if (global.onDOMContentLoaded) {
        console.log('Running DOMContentLoaded...');
        global.onDOMContentLoaded();
        console.log('DOMContentLoaded finished successfully.');
    }
} catch(e) {
    console.error('RUNTIME ERROR IN APP.JS:', e);
}
