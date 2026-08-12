import json
import re

log_path = r'C:\Users\kk548\.gemini\antigravity-ide\brain\1b575fd0-c701-4d2d-bc62-a5742cb34773\.system_generated\logs\transcript_full.jsonl'
lines_map = {}
with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            if 'content' in data and 'Showing lines 450 to 600' in data['content']:
                content = data['content']
                for l in content.split('\n'):
                    match = re.match(r'^(\d+): (.*)$', l)
                    if match:
                        num = int(match.group(1))
                        lines_map[num] = match.group(2)
        except Exception as e:
            pass

for k in sorted(list(lines_map.keys())):
    if k >= 550:
        print(f'{k}: {lines_map[k].encode("ascii", "ignore").decode("ascii")}')
