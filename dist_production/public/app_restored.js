const micBtn = document.getElementById('micBtn');
const micIcon = document.getElementById('micIcon');
const agentModeBtn = document.getElementById('agentModeBtn');
const backendMenu = document.getElementById('backendMenu');
const refreshBtn = document.getElementById('refreshBtn');
const previewUrlInput = document.getElementById('previewUrlInput');
let previewIframe = document.getElementById('iframeReact');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const instructionText = document.getElementById('instructionText');
const transcriptArea = document.getElementById('transcript');
const keyboardBtn = document.getElementById('keyboardBtn');
const textPanel = document.getElementById('textPanel');
const folderInput = document.getElementById('folderInput');
const textInput = document.getElementById('textInput');
const sendTextBtn = document.getElementById('sendTextBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomLevelLabel = document.getElementById('zoomLevelLabel');
const lastMessageBtn = document.getElementById('lastMessageBtn');
const contextStatusLabel = document.getElementById('contextStatusLabel');

let lastAiMessage = localStorage.getItem('tfte_last_ai_message') || '';
let geminiReady = false;

function markGeminiReady() {
    geminiReady = true;
    updateUIState('ready');
}

const closeToastBtn = document.getElementById('closeToast');
if (closeToastBtn) {
    closeToastBtn.addEventListener('click', () => {
        const responseToast = document.getElementById('responseToast');
        if (responseToast) responseToast.classList.add('hidden');
        if (window.autoSendTimer) {
            clearInterval(window.autoSendTimer);
            window.autoSendTimer = null;
        }
    }
}
        if (isListening) toggleRecording();
    });
}

function recordarUltimoMensaje(text) {
    lastAiMessage = text;
    localStorage.setItem('tfte_last_ai_message', text);
}

if (lastMessageBtn) {
    lastMessageBtn.addEventListener('click', () => {
        if (lastAiMessage) {
            addTranscriptText(lastAiMessage, 'ai');
            playAgentAudio(lastAiMessage);
        } else {
            addTranscriptText('Todavía no hay ningún mensaje del asistente.', 'error');
        }
    });
}

const ZOOM_MIN = 0.5, ZOOM_MAX = 1.5, ZOOM_STEP = 0.1;
let zoomLevel = parseFloat(localStorage.getItem('tfte_zoom') || '0.8');
if (isNaN(zoomLevel) || zoomLevel < ZOOM_MIN || zoomLevel > ZOOM_MAX) zoomLevel = 0.8;

function applyZoom() {
    const mc = previewIframe && previewIframe.parentElement;
    if (!mc || !previewIframe) return;
    const rect = mc.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    previewIframe.style.width = (rect.width / zoomLevel) + 'px';
    previewIframe.style.height = (rect.height / zoomLevel) + 'px';
    previewIframe.style.transform = `scale(${zoomLevel})`;
    if (zoomLevelLabel) zoomLevelLabel.textContent = Math.round(zoomLevel * 100) + '%';
    localStorage.setItem('tfte_zoom', zoomLevel);
}

if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
        zoomLevel = Math.max(ZOOM_MIN, +(zoomLevel - ZOOM_STEP).toFixed(2));
        applyZoom();
    });
}
if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
        zoomLevel = Math.min(ZOOM_MAX, +(zoomLevel + ZOOM_STEP).toFixed(2));
        applyZoom();
    });
}
window.addEventListener('resize', applyZoom);
window.addEventListener('load', applyZoom);
applyZoom();

let isListening = false;
let currentAudioEl = null;
let recognition;
let synth = window.speechSynthesis;
const SILENCE_TIMEOUT_MS = 3500;
const RESTART_DELAY_MS = 300;
const MAX_RESTARTS_SIN_PROGRESO = 3;
let silenceTimer = null;
let restartsSinProgreso = 0;
let finalTranscript = '';
let committedTranscript = '';
let manualAbort = false;
let silenceStop = false;
function textoAcumulado() {
}

let agentMode = localStorage.getItem('tfte_agent_mode');
if (agentMode === null) {
    agentMode = true;
    localStorage.setItem('tfte_agent_mode', '1');
} else {
    agentMode = agentMode === '1';
}
let agentBackend = localStorage.getItem('tfte_agent_backend') || 'gemini';
let agentPolling = null;

function lastSeenKey(backend) { return 'tfte_last_seen_' + backend; }
let lastAgentResponse = localStorage.getItem(lastSeenKey(agentBackend)) || '';

function nombreBackend() {
    return agentBackend === 'gemini' ? 'Gemini' : 'Claude';
}

function updateAgentModeUI() {
    if (agentModeBtn) agentModeBtn.classList.toggle('active', agentMode);
}

function updateBackendMenuUI() {
    if (!backendMenu) return;
    backendMenu.querySelectorAll('.backend-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.backend === agentBackend);
    });
}

function toggleBackendMenu(mostrar) {
    if (backendMenu) backendMenu.classList.toggle('hidden', !mostrar);
}

if (agentModeBtn) {
    updateAgentModeUI();
    updateBackendMenuUI();

    let longPressTimer = null;
    let longPressTriggered = false;
    const LONG_PRESS_MS = 550;

    agentModeBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        longPressTriggered = false;
        longPressTimer = setTimeout(() => {
            longPressTriggered = true;
            if (navigator.vibrate) navigator.vibrate(30);
            toggleBackendMenu(true);
        }, LONG_PRESS_MS);
    });

    agentModeBtn.addEventListener('pointerup', (e) => {
        e.preventDefault();
        clearTimeout(longPressTimer);
        if (longPressTriggered) return;

        agentMode = !agentMode;
        localStorage.setItem('tfte_agent_mode', agentMode ? '1' : '0');
        updateAgentModeUI();
        addTranscriptText(agentMode
            ? `Modo Agente activado (${nombreBackend()}): ahora puedo leer y modificar el código, te voy a pedir confirmación antes de ejecutar.`
            : 'Modo Agente desactivado: volviste al asistente rápido de solo lectura.', 'ai');
    });

    agentModeBtn.addEventListener('pointerleave', () => clearTimeout(longPressTimer));
    agentModeBtn.addEventListener('pointercancel', () => clearTimeout(longPressTimer));
    agentModeBtn.addEventListener('contextmenu', (e) => e.preventDefault());
}

if (backendMenu) {
    backendMenu.querySelectorAll('.backend-option').forEach(btn => {
        btn.addEventListener('click', () => {
            agentBackend = btn.dataset.backend;
            localStorage.setItem('tfte_agent_backend', agentBackend);
            lastAgentResponse = localStorage.getItem(lastSeenKey(agentBackend)) || '';
            updateBackendMenuUI();
            toggleBackendMenu(false);
            if (!agentMode) {
                agentMode = true;
                localStorage.setItem('tfte_agent_mode', '1');
                updateAgentModeUI();
            }
            addTranscriptText(`A partir de ahora, en Modo Agente le hablás a ${nombreBackend()}.`, 'ai');
        });
    });
    function handleOutsideClick(e) {
        if (backendMenu && !backendMenu.classList.contains('hidden') && !backendMenu.contains(e.target) && !agentModeBtn.contains(e.target)) {
            toggleBackendMenu(false);
        }

        const tasksContainer = document.getElementById('tasksContainer');
        const repoBtn = document.getElementById('repoBtn');
        const tasksBackdrop = document.getElementById('tasksBackdrop');
        if (tasksContainer && !tasksContainer.classList.contains('hidden') && !tasksContainer.contains(e.target) && (!repoBtn || !repoBtn.contains(e.target))) {
            tasksContainer.classList.add('hidden');
            if (tasksBackdrop) tasksBackdrop.style.display = 'none';
        }

        const textPanel = document.getElementById('textPanel');
        const keyboardBtn = document.getElementById('keyboardBtn');
        const textPanelBackdrop = document.getElementById('textPanelBackdrop');
        if (textPanel && !textPanel.classList.contains('hidden') && !textPanel.contains(e.target) && (!keyboardBtn || !keyboardBtn.contains(e.target))) {
            textPanel.classList.add('hidden');
            if (textPanelBackdrop) textPanelBackdrop.style.display = 'none';
        }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick, { passive: true });

    const tBackdrop = document.getElementById('tasksBackdrop');
    const tpBackdrop = document.getElementById('textPanelBackdrop');
    if (tBackdrop) {
        tBackdrop.addEventListener('touchstart', handleOutsideClick, { passive: true });
        tBackdrop.addEventListener('click', handleOutsideClick);
    }
    if (tpBackdrop) {
        tpBackdrop.addEventListener('touchstart', handleOutsideClick, { passive: true });
        tpBackdrop.addEventListener('click', handleOutsideClick);
    }
}

