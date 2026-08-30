const fs = require('fs');

let code = fs.readFileSync('public/app.js', 'utf8');

// The dangerous un-guarded calls are:
// document.getElementById('deletePopupBackdrop').addEventListener(...)
// document.getElementById('cancelDeleteBtn').addEventListener(...)
// document.getElementById('confirmDeleteBtn').addEventListener(...)

// I will manually fix them using regex.
code = code.replace(/document\.getElementById\('deletePopupBackdrop'\)\.addEventListener/g, "var _dpb = document.getElementById('deletePopupBackdrop'); if (_dpb) _dpb.addEventListener");
code = code.replace(/document\.getElementById\('cancelDeleteBtn'\)\.addEventListener/g, "var _cdb = document.getElementById('cancelDeleteBtn'); if (_cdb) _cdb.addEventListener");
code = code.replace(/document\.getElementById\('confirmDeleteBtn'\)\.addEventListener/g, "var _cfdb = document.getElementById('confirmDeleteBtn'); if (_cfdb) _cfdb.addEventListener");

fs.writeFileSync('public/app.js', code);
console.log('Patched missing element guards in app.js');

// Also sync to dist_production
fs.copyFileSync('public/app.js', 'dist_production/public/app.js');
console.log('Synced to dist_production');
