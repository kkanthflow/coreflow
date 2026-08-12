lines = open(r'd:\leakqoara\coreflow github\web\src\pages\Dashboard.tsx', 'r', encoding='utf-8').read().split('\n')
for i, l in enumerate(lines):
    if '<main' in l:
        print(f'{i}: {l}')