if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        isListening = true;
        updateUIState('listening');
    };

    recognition.onresult = (event) => {
        restartsSinProgreso = 0;

        let interim = '';
        const segmentosFinales = [];

        startSilenceTimer(); // Reiniciar el timer cada vez que escuche algo

        for (let i = 0; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                const texto = event.results[i][0].transcript.trim();
                if (!texto) continue;
                const anterior = segmentosFinales[segmentosFinales.length - 1];
                if (anterior && texto.toLowerCase().startsWith(anterior.toLowerCase())) {
                    segmentosFinales[segmentosFinales.length - 1] = texto;
                } else {
                    segmentosFinales.push(texto);
                }
            } else {
                interim += event.results[i][0].transcript;
            }
        }
        finalTranscript = segmentosFinales.join(' ') + (segmentosFinales.length ? ' ' : '');

        const display = (committedTranscript + ' ' + finalTranscript + interim).trim();
        // NOTA: No mostramos la transcripcion rapida (WebKit) en la interfaz 
        // para evitar que el usuario vea la version erronea. Solo mostraremos 
        // la version final de Whisper cuando termine de grabar.
        if (display) {
            // addTranscriptText(display, 'user');
        }
    };

    let silenceTimeout = null;
    function startSilenceTimer() {
        clearSilenceTimer();
        silenceTimeout = setTimeout(() => {
            if (isListening && mediaRecorder && mediaRecorder.state === 'recording') {
                console.log("Silencio detectado (3s). Cortando microfono...");
                toggleRecording(); // Stop automatically
            }
        }, 3000); // Cortar despues de 3 segundos
    }

    function clearSilenceTimer() {
        if (silenceTimeout) clearTimeout(silenceTimeout);
    }

    recognition.onerror = (event) => {
        console.error('Error de reconocimiento de voz:', event.error);
        if (event.error === 'aborted') {
            return;
        }
        if (event.error === 'no-speech' && isListening && !manualAbort && !silenceStop) {
            return;
        }

        // Si MediaRecorder esta grabando bien para enviar a Groq, ignoramos los errores de Chrome Webkit
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            console.warn("Ignorando error de webkitSpeechRecognition porque MediaRecorder grabará para Groq.");
            return;
        }

        clearSilenceTimer();
        isListening = false;
        updateUIState('ready');
        addTranscriptText('Error al escuchar. Intenta de nuevo.', 'error');
    };

    recognition.onend = () => {
        if (!isListening) {
            manualAbort = false;
            committedTranscript = '';
            finalTranscript = '';
            restartsSinProgreso = 0;
            return;
        }

        committedTranscript = textoAcumulado();
        committedTranscript = textoAcumulado();
        finalTranscript = '';

        // Si Webkit corta la transmision por silencio, forzamos parar MediaRecorder.
        if (isListening && mediaRecorder && mediaRecorder.state === 'recording') {
            console.log("Web Speech API detuvo por silencio. Cortando mic.");
            toggleRecording();
        }
    };

} else {
    addTranscriptText('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Safari.', 'error');
    if (micBtn) micBtn.disabled = true;
}

if (micBtn) micBtn.addEventListener('click', toggleRecording);

if (refreshBtn && previewIframe) {
    refreshBtn.addEventListener('click', () => {
        previewIframe.src = previewIframe.src;
    });
}

const fullscreenBtn = document.getElementById('fullscreenBtn');
const fullscreenIcon = document.getElementById('fullscreenIcon');
if (fullscreenBtn) {
    const el = document.documentElement;

    function isFullscreen() {
        return !!(document.fullscreenElement || document.webkitFullscreenElement);
    }

    function updateFullscreenIcon() {
        if (fullscreenIcon) fullscreenIcon.textContent = isFullscreen() ? 'fullscreen_exit' : 'fullscreen';
    }

    fullscreenBtn.addEventListener('click', () => {
        try {
            if (!isFullscreen()) {
                if (el.requestFullscreen) el.requestFullscreen();
                else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            }
        } catch (err) {
            console.error('Pantalla completa no disponible:', err);
            addTranscriptText('Tu navegador no permite pantalla completa acá. Probá "Agregar a pantalla de inicio" desde Safari para usarla sin barras.', 'error');
        }
    });

    document.addEventListener('fullscreenchange', updateFullscreenIcon);
    document.addEventListener('webkitfullscreenchange', updateFullscreenIcon);
}

if (previewIframe) {
    const btnHtml = document.getElementById('btnHtml');
    const btnReact = document.getElementById('btnReact');
    const btnImgs = document.getElementById('btnImgs');
    const btnPlan = document.getElementById('btnPlan');

    const htmlSelector = document.getElementById('htmlSelector');

    const savedUrls = JSON.parse(localStorage.getItem('tfte_url_history') || '[]');
    savedUrls.forEach(url => {
        if (url !== "/preview/TFTE Next Steps MainApp 2.html" && htmlSelector) {
            const option = document.createElement('option');
            option.value = url;
            option.textContent = url.replace('/preview/', '');
            htmlSelector.appendChild(option);
        }
    });

    function setActiveTab(activeBtn) {
        [btnReact, btnPlan, btnHtml, btnImgs].forEach(b => {
            if (b) {
                b.classList.toggle('active', b === activeBtn);
            }
        });
    }

    const iframeReact = document.getElementById('iframeReact');
    const iframeHtml = document.getElementById('iframeHtml');
    const iframePlan = document.getElementById('iframePlan');
    const iframeImgs = document.getElementById('iframeImgs');
    previewIframe = iframeReact || document.getElementById('iframeReact'); // The currently active iframe

    // Ocultar barras desplazadoras dentro de los iframes
    [iframeHtml, iframePlan, iframeImgs, iframeReact].forEach(ifr => {
        if (ifr) {
            const injectNoScroll = function() {
                try {
                    if (ifr.contentDocument && !ifr.contentDocument.getElementById('no-scroll-style')) {
                        const style = document.createElement('style');
                        style.id = 'no-scroll-style';
                        style.innerHTML = `
                            ::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
                            * { -ms-overflow-style: none !important; scrollbar-width: none !important; }
                        `;
                        ifr.contentDocument.head.appendChild(style);
                    }
                } catch(e) {
                    // Ignorar errores cross-origin
                }
            };
            ifr.addEventListener('load', injectNoScroll);
            injectNoScroll();
        }
    });

    function switchIframe(activeIframeEl) {
        [iframeReact, iframeHtml, iframePlan, iframeImgs].forEach(ifr => {
            if (ifr) {
                ifr.style.opacity = '0';
                ifr.style.pointerEvents = 'none';
                ifr.style.zIndex = '-1';
            }
        });
        if (activeIframeEl) {
            activeIframeEl.style.opacity = '1';
            activeIframeEl.style.pointerEvents = 'auto';
            activeIframeEl.style.zIndex = '1';
            previewIframe = activeIframeEl;
            updateZoom();
        }
    }

    if (htmlSelector) {
        htmlSelector.addEventListener('change', (e) => {
            // Deprecated fallback if they use the hidden dropdown
            switchIframe(iframeHtml);
            setActiveTab(btnHtml);
        });
    }

    if (btnHtml) {
        btnHtml.addEventListener('click', () => {
            switchIframe(iframeHtml);
            setActiveTab(btnHtml);
        });
    }

    if (btnReact) {
        btnReact.addEventListener('click', () => {
            switchIframe(iframeReact);
            setActiveTab(btnReact);
        });
    }


    if (btnPlan) {
        btnPlan.addEventListener('click', () => {
            switchIframe(iframePlan);
            setActiveTab(btnPlan);
        });
    }

    if (btnImgs) {
        btnImgs.addEventListener('click', () => {
            switchIframe(iframeImgs);
            setActiveTab(btnImgs);
        });
    }

    const mainEnableSaveBtn = document.getElementById('mainEnableSaveBtn');
    const mainSaveStatus = document.getElementById('mainSaveStatus');
    if (mainEnableSaveBtn && mainSaveStatus) {
        const dot = mainSaveStatus.querySelector('.pulse-ring');

        mainEnableSaveBtn.addEventListener('click', () => {
            try {
                const innerBtn = previewIframe.contentDocument.getElementById('enableSaveBtn');
                if (innerBtn) {
                    innerBtn.click();
                } else {
                    console.warn('Este documento no tiene auto-guardado (no es TFTE Next Steps MainApp 2.html).');
                }
            } catch (err) {
                console.error('No se pudo acceder al auto-guardado del documento:', err);
            }
        });

        setInterval(() => {
            try {
                const innerStatus = previewIframe.contentDocument.getElementById('saveStatus');
                if (!innerStatus) return;
                const activo = innerStatus.classList.contains('status-ok');
                dot.style.backgroundColor = activo ? 'var(--success-color)' : 'var(--text-secondary)';
                dot.style.boxShadow = activo ? '0 0 6px var(--success-color)' : 'none';
                mainSaveStatus.title = 'Auto-guardado: ' + innerStatus.innerText;
            } catch (err) {
            }
        }, 2000);
    }
}

