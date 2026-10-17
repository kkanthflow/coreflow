import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Check, Shield, Activity, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { EASINGS } from '../lib/motionSystem';
import { trpc } from '../lib/trpc';

type Step = 'welcome' | 'workspace' | 'join' | 'create' | 'independent' | 'password' | 'terms';

export default function Onboarding() {
  const navigate = useNavigate();
  const provisionMutation = trpc.auvryn.provisionGoogleUserWorkspace.useMutation();
  const [step, setStep] = useState<Step>('welcome');
  const [formData, setFormData] = useState({
    workspaceType: '',
    orgName: '',
    jobTitle: '',
    password: '',
    termsAccepted: false,
  });

  const nextStep = (s: Step) => setStep(s);

  return (
    <div className="min-h-screen bg-app text-main flex flex-col justify-center items-center p-4 selection:bg-[#FF6B4A]/30 font-sans relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] left-[25%] w-[650px] h-[650px] rounded-full bg-gradient-to-br from-[#FF6B4A]/[0.08] to-transparent blur-[140px] animate-pulse-glow" />
        <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tl from-blue-600/[0.04] to-transparent blur-[120px]" />
        <div 
          className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`, backgroundSize: '24px 24px' }}
        />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASINGS.spatial }}
        className="relative z-10 w-full max-w-3xl space-y-8"
      >
        {/* Progress Indicator */}
        <div className="flex justify-center items-center space-x-3 text-xs font-mono text-muted mb-8 tracking-wider">
          <span className={step === 'welcome' ? 'text-[#FF6B4A] font-bold' : ''}>✓ IDENTITY</span>
          <span className="text-divider">•</span>
          <span className={['workspace', 'join', 'create', 'independent'].includes(step) ? 'text-[#FF6B4A] font-bold' : ''}>
            {['password', 'terms'].includes(step) ? '✓' : '●'} WORKSPACE
          </span>
          <span className="text-divider">•</span>
          <span className={['password', 'terms'].includes(step) ? 'text-[#FF6B4A] font-bold' : ''}>
            ○ READY
          </span>
        </div>

        <div className="bg-card-bg/95 border border-divider rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
          
          {step === 'welcome' && (
            <div className="text-center space-y-6">
              <h1 className="text-3xl font-extrabold tracking-tight">Welcome to AUVRYN.</h1>
              <p className="text-muted max-w-md mx-auto">We've verified your identity. Now, let's configure your workspace access.</p>
              <button 
                onClick={() => nextStep('workspace')}
                className="mx-auto w-48 mt-4 bg-[#FF6B4A] hover:bg-[#FF552B] text-main font-semibold text-sm py-3 rounded-xl transition-colors shadow-[#FF6B4A]/25 flex items-center justify-center gap-2"
              >
                Continue <ArrowRight size={14} />
              </button>
            </div>
          )}

          {step === 'workspace' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-center mb-8">How will you use AUVRYN?</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Join */}
                <div 
                  className="p-5 border border-divider rounded-xl hover:border-blue-500/50 bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition-all space-y-3"
                  onClick={() => nextStep('join')}
                >
                  <Activity size={24} className="text-blue-400" />
                  <h3 className="font-semibold">Join an Organization</h3>
                  <p className="text-xs text-muted">Request access to your team's existing workspace.</p>
                </div>

                {/* Create */}
                <div 
                  className="p-5 border border-divider rounded-xl hover:border-purple-500/50 bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition-all space-y-3"
                  onClick={() => nextStep('create')}
                >
                  <Shield size={24} className="text-purple-400" />
                  <h3 className="font-semibold">Create an Organization</h3>
                  <p className="text-xs text-muted">Build a new workspace for your entire company.</p>
                </div>

                {/* Independent */}
                <div 
                  className="p-5 border border-divider rounded-xl hover:border-emerald-500/50 bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition-all space-y-3"
                  onClick={() => nextStep('independent')}
                >
                  <Lock size={24} className="text-emerald-400" />
                  <h3 className="font-semibold">Work Independently</h3>
                  <p className="text-xs text-muted">Manage clients and projects as a freelancer.</p>
                </div>

              </div>
            </div>
          )}

          {step === 'create' && (
            <div className="max-w-sm mx-auto space-y-5">
              <h2 className="text-xl font-bold text-center mb-6">Create Organization</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-muted mb-1.5">Organization Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Skavelon Technologies" 
                    className="w-full bg-app border border-divider rounded-lg px-3.5 py-2.5 text-xs text-main placeholder-zinc-600 focus:outline-none focus:border-[#FF6B4A]"
                    onChange={e => setFormData({...formData, orgName: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-muted mb-1.5">Your Job Title</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Founder & CEO" 
                    className="w-full bg-app border border-divider rounded-lg px-3.5 py-2.5 text-xs text-main placeholder-zinc-600 focus:outline-none focus:border-[#FF6B4A]"
                    onChange={e => setFormData({...formData, jobTitle: e.target.value})} 
                  />
                </div>
              </div>
              <button 
                onClick={() => nextStep('password')}
                disabled={!formData.orgName || !formData.jobTitle}
                className="w-full mt-4 bg-[#FF6B4A] hover:bg-[#FF552B] disabled:opacity-50 disabled:cursor-not-allowed text-main font-semibold text-sm py-2.5 rounded-xl transition-colors"
              >
                Continue
              </button>
              <button onClick={() => nextStep('workspace')} className="w-full text-xs text-muted hover:text-main mt-2">Back</button>
            </div>
          )}

          {/* Independent flow logic */}
          {step === 'independent' && (
            <div className="max-w-sm mx-auto space-y-5 text-center">
              <h2 className="text-xl font-bold mb-6">Setup Independent Workspace</h2>
              <p className="text-sm text-muted">We will provision a dedicated freelancer workspace for you to manage your clients and projects.</p>
              
              <button 
                disabled={provisionMutation.isPending}
                onClick={async () => {
                  try {
                    await provisionMutation.mutateAsync();
                    // Hard refresh to reload permissions/session
                    window.location.href = '/dashboard';
                  } catch (e) {
                    console.error('Failed to provision workspace', e);
                    alert('Failed to provision workspace. Please try again.');
                  }
                }}
                className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-main font-semibold text-sm py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {provisionMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} /> Provision Workspace</>}
              </button>
              <button onClick={() => nextStep('workspace')} className="text-xs text-[#FF6B4A] hover:text-[#FF552B] mt-2">Go Back</button>
            </div>
          )}

          {/* Join Fallback */}
          {step === 'join' && (
            <div className="max-w-sm mx-auto space-y-5 text-center">
              <h2 className="text-xl font-bold mb-6">Coming Soon</h2>
              <p className="text-sm text-muted">This flow path is under construction. Please use Create Organization or Work Independently for now.</p>
              <button onClick={() => nextStep('workspace')} className="text-xs text-[#FF6B4A] hover:text-[#FF552B]">Go Back</button>
            </div>
          )}

          {step === 'password' && (
            <div className="max-w-sm mx-auto space-y-5">
              <h2 className="text-xl font-bold text-center">Create Password</h2>
              <p className="text-[11px] text-muted text-center mb-4">You can use either Google or this password to sign in later.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-muted mb-1.5">Password</label>
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    className="w-full bg-app border border-divider rounded-lg px-3.5 py-2.5 text-xs text-main placeholder-zinc-600 focus:outline-none focus:border-[#FF6B4A]"
                    onChange={e => setFormData({...formData, password: e.target.value})} 
                  />
                </div>
              </div>
              <button 
                onClick={() => nextStep('terms')}
                disabled={formData.password.length < 6}
                className="w-full mt-4 bg-[#FF6B4A] hover:bg-[#FF552B] disabled:opacity-50 disabled:cursor-not-allowed text-main font-semibold text-sm py-2.5 rounded-xl transition-colors"
              >
                Continue
              </button>
              <button onClick={() => nextStep('create')} className="w-full text-xs text-muted hover:text-main mt-2">Back</button>
            </div>
          )}

          {step === 'terms' && (
            <div className="max-w-sm mx-auto space-y-5 text-center">
              <h2 className="text-xl font-bold mb-6">Final Step</h2>
              <label className="flex items-start gap-3 bg-white/[0.02] p-4 rounded-xl border border-divider text-left cursor-pointer hover:bg-white/[0.04]">
                <input 
                  type="checkbox" 
                  className="mt-1"
                  checked={formData.termsAccepted}
                  onChange={(e) => setFormData({...formData, termsAccepted: e.target.checked})}
                />
                <span className="text-xs text-muted">
                  I agree to the AUVRYN{' '}
                  <Link
                    to="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[#FF6B4A] underline hover:text-[#FF552B]"
                  >
                    Terms & Conditions
                  </Link>{' '}
                  and{' '}
                  <Link
                    to="/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[#FF6B4A] underline hover:text-[#FF552B]"
                  >
                    Privacy Policy
                  </Link>.
                </span>
              </label>
              <button 
                disabled={!formData.termsAccepted} 
                onClick={() => navigate('/dashboard')}
                className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-main font-semibold text-sm py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                Complete Onboarding <Check size={16} />
              </button>
            </div>
          )}

        </div>
      </motion.div>
    </div>
  );
}
