import sys

# 1. Dashboard Padding
content = open(r'd:\leakqoara\coreflow github\web\src\pages\Dashboard.tsx', 'r', encoding='utf-8').read()
content = content.replace('p-6 md:p-8 space-y-8', 'p-4 md:p-6 space-y-4')

# 2. Live Rooms Button
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

replacement = '''                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5 relative z-10">
                          <div className="flex items-center gap-2 text-xs text-[#FF6B4A]">
                            <Clock size={12} fill="currentColor" />
                            <span>Live</span>
                          </div>
                          <button
                            onClick={() => navigate(/meetings/ + m.id)}
                            className="px-4 py-2 bg-[#FF6B4A] hover:bg-[#E85A3A] text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-[#FF6B4A]/10 transition-all active:scale-[0.98] shrink-0"
                          >
                            <Play size={12} fill="currentColor" />
                            <span>Join</span>
                          </button>
                        </div>
                      </div>'''

import re
# regex replacement just in case spaces don't perfectly match (e.g. string template literals)
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

# 3. CalendarView Spacing
content2 = open(r'd:\leakqoara\coreflow github\web\src\components\dashboard\CalendarView.tsx', 'r', encoding='utf-8').read()
content2 = content2.replace('space-y-8', 'space-y-4')
open(r'd:\leakqoara\coreflow github\web\src\components\dashboard\CalendarView.tsx', 'w', encoding='utf-8').write(content2)

print('Done')