let mediaRecorder = null;
let audioChunks = [];
let globalMicStream = null;

// ==========================================
// NUEVA UX: MODAL INTERACTIVO DE AUTENTICACIÓN
// ==========================================
function mostrarModalCreditos(proveedor) {
    const modal = document.getElementById('modal-creditos');
    if (!modal) return;

    // Reiniciar vista al paso 1
    const step1 = document.getElementById('modal-step-1');
    const stepYes = document.getElementById('modal-step-yes');
    const stepNo = document.getElementById('modal-step-no');

    if (step1) step1.style.display = 'block';
    if (stepYes) stepYes.style.display = 'none';
    if (stepNo) stepNo.style.display = 'none';

    // Dinamizar texto según agente
    let agentName = 'Claude';
    if (proveedor === 'gemini') agentName = 'Gemini';
    if (proveedor === 'groq') agentName = 'Groq (Voz a Texto)';

    const agentNameEl = document.getElementById('modal-agent-name');
    if (agentNameEl) agentNameEl.innerText = agentName;

    let url = "https://console.anthropic.com/";
    let cmd = "claude login";
    if (proveedor === 'gemini' || proveedor === 'antigravity') {
        url = "https://aistudio.google.com/";
        cmd = "agy";
    }

    const btnLogin = document.getElementById('btn-login-ia');
    if (btnLogin) btnLogin.onclick = () => window.open(url, "_blank");

    const cmdEl = document.getElementById('cmd-instruccion');
    if (cmdEl) cmdEl.innerText = cmd;

    modal.classList.remove('modal-oculto');
    modal.classList.add('modal-visible');
}

// Inicializar Botones del Modal y Logica Principal
document.addEventListener('DOMContentLoaded', () => {
    // Configuración del Modal Interactivo
    const btnAuthYes = document.getElementById('btn-auth-yes');
    const btnAuthNo = document.getElementById('btn-auth-no');
    const btnCerrar1 = document.getElementById('btn-cerrar-modal-1');
    const btnCerrar2 = document.getElementById('btn-cerrar-modal-2');
    const btnCerrar3 = document.getElementById('btn-cerrar-modal-3');
    const modal = document.getElementById('modal-creditos');

    if (btnAuthYes) btnAuthYes.onclick = () => {
        document.getElementById('modal-step-1').style.display = 'none';
        document.getElementById('modal-step-yes').style.display = 'block';
    };

    if (btnAuthNo) btnAuthNo.onclick = () => {
        document.getElementById('modal-step-1').style.display = 'none';
        document.getElementById('modal-step-no').style.display = 'block';
    };

    const cerrarModal = () => {
        if (modal) {
            modal.classList.remove('modal-visible');
            modal.classList.add('modal-oculto');
        }
    };

    if (btnCerrar1) btnCerrar1.onclick = cerrarModal;
    if (btnCerrar2) btnCerrar2.onclick = cerrarModal;
    if (btnCerrar3) btnCerrar3.onclick = cerrarModal;

    const sendToastBtn = document.getElementById('sendToastBtn');
    const responseToast = document.getElementById('responseToast');

    if (sendToastBtn && responseToast) {
        // El manejador se asigna de forma dinámica en triggerSendCountdown
        // para evitar ejecuciones duplicadas de enviarMensaje()
    }

    const contextModal = document.getElementById('contextModal');
    const startContextBtn = document.getElementById('startContextBtn');

    if (contextModal && startContextBtn) {

        async function autoConnect() {
            try {
                // Si la sesion ya esta activa en localStorage, no validamos con IA para ahorrar tokens
                if (localStorage.getItem('tfte_session_active') === 'true') {
                    contextModal.style.display = 'none';
                    contextModal.classList.add('hidden');
                    markGeminiReady();
                    return;
                }

                // Obtener el contexto de forma confiable desde el backend
                const res = await fetch('/api/get-context');
                const data = await res.json();

                if (data.contextPath) {
                    // AUTO-CONEXION INVISIBLE E INMEDIATA
                    contextModal.style.display = 'none';
                    contextModal.classList.add('hidden');

                    updateUIState('thinking');
                    statusText.textContent = 'Verificando Agente...';

                    // Populemos el select interno
                    const selectEl = document.getElementById('savedContextsSelect');
                    if (selectEl) {
                        let optionExists = Array.from(selectEl.options).some(opt => opt.value === data.contextPath);
                        if (!optionExists) {
                            const newOpt = document.createElement('option');
                            newOpt.value = data.contextPath;
                            newOpt.text = data.contextPath;
                            selectEl.appendChild(newOpt);
                        }
                        selectEl.value = data.contextPath;
                    }

                    // Llamar al backend para setear el context path
                    const setRes = await fetch('/api/set-context', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contextPath: data.contextPath })
                    });

                    if (setRes.ok) {
                        localStorage.setItem('tfte_session_active', 'true');
                        markGeminiReady();
                        const greetingText = `Contexto vinculado automáticamente. ¡Hola! Soy tu agente ${nombreBackend()}.`;
                        addTranscriptText(greetingText, 'ai');
                        playAgentAudio(greetingText);
                        return;
                    }

                    // Si algo falla, mostramos modal de creditos
                    mostrarModalCreditos(agentBackend);
                } else {
                    // Flujo manual si el servidor no tiene contexto
                    contextModal.classList.remove('hidden');
                    contextModal.style.display = 'flex';
                    statusIndicator.className = 'status-indicator thinking';
                    statusText.textContent = 'Requiere contexto';
                    instructionText.textContent = 'Aguardando inicialización de sesión...';
                }
            } catch (err) {
                console.error("Fallo auto-conexion:", err);
                // Si falla la red, obligamos a manual
                contextModal.classList.remove('hidden');
                contextModal.style.display = 'flex';
            }
        }

        // Lanzar autoConnect apenas arranca el DOM
        autoConnect();

        startContextBtn.addEventListener('click', async () => {
            try {
                startContextBtn.disabled = true;
                startContextBtn.textContent = 'Guardando ruta...';

                const activeCtx = document.getElementById('savedContextsSelect').value;

                try {
                    await fetch('/api/set-context', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contextPath: activeCtx })
                    });
                } catch (err) { }

                contextModal.classList.add('hidden');
                setTimeout(() => contextModal.style.display = 'none', 300);
                localStorage.setItem('tfte_session_active', 'true');
                markGeminiReady();
                const greeting = `Contexto vinculado. ¡Hola! Soy tu agente ${nombreBackend()}.`;
                addTranscriptText(greeting, 'ai');
                playAgentAudio(greeting);

            } catch (err) {
                console.error(err);
            } finally {
                startContextBtn.disabled = false;
                startContextBtn.textContent = 'Cargar Contexto y Empezar';
            }
        });
    }
});

