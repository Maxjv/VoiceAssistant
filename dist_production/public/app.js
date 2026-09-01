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

        const pendingTasksBar = document.getElementById('pendingTasksBar');
        const pendingTasksIcon = document.getElementById('pendingTasksIcon');
        if (pendingTasksBar && !pendingTasksBar.classList.contains('hidden') && !pendingTasksBar.contains(e.target)) {
            pendingTasksBar.classList.add('hidden');
            if (pendingTasksIcon) pendingTasksIcon.textContent = 'expand_less';
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

    // Detectar clicks dentro de los iframes para cerrar barra inferior de tareas cuando se interactua
    const allIframes = [document.getElementById('iframeReact'), document.getElementById('iframeHtml'), document.getElementById('iframePlan'), document.getElementById('iframeImgs')];
    allIframes.forEach(ifr => {
        if (ifr) {
            const attach = () => {
                try {
                    if (ifr.contentDocument) {
                        ifr.contentDocument.addEventListener('mousedown', (e) => {
                            const pendingTasksBar = document.getElementById('pendingTasksBar');
                            const pendingTasksIcon = document.getElementById('pendingTasksIcon');
                            if (pendingTasksBar && !pendingTasksBar.classList.contains('hidden')) {
                                pendingTasksBar.classList.add('hidden');
                                if (pendingTasksIcon) pendingTasksIcon.textContent = 'expand_less';
                            }
                        });
                    }
                } catch (err) { }
            };
            ifr.addEventListener('load', attach);
            attach();
        }
    });

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
        if (url !== "/preview/Project_Control.html" && htmlSelector) {
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
                b.style.color = '';
                b.style.background = '';
            }
        });
    }

    const iframeReact = document.getElementById('iframeReact');
    const iframeHtml = document.getElementById('iframeHtml');
    const iframePlan = document.getElementById('iframePlan');
    const iframeImgs = document.getElementById('iframeImgs');
    previewIframe = iframeReact || document.getElementById('iframeReact'); // The currently active iframe

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
            if (typeof applyZoom === 'function') applyZoom();
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
        btnHtml.addEventListener('click', async () => {
            try {
                const res = await fetch('/api/check-control');
                const data = await res.json();

                if (data.exists) {
                    if (!iframeHtml.src.endsWith('/control-board')) {
                        iframeHtml.src = '/control-board';
                    }
                    switchIframe(iframeHtml);
                    setActiveTab(btnHtml);
                } else {
                    // Usar el nuevo Modal personalizado en lugar del confirm nativo
                    const ctrlModal = document.getElementById('createControlModal');
                    if (ctrlModal) {
                        ctrlModal.classList.remove('hidden');
                        ctrlModal.style.display = 'flex';

                        const closeModal = () => {
                            ctrlModal.classList.add('hidden');
                            setTimeout(() => ctrlModal.style.display = 'none', 300);
                        };

                        document.getElementById('closeCreateControlModal').onclick = closeModal;
                        document.getElementById('btnCancelCreateControl').onclick = closeModal;

                        document.getElementById('btnConfirmCreateControl').onclick = async () => {
                            document.getElementById('btnConfirmCreateControl').disabled = true;
                            document.getElementById('btnConfirmCreateControl').innerHTML = '<span class="material-icons-round" style="font-size: 1.1rem; margin-right: 5px;">hourglass_empty</span> Creando...';

                            try {
                                const createRes = await fetch('/api/control/create', { method: 'POST' });
                                const createData = await createRes.json();
                                if (createData.ok) {
                                    iframeHtml.src = createData.url;
                                    switchIframe(iframeHtml);
                                    setActiveTab(btnHtml);
                                    closeModal();
                                } else {
                                    alert("No se pudo crear el entorno de control.");
                                }
                            } catch (err) {
                                alert("Error creando el entorno.");
                            } finally {
                                document.getElementById('btnConfirmCreateControl').disabled = false;
                                document.getElementById('btnConfirmCreateControl').innerHTML = '<span class="material-icons-round" style="font-size: 1.1rem; margin-right: 5px;">add_circle</span> Crear';
                            }
                        };
                    }
                }
            } catch (err) {
                console.error("Error checking control environment:", err);
                // Fallback
                switchIframe(iframeHtml);
                setActiveTab(btnHtml);
            }
        });
    }

    if (btnReact) {
        btnReact.addEventListener('click', () => {
            if (btnReact.classList.contains('active') && iframeReact) {
                iframeReact.contentWindow.location.reload();
            } else {
                switchIframe(iframeReact);
                setActiveTab(btnReact);
            }
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
                    console.warn('Este documento no tiene auto-guardado (no es Project_Control.html).');
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
function mostrarModalCreditos(proveedor, showQuota = false) {
    const modal = document.getElementById('modal-creditos');
    if (!modal) return;

    // Reiniciar vista al paso 1 o al paso Quota
    const step1 = document.getElementById('modal-step-1');
    const stepYes = document.getElementById('modal-step-yes');
    const stepNo = document.getElementById('modal-step-no');
    const stepQuota = document.getElementById('modal-step-quota');

    if (step1) step1.style.display = showQuota ? 'none' : 'block';
    if (stepYes) stepYes.style.display = 'none';
    if (stepNo) stepNo.style.display = 'none';
    if (stepQuota) stepQuota.style.display = showQuota ? 'block' : 'none';

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
    const btnCerrarQuota = document.getElementById('btn-cerrar-modal-quota');
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
    if (btnCerrarQuota) btnCerrarQuota.onclick = cerrarModal;

    const sendToastBtn = document.getElementById('sendToastBtn');

    // NUEVO: Instalar CLI si falla
    const btnInstallCli = document.getElementById('btn-install-cli');
    if (btnInstallCli) {
        btnInstallCli.onclick = () => {
            fetch('/api/install-cli', { method: 'POST' });
            btnInstallCli.innerHTML = '<span class="material-icons-round" style="font-size:1rem; animation:spin 1s linear infinite;">sync</span> Instalando en consola...';
        };
    }

    // NUEVO: Lógica del botón mágico de Login
    const btnMagicoLogin = document.getElementById('btn-magico-login');
    if (btnMagicoLogin) {
        btnMagicoLogin.onclick = async () => {
            btnMagicoLogin.innerHTML = '<span class="material-icons-round" style="animation: spin 1s linear infinite;">sync</span> Abriendo navegador...';
            try {
                await fetch('/api/auth-cli', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ backend: agentBackend })
                });
                document.getElementById('msg-login-enviado').style.display = 'block';
                btnMagicoLogin.style.display = 'none';
            } catch (e) {
                alert("Error intentando abrir el login.");
                btnMagicoLogin.innerHTML = 'Reintentar';
            }
        };
    }

    // NUEVO: Detectar nombre del proyecto y cambiar el botón
    fetch('/api/project-info')
        .then(r => r.json())
        .then(info => {
            const btnReactLabel = document.querySelector('#btnReact .rail-label');
            if (btnReactLabel && info.name && info.name !== 'React App') {
                btnReactLabel.textContent = info.name.length > 10 ? info.name.substring(0, 8) + '...' : info.name;
                document.getElementById('btnReact').title = `Ver ${info.name}`;
            }
        }).catch(() => { });

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
                // Si la sesion ya esta activa en localStorage, ingresamos rápido pero verificamos cuota en silencio
                if (localStorage.getItem('tfte_session_active') === 'true') {
                    const ctxModal = document.getElementById('contextModal');
                    if (ctxModal) {
                        ctxModal.style.display = 'none';
                        ctxModal.classList.add('hidden');
                    }
                    markGeminiReady();

                    // (Eliminado el PING_CUOTA porque causaba mensajes falsos en el agente y siempre daba HTTP 200)

                    return;
                }

                // Obtener el contexto de forma confiable desde el backend (100% DINÁMICO)
                const res = await fetch('/api/get-context');
                const data = await res.json();

                if (data.contextPath) {
                    const ctxModal = document.getElementById('contextModal');
                    if (ctxModal) {
                        // AUTO-CONEXION INVISIBLE E INMEDIATA
                        ctxModal.style.display = 'none';
                        ctxModal.classList.add('hidden');
                    }

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

                    // Llamar al backend para setear el context path y projectName
                    const setRes = await fetch('/api/set-context', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contextPath: data.contextPath,
                            projectName: data.projectName
                        })
                    });

                    if (setRes.ok) {
                        localStorage.setItem('tfte_session_active', 'true');
                        markGeminiReady();
                        // 🛑 ARQUITECTURA LIMPIA: Cero "pings" rotos, cero saludos falsos.
                        return;
                    }

                    // Si algo falla, mostramos modal de creditos
                    mostrarModalCreditos(agentBackend);
                } else {
                    // Flujo manual si el servidor no tiene contexto
                    const ctxModal = document.getElementById('contextModal');
                    if (ctxModal) {
                        ctxModal.classList.remove('hidden');
                        ctxModal.style.display = 'flex';
                    }
                    statusIndicator.className = 'status-indicator thinking';
                    statusText.textContent = 'Requiere contexto';
                    instructionText.textContent = 'Aguardando inicialización de sesión...';
                }
            } catch (err) {
                console.error("Fallo auto-conexion:", err);
                // Si falla la red, obligamos a manual
                const ctxModal = document.getElementById('contextModal');
                if (ctxModal) {
                    ctxModal.classList.remove('hidden');
                    ctxModal.style.display = 'flex';
                }
            }
        }

        // Lanzar autoConnect apenas arranca el DOM
        autoConnect();

        startContextBtn.addEventListener('click', async () => {
            try {
                startContextBtn.disabled = true;
                startContextBtn.textContent = 'Guardando ruta...';

                // Leemos el contexto activo del localStorage (gestionado por app.html)
                const activeCtxObjStr = localStorage.getItem('tfte_active_context_obj');
                const selectEl = document.getElementById('savedContextsSelect');
                let activeCtx = selectEl ? selectEl.value : (localStorage.getItem('tfte_active_context') || '');
                let activeProj = 'Mi Proyecto';

                if (activeCtxObjStr) {
                    try {
                        const parsed = JSON.parse(activeCtxObjStr);
                        if (parsed && parsed.path) {
                            activeCtx = parsed.path;
                            activeProj = parsed.name || 'Mi Proyecto';
                        }
                    } catch (e) { }
                }

                const lbl1 = document.getElementById('projectNameLabel1');
                const lbl2 = document.getElementById('projectNameLabel2');
                if (lbl1) lbl1.innerText = activeProj;
                if (lbl2) lbl2.innerText = activeProj;

                try {
                    await fetch('/api/set-context', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contextPath: activeCtx,
                            projectName: activeProj
                        })
                    });
                } catch (err) { }

                contextModal.classList.add('hidden');
                setTimeout(() => contextModal.style.display = 'none', 300);
                localStorage.setItem('tfte_session_active', 'true');
                markGeminiReady();
                // 🛑 CERO SALUDOS FALSOS AQUÍ TAMBIÉN.

            } catch (err) {
                console.error(err);
            } finally {
                startContextBtn.disabled = false;
                startContextBtn.textContent = 'Cargar Contexto y Empezar';
            }
        }); // <-- Aquí termina el botón de Cargar Contexto

        // --- LÓGICA DEL NUEVO BOTÓN APLICAR ---
        const applyModelBtn = document.getElementById('applyModelBtn');
        if (applyModelBtn) {
            applyModelBtn.addEventListener('click', () => {
                const selectEl = document.getElementById('geminiModelSelect');
                if (selectEl) {
                    localStorage.setItem('tfte_gemini_model', selectEl.value);
                    const modelName = selectEl.options[selectEl.selectedIndex].text;
                    addTranscriptText(`Modelo de Inteligencia Artificial cambiado exitosamente a ${modelName}.`, 'ai');
                }
                // Cierra el modal sin disparar el fetch del contexto
                contextModal.classList.add('hidden');
                setTimeout(() => contextModal.style.display = 'none', 300);
            });
        }
    }
});

