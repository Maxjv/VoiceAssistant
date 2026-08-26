const fs = require('fs');

const transcriptPath = 'C:/Users/Maxi Vargas/.gemini/antigravity-ide/brain/bcd37ea7-a36a-4e83-b279-b6747e2bfca8/.system_generated/logs/transcript_full.jsonl';
const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');

const keywords = [
    'Add automatic iframe refresh logic after agent finishes',
    'Remove refreshBtn event listener',
    'Add btnPlan event listener',
    'Close task repo on backdrop click',
    'Add auto-refresh to iframe',
    'Remove refreshBtn declaration',
    'Update fetchPendingTasks',
    'Fix toggleRecording Web Speech API stop logic',
    'Fix ReferenceError in switchIframe',
    'Fix task duplication in Repo'
];

let extracted = '';

for (let line of lines) {
    if (!line.trim()) continue;
    try {
        const step = JSON.parse(line);
        if (step.type === 'PLANNER_RESPONSE' && step.tool_calls) {
            for (let call of step.tool_calls) {
                if (call.name === 'replace_file_content' || call.name === 'multi_replace_file_content') {
                    const args = call.args;
                    const desc = args.Description || args.Instruction || '';
                    if (keywords.some(k => desc.includes(k))) {
                        extracted += '\n\n=== ' + desc + ' ===\n';
                        if (args.ReplacementContent) extracted += args.ReplacementContent;
                        if (args.ReplacementChunks) {
                            for (let chunk of args.ReplacementChunks) {
                                extracted += '\n--- CHUNK ---\n' + chunk.ReplacementContent;
                            }
                        }
                    }
                }
            }
        }
    } catch(e) {}
}

fs.writeFileSync('extracted_features.txt', extracted);
console.log('Done extracting features.');