function triggerSendCountdown(finalText) {
    const folder = (typeof folderInput !== 'undefined' && folderInput) ? folderInput.value.trim() : '';
    window.pendingFolder = folder;

    const responseToast = document.getElementById('responseToast');
    if (responseToast) responseToast.classList.remove('hidden');

    const sendToastBtn = document.getElementById('sendToastBtn');
    if (sendToastBtn) {
        sendToastBtn.style.display = 'inline-block';

        let cancelWhisperBtn = document.getElementById('cancelWhisperBtn');
        if (!cancelWhisperBtn) {
            cancelWhisperBtn = document.createElement('span');
            cancelWhisperBtn.id = 'cancelWhisperBtn';
            cancelWhisperBtn.innerHTML = '❌';
            cancelWhisperBtn.style.cursor = 'pointer';
            cancelWhisperBtn.style.marginLeft = '10px';
            cancelWhisperBtn.style.fontSize = '1.2em';
            cancelWhisperBtn.title = 'Cancelar mensaje';
            sendToastBtn.parentNode.insertBefore(cancelWhisperBtn, sendToastBtn.nextSibling);
        }
        cancelWhisperBtn.style.display = 'inline-block';

        cancelWhisperBtn.onclick = () => {
            if (window.autoSendTimer) {
                clearInterval(window.autoSendTimer);
                window.autoSendTimer = null;
            }
            if (responseToast) responseToast.classList.add('hidden');
            sendToastBtn.style.display = 'none';
            cancelWhisperBtn.style.display = 'none';
        };

        if (window.autoSendTimer) clearInterval(window.autoSendTimer);
        let countdown = 7;
        sendToastBtn.textContent = `Enviar (${countdown}s)`;

        window.autoSendTimer = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                sendToastBtn.textContent = `Enviar (${countdown}s)`;
            } else {
                clearInterval(window.autoSendTimer);
                sendToastBtn.click();
            }
        }, 1000);

        const editableTranscript = document.getElementById('editableTranscript');
        if (editableTranscript) {
            const stopCountdown = () => {
                if (window.autoSendTimer) {
                    clearInterval(window.autoSendTimer);
                    window.autoSendTimer = null;
                    sendToastBtn.textContent = 'Enviar';
                }
            };
            editableTranscript.addEventListener('click', stopCountdown);
            editableTranscript.addEventListener('input', stopCountdown);
        }

        sendToastBtn.onclick = () => {
            sendToastBtn.onclick = null; // Evitar envíos duplicados si hay múltiples timers
            if (window.autoSendTimer) {
                clearInterval(window.autoSendTimer);
                window.autoSendTimer = null;
            }
            const finalTxt = editableTranscript ? editableTranscript.textContent.trim() : finalText;
            if (finalTxt && finalTxt !== '...') {
                enviarMensaje(finalTxt, window.pendingFolder || '');
            }
            responseToast.classList.add('hidden');
            sendToastBtn.style.display = 'none';
            cancelWhisperBtn.style.display = 'none';
            updateUIState('ready');
        };

        cancelWhisperBtn.onclick = () => {
            if (window.autoSendTimer) clearInterval(window.autoSendTimer);
            responseToast.classList.add('hidden');
            sendToastBtn.style.display = 'none';
            cancelWhisperBtn.style.display = 'none';
            updateUIState('ready');
        };
    }
}

async function toggleRecording() {
    const agentAudio = document.getElementById('agentAudio');
    if (agentAudio) {
        if (!window.audioUnlocked) {
            agentAudio.play().catch(e => { });
            window.audioUnlocked = true;
        }
        // Cortar el audio si el agente estǭ hablando y queremos interrumpirlo
        agentAudio.pause();
        if (currentAudioEl === agentAudio) currentAudioEl = null;
    }

    if (!isListening) {
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = event => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };

            mediaRecorder.onstart = () => {
                isListening = true;
                updateUIState('listening');

                const responseToast = document.getElementById('responseToast');
                if (responseToast) responseToast.classList.remove('hidden');

                const transcriptEl = document.getElementById('transcript');
                if (transcriptEl) {
                    transcriptEl.innerHTML = '';
                    const p = document.createElement('p');
                    p.className = 'user-text';
                    p.textContent = 'Escuchando...';
                    p.contentEditable = 'false';
                    p.style.outline = 'none';
                    p.id = 'editableTranscript';
                    transcriptEl.appendChild(p);
                }

                const sendToastBtn = document.getElementById('sendToastBtn');
                const cancelWhisperBtn = document.getElementById('cancelWhisperBtn');
                if (sendToastBtn) sendToastBtn.style.display = 'none';
                if (cancelWhisperBtn) cancelWhisperBtn.style.display = 'none';
            };

            mediaRecorder.onstop = async () => {
                isListening = false;
                updateUIState('ready');

                const editableEl = document.getElementById('editableTranscript');
                if (editableEl) {
                    editableEl.textContent = 'Transcribiendo...';
                }

                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const formData = new FormData();
                formData.append('audio', audioBlob, 'recording.webm');

                try {
                    const response = await fetch('/api/transcribe', {
                        method: 'POST',
                        body: formData
                    });
                    const data = await response.json();

                    if (data.text) {
                        const finalTxt = data.text.trim();
                        if (editableEl) {
                            editableEl.textContent = finalTxt;
                            editableEl.contentEditable = 'true';
                        }
                        if (finalTxt && finalTxt !== '...') {
                            triggerSendCountdown(finalTxt);
                        } else {
                            const responseToast = document.getElementById('responseToast');
                            if (responseToast) responseToast.classList.add('hidden');
                        }
                    } else {
                        console.error('Error in transcription:', data.error, data.details);
                        if (editableEl) editableEl.textContent = 'Error: ' + (data.details || data.error || 'Failed to transcribe audio');
                    }
                } catch (error) {
                    console.error('Error enviando audio:', error);
                    if (editableEl) editableEl.textContent = 'Error de conexión al transcribir.';
                }

                // Detener todas las pistas de audio para liberar el mic
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            if (recognition) {
                try { recognition.start(); } catch (e) { }
            }

        } catch (error) {
            console.error("Error accediendo al micrófono:", error);
            addTranscriptText("No se pudo acceder al micrófono.", 'error');
        }
    } else {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            if (recognition) {
                try { recognition.stop(); } catch (e) { }
            }
        } else {
            isListening = false;
            updateUIState('ready');
        }
    }
}


const messageQueue = [];
let queueBusy = false;

