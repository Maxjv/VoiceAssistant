
        document.addEventListener('DOMContentLoaded', async () => {
            const btnSettings = document.getElementById('btnAgentSettings');
            const contextModal = document.getElementById('contextModal');
            const closeBtn = document.getElementById('closeContextModal');
            const selectEl = document.getElementById('savedContextsSelect');
            const newContextInput = document.getElementById('newContextFolder');
            const addContextBtn = document.getElementById('addContextBtn');
            const statusLabel = document.getElementById('contextStatusLabel');
            const folderInputHidden = document.getElementById('folderInput');

            let contexts = JSON.parse(localStorage.getItem('tfte_contexts') || '[]');
            let activeContext = localStorage.getItem('tfte_active_context');

            try {
                const res = await fetch('/api/get-context');
                if (res.ok) {
                    const data = await res.json();
                    const serverContext = data.contextPath;

                    if (serverContext) {
                        if (!contexts.includes(serverContext)) contexts.push(serverContext);
                        activeContext = serverContext;
                        localStorage.setItem('tfte_contexts', JSON.stringify(contexts));
                        localStorage.setItem('tfte_active_context', activeContext);
                    }
                }
            } catch (err) {
                console.warn("No se pudo obtener el contexto del servidor", err);
            }

            const geminiModelSelect = document.getElementById('geminiModelSelect');

            let savedModel = localStorage.getItem('tfte_gemini_model') || 'gemini-3.1-pro-high';
            if (geminiModelSelect) {
                geminiModelSelect.value = savedModel;
                geminiModelSelect.addEventListener('change', (e) => {
                    localStorage.setItem('tfte_gemini_model', e.target.value);
                });
            }

            if (contexts.length === 0) {
                contexts = ['C:\\TFTE'];
                activeContext = 'C:\\TFTE';
            }

            function renderSelect() {
                selectEl.innerHTML = '';
                contexts.forEach(ctx => {
                    const opt = document.createElement('option');
                    opt.value = ctx;
                    opt.innerText = ctx;
                    if (ctx === activeContext) opt.selected = true;
                    selectEl.appendChild(opt);
                });
                updateActive(activeContext);
            }

            function updateActive(ctx) {
                activeContext = ctx;
                localStorage.setItem('tfte_active_context', ctx);
                if (statusLabel) statusLabel.innerText = 'Contexto: ' + ctx;
                if (folderInputHidden) folderInputHidden.value = ctx;
            }

            renderSelect();

            selectEl.addEventListener('change', (e) => {
                updateActive(e.target.value);
            });

            addContextBtn.addEventListener('click', () => {
                const val = newContextInput.value.trim();
                if (val && !contexts.includes(val)) {
                    contexts.push(val);
                    localStorage.setItem('tfte_contexts', JSON.stringify(contexts));
                    renderSelect();
                    selectEl.value = val;
                    updateActive(val);
                    newContextInput.value = '';
                }
            });

            if (btnSettings && contextModal) {
                btnSettings.addEventListener('click', () => {
                    contextModal.classList.remove('hidden');
                    contextModal.style.display = 'flex';
                });

                closeBtn.addEventListener('click', () => {
                    contextModal.classList.add('hidden');
                    setTimeout(() => contextModal.style.display = 'none', 300);
                });
            }
        });
    