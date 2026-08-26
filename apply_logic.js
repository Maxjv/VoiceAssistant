const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// Ensure responderAgente is defined if it was lost!
if (!code.includes('window.responderAgente = async function')) {
    const responderLogic = `
window.responderAgente = async function(res) {
    const task = tasks.find(t => t.status === 'esperando_confirmacion');
    if (!task) return;
    
    // Si res === 'yes', mandamos "Ok, ejecútalo. Procede y dame un resumen punto por punto."
    const msg = (res === 'yes') ? "Ok, ejecútalo. Procede y dame un resumen punto por punto." : "no";
    
    try {
        await fetch('/api/agente', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg, backend: agentBackend })
        });
        task.status = 'ejecutando';
        updateTaskUI(task);
        await pollAgente(task);
    } catch(e) {
        console.error(e);
    }
};
`;
    code += "\n" + responderLogic;
}

// Modify sendToAgente to prepend the 3-step reasoning prompt
code = code.replace(
    /body: JSON\.stringify\(\{ message: text, backend: agentBackend, folder: folder \|\| '' \}\)/g,
    `body: JSON.stringify({ message: "INSTRUCCIÓN DE SISTEMA: 1. Analiza mi siguiente instrucción. 2. RESPONDE ÚNICAMENTE CON TU RAZONAMIENTO sobre lo que harías. 3. NO uses herramientas ni edites código. 4. Espera a que te diga 'Ok, ejecútalo'. Mi instrucción es: " + text, backend: agentBackend, folder: folder || '' })`
);

fs.writeFileSync('public/app.js', code);
console.log("Applied responderAgente & 3-step instruction");