function enviarMensaje(text, folder) {
    messageQueue.push({ text, folder });
    addTranscriptText(text, 'user');
    procesarCola();
}

let lastSentMessage = '';
let lastSentTime = 0;

async function procesarCola() {
    if (queueBusy) return;
    queueBusy = true;
    while (messageQueue.length > 0) {
        const { text, folder } = messageQueue.shift();

        // Anti-duplicados: si es el mismo mensaje en menos de 30s, lo saltamos
        const now = Date.now();
        if (text === lastSentMessage && (now - lastSentTime) < 30000) {
            console.log('Mensaje duplicado ignorado por seguridad:', text);
            continue;
        }
        lastSentMessage = text;
        lastSentTime = now;

        updateUIState('thinking');
        if (messageQueue.length > 0) {
            instructionText.textContent = `Procesando... (${messageQueue.length} en cola)`;
        }
        try {
            if (agentMode) {
                let contextSuffix = "";
                try {
                    const pIframe = document.getElementById('previewIframe');
                    if (pIframe && pIframe.src && pIframe.src.includes('/preview/')) {
                        const fileVisto = decodeURIComponent(new URL(pIframe.src).pathname.split('/').pop());
                        if (fileVisto) {
                            contextSuffix = `\n(Nota interna del sistema: Actualmente el usuario tiene abierto y está visualizando el archivo "${fileVisto}" en la pantalla principal. Asume que se refiere a este archivo si te pide modificar algo de lo que está viendo.)`;
                        }
                    }
                } catch (e) { }
                await sendToAgente(text + contextSuffix, folder);
            } else {
                await sendToServer(text);
            }
        } catch (e) {
            console.error('Error procesando mensaje de la cola:', e);
        }
    }
    queueBusy = false;
}

if (keyboardBtn && textPanel && textInput && sendTextBtn) {
    folderInput.value = localStorage.getItem('tfte_last_folder') || '';

    keyboardBtn.addEventListener('click', () => {
        const abrir = textPanel.classList.contains('hidden');
        textPanel.classList.toggle('hidden', !abrir);
        const textPanelBackdrop = document.getElementById('textPanelBackdrop');
        if (textPanelBackdrop) {
            textPanelBackdrop.style.display = abrir ? 'block' : 'none';
        }
        if (abrir) textInput.focus();
    });

    function enviarDesdeTexto() {
        const text = textInput.value.trim();
        if (!text) return;
        const folder = folderInput.value.trim();
        localStorage.setItem('tfte_last_folder', folder);
        textInput.value = '';
        textInput.style.height = 'auto'; // Reset dynamic size

        // Ocultar el panel de texto
        textPanel.classList.add('hidden');
        const textPanelBackdrop = document.getElementById('textPanelBackdrop');
        if (textPanelBackdrop) textPanelBackdrop.style.display = 'none';

        // Mostrar el Toast con el texto
        const responseToast = document.getElementById('responseToast');
        if (responseToast) responseToast.classList.remove('hidden');

        const transcriptEl = document.getElementById('transcript');
        if (transcriptEl) {
            transcriptEl.innerHTML = '';
            const p = document.createElement('p');
            p.className = 'user-text';
            p.textContent = text;
            p.contentEditable = 'true';
            p.style.outline = 'none';
            p.id = 'editableTranscript';
            transcriptEl.appendChild(p);
        }

        const sendToastBtn = document.getElementById('sendToastBtn');
        const cancelWhisperBtn = document.getElementById('cancelWhisperBtn');
        if (sendToastBtn) sendToastBtn.style.display = 'none';
        if (cancelWhisperBtn) cancelWhisperBtn.style.display = 'none';

        triggerSendCountdown(text);
    }

    sendTextBtn.addEventListener('click', enviarDesdeTexto);
    textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            enviarDesdeTexto();
        }
    });

    // Auto-resize dinámico para el textarea
    textInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
}

async function sendToServer(text) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: text }),
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            if (response.status === 401 || response.status === 403 || response.status === 429) {
                mostrarModalCreditos('groq');
                throw new Error("Sin creditos en Groq");
            }

            let serverError = 'Error de conexión';
            try {
                const errorData = await response.json();
                if (errorData && errorData.error) {
                    serverError = errorData.error;
                }
            } catch (e) { }
            throw new Error(serverError);
        }

        const data = await response.json();
        addTranscriptText(data.response, 'ai');
        await playAgentAudio(data.response);

    } catch (error) {
        clearTimeout(timeout);
        console.error('Error:', error);
        updateUIState('ready');

        let errorMsg = 'Error de conexión con el servidor local.';
        if (error.name === 'AbortError') {
            errorMsg = 'La respuesta tardó demasiado. Intentá de nuevo.';
        } else if (error.message) {
            errorMsg = error.message;
        }

        addTranscriptText(errorMsg, 'error');
    }
}

async function sendToAgente(text, folder) {
    try {
        const modelToUse = localStorage.getItem('tfte_gemini_model') || 'gemini-3.1-pro-high';
        const response = await fetch('/api/agente', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, backend: agentBackend, folder: folder || '', model: modelToUse })
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403 || response.status === 429) {
                mostrarModalCreditos(agentBackend);
                throw new Error("Sin creditos en Agente");
            }

            const errorData = await response.json().catch(() => null);
            throw new Error((errorData && errorData.error) || 'No se pudo enviar al agente');
        }
        await pollAgente();
    } catch (error) {
        console.error('Error enviando al agente:', error);
        updateUIState('ready');
        addTranscriptText(error.message || 'Error de conexión con el agente.', 'error');
    }
}

// ==========================================
// NUEVO POLL AGENTE (Detecta cuelgues del CLI)
// ==========================================
function pollAgente() {
    return new Promise((resolve) => {
        if (agentPolling) clearInterval(agentPolling);
        let vistoOcupado = false;
        let ciclosPensando = 0; // NUEVO: Contador de timeout

        agentPolling = setInterval(async () => {
            try {
                const response = await fetch('/api/agente/estado?backend=' + agentBackend);
                if (!response.ok) return;

                const data = await response.json();

                if (data.status === 'ejecutando') {
                    vistoOcupado = true;
                    ciclosPensando = 0;
                    instructionText.textContent = `Ejecutando cambios (${nombreBackend()})...`;
                    return;
                }

                if (data.status === 'pensando') {
                    vistoOcupado = true;
                    ciclosPensando++;
                    instructionText.textContent = `El agente (${nombreBackend()}) está pensando...`;

                    // Si el agente tarda más de 5 mins, forzamos el modal de login
                    if (ciclosPensando > 200) {
                        clearInterval(agentPolling);
                        updateUIState('ready');
                        mostrarModalCreditos(agentBackend);
                    }
                    return;
                }

                if (data.status === 'idle') {
                    if (vistoOcupado) {
                        // TERMINÓ
                        clearInterval(agentPolling);
                        updateUIState('ready');
                    } else {
                        ciclosPensando++;
                        if (ciclosPensando > 200) { // 5 mins esperando que el CLI reaccione
                            clearInterval(agentPolling);
                            updateUIState('ready');
                            addTranscriptText(`Error: El motor del Agente no responde.`, 'error');
                        }
                    }
                }

                const esNueva = data.respuesta && (data.respuesta !== lastAgentResponse || vistoOcupado);
                if (esNueva) {
                    lastAgentResponse = data.respuesta;
                    localStorage.setItem(lastSeenKey(agentBackend), data.respuesta);
                    clearInterval(agentPolling);
                    agentPolling = null;
                    addTranscriptText(data.respuesta, 'ai');
                    if (typeof updateTaskRepoResponse === 'function' && currentTaskObj) {
                        updateTaskRepoResponse(currentTaskObj, data.respuesta);
                    }

                    await playAgentAudio(data.respuesta);

                    // Nota: Se elimina la recarga forzada (previewIframe.src = currentUrl)
                    // porque en apps React con estado en memoria, cualquier recarga destruye
                    // el estado interno y devuelve al usuario a la vista "Home".

                    resolve();
                }
            } catch (error) {
                console.error('Error consultando estado del agente:', error);
            }
        }, 1500);
    });
}