// ==========================================
// VERIFICACIÓN INTELIGENTE DE CUOTA Y SALUDO
// ==========================================
async function verificarCuotaYSaludar(esAuto) {
    const selectElModel = document.getElementById('geminiModelSelect');
    const modelName = selectElModel && selectElModel.options[selectElModel.selectedIndex] ? selectElModel.options[selectElModel.selectedIndex].text : 'IA';
    const saludo = esAuto ? `Contexto vinculado automáticamente. ¡Hola! Soy tu agente ${modelName}.` : `Contexto vinculado. ¡Hola! Soy tu agente ${modelName}.`;

    try {
        statusText.textContent = 'Verificando estado de la IA...';

        // (PING_CUOTA eliminado porque el servidor Node.js siempre devuelve 200 OK y activaba un mensaje falso del Agente)

        // Si pasamos la aduana sin errores de cuota, lanzamos el saludo y el audio
        addTranscriptText(saludo, 'ai');
        playAgentAudio(saludo);

    } catch (e) {
        // Fallback por si hay error de red genérico, saludamos igual para no trabar la interfaz
        addTranscriptText(saludo, 'ai');
        playAgentAudio(saludo);
    }
}

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
            if (window.autoSendTimer) clearInterval(window.autoSendTimer);
            const finalTxt = editableTranscript ? editableTranscript.textContent.trim() : finalText;
            if (finalTxt && finalTxt !== '...') {
                enviarMensaje(finalTxt, window.pendingFolder || '');
            }
            responseToast.classList.add('hidden');
            sendToastBtn.style.display = 'none';
            cancelWhisperBtn.style.display = 'none';
            updateUIState(queueBusy ? 'thinking' : 'ready');
        };

        cancelWhisperBtn.onclick = () => {
            if (window.autoSendTimer) clearInterval(window.autoSendTimer);
            responseToast.classList.add('hidden');
            sendToastBtn.style.display = 'none';
            cancelWhisperBtn.style.display = 'none';
            updateUIState(queueBusy ? 'thinking' : 'ready');
        };
    }
}

