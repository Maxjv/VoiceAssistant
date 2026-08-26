const fs = require('fs');
const js = fs.readFileSync('public/app.js', 'utf8');

const mockDocument = {
    getElementById: (id) => { return { classList: { add:()=>{}, remove:()=>{}, contains:()=>false }, style: {}, addEventListener: ()=>{}, parentElement: {} }; },
    addEventListener: () => {}
};
const mockWindow = {
    addEventListener: () => {},
    speechSynthesis: {},
    location: {},
    SpeechRecognition: function() {},
    webkitSpeechRecognition: function() {}
};

global.document = mockDocument;
global.window = mockWindow;
global.localStorage = { getItem: () => null, setItem: () => {} };
global.navigator = { mediaDevices: { getUserMedia: () => Promise.resolve() } };

try {
    eval(js);
    console.log('EVAL SUCCESSFUL');
} catch(e) {
    console.error('EVAL FAILED AT LINE:', e.stack);
}
