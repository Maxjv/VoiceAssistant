const fs = require('fs');
const transcriptPath = 'C:/Users/Maxi Vargas/.gemini/antigravity-ide/brain/bcd37ea7-a36a-4e83-b279-b6747e2bfca8/.system_generated/logs/transcript_full.jsonl';
const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');

for (let line of lines) {
    if (!line.trim()) continue;
    try {
        const step = JSON.parse(line);
        if (step.type === 'PLANNER_RESPONSE' && step.tool_calls) {
            for (let call of step.tool_calls) {
                if (call.name === 'write_to_file') {
                    if (call.args.TargetFile && call.args.TargetFile.toLowerCase().includes('app.js')) {
                        console.log('FOUND write_to_file for app.js!');
                        fs.writeFileSync('public/app_restored_write.js', call.args.CodeContent);
                    }
                }
            }
        }
    } catch(e) {}
}
console.log('Done checking write_to_file.');