async function retomarAgentePendiente() {
    try {
        const response = await fetch('/api/agente/estado?backend=' + agentBackend);
        const data = await response.json();

        if (data.status === 'pensando' || data.status === 'ejecutando') {
            updateUIState('thinking');
            await pollAgente();
            return;
        }

        if (data.respuesta && data.respuesta !== lastAgentResponse) {
            lastAgentResponse = data.respuesta;
            localStorage.setItem(lastSeenKey(agentBackend), data.respuesta);
            addTranscriptText(data.respuesta, 'ai');
            if (typeof updateTaskRepoResponse === 'function' && currentTaskObj) {
                updateTaskRepoResponse(currentTaskObj, data.respuesta);
            }

            await playAgentAudio(data.respuesta);

            // Recargar automǭticamente todos los iframes para reflejar los cambios de la IA
            const iframesToRefresh = [
                document.getElementById('iframeReact'),
                document.getElementById('iframeHtml'),
                document.getElementById('iframePlan'),
                document.getElementById('iframeImgs')
            ];

            iframesToRefresh.forEach(ifr => {
                if (ifr) {
                    try {
                        ifr.contentWindow.location.reload();
                    } catch (e) {
                        ifr.src = ifr.src; // Fallback if cross-origin or no contentWindow
                    }
                }
            });
        }
    } catch (error) {
        console.error('No se pudo chequear si había una respuesta pendiente del agente:', error);
    }
}

function playAgentAudio(text) {
    return new Promise((resolve) => {
        updateUIState('speaking');

        const agentAudio = document.getElementById('agentAudio');
        if (!agentAudio) { resolve(); return; }

        agentAudio.src = '/api/tts?text=' + encodeURIComponent(text);
        currentAudioEl = agentAudio;

        let speechTimeout = setTimeout(() => {
            agentAudio.pause();
            updateUIState('ready');
            resolve();
        }, 30000);

        agentAudio.onended = () => {
            clearTimeout(speechTimeout);
            if (currentAudioEl === agentAudio) currentAudioEl = null;
            updateUIState('ready');
            resolve();
        };

        agentAudio.onpause = () => {
            clearTimeout(speechTimeout);
            if (currentAudioEl === agentAudio) currentAudioEl = null;
            resolve();
        };

        agentAudio.onerror = () => {
            clearTimeout(speechTimeout);
            console.error('TTS audio error, trying browser fallback');
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'es-ES';
                utterance.onend = () => { updateUIState('ready'); resolve(); };
                utterance.onerror = () => { updateUIState('ready'); resolve(); };
                window.speechSynthesis.speak(utterance);
            } else {
                updateUIState('ready');
                resolve();
            }
        };

        agentAudio.play().catch(err => {
            console.error('Audio play failed:', err);
            clearTimeout(speechTimeout);
            updateUIState('ready');
            resolve();
        });
    });
}

function updateUIState(state) {
    statusIndicator.className = 'status-indicator';

    if (state === 'listening') {
        statusIndicator.classList.add('listening');
        statusText.textContent = 'Escuchando...';
        if (micBtn) micBtn.classList.add('active');
        if (micIcon) micIcon.textContent = 'mic_off';
        instructionText.textContent = 'Toca para detener';
    } else if (state === 'thinking') {
        statusIndicator.classList.add('thinking');
        statusText.textContent = 'Pensando...';
        if (micBtn) {
            micBtn.classList.remove('active');
            micBtn.classList.add('thinking');
        }
        if (micIcon) micIcon.textContent = 'mic';
        instructionText.textContent = 'Toca para agregar más info';
    } else if (state === 'speaking') {
        statusIndicator.classList.add('speaking');
        statusText.textContent = 'Hablando...';
        if (micBtn) {
            micBtn.classList.remove('active');
            micBtn.classList.remove('thinking');
        }
        if (micIcon) micIcon.textContent = 'volume_up';
        instructionText.textContent = 'Escucha la respuesta';
    } else {
        statusText.textContent = geminiReady ? 'Contexto Vinculado' : 'Aguardando agente...';
        if (micBtn) {
            micBtn.classList.remove('active');
            micBtn.classList.remove('thinking');
        }
        if (micIcon) micIcon.textContent = 'mic';
        instructionText.textContent = geminiReady ? 'Toca para hablar' : 'Esperando a Gemini...';
        if (contextStatusLabel) {
            contextStatusLabel.textContent = geminiReady ? 'Contexto Vinculado' : 'Aguardando agente...';
            contextStatusLabel.style.color = geminiReady ? '#4ade80' : '#ffb84d';
            contextStatusLabel.style.background = geminiReady ? 'rgba(74, 222, 128, 0.1)' : 'rgba(255, 184, 77, 0.1)';
            contextStatusLabel.style.borderColor = geminiReady ? 'rgba(74, 222, 128, 0.3)' : 'rgba(255, 184, 77, 0.3)';
        }
    }
}

function addTranscriptText(text, type = 'user') {
    if (type === 'ai') recordarUltimoMensaje(text);

    if (typeof logTaskToRepo === 'function' && type === 'user') {
        currentTaskObj = logTaskToRepo(text, type);
    }

    const toast = document.getElementById('responseToast');
    const closeBtn = document.getElementById('closeToast');

    transcriptArea.innerHTML = '';
    const p = document.createElement('p');
    p.className = type === 'user' ? 'user-text' : type === 'error' ? 'user-text' : 'ai-text';
    p.textContent = text;

    if (type === 'user') {
        const cancelBtn = document.createElement('span');
        cancelBtn.innerHTML = '&#10060;';
        cancelBtn.style.color = 'red';
        cancelBtn.style.cursor = 'pointer';
        cancelBtn.style.marginLeft = '10px';
        cancelBtn.style.fontSize = '1.2em';
        cancelBtn.title = 'Cancelar envio';
        cancelBtn.onclick = async () => {
            for (let i = messageQueue.length - 1; i >= 0; i--) {
                if (messageQueue[i].text === text) messageQueue.splice(i, 1);
            }
            try {
                await fetch('/api/agente', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: 'cancelar', backend: agentBackend, folder: '' })
                });
            } catch (e) { }
            p.textContent = 'Envio cancelado.';
            p.style.color = 'gray';
            updateUIState('ready');
        };
        p.appendChild(cancelBtn);
    }
    transcriptArea.appendChild(p);

    if (toast) {
        toast.classList.remove('hidden');

        const sendToastBtn = document.getElementById('sendToastBtn');
        const cancelWhisperBtn = document.getElementById('cancelWhisperBtn');
        if (sendToastBtn) sendToastBtn.style.display = 'none';
        if (cancelWhisperBtn) cancelWhisperBtn.style.display = 'none';

        if (type === 'ai') {
            setTimeout(() => {
                toast.classList.add('hidden');
            }, 15000);
        }
    }

    if (closeBtn) {
        closeBtn.onclick = () => toast.classList.add('hidden');
    }
}

retomarAgentePendiente();

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        retomarAgentePendiente();
    }
});

const repoBtn = document.getElementById('repoBtn');
const closeRepoBtn = document.getElementById('closeRepoBtn');
const tasksContainer = document.getElementById('tasksContainer');
const clearRepoBtn = document.getElementById('clearRepoBtn');
const repoList = document.getElementById('repoList');
const tasksBackdrop = document.getElementById('tasksBackdrop');

let taskIdCounter = 1;
let currentTaskObj = null;