function toggleRecording() {
    const agentAudio = document.getElementById('agentAudio');
    if (agentAudio) {
        if (!window.audioUnlocked) {
            agentAudio.play().catch(e => { });
            window.audioUnlocked = true;
        }
        // Cortar el audio si el agente está hablando y queremos interrumpirlo
        agentAudio.pause();
        if (currentAudioEl === agentAudio) currentAudioEl = null;
    }

    if (!isListening) {
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            addTranscriptText("Tu navegador no soporta reconocimiento de voz nativo. Usa Chrome.", 'error');
            return;
        }

        recognition = new SpeechRecognition();
        recognition.lang = 'es-ES';
        recognition.continuous = true;
        recognition.interimResults = true;
        finalTranscript = '';

        recognition.onstart = () => {
            isListening = true;
            updateUIState('listening');

            const responseToast = document.getElementById('responseToast');
            if (responseToast) responseToast.classList.remove('hidden');

            const transcriptEl = document.getElementById('transcript');
            if (transcriptEl) {
                transcriptEl.innerHTML = '';
                const p = document.createElement('p');
                p.className = 'user-text';
                p.textContent = '...';
                p.contentEditable = 'true';
                p.style.outline = 'none';
                p.id = 'editableTranscript';
                transcriptEl.appendChild(p);
            }

            const sendToastBtn = document.getElementById('sendToastBtn');
            const cancelWhisperBtn = document.getElementById('cancelWhisperBtn');
            if (sendToastBtn) sendToastBtn.style.display = 'none';
            if (cancelWhisperBtn) cancelWhisperBtn.style.display = 'none';
        };

        recognition.onresult = (event) => {
            let interim = '';
            let finalPiece = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) finalPiece += event.results[i][0].transcript;
                else interim += event.results[i][0].transcript;
            }
            finalTranscript += finalPiece;

            const editableEl = document.getElementById('editableTranscript');
            if (editableEl) {
                editableEl.textContent = finalTranscript + interim;
            }

            clearTimeout(silenceTimer);
            silenceTimer = setTimeout(() => {
                if (isListening) toggleRecording();
            }, SILENCE_TIMEOUT_MS);
        };

        recognition.onerror = (event) => {
            console.error("Speech API error:", event.error);
            if (event.error !== 'no-speech') {
                addTranscriptText(`Error de micrófono: ${event.error}`, 'error');
            }
            if (isListening) {
                isListening = false;
                updateUIState(queueBusy ? 'thinking' : 'ready');
            }
        };

        recognition.onend = () => {
            if (isListening) {
                isListening = false;
                updateUIState(queueBusy ? 'thinking' : 'ready');
                const editableEl = document.getElementById('editableTranscript');
                const finalTxt = editableEl ? editableEl.textContent.trim() : finalTranscript.trim();
                if (finalTxt && finalTxt !== '...') {
                    triggerSendCountdown(finalTxt);
                }
            }
        };

        try {
            recognition.start();
        } catch (e) {
            console.error(e);
            isListening = false;
            updateUIState('ready');
        }
    } else {
        if (recognition) {
            try { recognition.stop(); } catch (e) { }
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
            headers: { 'Content-Type': 'application/json' },
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
        return true; // ÉXITO
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
        return false; // FALLO
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
        return true; // ÉXITO
    } catch (error) {
        console.error('Error enviando al agente:', error);
        updateUIState('ready');
        addTranscriptText(error.message || 'Error de conexión con el agente.', 'error');
        return false; // FALLO (ej. Sin créditos)
    }
}

