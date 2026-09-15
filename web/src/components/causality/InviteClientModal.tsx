import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, UserPlus, Shield, Lock, Mail, User, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { toast } from '../ui/Toast';
import { causalityApi } from '../../lib/causalityApi';

interface InviteClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
}

export default function InviteClientModal({
  isOpen,
  onClose,
  projectId,
  projectTitle,
}: InviteClientModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [canApprove, setCanApprove] = useState(true);
  const [canRequestChanges, setCanRequestChanges] = useState(true);
  const [canViewFinancials, setCanViewFinancials] = useState(true);
  const [creating, setCreating] = useState(false);
  const [successResult, setSuccessResult] = useState<any>(null);

  if (!isOpen) return null;

  const handleCreateClientUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Email and password are required.');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }

    setCreating(true);
    try {
      const res = await causalityApi.provisionClientUser({
        projectId,
        email: email.trim(),
        password,
        fullName: fullName.trim() || 'Client Contact',
        canApprove,
        canRequestChanges,
        canViewFinancials,
      });

      setSuccessResult(res);
      toast.success(`Client account created for ${email}`);
    } catch (err: any) {
      console.error('Provision client error:', err);
      toast.error(err.message || 'Failed to create client user account');
    } finally {
      setCreating(false);
    }
  };

  const handleResetAndClose = () => {
    setEmail('');
    setPassword('');
    setFullName('');
    setSuccessResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-lg bg-[#0B0C10] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden flex flex-col text-white"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/[0.06] bg-[#0E1017] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FF6B4A]/10 border border-[#FF6B4A]/30 flex items-center justify-center text-[#FF6B4A]">
              <UserPlus size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Create Client Contact Account
              </h2>
              <p className="text-xs text-zinc-400 truncate max-w-sm">{projectTitle}</p>
            </div>
          </div>
          <button onClick={handleResetAndClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-zinc-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {successResult ? (
            <div className="p-5 bg-emerald-950/20 border border-emerald-500/20 rounded-xl space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-emerald-300">Client Account Created</h3>
                <p className="text-xs text-zinc-300 mt-1">
                  User credentials have been registered in the database with direct project room access.
                </p>
              </div>
              <div className="p-3 bg-[#07080B] rounded-lg border border-white/[0.06] text-left text-xs font-mono space-y-1.5">
                <div className="text-zinc-400">Email: <span className="text-white font-bold">{successResult.email}</span></div>
                <div className="text-zinc-400">Name: <span className="text-white">{successResult.fullName}</span></div>
                <div className="text-zinc-400">Role: <span className="text-emerald-400 font-bold">CLIENT</span></div>
              </div>
              <button
                onClick={handleResetAndClose}
                className="w-full py-2 bg-[#FF6B4A] hover:bg-[#FF552B] text-white rounded-lg text-xs font-bold transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleCreateClientUser} className="space-y-4">
              {/* Security Protection Banner */}
              <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-lg flex items-start gap-2.5">
                <Shield size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-zinc-300 space-y-0.5">
                  <span className="font-bold text-emerald-400 block">Verified Database Credentials</span>
                  <p className="text-[11px] text-zinc-400">
                    Creates an authenticated client user in the database with access strictly scoped to this Client Project Room.
                  </p>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Client Contact Name
                </label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-2.5 text-zinc-500" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sarah Jenkins"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#12141C] border border-white/[0.08] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF6B4A]"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Client Email Address
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-2.5 text-zinc-500" />
                  <input
                    type="email"
                    required
                    placeholder="client@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#12141C] border border-white/[0.08] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF6B4A]"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Initial Password
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-2.5 text-zinc-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Set 6+ character password..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-9 py-2 rounded-lg bg-[#12141C] border border-white/[0.08] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF6B4A]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Granular Client Permissions */}
              <div className="p-3 rounded-lg bg-[#07080B] border border-white/[0.04] space-y-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                  Client Permissions Granted
                </span>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={canApprove}
                    onChange={(e) => setCanApprove(e.target.checked)}
                    className="rounded border-white/20 bg-[#12141C] text-[#FF6B4A] focus:ring-0"
                  />
                  <span>Can Approve Deliverables & Milestones</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={canRequestChanges}
                    onChange={(e) => setCanRequestChanges(e.target.checked)}
                    className="rounded border-white/20 bg-[#12141C] text-[#FF6B4A] focus:ring-0"
                  />
                  <span>Can Submit Change Requests (CR)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={canViewFinancials}
                    onChange={(e) => setCanViewFinancials(e.target.checked)}
                    className="rounded border-white/20 bg-[#12141C] text-[#FF6B4A] focus:ring-0"
                  />
                  <span>Can View Project Value & Cost Causality</span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex justify-end gap-2 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-3.5 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !email.trim() || !password}
                  className="px-4 py-2 rounded-lg bg-[#FF6B4A] hover:bg-[#FF5530] disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <UserPlus size={14} />
                  <span>{creating ? 'Creating Account...' : 'Create Client Account'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