function logTaskToRepo(text, type = 'user') {
    if (!repoList) return null;
    const id = taskIdCounter++;
    const card = document.createElement('div');
    card.className = 'task-card';
    card.id = 'repo-task-' + id;
    card.innerHTML = `
        <div class="task-row" style="cursor: pointer;" onclick="this.parentElement.classList.toggle('collapsed')">
            <div style="color: #94a3b8; font-size: 0.8rem; display: flex; align-items: center; gap: 4px;">
                <span class="material-icons-round chevron-icon" style="font-size: 1rem; transition: transform 0.2s;">expand_more</span>
                #${id} Instrucción
            </div>
            <div class="task-badge badge-pending" id="badge-inst-${id}">PENDING</div>
        </div>
        <div class="task-text">${text}</div>
        <div class="task-row" style="margin-top: 4px;">
            <div style="color: #94a3b8; font-size: 0.8rem;">Respuesta</div>
            <div class="task-badge badge-pending" id="badge-resp-${id}">PENDING</div>
        </div>
        <div class="repo-response" id="resp-text-${id}" style="display: none;"></div>
        <div class="task-row" style="margin-top: 4px;">
            <div style="color: #94a3b8; font-size: 0.8rem;">Confirmación de Cierre</div>
            <div class="task-badge badge-pending" id="badge-conf-${id}">PENDING</div>
        </div>
    `;
    repoList.prepend(card);
    if (tasksContainer) tasksContainer.scrollTop = 0;
    return { id, element: card, status: 'pending', responseText: '', originalText: text };
}

function updateTaskRepoResponse(taskObj, responseText, isConfirmation = false) {
    if (!taskObj || !taskObj.element) return;
    const { id, originalText } = taskObj;

    const isError = responseText.includes('Hubo un error técnico') || responseText.includes('Exit code null');
    const badgeText = isError ? 'ERROR' : 'COMPLETADO';
    const badgeClass = isError ? 'task-badge badge-error' : 'task-badge badge-completed';

    if (isConfirmation) {
        const confBadge = document.getElementById('badge-conf-' + id);
        if (confBadge) {
            confBadge.textContent = badgeText;
            confBadge.className = badgeClass;
        }
    } else {
        const respBadge = document.getElementById('badge-resp-' + id);
        if (respBadge) {
            respBadge.textContent = badgeText;
            respBadge.className = badgeClass;
        }
        const respText = document.getElementById('resp-text-' + id);
        if (respText) {
            respText.style.display = 'block';
            respText.innerHTML = responseText.replace(/\n/g, '<br>');

            if (isError) {
                if (!document.getElementById('resend-btn-' + id)) {
                    const resendBtn = document.createElement('button');
                    resendBtn.id = 'resend-btn-' + id;
                    resendBtn.className = 'resend-btn';
                    resendBtn.innerHTML = '<span class="material-icons-round" style="font-size: 1rem;">refresh</span> Reenviar Instrucción';
                    resendBtn.style.cssText = 'margin-top: 10px; background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 4px; padding: 6px 12px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 0.8rem; font-weight: 500; transition: background 0.2s;';
                    resendBtn.onmouseover = () => resendBtn.style.background = 'rgba(239, 68, 68, 0.2)';
                    resendBtn.onmouseout = () => resendBtn.style.background = 'rgba(239, 68, 68, 0.1)';
                    resendBtn.onclick = (e) => {
                        e.stopPropagation();
                        if (originalText) {
                            const editableEl = document.getElementById('editableTranscript');
                            if (editableEl) {
                                editableEl.textContent = originalText;
                                editableEl.contentEditable = 'true';
                            }
                            // Cerrar el modal del repositorio para que el toast sea visible
                            const tasksContainer = document.getElementById('tasksContainer');
                            if (tasksContainer) tasksContainer.classList.add('hidden');

                            triggerSendCountdown(originalText);

                            resendBtn.innerHTML = 'Enviando...';
                            resendBtn.disabled = true;
                            resendBtn.style.opacity = '0.5';
                        }
                    };
                    respText.appendChild(document.createElement('br'));
                    respText.appendChild(resendBtn);
                }
            }
        }
    }
}

let repoLoaded = false;