// ==========================================
// POLL AGENTE (Escudo Anti-Bucles y Detección de Tokens)
// ==========================================
function pollAgente() {
    return new Promise((resolve) => {
        if (agentPolling) clearInterval(agentPolling);
        let vistoOcupado = false;
        let ciclosPensando = 0;

        agentPolling = setInterval(async () => {
            try {
                const response = await fetch('/api/agente/estado?backend=' + agentBackend);
                if (!response.ok) return;
                const data = await response.json();

                // 🔥 ADUANA INMEDIATA: Inspecciona cada respuesta en busca de falta de tokens
                const respLower = (data.respuesta || '').toLowerCase();
                if (respLower.includes('quota reached') || respLower.includes('exit code 1') || respLower.includes('hubo un error técnico') || respLower.includes('individual quota reached')) {
                    clearInterval(agentPolling);
                    agentPolling = null;
                    updateUIState('ready');
                    const isQuota = respLower.includes('quota reached');
                    mostrarModalCreditos(agentBackend, isQuota); // Dispara tu popup elegante

                    // Limpiamos memoria para liberar el bucle
                    lastAgentResponse = '';
                    localStorage.removeItem(lastSeenKey(agentBackend));
                    return;
                }

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
                    if (ciclosPensando > 200) {
                        clearInterval(agentPolling);
                        updateUIState('ready');
                        mostrarModalCreditos(agentBackend);
                    }
                    return;
                }

                if (data.status === 'idle') {
                    if (vistoOcupado) {
                        clearInterval(agentPolling);
                        updateUIState('ready');
                    } else {
                        ciclosPensando++;
                        if (ciclosPensando > 200) {
                            clearInterval(agentPolling);
                            updateUIState('ready');
                            addTranscriptText(`Error: El motor no responde.`, 'error');
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

                    // Forzar recarga de iframes para asegurar que el cambio se vea en vivo (producción o dev)
                    document.querySelectorAll('iframe').forEach(ifr => {
                        try {
                            const currentSrc = ifr.src;
                            if (currentSrc && !currentSrc.includes('about:blank')) {
                                // Para evitar el "flashazo blanco", simplemente reasignamos el src original.
                                // El navegador intentará cargar la nueva página encima de la anterior de forma más suave.
                                const url = new URL(currentSrc);
                                url.searchParams.set('t', Date.now()); // Forzar cache bust
                                ifr.src = url.toString();
                            }
                        } catch (e) { }
                    });

                    if (typeof updateTaskRepoResponse === 'function' && currentTaskObj) {
                        updateTaskRepoResponse(currentTaskObj, data.respuesta);
                    }
                    await playAgentAudio(data.respuesta);
                    resolve();
                }
            } catch (error) {
                console.error('Error consultando estado del agente:', error);
            }
        }, 1500);
    });
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
            micBtn.classList.remove('thinking');
        }
        if (micIcon) micIcon.textContent = 'mic'; // Mantiene el ícono para que puedas seguir hablando
        instructionText.textContent = 'Procesando... (Toca para hablar)';
    } else if (state === 'speaking') {
        statusIndicator.classList.add('speaking');
        statusText.textContent = 'Hablando...';
        if (micBtn) micBtn.classList.remove('active');
        if (micIcon) micIcon.textContent = 'volume_up';
        instructionText.textContent = 'Escucha la respuesta';
    } else {
        statusText.textContent = geminiReady ? 'Contexto Vinculado' : 'Aguardando agente...';
        if (micBtn) micBtn.classList.remove('active');
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

        // Desaparecer automáticamente el mensaje del usuario al cabo de 10 segundos
        setTimeout(() => {
            if (p && p.parentNode) {
                p.remove();
            }
            if (toast) {
                toast.classList.add('hidden');
            }
        }, 10000);
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

async function retomarAgentePendiente() {
    try {
        const response = await fetch('/api/agente/estado?backend=' + agentBackend);
        if (!response.ok) return;
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
            if (typeof updateTaskRepoResponse === 'function' && typeof currentTaskObj !== 'undefined' && currentTaskObj) {
                updateTaskRepoResponse(currentTaskObj, data.respuesta);
            }
            await playAgentAudio(data.respuesta);
        }
    } catch (error) {
        console.error('Chequeo de agente pendiente omitido:', error);
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

// --- LÓGICA DEL POPUP DE ELIMINAR MENSAJE ---
let deletePopup = document.getElementById('deleteTaskPopup');
if (!deletePopup) {
    deletePopup = document.createElement('div');
    deletePopup.id = 'deleteTaskPopup';
    deletePopup.style.cssText = 'display: none; position: fixed; inset: 0; z-index: 100005; align-items: center; justify-content: center;';
    deletePopup.innerHTML = `
        <div id="deletePopupBackdrop" style="position: absolute; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(2px); cursor: pointer;"></div>
        <div style="position: relative; background: #1e293b; border: 1px solid #334155; padding: 20px; border-radius: 12px; z-index: 100006; display: flex; flex-direction: column; gap: 15px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); max-width: 300px; text-align: center;">
            <span class="material-icons-round" style="font-size: 2.5rem; color: #ef4444; margin: 0 auto;">delete_forever</span>
            <span style="color: #f8fafc; font-size: 0.85rem; font-weight: 500;">¿Seguro que deseas eliminar este mensaje del historial?</span>
            <div style="display: flex; gap: 10px; justify-content: center; margin-top: 5px;">
                <button id="cancelDeleteBtn" style="background: #475569; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 0.75rem; font-weight: 600; flex: 1;">Cancelar</button>
                <button id="confirmDeleteBtn" style="background: #ef4444; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 0.75rem; font-weight: 600; flex: 1;">Eliminar</button>
            </div>
        </div>
    `;
    document.body.appendChild(deletePopup);

    var _dpb = document.getElementById('deletePopupBackdrop'); if (_dpb) _dpb.addEventListener('click', () => {
        deletePopup.style.display = 'none';
    });
    var _cdb = document.getElementById('cancelDeleteBtn'); if (_cdb) _cdb.addEventListener('click', () => {
        deletePopup.style.display = 'none';
    });
}

let taskToDeleteId = null;

window.openDeletePopup = function (event, cardId) {
    event.stopPropagation();
    taskToDeleteId = cardId;
    document.getElementById('deleteTaskPopup').style.display = 'flex';
};

var _cfdb = document.getElementById('confirmDeleteBtn'); if (_cfdb) _cfdb.addEventListener('click', () => {
    if (taskToDeleteId) {
        const card = document.getElementById(taskToDeleteId);
        if (card) {
            // Efecto de desvanecimiento antes de borrar
            card.style.transition = 'opacity 0.2s, transform 0.2s';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.95)';
            setTimeout(() => card.remove(), 200);
        }
        taskToDeleteId = null;
    }
    document.getElementById('deleteTaskPopup').style.display = 'none';
});
// --------------------------------------------

function logTaskToRepo(text, type = 'user') {
    if (!repoList) return null;
    const id = taskIdCounter++;
    const card = document.createElement('div');
    card.className = 'task-card';
    card.id = 'repo-task-' + id;

    // Tamaños reducidos (~3pt menos): Textos de 0.85/0.9 -> 0.75, Títulos a 0.65, Badges a 0.6
    card.innerHTML = `
        <div class="task-row" style="cursor: pointer; align-items: flex-start;" onclick="this.parentElement.classList.toggle('collapsed')">
            <div style="color: #94a3b8; font-size: 0.65rem; display: flex; align-items: center; gap: 4px;">
                <span class="material-icons-round chevron-icon" style="font-size: 0.85rem; transition: transform 0.2s;">expand_more</span>
                #${id} Instrucción
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
                <div class="task-badge badge-pending" id="badge-inst-${id}" style="font-size: 0.6rem; padding: 2px 6px;">PENDING</div>
                <button onclick="window.openDeletePopup(event, 'repo-task-${id}')" title="Eliminar mensaje" style="background: transparent; border: none; color: #ef4444; cursor: pointer; padding: 2px; display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: background 0.2s;" onmouseover="this.style.background='rgba(239, 68, 68, 0.1)'" onmouseout="this.style.background='transparent'">
                    <span class="material-icons-round" style="font-size: 0.95rem;">delete_outline</span>
                </button>
            </div>
        </div>
        <div class="task-text" style="font-size: 0.75rem; line-height: 1.4; padding: 2px 0;">${text}</div>
        <div class="task-row" style="margin-top: 4px;">
            <div style="color: #94a3b8; font-size: 0.65rem;">Respuesta</div>
            <div class="task-badge badge-pending" id="badge-resp-${id}" style="font-size: 0.6rem; padding: 2px 6px;">PENDING</div>
        </div>
        <div class="repo-response" id="resp-text-${id}" style="display: none; font-size: 0.7rem; line-height: 1.4; padding: 4px 0;"></div>
        <div class="task-row" style="margin-top: 4px;">
            <div style="color: #94a3b8; font-size: 0.65rem;">Confirmación de Cierre</div>
            <button class="task-badge badge-pending" id="badge-conf-${id}" style="font-size: 0.6rem; padding: 2px 6px; cursor: pointer; border: none; font-family: inherit;" onclick="window.confirmarDesdeHistorial(this, '${text.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${id}', event)" title="Confirmar y cerrar tarea">PENDING</button>
        </div>
    `;
    repoList.prepend(card);
    if (tasksContainer) tasksContainer.scrollTop = 0;
    return { id, element: card, status: 'pending', responseText: '', originalText: text };
}

function updateTaskRepoResponse(taskObj, responseText, isConfirmation = false) {
    if (!taskObj || !taskObj.element) return;
    const { id, originalText } = taskObj;

    const isError = responseText.includes('Hubo un error') || responseText.includes('Exit code null');
    const badgeText = isError ? 'ERROR' : 'COMPLETADO';
    const badgeClass = isError ? 'task-badge badge-error' : 'task-badge badge-completed';

    if (isConfirmation) {
        const confBadge = document.getElementById('badge-conf-' + id);
        if (confBadge) {
            confBadge.textContent = badgeText;
            confBadge.className = badgeClass;
            confBadge.style.fontSize = '0.6rem';
            confBadge.style.padding = '2px 6px';
        }
    } else {
        const respBadge = document.getElementById('badge-resp-' + id);
        if (respBadge) {
            respBadge.textContent = badgeText;
            respBadge.className = badgeClass;
            respBadge.style.fontSize = '0.6rem';
            respBadge.style.padding = '2px 6px';
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
                    resendBtn.innerHTML = '<span class="material-icons-round" style="font-size: 0.85rem;">refresh</span> Reenviar Instrucción';
                    resendBtn.style.cssText = 'margin-top: 8px; background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 4px; padding: 4px 10px; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 0.65rem; font-weight: 500; transition: background 0.2s;';
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
                            const tasksContainer = document.getElementById('tasksContainer');
                            if (tasksContainer) tasksContainer.classList.add('hidden');

                            triggerSendCountdown(originalText);

                            resendBtn.innerHTML = '<span class="material-icons-round" style="font-size: 0.85rem; animation: spin 1s linear infinite;">sync</span> Enviando...';
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
                card.id = 'hist-task-' + id;
                card.innerHTML = `
                    <div class="task-row" style="cursor: pointer; align-items: flex-start;" onclick="this.parentElement.classList.toggle('collapsed')">
                        <div style="color: #94a3b8; font-size: 0.65rem; display: flex; align-items: center; gap: 4px;">
                            <span class="material-icons-round chevron-icon" style="font-size: 0.85rem; transition: transform 0.2s;">expand_more</span>
                            ${timestamp}
                        </div>
                        <div style="display: flex; gap: 6px; align-items: center;">
                            <div class="task-badge badge-waiting" style="font-size: 0.6rem; padding: 2px 6px;">PROCESANDO</div>
                            <button onclick="window.openDeletePopup(event, 'hist-task-${id}')" title="Eliminar mensaje" style="background: transparent; border: none; color: #ef4444; cursor: pointer; padding: 2px; display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: background 0.2s;" onmouseover="this.style.background='rgba(239, 68, 68, 0.1)'" onmouseout="this.style.background='transparent'">
                                <span class="material-icons-round" style="font-size: 0.95rem;">delete_outline</span>
                            </button>
                        </div>
                    </div>
                    <div class="task-text" style="font-size: 0.75rem; line-height: 1.4; padding: 2px 0;">${text}</div>
                    <div class="repo-response" style="display: none; font-size: 0.7rem; line-height: 1.4; padding: 4px 0;"></div>
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
                        badge.style.fontSize = '0.6rem';
                        badge.style.padding = '2px 6px';
                    }
                    if (isError) {
                        const resendBtn = document.createElement('button');
                        resendBtn.className = 'resend-btn';
                        resendBtn.innerHTML = '<span class="material-icons-round" style="font-size: 0.85rem;">refresh</span> Reenviar Instrucción';
                        resendBtn.style.cssText = 'margin-top: 8px; background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 4px; padding: 4px 10px; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 0.65rem; font-weight: 500; transition: background 0.2s;';
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

                                resendBtn.innerHTML = '<span class="material-icons-round" style="font-size: 0.85rem; animation: spin 1s linear infinite;">sync</span> Enviando...';
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
        if (tasksContainer) tasksContainer.classList.toggle('hidden');
    });
}
if (closeRepoBtn) {
    closeRepoBtn.addEventListener('click', () => {
        if (tasksContainer) tasksContainer.classList.add('hidden');
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
        } else if (data.status === 'active' || data.status === 'trial') {
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

// --- LOGICA DE COMPLETAR TAREAS ---
// --- LOGICA DE COMPLETAR TAREAS (BOTÓN HECHO) ---
// --- LOGICA DE COMPLETAR TAREAS DESDE EL HISTORIAL ---
window.confirmarDesdeHistorial = async function (btn, taskText, id, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (btn.textContent === 'COMPLETADO' || btn.textContent === 'ERROR') return;

    btn.innerHTML = 'Guardando...';
    btn.style.pointerEvents = 'none';

    try {
        const res = await fetch('/api/tasks/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: taskText, subApp: '' })
        });
        const data = await res.json();

        if (data.ok) {
            btn.textContent = 'COMPLETADO';
            btn.className = 'task-badge badge-completed';
        } else {
            btn.textContent = 'ERROR';
            btn.className = 'task-badge badge-error';
            setTimeout(() => {
                btn.textContent = 'PENDING';
                btn.className = 'task-badge badge-pending';
                btn.style.pointerEvents = 'auto';
            }, 2000);
        }
    } catch (err) {
        console.error('Error:', err);
        btn.textContent = 'ERROR';
        btn.className = 'task-badge badge-error';
        setTimeout(() => {
            btn.textContent = 'PENDING';
            btn.className = 'task-badge badge-pending';
            btn.style.pointerEvents = 'auto';
        }, 2000);
    }
};

window.completeTask = async function (btn, taskText, subApp, taskId, event) {
    if (typeof taskId === 'object') {
        event = taskId;
        taskId = null;
    }
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    if (!btn) return;

    if (taskId && window.executedTasksWaitingConfirm) {
        window.executedTasksWaitingConfirm.delete(taskId);
    }

    // Feedback visual inmediato
    btn.innerHTML = '<span class="material-icons-round" style="font-size: 0.95rem; animation: spin 1s linear infinite;">sync</span> Guardando...';
    btn.style.pointerEvents = 'none';

    try {
        const res = await fetch('/api/tasks/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: taskText, subApp: subApp || '' })
        });
        const data = await res.json();

        if (data.ok) {
            const pendingItem = btn.closest('.pending-task-item');
            if (pendingItem) {
                // Animación de desaparición fluida
                pendingItem.style.opacity = '0';
                pendingItem.style.transform = 'translateX(30px)';

                setTimeout(() => {
                    pendingItem.remove();
                    // Mostrar mensaje festivo si se vació la lista
                    const container = document.getElementById('pendingTasksContent');
                    if (container && container.querySelectorAll('.pending-task-item').length === 0) {
                        container.innerHTML = '<div style="color: #94a3b8; font-size: 0.8rem; padding: 12px; text-align: center;">🎉 No hay tareas pendientes en este momento.</div>';
                    }
                }, 300);
            }
        } else {
            // Si el backend no encontró el texto exacto
            btn.innerHTML = '<span class="material-icons-round" style="font-size: 0.95rem;">warning</span> Error lectura';
            btn.style.color = '#f59e0b';
            setTimeout(() => {
                btn.innerHTML = '<span class="material-icons-round" style="font-size: 0.95rem;">check</span> Hecho';
                btn.style.color = '#34d399';
                btn.style.pointerEvents = 'auto';
            }, 2000);
        }
    } catch (err) {
        console.error('Error completando tarea:', err);
        btn.innerHTML = '<span class="material-icons-round" style="font-size: 0.95rem;">error</span> Error Red';
        btn.style.color = '#f87171';
        setTimeout(() => {
            btn.innerHTML = '<span class="material-icons-round" style="font-size: 0.95rem;">check</span> Hecho';
            btn.style.color = '#34d399';
            btn.style.pointerEvents = 'auto';
        }, 2000);
    }
};

// --- LOGICA DE BARRA DE TAREAS PENDIENTES ---
window.togglePendingTasks = function () {
    const bar = document.getElementById('pendingTasksBar');
    const icon = document.getElementById('bottomToggleIcon');
    if (!bar) return;
    if (bar.classList.contains('hidden')) {
        bar.classList.remove('hidden');
        if (icon) icon.textContent = 'expand_more';
        fetchPendingTasks();
    } else {
        bar.classList.add('hidden');
        if (icon) icon.textContent = 'expand_less';
    }
};

// --- COLA DE EJECUCIÓN ESTILO ANTIGRAVITY ---
window.executionQueue = [];
let isQueueRunning = false;
let currentExecutingTaskId = null;

window.queuePendingTask = function (btn, event) {
    if (event) event.preventDefault();
    const itemDiv = btn.closest('.pending-task-item');
    if (!itemDiv) return;
    const textInput = itemDiv.querySelector('.edit-task-input');
    const subApp = itemDiv.dataset.subapp || '';
    const field = itemDiv.dataset.field || '';
    const textoEditado = (textInput ? textInput.value : '').trim();
    const taskId = itemDiv.dataset.taskid || ('task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4));
    itemDiv.dataset.taskid = taskId;

    // Si ya está en la cola, quitarla (toggle de-queue)
    const existingIndex = window.executionQueue.findIndex(t => t.id === taskId);
    if (existingIndex !== -1) {
        window.executionQueue.splice(existingIndex, 1);
        updateQueueUI();
        return;
    }

    // Si es la que está ejecutando ahora mismo, no hacer nada
    if (currentExecutingTaskId === taskId) return;

    const fullPrompt = subApp ? `[${subApp}${field ? ' - ' + field : ''}] ${textoEditado}` : textoEditado;

    const taskObj = {
        id: taskId,
        subApp,
        field,
        rawText: textoEditado,
        fullPrompt,
        status: 'queued',
        addedAt: Date.now()
    };

    window.executionQueue.push(taskObj);
    updateQueueUI();
    processExecutionQueue();
};

window.clearExecutionQueue = function (event) {
    if (event) event.stopPropagation();

    // Quitar la tarea actual del estado de confirmación si fue cancelada
    if (currentExecutingTaskId && window.executedTasksWaitingConfirm) {
        window.executedTasksWaitingConfirm.delete(currentExecutingTaskId);
    }

    window.executionQueue = [];
    isQueueRunning = false;
    currentExecutingTaskId = null;
    updateQueueUI();
    fetchPendingTasks(); // Refrescar visualmente

    fetch('/api/agente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'cancelar', backend: agentBackend, folder: '' })
    }).catch(e => { });

    updateUIState('ready');
};

function updateQueueUI() {
    const queueCountBadge = document.getElementById('queueCountBadge');
    const queueActiveIndicator = document.getElementById('queueActiveIndicator');
    const queueStatusBanner = document.getElementById('queueStatusBanner');
    const queueStatusText = document.getElementById('queueStatusText');

    const totalQueued = window.executionQueue.length;

    if (queueCountBadge) {
        if (totalQueued > 0) {
            queueCountBadge.style.display = 'inline-block';
            queueCountBadge.textContent = `${totalQueued} en cola`;
        } else {
            queueCountBadge.style.display = 'none';
        }
    }

    if (queueActiveIndicator) {
        queueActiveIndicator.style.display = isQueueRunning ? 'flex' : 'none';
    }

    if (queueStatusBanner) {
        if (totalQueued > 0 || isQueueRunning) {
            queueStatusBanner.style.display = 'flex';
            if (queueStatusText) {
                queueStatusText.textContent = isQueueRunning
                    ? `Ejecutando tarea... (${totalQueued} en cola de espera)`
                    : `${totalQueued} tarea(s) en cola de ejecución`;
            }
        } else {
            queueStatusBanner.style.display = 'none';
        }
    }

    // Actualizar badges y botones en los items de la lista
    document.querySelectorAll('.pending-task-item').forEach(itemDiv => {
        const tId = itemDiv.dataset.taskid;
        const sendBtn = itemDiv.querySelector('.pending-task-btn-send');
        const queueSlot = itemDiv.querySelector('.queue-badge-slot');

        const queueIndex = window.executionQueue.findIndex(t => t.id === tId);

        if (tId === currentExecutingTaskId && isQueueRunning) {
            if (queueSlot) {
                queueSlot.innerHTML = `<span style="font-size: 0.65rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: rgba(245, 158, 11, 0.2); border: 1px solid #f59e0b; color: #fbbf24; display: inline-flex; align-items: center; gap: 3px;"><span class="material-icons-round" style="font-size: 0.8rem; animation: spin 1.5s linear infinite;">sync</span> EJECUTANDO</span>`;
            }
            if (sendBtn) {
                sendBtn.innerHTML = `<span class="material-icons-round" style="font-size: 0.95rem; animation: spin 1.5s linear infinite; color: #fbbf24;">sync</span> En curso`;
                sendBtn.style.background = 'rgba(245, 158, 11, 0.2)';
                sendBtn.style.borderColor = 'rgba(245, 158, 11, 0.4)';
                sendBtn.style.color = '#fbbf24';
            }
        } else if (queueIndex !== -1) {
            if (queueSlot) {
                queueSlot.innerHTML = `<span style="font-size: 0.65rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: rgba(56, 189, 248, 0.2); border: 1px solid #38bdf8; color: #7dd3fc; display: inline-flex; align-items: center; gap: 3px;"><span class="material-icons-round" style="font-size: 0.75rem;">schedule</span> EN COLA #${queueIndex + 1}</span>`;
            }
            if (sendBtn) {
                sendBtn.innerHTML = `<span class="material-icons-round" style="font-size: 0.95rem; color: #f87171;">remove_circle_outline</span> Quitar`;
                sendBtn.style.background = 'rgba(239, 68, 68, 0.15)';
                sendBtn.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                sendBtn.style.color = '#f87171';
            }
        } else {
            if (queueSlot) {
                queueSlot.innerHTML = '';
            }
            if (sendBtn) {
                sendBtn.innerHTML = `<span class="material-icons-round" style="font-size: 0.95rem;">playlist_add</span> Encolar`;
                sendBtn.style.background = 'rgba(56, 189, 248, 0.1)';
                sendBtn.style.borderColor = 'rgba(56, 189, 248, 0.3)';
                sendBtn.style.color = '#38bdf8';
            }
        }
    });
}

