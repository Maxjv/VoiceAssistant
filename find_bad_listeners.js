const fs = require('fs');
const jsCode = fs.readFileSync('public/app.js', 'utf8');

const missing = [
  'refreshBtn', 'previewUrlInput', 'lastMessageBtn', 'htmlSelector',
  'mainEnableSaveBtn', 'mainSaveStatus', 'cancelWhisperBtn',
  'editableTranscript', 'previewIframe', 'closeRepoBtn'
];

missing.forEach(id => {
    const lines = jsCode.split('\n');
    lines.forEach((line, i) => {
        if (line.includes(id + '.addEventListener')) {
            console.log('Found listener for missing ID', id, 'at line', i + 1, ':', line.trim());
        }
    });
});
