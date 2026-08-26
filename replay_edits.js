const fs = require('fs');
const path = require('path');

const transcriptPath = 'C:/Users/Maxi Vargas/.gemini/antigravity-ide/brain/bcd37ea7-a36a-4e83-b279-b6747e2bfca8/.system_generated/logs/transcript_full.jsonl';
const fileToFix = 'c:\\TFTE\\VoiceAssistant\\public\\app.js'.toLowerCase();

let content = fs.readFileSync('public/app.js', 'utf8');
const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');

let editsApplied = 0;

for (let line of lines) {
    if (!line.trim()) continue;
    try {
        const step = JSON.parse(line);
        if (step.type === 'PLANNER_RESPONSE' && step.tool_calls) {
            for (let call of step.tool_calls) {
                if (call.name === 'replace_file_content' || call.name === 'multi_replace_file_content') {
                    const args = call.args;
                    if (args.TargetFile && args.TargetFile.toLowerCase() === fileToFix) {
                        if (call.name === 'replace_file_content') {
                            const target = args.TargetContent;
                            const replacement = args.ReplacementContent;
                            if (content.includes(target)) {
                                content = content.replace(target, replacement);
                                editsApplied++;
                            }
                        } else if (call.name === 'multi_replace_file_content') {
                            for (let chunk of args.ReplacementChunks) {
                                const target = chunk.TargetContent;
                                const replacement = chunk.ReplacementContent;
                                if (content.includes(target)) {
                                    content = content.replace(target, replacement);
                                    editsApplied++;
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch(e) {}
}

fs.writeFileSync('public/app_restored.js', content);
console.log('Edits applied:', editsApplied);
