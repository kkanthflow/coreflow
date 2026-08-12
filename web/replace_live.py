import sys
content = open(r'd:\leakqoara\coreflow github\web\src\pages\Dashboard.tsx', 'r', encoding='utf-8').read()

target = '''                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Clock size={12} className="text-gray-400" />
                          <span>Started {new Date(m.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <button
                          onClick={() => navigate(/meetings/ + m.id)}
                          className="w-full py-3 bg-[#FF6B4A] hover:bg-[#E85A3A] text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#FF6B4A]/10 transition-all active:scale-[0.98]"
                        >
                          <Play size={14} fill="currentColor" />
                          <span>Join Meeting</span>
                        </button>
                      </div>'''

# Adjusting target to match exact content because of template literal backticks which cause issues in powershell strings
import re
# We'll use regex to make it foolproof
content = re.sub(
    r'<div className="flex items-center gap-2 text-xs text-gray-500">.*?<span>Join Meeting</span>.*?</div>',
    r'''<div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5 relative z-10">
                          <div className="flex items-center gap-2 text-xs text-[#FF6B4A]">
                            <Clock size={12} fill="currentColor" />
                            <span>Live</span>
                          </div>
                          <button
                            onClick={() => navigate(/meetings/)}
                            className="px-4 py-2 bg-[#FF6B4A] hover:bg-[#E85A3A] text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-[#FF6B4A]/10 transition-all active:scale-[0.98] shrink-0"
                          >
                            <Play size={12} fill="currentColor" />
                            <span>Join</span>
                          </button>
                        </div>''',
    content,
    flags=re.DOTALL
)

open(r'd:\leakqoara\coreflow github\web\src\pages\Dashboard.tsx', 'w', encoding='utf-8').write(content)
print('Done')
