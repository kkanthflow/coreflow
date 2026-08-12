lines = open(r'd:\leakqoara\coreflow github\web\src\pages\Dashboard.tsx', 'r', encoding='utf-8').read().split('\n')

replacement = '''            const isActive = activeTab === item.name;
            return (
              <button
                key={item.name}
                onClick={() => {
                  if (item.name === 'Settings') {
                    navigate('/settings');
                  } else {
                    setActiveTab(item.name);
                  }
                }}
                className={w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all relative overflow-hidden group }
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF6B4A] rounded-r-full shadow-[0_0_10px_#FF6B4A]" />
                )}
                <Icon size={18} className={isActive ? 'text-[#FF6B4A]' : 'text-gray-400 group-hover:text-gray-300'} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* User Profile Footer */}
        <SidebarProfile />
      </aside>'''

start_idx = -1
for i, l in enumerate(lines):
    if 'const Icon = item.icon;' in l:
        start_idx = i
        break

end_idx = -1
for i, l in enumerate(lines):
    if '<main className="flex-1 flex flex-col min-w-0 overflow-y-auto relative">' in l:
        end_idx = i
        break

if start_idx != -1 and end_idx != -1:
    del lines[start_idx + 1:end_idx]
    lines.insert(start_idx + 1, replacement)
    open(r'd:\leakqoara\coreflow github\web\src\pages\Dashboard.tsx', 'w', encoding='utf-8').write('\n'.join(lines))
    print('Successfully replaced lines')
else:
    print('Indices not found')