async function processExecutionQueue() {
    if (isQueueRunning) return;
    if (window.executionQueue.length === 0) {
        isQueueRunning = false;
        currentExecutingTaskId = null;
        updateQueueUI();
        return;
    }

    isQueueRunning = true;
    const currentTask = window.executionQueue.shift();
    currentExecutingTaskId = currentTask.id;
    updateQueueUI();

    try {
        addTranscriptText(currentTask.fullPrompt, 'user');
        updateUIState('thinking');

        let success = false;

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
            success = await sendToAgente(currentTask.fullPrompt + contextSuffix, '');
        } else {
            success = await sendToServer(currentTask.fullPrompt);
        }

        // VALIDACIÓN ESTRICTA: ¿El agente reportó un error interno o de terminal?
        const agentResponseStr = String(lastAgentResponse || '');
        const isInternalError = agentResponseStr.includes('Hubo un error') || agentResponseStr.includes('Exit code') || agentResponseStr.includes('Error:');

        // Solo marcamos para "¡Confirmar!" si todo salió perfecto y NO se canceló la cola
        if (success && !isInternalError && isQueueRunning && currentExecutingTaskId === currentTask.id) {
            window.executedTasksWaitingConfirm = window.executedTasksWaitingConfirm || new Set();
            window.executedTasksWaitingConfirm.add(currentTask.id);
        }

    } catch (err) {
        console.error('Error ejecutando tarea de la cola:', err);
    } finally {
        if (currentExecutingTaskId === currentTask.id) {
            isQueueRunning = false;
            currentExecutingTaskId = null;
            updateQueueUI();
            fetchPendingTasks();
            if (window.executionQueue.length > 0) {
                processExecutionQueue();
            }
        }
    }
}

