const fs = require('fs');

let code = fs.readFileSync('public/app.js', 'utf8');

// 1. Fix dangling catch blocks from previous agent
code = code.replace(/} catch \(e\) {\s*}\s*}\s*}\s*catch \(e\) {\s*}/g, '} catch (e) {}\n}\n');

// 2. Change agentBackend to gemini
code = code.replace(/let agentBackend = localStorage\.getItem\('tfte_agent_backend'\) \|\| 'claude';/, 
                    "let agentBackend = localStorage.getItem('tfte_agent_backend') || 'gemini';");

// 3. Audio unlock for mobile browsers
const unlockAudioCode = `
// Audio unlock for mobile browsers
let audioUnlocked = false;
function unlockAudio() {
    if (audioUnlocked) return;
    const silentAudio = new Audio('data:audio/mp3;base64,//OExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq');
    silentAudio.play().then(() => {
        audioUnlocked = true;
    }).catch(e => console.error("Audio unlock failed:", e));
}
`;
code = code.replace(/let isRecording = false;/, unlockAudioCode + "\nlet isRecording = false;");

code = code.replace(/micBtn\.addEventListener\('click', toggleRecording\);/, 
`micBtn.addEventListener('click', () => {
    unlockAudio();
    toggleRecording();
});`);

// 4. Force context simulation on load
code = code.replace(/if \(\!sessionStorage\.getItem\('contextLoaded'\)\) {([\s\S]*?)} else {\s*startupModal\.classList\.add\('hidden'\);\s*}/m, 
    "$1");

// 5. procesarCola waits for contextLoaded
code = code.replace(/async function procesarCola\(\) {\s*if \(isProcessingQueue\) return;\s*isProcessingQueue = true;/m, 
    "async function procesarCola() {\n    if (isProcessingQueue) return;\n    if (!sessionStorage.getItem('contextLoaded')) return; // Wait for context\n    isProcessingQueue = true;");

// 6. trigger procesarCola after context loaded
code = code.replace(/} catch \(error\) {\s*console\.error\('Error cargando contexto:', error\);\s*if \(statusLabel\) {\s*statusLabel\.textContent = 'Error cargando contexto';\s*statusLabel\.style\.color = '#ef4444';\s*}\s*}\s*}\);\s*}/m,
`} catch (error) {
                    console.error('Error cargando contexto:', error);
                    if (statusLabel) {
                        statusLabel.textContent = 'Error cargando contexto';
                        statusLabel.style.color = '#ef4444';
                    }
                }
            }, 1500);
        } catch (e) {
            if (statusLabel) {
                statusLabel.textContent = 'Error iniciando';
                statusLabel.style.color = '#ff4d4f';
            }
        }
        procesarCola(); // Start queued tasks
    });
}`);

// 7. createTaskCard Redesign (Vertical + Number)
const oldCardBlock = `    // For repo: 3 columns. For popup: vertical.
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
                "<button class='task-btn btn-ok' onclick='responderAgente(\"yes\")'><span class='material-icons-round'>check</span>Ok, ejecútalo</button>" +
                "<button class='task-btn btn-cancel' onclick='responderAgente(\"no\")'><span class='material-icons-round'>close</span>Cancelar</button>" +
            "</div>";
    } else {
        card.innerHTML = 
            "<div class='task-header'>" +
                "<span class='task-status " + task.status + "' id='task-status-"+task.id+suf+"'>" + getStatusLabel(task.status) + "</span>" +
            "</div>" +
            "<p class='task-text'>" + task.text + "</p>" +
            "<p class='task-ai-response' id='task-response-"+task.id+suf+"' style='display: "+(task.responseText?'block':'none')+"'>" + (task.responseText||'') + "</p>" +
            "<div class='task-actions' id='task-actions-"+task.id+suf+"' style='display: none;'>" +
                "<button class='task-btn btn-ok' onclick='responderAgente(\"yes\")'><span class='material-icons-round'>check</span>Proceder</button>" +
                "<button class='task-btn btn-cancel' onclick='responderAgente(\"no\")'><span class='material-icons-round'>close</span>Cancelar</button>" +
            "</div>";
    }`;

