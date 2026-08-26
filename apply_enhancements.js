const fs = require('fs');

let code = fs.readFileSync('public/app.js', 'utf8');

// 1. Fix the syntax errors left by patch_app_final.js
// First error: onclick="responderAgente('yes')" was injected as \"yes\" which evaluated to "yes" breaking the string
code = code.replace(
    /onclick='responderAgente\("yes"\)'/g,
    `onclick='responderAgente(\\"yes\\")'`
);
code = code.replace(
    /onclick='responderAgente\("no"\)'/g,
    `onclick='responderAgente(\\"no\\")'`
);

// Second error: dangling catch blocks because of regex missing the end of function
code = code.replace(
    /isProcessingQueue = false;\n\}\n catch \(e\) \{\n            console\.error\('Error procesando mensaje de la cola:', e\);\n        \}\n    \}\n    queueBusy = false;\n\}/g,
    `isProcessingQueue = false;\n}`
);

code = code.replace(
    /    \}\n\}\n catch \(error\) \{\n        console\.error\('Error enviando al agente:', error\);\n        updateUIState\('ready'\);\n        addTranscriptText\(error\.message \|\| 'Error de conexión con el agente\.', 'error'\);\n    \}\n\}/g,
    `    }\n}`
);

// 2. Repository UI Grid (createTaskCard)
// Change vertical card into a horizontal row
const newCreateTask = `function createTaskCard(task, isPopup = false) {
    const suf = isPopup ? '-popup' : '-repo';
    const card = document.createElement('div');
    card.className = 'task-card task-card-row'; // Use new class for horizontal layout
    card.id = 'task-' + task.id + suf;
    
    let actionsDisplay = task.status === 'esperando_confirmacion' ? 'flex' : 'none';
    if (isPopup) actionsDisplay = 'none'; // Popups handled separately
    
    // For repo: 3 columns. For popup: vertical.
    if (!isPopup) {
        card.innerHTML = 
            "<div class='task-col-question'>" + 
                "<span class='task-status " + task.status + "' id='task-status-"+task.id+suf+"'>" + getStatusLabel(task.status) + "</span>" +
                "<p class='task-text'>" + task.text + "</p>" +
            "</div>" +
            "<div class='task-col-response'>" +
                "<p class='task-ai-response' id='task-response-"+task.id+suf+"' style='display: "+(task.responseText?'block':'none')+"'>" + (task.responseText||'') + "</p>" +
            "</div>" +
            "<div class='task-col-actions task-actions' id='task-actions-"+task.id+suf+"' style='display: "+actionsDisplay+";'>" +
                "<button class='task-btn btn-ok' onclick='responderAgente(\\"yes\\")'><span class='material-icons-round'>check</span>Ok, ejecútalo</button>" +
                "<button class='task-btn btn-cancel' onclick='responderAgente(\\"no\\")'><span class='material-icons-round'>close</span>Cancelar</button>" +
            "</div>";
    } else {
        card.innerHTML = 
            "<div class='task-header'>" +
                "<span class='task-status " + task.status + "' id='task-status-"+task.id+suf+"'>" + getStatusLabel(task.status) + "</span>" +
            "</div>" +
            "<p class='task-text'>" + task.text + "</p>" +
            "<p class='task-ai-response' id='task-response-"+task.id+suf+"' style='display: "+(task.responseText?'block':'none')+"'>" + (task.responseText||'') + "</p>" +
            "<div class='task-actions' id='task-actions-"+task.id+suf+"' style='display: none;'>" +
                "<button class='task-btn btn-ok' onclick='responderAgente(\\"yes\\")'><span class='material-icons-round'>check</span>Proceder</button>" +
                "<button class='task-btn btn-cancel' onclick='responderAgente(\\"no\\")'><span class='material-icons-round'>close</span>Cancelar</button>" +
            "</div>";
    }
    return card;
}`;
if (code.includes('function createTaskCard')) {
    code = code.replace(/function createTaskCard[\s\S]*?return card;\n\}/, newCreateTask);
}