// Alias para compatibilidad
window.sendPendingTask = window.queuePendingTask;

function fetchPendingTasks() {
    fetch('/api/tasks/pending')
        .then(res => res.json())
        .then(tasks => {
            const container = document.getElementById('pendingTasksContent');
            if (!container) return;
            if (!tasks || tasks.length === 0) {
                container.innerHTML = '<div style="color: #94a3b8; font-size: 0.8rem; padding: 12px; text-align: center;">🎉 No hay tareas pendientes en este momento.</div>';
                return;
            }

            let html = '';
            tasks.forEach((t, idx) => {
                const st = (t.status || 'Pendiente').toLowerCase();
                let statusBg = 'rgba(194, 65, 12, 0.2)';
                let statusBorder = '#c2410c';
                let statusColor = '#fb923c';
                let statusLabel = 'PENDIENTE';

                if (st.includes('proceso') || st.includes('haciendo')) {
                    statusBg = 'rgba(133, 77, 14, 0.25)';
                    statusBorder = '#d97706';
                    statusColor = '#fcd34d';
                    statusLabel = 'EN PROCESO';
                } else if (st.includes('proximo')) {
                    statusBg = 'rgba(185, 28, 28, 0.2)';
                    statusBorder = '#ef4444';
                    statusColor = '#fca5a5';
                    statusLabel = 'PRÓXIMOS';
                } else if (st.includes('terminado')) {
                    statusBg = 'rgba(16, 185, 129, 0.2)';
                    statusBorder = '#10b981';
                    statusColor = '#6ee7b7';
                    statusLabel = 'TERMINADO';
                }

                const rawText = (t.text || t.description || '').replace(/^\[.*?\]\s*/, '').trim();
                const safeRaw = rawText.replace(/"/g, '&quot;').replace(/'/g, "\\'");
                const subApp = t.subApp || 'Control';
                const fieldName = t.field ? t.field.toUpperCase() : '';
                const taskId = 'task_item_' + idx + '_' + (t.subApp || '').replace(/\s+/g, '_');

                window.executedTasksWaitingConfirm = window.executedTasksWaitingConfirm || new Set();
                const isWaitingConfirm = window.executedTasksWaitingConfirm.has(taskId);

                let btnCompleteStyle = isWaitingConfirm
                    ? 'font-size: 0.72rem; font-weight: 700; padding: 4px 10px; gap: 4px; background: rgba(16, 185, 129, 0.25); border-color: #10b981; color: #10b981; box-shadow: 0 0 8px rgba(16,185,129,0.4);'
                    : 'font-size: 0.72rem; font-weight: 600; padding: 3px 8px; gap: 3px; background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.3); color: #34d399;';

                let btnCompleteText = isWaitingConfirm ? '¡Confirmar!' : 'Hecho';
                let btnCompleteIcon = isWaitingConfirm ? 'done_all' : 'check';

                html += `
                    <div class="pending-task-item" data-taskid="${taskId}" data-subapp="${subApp}" data-field="${fieldName}" style="transition: all 0.3s ease;">
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; gap: 8px;">
                                <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    <span style="font-size: 0.65rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${statusBg}; border: 1px solid ${statusBorder}; color: ${statusColor}; letter-spacing: 0.04em;">${statusLabel}</span>
                                    <span class="queue-badge-slot"></span>
                                    <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 600;">${subApp}${fieldName ? ' · ' + fieldName : ''}</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                                    <button class="pending-task-btn-action pending-task-btn-complete" onclick="window.completeTask(this, '${safeRaw}', '${subApp}', '${taskId}', event)" title="Marcar como Terminada en Control" style="${btnCompleteStyle} transition: all 0.3s;">
                                        <span class="material-icons-round" style="font-size: 0.95rem;">${btnCompleteIcon}</span> ${btnCompleteText}
                                    </button>
                                    <button class="pending-task-btn-action pending-task-btn-send" onclick="window.queuePendingTask(this, event)" title="Encolar para ejecución" style="font-size: 0.72rem; font-weight: 600; padding: 3px 8px; gap: 3px; background: rgba(56, 189, 248, 0.1); border-color: rgba(56, 189, 248, 0.3); color: #38bdf8;">
                                        <span class="material-icons-round" style="font-size: 0.95rem;">playlist_add</span> Encolar
                                    </button>
                                </div>
                            </div>
                            <input type="text" class="edit-task-input" value="${safeRaw}" style="width: 100%; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255,255,255,0.08); color: #f1f5f9; font-size: 0.76rem; padding: 5px 8px; border-radius: 6px; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='rgba(56, 189, 248, 0.5)'" onblur="this.style.borderColor='rgba(255,255,255,0.08)'">
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
            updateQueueUI();
        })
        .catch(err => {
            console.error('Error fetching pending tasks:', err);
            const container = document.getElementById('pendingTasksContent');
            if (container) container.innerHTML = '<div style="color: #ef4444; font-size: 0.8rem; padding: 12px; text-align: center;">Error al cargar tareas de Control.</div>';
        });
}

const initialBar = document.getElementById('pendingTasksBar');
if (initialBar && !initialBar.classList.contains('hidden')) {
    fetchPendingTasks();
}


// ==========================================
// LÓGICA DE GIT SYNC (MANUAL Y CREACIÓN DE REPO)
// ==========================================
window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'CONTROL_SAVED') {
        if (typeof fetchPendingTasks === 'function') {
            fetchPendingTasks();
        }
    }
});

const gitSyncBtn = document.getElementById('gitSyncBtn');
const gitSyncIcon = document.getElementById('gitSyncIcon');

if (gitSyncBtn && gitSyncIcon) {
    gitSyncBtn.addEventListener('click', async () => {
        const isConfigured = localStorage.getItem('tfte_github_configured');

        if (!isConfigured) {
            // Flujo A: Creación e inicio de sesión
            const token = prompt("🔑 Bienvenido a la Sincronización en la Nube.\n\nPara conectar tu proyecto (Puerto 3000), pega aquí tu GitHub Personal Access Token (PAT):");
            if (!token) return;

            const repoName = prompt("📁 ¿Qué nombre quieres ponerle a tu repositorio en GitHub?");
            if (!repoName) return;

            gitSyncBtn.disabled = true;
            gitSyncIcon.textContent = 'sync';
            gitSyncIcon.style.animation = 'spin 1s linear infinite';
            gitSyncIcon.style.color = '#38bdf8';
            addTranscriptText(`Creando repositorio "${repoName}" en tu GitHub...`, 'ai');

            try {
                const res = await fetch('/api/git-init', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, repoName })
                });
                const data = await res.json();

                if (data.ok) {
                    localStorage.setItem('tfte_github_configured', 'true');
                    gitSyncIcon.textContent = 'cloud_done';
                    gitSyncIcon.style.color = '#34d399';
                    addTranscriptText(`☁️ ${data.message}`, 'ai');
                } else {
                    gitSyncIcon.textContent = 'error_outline';
                    gitSyncIcon.style.color = '#f87171';
                    addTranscriptText(`❌ Error GitHub: ${data.error}`, 'error');
                }
            } catch (err) {
                addTranscriptText('❌ Error de red conectando con GitHub.', 'error');
            } finally {
                setTimeout(() => {
                    gitSyncIcon.style.animation = 'none';
                    gitSyncIcon.textContent = 'cloud_upload';
                    gitSyncIcon.style.color = '#94a3b8';
                    gitSyncBtn.disabled = false;
                }, 4000);
            }

        } else {
            // Flujo B: Ya está configurado, solo actualizamos los cambios
            gitSyncBtn.disabled = true;
            gitSyncIcon.textContent = 'sync';
            gitSyncIcon.style.animation = 'spin 1s linear infinite';
            gitSyncIcon.style.color = '#38bdf8';

            try {
                const res = await fetch('/api/git-sync', { method: 'POST' });
                const data = await res.json();

                if (data.ok) {
                    gitSyncIcon.textContent = 'cloud_done';
                    gitSyncIcon.style.color = '#34d399';
                    addTranscriptText(`☁️ ${data.message}`, 'ai');
                } else {
                    gitSyncIcon.textContent = 'error_outline';
                    gitSyncIcon.style.color = '#f87171';
                    addTranscriptText(`❌ Error: ${data.error}`, 'error');
                }
            } catch (err) {
                gitSyncIcon.textContent = 'cloud_off';
                gitSyncIcon.style.color = '#f87171';
            } finally {
                setTimeout(() => {
                    gitSyncIcon.style.animation = 'none';
                    gitSyncIcon.textContent = 'cloud_upload';
                    gitSyncIcon.style.color = '#94a3b8';
                    gitSyncBtn.disabled = false;
                }, 4000);
            }
        }
    });
}

// ==========================================
// ESCUCHA DE LIVE RELOAD Y AUTO-GIT-SYNC
// ==========================================
let isAutoSyncEnabled = localStorage.getItem('tfte_auto_git_sync') === 'true';
const autoGitSyncBtn = document.getElementById('autoGitSyncBtn');

function updateAutoSyncUI() {
    if (!autoGitSyncBtn) return;
    if (isAutoSyncEnabled) {
        autoGitSyncBtn.style.color = '#38bdf8'; // Texto Azul brillante
        autoGitSyncBtn.style.background = 'rgba(56, 189, 248, 0.15)'; // Fondo azul translúcido
    } else {
        autoGitSyncBtn.style.color = '#64748b'; // Texto gris apagado
        autoGitSyncBtn.style.background = 'transparent';
    }
}

if (autoGitSyncBtn) {
    updateAutoSyncUI();
    autoGitSyncBtn.addEventListener('click', () => {
        isAutoSyncEnabled = !isAutoSyncEnabled;
        localStorage.setItem('tfte_auto_git_sync', isAutoSyncEnabled);
        updateAutoSyncUI();
    });
}

let autoSyncTimer = null;

try {
    const reloadSource = new EventSource('/api/live-reload');
    reloadSource.onmessage = (event) => {
        if (event.data === 'reload') {
            console.log('🔄 Cambios detectados. Recargando iframe(s)...');

            document.querySelectorAll('iframe').forEach(ifr => {
                try {
                    const currentSrc = ifr.src;
                    if (currentSrc && !currentSrc.includes('about:blank')) {
                        const url = new URL(currentSrc);
                        url.searchParams.set('t', Date.now());
                        ifr.src = url.toString();
                    }
                } catch (e) { }
            });

            if (isAutoSyncEnabled) {
                if (localStorage.getItem('tfte_github_configured') === 'true') {
                    if (autoSyncTimer) clearTimeout(autoSyncTimer);

                    const gitIcon = document.getElementById('gitSyncIcon');
                    if (gitIcon) {
                        gitIcon.style.color = '#f59e0b'; // Naranja: Timer iniciado
                    }

                    autoSyncTimer = setTimeout(() => {
                        const syncBtn = document.getElementById('gitSyncBtn');
                        if (syncBtn && !syncBtn.disabled) {
                            console.log('☁️ Ejecutando Auto-Sync a GitHub...');
                            syncBtn.click();
                        }
                    }, 10000);
                }
            }
        }
    };
} catch (e) {
    console.error("No se pudo conectar al Live Reload:", e);
}