const newCardBlock = `    card.classList.remove('task-card-row');
    card.innerHTML = 
        "<div class='task-header'>" +
            "<div><strong style='color: white; margin-right: 8px;'>#" + task.id + "</strong><span class='task-status " + task.status + "' id='task-status-"+task.id+suf+"'>" + getStatusLabel(task.status) + "</span></div>" +
        "</div>" +
        "<div style='margin-bottom: 8px;'>" +
            "<p style='font-size: 0.8rem; color: #94a3b8; margin: 0 0 4px 0;'>Tu petición:</p>" +
            "<p class='task-text' style='background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px;'>" + task.text + "</p>" +
        "</div>" +
        "<div id='task-response-container-"+task.id+suf+"' style='display: "+(task.responseText?'block':'none')+"; margin-bottom: 8px;'>" +
            "<p style='font-size: 0.8rem; color: #93c5fd; margin: 0 0 4px 0;'><span class='material-icons-round' style='font-size: 14px; vertical-align: middle; margin-right: 4px;'>smart_toy</span>Respuesta del Agente:</p>" +
            "<p class='task-ai-response' id='task-response-"+task.id+suf+"' style='background: rgba(59, 130, 246, 0.1); padding: 10px; border-radius: 8px; border-left: 3px solid #3b82f6; display: block;'>" + (task.responseText||'') + "</p>" +
        "</div>" +
        "<div class='task-actions' id='task-actions-"+task.id+suf+"' style='display: "+actionsDisplay+";'>" +
            "<button class='task-btn btn-ok' onclick='responderAgente(\"yes\")'><span class='material-icons-round'>check</span>Ok, ejecútalo</button>" +
            "<button class='task-btn btn-cancel' onclick='responderAgente(\"no\")'><span class='material-icons-round'>close</span>Cancelar</button>" +
        "</div>";`;

code = code.replace(oldCardBlock, newCardBlock);

// 8. updateTaskUI fixes
code = code.replace(
    /const actionsEl = el\.querySelector\('#task-actions-' \+ task\.id \+ suf\);\s*if \(statusEl\) {/m,
    `const responseContainerEl = el.querySelector('#task-response-container-' + task.id + suf);
        const actionsEl = el.querySelector('#task-actions-' + task.id + suf);
        
        if (statusEl) {`
);

code = code.replace(
    /if \(responseEl && task\.responseText\) {\s*responseEl\.textContent = task\.responseText;\s*responseEl\.style\.display = 'block';\s*}/m,
    `if (responseEl && task.responseText) {
            responseEl.innerHTML = task.responseText;
            responseEl.style.display = 'block';
            if (responseContainerEl) {
                responseContainerEl.style.display = 'block';
            }
        }`
);

// 9. Latency tracking in sendToAgente & pollAgente
code = code.replace(
    /async function sendToAgente\(text, folder\) \{([\s\S]*?)await pollAgente\(task\);/m,
    `async function sendToAgente(text, folder) {
    const task = tasks.find(t => t.status === 'thinking'); // The current one
    const startTime = Date.now();
    try {
        const response = await fetch('/api/agente', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: "INSTRUCCIÓN DE SISTEMA: 1. Analiza mi siguiente instrucción. 2. RESPONDE ÚNICAMENTE CON TU RAZONAMIENTO sobre lo que harías. 3. NO uses herramientas ni edites código. 4. Espera a que te diga 'Ok, ejecútalo'. Mi instrucción es: " + text, backend: agentBackend, folder: folder || '' })
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error((errorData && errorData.error) || 'No se pudo enviar al agente');
        }
        await pollAgente(task, startTime);`
);

code = code.replace(
    /function pollAgente\(\) \{/g,
    `function pollAgente(task, startTime = null) {`
);

code = code.replace(
    /addTranscriptText\(data\.respuesta, 'ai'\);\s*await playAgentAudio\(data\.respuesta\);\s*resolve\(\);/g,
    `addTranscriptText(data.respuesta, 'ai');
                    if (task) {
                        let text = data.respuesta;
                        if (startTime) {
                            const latency = ((Date.now() - startTime) / 1000).toFixed(1);
                            text += " <br><small style='color: #64748b; font-size: 0.75rem; margin-top: 8px; display: block;'>⏱️ Tiempo de respuesta: " + latency + "s</small>";
                        }
                        task.responseText = text;
                        task.status = 'esperando_confirmacion';
                        updateTaskUI(task);
                    }
                    await playAgentAudio(data.respuesta);
                    resolve();`
);

code = code.replace(
    /updateTaskUI\(task\);\s*await pollAgente\(task\);/g,
    `updateTaskUI(task);\n        await pollAgente(task, Date.now());`
);


fs.writeFileSync('public/app.js', code);
console.log("Applied ALL fixes!");
