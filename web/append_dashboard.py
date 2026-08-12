append_str = '''                  <button
                    onClick={() => navigate('/meetings/pre-join')}
                    className="bg-[#181818] border border-white/5 hover:border-emerald-500/25 rounded-2xl p-5 flex flex-col justify-between items-start gap-4 transition-all duration-300 group text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                      <Plus size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Join with Code</h4>
                      <p className="text-[10px] text-gray-500 mt-1 leading-normal">Already have an invite ID? Insert credentials to start audio routing</p>
                    </div>
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
'''
with open(r'd:\leakqoara\coreflow github\web\src\pages\Dashboard.tsx', 'a', encoding='utf-8') as f:
    f.write(append_str)
