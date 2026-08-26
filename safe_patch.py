import sys

with open('public/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix dangling catch blocks
content = content.replace("} catch (e) {\n        }\n    }\n} catch (e) {\n}", "} catch (e) {}\n}\n")

# 2. Add Audio Unlock
unlock_code = """
// Audio unlock for mobile browsers
let audioUnlocked = false;
function unlockAudio() {
    if (audioUnlocked) return;
    const silentAudio = new Audio('data:audio/mp3;base64,//OExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq');
    silentAudio.play().then(() => {
        audioUnlocked = true;
    }).catch(e => console.error("Audio unlock failed:", e));
}
let isRecording = false;
"""
content = content.replace("let isRecording = false;", unlock_code)
content = content.replace("micBtn.addEventListener('click', toggleRecording);", "micBtn.addEventListener('click', () => {\n    unlockAudio();\n    toggleRecording();\n});")


# 3. CreateTaskCard redesign
old_card = """    // For repo: 3 columns. For popup: vertical.
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
    }"""

new_card = """    card.classList.remove('task-card-row');
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
        "</div>";"""
content = content.replace(old_card, new_card)

# 4. updateTaskUI
old_ui = """        const responseEl = el.querySelector('#task-response-' + task.id + suf);
        const actionsEl = el.querySelector('#task-actions-' + task.id + suf);
        
        if (statusEl) {
            statusEl.className = 'task-status ' + task.status;
            statusEl.textContent = getStatusLabel(task.status);
        }
        if (responseEl && task.responseText) {
            responseEl.textContent = task.responseText;
            responseEl.style.display = 'block';
        }"""
new_ui = """        const responseEl = el.querySelector('#task-response-' + task.id + suf);
        const responseContainerEl = el.querySelector('#task-response-container-' + task.id + suf);
        const actionsEl = el.querySelector('#task-actions-' + task.id + suf);
        
        if (statusEl) {
            statusEl.className = 'task-status ' + task.status;
            statusEl.textContent = getStatusLabel(task.status);
        }
        if (responseEl && task.responseText) {
            responseEl.innerHTML = task.responseText;
            responseEl.style.display = 'block';
            if (responseContainerEl) responseContainerEl.style.display = 'block';
        }"""
content = content.replace(old_ui, new_ui)


# 5. procesarCola queue gating
content = content.replace("async function procesarCola() {\n    if (isProcessingQueue) return;\n    isProcessingQueue = true;", "async function procesarCola() {\n    if (isProcessingQueue) return;\n    if (!sessionStorage.getItem('contextLoaded')) return;\n    isProcessingQueue = true;")

# 6. Latency Tracking
content = content.replace("async function sendToAgente(text, folder) {\n    const task = tasks.find(t => t.status === 'thinking'); // The current one\n    try {", "async function sendToAgente(text, folder) {\n    const task = tasks.find(t => t.status === 'thinking');\n    const startTime = Date.now();\n    try {")
content = content.replace("await pollAgente();", "await pollAgente(task, startTime);")
content = content.replace("function pollAgente() {\n    return new Promise((resolve) => {", "function pollAgente(task = null, startTime = null) {\n    return new Promise((resolve) => {")

old_poll = """                const esNueva = data.respuesta && (data.respuesta !== lastAgentResponse || vistoOcupado);
                if (esNueva) {
                    lastAgentResponse = data.respuesta;
                    localStorage.setItem(lastSeenKey(agentBackend), data.respuesta);
                    clearInterval(agentPolling);
                    agentPolling = null;
                    addTranscriptText(data.respuesta, 'ai');
                    await playAgentAudio(data.respuesta);
                    resolve();
                }"""
new_poll = """                const esNueva = data.respuesta && (data.respuesta !== lastAgentResponse || vistoOcupado);
                if (esNueva) {
                    lastAgentResponse = data.respuesta;
                    localStorage.setItem(lastSeenKey(agentBackend), data.respuesta);
                    clearInterval(agentPolling);
                    agentPolling = null;
                    
                    let finalText = data.respuesta;
                    if (startTime) {
                        const latency = ((Date.now() - startTime) / 1000).toFixed(1);
                        finalText += " <br><small style='color: #64748b; font-size: 0.75rem; margin-top: 8px; display: block;'>⏱️ Tiempo de respuesta: " + latency + "s</small>";
                    }
                    if (task) {
                        task.responseText = finalText;
                        task.status = 'esperando_confirmacion';
                        updateTaskUI(task);
                    }
                    
                    addTranscriptText(data.respuesta, 'ai');
                    await playAgentAudio(data.respuesta);
                    resolve();
                }"""
content = content.replace(old_poll, new_poll)
content = content.replace("updateTaskUI(task);\n        await pollAgente();", "updateTaskUI(task);\n        await pollAgente(task, Date.now());")

# 7. Context auto load visual (Simulating progress BEFORE hiding modal)
# In original app.js:
# if (!sessionStorage.getItem('contextLoaded')) {
#     startupModal.classList.remove('hidden');
# } else {
#     startupModal.classList.add('hidden');
# }
old_context_start = """    if (!sessionStorage.getItem('contextLoaded')) {
        startupModal.classList.remove('hidden');
    } else {
        startupModal.classList.add('hidden');
    }"""
new_context_start = """    // Siempre iniciamos el modal momentáneamente para mostrar el progreso de F5
    startupModal.classList.remove('hidden');
    if (startContextBtn) {
        setTimeout(() => startContextBtn.click(), 500);
    }"""
content = content.replace(old_context_start, new_context_start)

# Inside the event listener, do not hide immediately!
old_context_click = """        sessionStorage.setItem('contextLoaded', 'true');
        startupModal.classList.add('hidden');
        startContextBtn.style.display = 'block';"""
new_context_click = """        // NO ocultamos el modal todavía, esperamos que termine el progreso visual
        sessionStorage.setItem('contextLoaded', 'true');"""
content = content.replace(old_context_click, new_context_click)

# At the end of the fake progress interval (when reaching 100)
old_progress_done = """                    if (startupProgressFill.style.width === '100%') {
                        clearInterval(progressInterval);
                        if (startContextBtn) {
                            startContextBtn.style.display = 'none';
                        }
                        if (startupProgressContainer) {
                            setTimeout(() => {
                                startupProgressContainer.classList.add('hidden');
                            }, 5000);
                        }
                    }"""
new_progress_done = """                    if (startupProgressFill.style.width === '100%') {
                        clearInterval(progressInterval);
                        setTimeout(() => {
                            startupModal.classList.add('hidden');
                            procesarCola(); // Start any queued tasks
                        }, 500);
                    }"""
content = content.replace(old_progress_done, new_progress_done)

with open('public/app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Safely applied UI patches.")