// 3. Update addTranscriptText to add audio icon
code = code.replace(
    /p\.className = type === 'user' \? 'user-text' : type === 'error' \? 'user-text' : 'ai-text';\n    p\.textContent = text;/g,
    `p.className = type === 'user' ? 'user-text' : type === 'error' ? 'user-text' : 'ai-text';
    if (type === 'ai') {
        p.innerHTML = '<span class="material-icons-round" style="vertical-align: middle; margin-right: 5px; font-size: 18px;">volume_up</span>' + text;
    } else {
        p.textContent = text;
    }`
);


// 4. Append Startup Logic with 3-Step Instruction Optimization
const startupLogic = `
// --- STARTUP MODAL LOGIC ---
const startupModal = document.getElementById('startupModal');
const startContextBtn = document.getElementById('startContextBtn');

if (startupModal) {
    if (!sessionStorage.getItem('contextLoaded')) {
        setTimeout(() => {
            startupModal.classList.remove('hidden');
        }, 2500);
    } else {
        startupModal.classList.add('hidden');
    }

    startContextBtn.addEventListener('click', async () => {
        startContextBtn.style.display = 'none';
        
        const folderVal = document.getElementById('startupContext').value.trim();
        const folderInput = document.getElementById('folderInput');
        if (folderInput) {
            folderInput.value = folderVal;
            localStorage.setItem('tfte_last_folder', folderVal);
        }

        const statusLabel = document.getElementById('contextStatusLabel');
        if (statusLabel) {
            statusLabel.style.display = 'inline-block';
            statusLabel.textContent = 'Enviando petición...';
        }

        sessionStorage.setItem('contextLoaded', 'true');
        startupModal.classList.add('hidden');
        startContextBtn.style.display = 'block';

        try {
            await fetch('/api/agente', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: "Analiza brevemente el código fuente de la aplicación React (en la carpeta asignada al alcance) para tener contexto de mi plataforma. IMPORTANTE: No uses herramientas de edicion ni propongas ejecutar ningun comando, solo responde: 'Ya tengo el contexto. ¿Con qué avanzamos?'", 
                    backend: agentBackend,
                    folder: folderVal
                })
            });

            let simulatedProgress = 5;
            
            const pollInterval = setInterval(async () => {
                try {
                    const res = await fetch('/api/agente/estado?backend=' + agentBackend);
                    const data = await res.json();
                    
                    if (statusLabel) {
                        if (simulatedProgress < 90) simulatedProgress += 10;
                        
                        if (data.status === 'pensando') {
                            statusLabel.textContent = \`Loading Context... \${simulatedProgress}%\`;
                        } 
                        else if (data.status === 'ejecutando') {
                            statusLabel.textContent = \`Loading Context... \${simulatedProgress + 5}%\`;
                        }
                        else if (data.status === 'esperando_confirmacion' || data.status === 'idle') {
                            clearInterval(pollInterval);
                            statusLabel.textContent = 'Contexto 100%';
                            statusLabel.style.color = '#4caf50';
                            statusLabel.style.background = 'rgba(76, 175, 80, 0.1)';
                            statusLabel.style.borderColor = 'rgba(76, 175, 80, 0.3)';
                            
                            if (data.status === 'esperando_confirmacion') {
                                await fetch('/api/agente', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ message: 'no', backend: agentBackend })
                                });
                            }
                            
                            setTimeout(() => {
                                statusLabel.style.display = 'none';
                            }, 5000);
                        }
                    }
                } catch(err) {}
            }, 1500);
        } catch (e) {
            if (statusLabel) {
                statusLabel.textContent = 'Error';
                statusLabel.style.color = '#ff4d4f';
            }
        }
    });
}
`;

if (!code.includes('STARTUP MODAL LOGIC')) {
    code += "\\n" + startupLogic;
}

fs.writeFileSync('public/app.js', code);
console.log("Enhancements applied to app.js successfully!");
