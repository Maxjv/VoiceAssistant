const fs = require('fs');
let serverCode = fs.readFileSync('server.js', 'utf8');

serverCode = serverCode.replace(
    /const server = app\.listen\(port, \(\) => \{/,
    "const server = app.listen(port, '127.0.0.1', () => {"
);

fs.writeFileSync('server.js', serverCode, 'utf8');
console.log("Patched app.listen to use 127.0.0.1");
