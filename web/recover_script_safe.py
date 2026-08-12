import json
import re

log_path = r'C:\Users\kk548\.gemini\antigravity-ide\brain\1b575fd0-c701-4d2d-bc62-a5742cb34773\.system_generated\logs\transcript_full.jsonl'
lines_map = {}
with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            if data.get('step_index', 0) > 700:
                continue
            if 'content' in data and data['type'] == 'VIEW_FILE' and 'Dashboard.tsx' in data['content']:
                content = data['content']
                if 'Showing lines' in content:
                    for l in content.split('\n'):
                        match = re.match(r'^(\d+): (.*)$', l)
                        if match:
                            num = int(match.group(1))
                            lines_map[num] = match.group(2)
        except Exception as e:
            pass

max_line = max(lines_map.keys())
with open(r'd:\leakqoara\coreflow github\web\src\pages\Dashboard.tsx', 'w', encoding='utf-8') as f:
    for i in range(1, max_line + 1):
        f.write(lines_map.get(i, '') + '\n')
