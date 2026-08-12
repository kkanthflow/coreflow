import os

def replace_in_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        new_content = content.replace('coreflow-one.vercel.app', 'coreflow-kk5480346-9617s-projects.vercel.app')
        
        if new_content != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f'Updated {filepath}')
    except Exception as e:
        print(f'Error reading {filepath}: {e}')

def walk_dir(directory):
    for root, dirs, files in os.walk(directory):
        if 'node_modules' in dirs:
            dirs.remove('node_modules')
        if '.git' in dirs:
            dirs.remove('.git')
        if '.expo' in dirs:
            dirs.remove('.expo')
        if 'dist' in dirs:
            dirs.remove('dist')
            
        for file in files:
            if file.endswith(('.ts', '.tsx', '.js', '.json')) or file.startswith('.env'):
                # Avoid touching package-lock.json to avoid corrupting it, but we can do it safely
                if file != 'package-lock.json':
                    replace_in_file(os.path.join(root, file))

if __name__ == '__main__':
    walk_dir('d:/leakqoara/coreflow github')
