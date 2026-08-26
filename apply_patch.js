const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf-8');

// 1. Repositorio events
const repoLogic = `
const repoBtn = document.getElementById('repoBtn');
const closeRepoBtn = document.getElementById('closeRepoBtn');
const tasksContainer = document.getElementById('tasksContainer'); // ahora es el modal del repo
const popupsContainer = document.getElementById('popupsContainer');
const repoList = document.getElementById('repoList');

if (repoBtn) repoBtn.addEventListener('click', () => tasksContainer.classList.toggle('hidden'));
if (closeRepoBtn) closeRepoBtn.addEventListener('click', () => tasksContainer.classList.add('hidden'));

// Además cerrar repoBtn si clickea en cualquier otro lado de la screen
document.addEventListener('click', (e) => {
    if (tasksContainer && !tasksContainer.classList.contains('hidden')) {
        if (!tasksContainer.contains(e.target) && (!repoBtn || !repoBtn.contains(e.target))) {
            tasksContainer.classList.add('hidden');
        }
    }
});

async function cargarTareas() {
    try {
        const res = await fetch('/api/agente/tareas?backend=' + agentBackend);
        const data = await res.json();
        tasks.length = 0;
        data.forEach(t => tasks.push({...t, popupElement: null, repoElement: null, uiElement: null}));
        taskIdCounter = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 0;
        
        repoList.innerHTML = '';
        tasks.forEach(t => {
            const card = createTaskCard(t, false);
            t.repoElement = card;
            repoList.appendChild(card);
            updateTaskUI(t);
        });
    } catch(e) {}
}
async function guardarTareas() {
    try {
        const clean = tasks.map(t => ({...t, popupElement: undefined, repoElement: undefined, uiElement: undefined}));
        await fetch('/api/agente/tareas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ backend: agentBackend, tasks: clean })
        });
    } catch(e) {}
}
`;

code = code.replace(/let taskIdCounter = 0;/, "let taskIdCounter = 0;\n\n" + repoLogic);

// 2. createTaskCard postfix IDs
code = code.replace(/function createTaskCard\(task\) \{/, "function createTaskCard(task, isPopup = false) {\n    const suf = isPopup ? '-popup' : '-repo';");
code = code.replace(/id="task-status-\$\{task\.id\}"/g, 'id="task-status-${task.id}" + suf');
code = code.replace(/id="task-response-\$\{task\.id\}"/g, 'id="task-response-${task.id}" + suf');
code = code.replace(/id="task-actions-\$\{task\.id\}"/g, 'id="task-actions-${task.id}" + suf');
code = code.replace(/card\.id = \`task-\$\{task\.id\}\`;/, "card.id = `task-${task.id}` + suf;");

// 3. updateTaskUI logic
const updateTaskUIReplacement = `function updateTaskUI(task) {
    [ {el: task.popupElement, suf: '-popup'}, {el: task.repoElement, suf: '-repo'} ].forEach(({el, suf}) => {
        if (!el) return;
        const statusEl = el.querySelector('#task-status-' + task.id + suf);
        const responseEl = el.querySelector('#task-response-' + task.id + suf);
        const actionsEl = el.querySelector('#task-actions-' + task.id + suf);
        
        if (statusEl) {
            statusEl.className = 'task-status ' + task.status;
            statusEl.textContent = getStatusLabel(task.status);
        }
        if (responseEl && task.responseText) {
            responseEl.textContent = task.responseText;
            responseEl.style.display = 'block';
        }
        if (actionsEl) {
            if (task.status === 'waiting') {
                actionsEl.style.display = 'flex';
            } else {
                actionsEl.style.display = 'none';
            }
        }
    });
    
    guardarTareas();
}`;
code = code.replace(/function updateTaskUI\(task\) \{[\s\S]*?async function processTasks\(\)/, updateTaskUIReplacement + "\n\nasync function processTasks()");

// 4. task creation
const creation = `
    const repoCard = createTaskCard(task, false);
    task.repoElement = repoCard;
    if (typeof repoList !== 'undefined') repoList.appendChild(repoCard);
    
    const popupCard = createTaskCard(task, true);
    task.popupElement = popupCard;
    if (typeof popupsContainer !== 'undefined') popupsContainer.appendChild(popupCard);
    
    setTimeout(() => {
        if (popupCard && popupCard.parentNode) {
            popupCard.classList.add('hidden');
            setTimeout(() => popupCard.remove(), 300);
        }
        task.popupElement = null;
    }, 5000);
`;
code = code.replace(/task\.uiElement = card;\s*document\.getElementById\('tasksContainer'\)\.appendChild\(card\);/g, creation);

// 5. Call cargarTareas() on init
code = code.replace(/retomarAgentePendiente\(\);/g, "cargarTareas().then(() => retomarAgentePendiente());");

fs.writeFileSync('public/app.js', code, 'utf-8');
console.log("Patched app.js successfully via JS");