async function cargarHistorialEnRepo() {
    if (repoLoaded || !repoList) return;
    repoLoaded = true;
    try {
        const res = await fetch('/api/historial?backend=' + agentBackend);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.historial || !data.historial.trim()) return;

        const lines = data.historial.replace(/\r/g, '').split('\n').filter(l => l.trim());
        let currentUserMsg = null;

        for (const line of lines) {
            const match = line.match(/^\[(.+?)\]\s+(USUARIO|ASISTENTE|SISTEMA):\s*(.*)$/);
            if (!match) continue;
            const [, timestamp, role, text] = match;
            if (!text.trim()) continue;

            if (role === 'USUARIO') {
                if (text.toLowerCase() === 'cancelar') continue;
                const id = taskIdCounter++;
                const card = document.createElement('div');
                card.className = 'task-card';
                card.innerHTML = `
                    <div class="task-row" style="cursor: pointer;" onclick="this.parentElement.classList.toggle('collapsed')">
                        <div style="color: #94a3b8; font-size: 0.7rem; display: flex; align-items: center; gap: 4px;">
                            <span class="material-icons-round chevron-icon" style="font-size: 1rem; transition: transform 0.2s;">expand_more</span>
                            ${timestamp}
                        </div>
                        <div class="task-badge badge-waiting">PROCESANDO</div>
                    </div>
                    <div class="task-text">${text}</div>
                    <div class="repo-response" style="display: none;"></div>
                `;
                repoList.prepend(card);
                currentUserMsg = card;
            } else if (role === 'ASISTENTE' && currentUserMsg) {
                const respDiv = currentUserMsg.querySelector('.repo-response');
                if (respDiv) {
                    respDiv.style.display = 'block';
                    respDiv.innerHTML = text.replace(/\n/g, '<br>');

                    const isError = text.includes('Hubo un error') || text.includes('Exit code null');
                    const badge = currentUserMsg.querySelector('.task-badge');
                    if (badge) {
                        if (isError) {
                            badge.textContent = 'ERROR';
                            badge.className = 'task-badge badge-error';
                        } else {
                            badge.textContent = 'COMPLETADO';
                            badge.className = 'task-badge badge-completed';
                        }
                    }
                    if (isError) {
                        const resendBtn = document.createElement('button');
                            resendBtn.className = 'resend-btn';
                            resendBtn.innerHTML = '<span class="material-icons-round" style="font-size: 1rem;">refresh</span> Reenviar Instrucción';
                            resendBtn.style.cssText = 'margin-top: 10px; background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 4px; padding: 6px 12px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 0.8rem; font-weight: 500; transition: background 0.2s;';
                            resendBtn.onmouseover = () => resendBtn.style.background = 'rgba(239, 68, 68, 0.2)';
                            resendBtn.onmouseout = () => resendBtn.style.background = 'rgba(239, 68, 68, 0.1)';
                            resendBtn.onclick = (e) => {
                                e.stopPropagation();
                                const userText = currentUserMsg.querySelector('.task-text').textContent;
                                if (userText) {
                                    const editableEl = document.getElementById('editableTranscript');
                                    if (editableEl) {
                                        editableEl.textContent = userText;
                                        editableEl.contentEditable = 'true';
                                    }
                                    const tasksContainer = document.getElementById('tasksContainer');
                                    if (tasksContainer) tasksContainer.classList.add('hidden');

                                    triggerSendCountdown(userText);

                                    resendBtn.innerHTML = 'Enviando...';
                                    resendBtn.disabled = true;
                                    resendBtn.style.opacity = '0.5';
                                }
                            };
                            respDiv.appendChild(document.createElement('br'));
                            respDiv.appendChild(resendBtn);
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Error cargando historial:', e);
        }
    }

cargarHistorialEnRepo();

    if (repoBtn) {
        repoBtn.addEventListener('click', () => {
            const isHidden = tasksContainer.classList.contains('hidden');
            if (isHidden) {
                tasksContainer.classList.remove('hidden');
            } else {
                tasksContainer.classList.add('hidden');
            }
        });
    }
    if (closeRepoBtn) {
        closeRepoBtn.addEventListener('click', () => {
            tasksContainer.classList.add('hidden');
        });
    }

    if (clearRepoBtn) {
        clearRepoBtn.addEventListener('click', () => {
            if (confirm('¿Seguro que deseas vaciar el historial de tareas y reiniciar la sesión?')) {
                if (repoList) repoList.innerHTML = '';
                taskIdCounter = 1;
                fetch('/api/agente', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: 'CLEAR_HISTORY', backend: agentBackend, folder: '' })
                }).then(() => {
                    localStorage.removeItem('tfte_session_active');
                    location.reload();
                });
            }
        });
    }

    // --- INICIO LÓGICA DE LICENCIA / TRIAL ---
    async function checkLicenseStatus() {
        try {
            const res = await fetch('/api/license/status');
            const data = await res.json();

            const licenseModal = document.getElementById('licenseModal');

            if (data.status === 'expired') {
                // Mostrar modal de bloqueo
                if (licenseModal) {
                    licenseModal.classList.remove('hidden');
                    licenseModal.style.display = 'flex';
                }
                if (statusText) statusText.textContent = 'Trial Expirado';
            } else if (data.status === 'active') {
                // Mostrar días restantes en el side-rail
                const contextLabel = document.getElementById('contextStatusLabel');
                if (contextLabel) {
                    contextLabel.innerText = `Trial: ${data.daysLeft} días`;
                    contextLabel.style.color = '#38bdf8';
                    contextLabel.style.background = 'rgba(56, 189, 248, 0.1)';
                    contextLabel.style.border = '1px solid rgba(56, 189, 248, 0.3)';
                }
            }
        } catch (e) {
            console.error('Error comprobando licencia:', e);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        checkLicenseStatus();

        const verifyBtn = document.getElementById('verifyLicenseBtn');
        const licenseInput = document.getElementById('licenseKeyInput');

        if (verifyBtn && licenseInput) {
            verifyBtn.addEventListener('click', async () => {
                const key = licenseInput.value.trim();
                if (!key) return alert('Por favor ingresa una clave.');

                verifyBtn.textContent = 'Validando...';
                verifyBtn.disabled = true;

                try {
                    const res = await fetch('/api/license/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key })
                    });
                    const data = await res.json();

                    if (data.ok) {
                        alert(data.message);
                        location.reload();
                    } else {
                        alert(data.error || 'Clave inválida.');
                        verifyBtn.textContent = 'Validar Licencia';
                        verifyBtn.disabled = false;
                    }
                } catch (e) {
                    alert('Error de conexión.');
                    verifyBtn.textContent = 'Validar Licencia';
                    verifyBtn.disabled = false;
                }
            });
        }
    });
    // --- FIN LÓGICA DE LICENCIA ---

    // --- LÓGICA DE BARRA DE TAREAS PENDIENTES ---

    window.sendPendingTask = function (btn, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (btn.style.pointerEvents === 'none') return;
        
        const textEl = btn.closest('.pending-task-item').querySelector('.pending-task-text');
        const text = textEl.textContent.trim();
        if (!text) return;

        const originalIcon = btn.innerHTML;
        btn.innerHTML = '<span class="material-icons-round" style="animation: pulse 1s infinite; font-size: 1rem;">hourglass_empty</span>';
        btn.style.pointerEvents = 'none';

        fetch('/api/agente', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, backend: window.agentBackend || 'gemini' })
        }).then(r => r.json()).then(res => {
            if (res.ok) {
                btn.innerHTML = '<span class="material-icons-round" style="font-size: 1rem; color: #fbbf24;">check_circle</span>';
            } else {
                btn.innerHTML = originalIcon;
                btn.style.pointerEvents = 'auto';
            }
        }).catch(err => {
            console.error(err);
            btn.innerHTML = originalIcon;
            btn.style.pointerEvents = 'auto';
        });
    };

    async function fetchPendingTasks() {
        const contentDiv = document.getElementById('pendingTasksContent');
        if (!contentDiv) return;
        try {
            const response = await fetch('/api/agente/control?t=' + Date.now());
            const data = await response.json();
            if (data.tasks) {
                const combinedTasks = data.tasks.slice(0, 4);

                if (combinedTasks.length > 0) {
                    contentDiv.innerHTML = combinedTasks.map(taskObj => {
                        const status = taskObj.status;
                        const text = taskObj.text;
                        let iconColor = '#94a3b8';
                        let iconType = 'radio_button_unchecked';
                        let tagBg = '#475569';
                        let tagText = status ? status.toUpperCase() : 'TAREA';

                        if (status === 'En proceso/haciendo') {
                            iconColor = '#38bdf8';
                            iconType = 'play_circle';
                            tagBg = '#0284c7';
                            tagText = 'EN PROCESO';
                        } else if (status === 'Pendiente') {
                            iconColor = '#fbbf24';
                            tagBg = '#d97706';
                            tagText = 'PENDIENTE';
                        } else if (status === 'Proximos') {
                            tagBg = '#475569';
                            tagText = 'PRÓXIMO';
                        }

                        return `<div class="pending-task-item" style="display: flex; gap: 8px; align-items: flex-start; margin-bottom: 8px;">
                                <span class="material-icons-round" style="font-size: 1rem; color: ${iconColor}; margin-top: 2px;">${iconType}</span>
                                <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <span style="font-size: 8px; font-weight: 800; padding: 2px 4px; border-radius: 3px; background-color: ${tagBg}; color: white; width: max-content; letter-spacing: 0.5px;">${tagText}</span>
                                        <button class="send-pending-task-btn" onclick="window.sendPendingTask(this, event)" title="Enviar al Agente" style="background: none; border: none; color: #38bdf8; cursor: pointer; display: flex; align-items: center; padding: 2px; border-radius: 4px;">
                                            <span class="material-icons-round" style="font-size: 1rem;">send</span>
                                        </button>
                                    </div>
                                    <span contenteditable="true" class="pending-task-text" style="outline: none; border: 1px solid transparent; padding: 2px; border-radius: 4px; min-height: 20px; font-size: 0.85rem;" onfocus="this.style.border='1px solid rgba(255,255,255,0.2)'" onblur="this.style.border='1px solid transparent'">${text}</span>
                                </div>
                            </div>`;
                    }).join('');
                } else {
                    contentDiv.innerHTML = '<div style="text-align: center; color: #64748b; padding: 10px;">No hay tareas pendientes.</div>';
                }
            } else if (data.plan) {
                contentDiv.innerHTML = '<div style="text-align: center; color: #64748b; padding: 10px;">Por favor reinicia el backend (watchdog).</div>';
            }
        } catch (e) {
            console.error("Error fetching tasks:", e);
        }
    }

    window.togglePendingTasks = function () {
        const bar = document.getElementById('pendingTasksBar');
        const icon = document.getElementById('pendingTasksIcon');
        if (bar) {
            bar.classList.toggle('hidden');
            if (!bar.classList.contains('hidden')) {
                icon.textContent = 'expand_more';
                fetchPendingTasks();
            } else {
                icon.textContent = 'expand_less';
            }
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        fetchPendingTasks();
        setInterval(fetchPendingTasks, 10000); // Refrescar cada 10s
    });
// --- FIN LÓGICA DE BARRA DE TAREAS PENDIENTES ---
