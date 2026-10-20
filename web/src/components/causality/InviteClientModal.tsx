import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  UserPlus, 
  Shield, 
  Mail, 
  User, 
  CheckCircle2, 
  Copy, 
  Check, 
  Link2, 
  Clock, 
  RefreshCw, 
  Trash2,
  Building2,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { toast } from '../ui/Toast';
import { causalityApi } from '../../lib/causalityApi';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../hooks/useWorkspace';

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
  const { orgId } = useWorkspace();

  const [activeTab, setActiveTab] = useState<'invite' | 'manage'>('invite');
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  
  const [canApprove, setCanApprove] = useState(true);
  const [canRequestChanges, setCanRequestChanges] = useState(true);
  const [canViewFinancials, setCanViewFinancials] = useState(true);
  
  const [generating, setGenerating] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Manage tab state
  const [invitesList, setInvitesList] = useState<any[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Load existing clients for easy selection
  useEffect(() => {
    if (!isOpen) return;

    const fetchClients = async () => {
      try {
        let query = supabase.from('clients').select('id, name, company_name, email').eq('is_deleted', false);
        if (orgId) {
          query = query.eq('organization_id', orgId);
        }
        const { data } = await query;
        setClients(data || []);
      } catch (e) {
        console.error('Failed to load clients list:', e);
      }
    };

    fetchClients();
  }, [isOpen, orgId]);

  // Load invites for manage tab
  const loadInvites = async () => {
    setLoadingInvites(true);
    try {
      const data = await causalityApi.listProjectInvites(projectId);
      setInvitesList(data || []);
    } catch (e) {
      console.error('Failed to load project invites:', e);
    } finally {
      setLoadingInvites(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'manage') {
      loadInvites();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    if (!clientId) return;
    const match = clients.find(c => c.id === clientId);
    if (match) {
      if (match.email) setEmail(match.email);
      if (match.name) setFullName(match.name);
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() && !selectedClientId) {
      toast.error('Please specify a client or email address.');
      return;
    }

    setGenerating(true);
    try {
      const res = await causalityApi.createProjectInvite({
        projectId,
        clientId: selectedClientId || undefined,
        email: email.trim() || undefined,
        name: fullName.trim() || undefined,
        canApprove,
        canRequestChanges,
        canViewFinancials,
      });

      const inviteUrl = `${window.location.origin}/invite/client?token=${res.token}`;
      setCreatedInvite({ ...res.invite, inviteUrl, token: res.token });
      toast.success('Project client invitation link generated!');
    } catch (err: any) {
      console.error('Invite generation error:', err);
      toast.error(err.message || 'Failed to generate invitation link.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyLink = () => {
    if (!createdInvite?.inviteUrl) return;
    navigator.clipboard.writeText(createdInvite.inviteUrl);
    setCopied(true);
    toast.success('Invitation link copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleResend = async (inviteId: string) => {
    setActionLoadingId(inviteId);
    try {
      const res = await causalityApi.resendProjectInvite(inviteId);
      const newUrl = `${window.location.origin}/invite/client?token=${res.token}`;
      navigator.clipboard.writeText(newUrl);
      toast.success('Fresh invitation link generated and copied to clipboard!');
      await loadInvites();
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend invite');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    setActionLoadingId(inviteId);
    try {
      await causalityApi.revokeProjectInvite(inviteId);
      toast.success('Invitation revoked.');
      await loadInvites();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke invite');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResetAndClose = () => {
    setEmail('');
    setFullName('');
    setSelectedClientId('');
    setCreatedInvite(null);
    setCopied(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-lg bg-card-bg border border-divider rounded-2xl shadow-2xl overflow-hidden flex flex-col text-main max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-divider bg-card-bg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FF6B4A]/10 border border-[#FF6B4A]/30 flex items-center justify-center text-[#FF6B4A]">
              <UserPlus size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-main tracking-tight">
                Invite Client Contact
              </h2>
              <p className="text-xs text-muted truncate max-w-sm">{projectTitle}</p>
            </div>
          </div>
          <button 
            onClick={handleResetAndClose} 
            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-muted hover:text-main transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-divider bg-hover/50 px-5 pt-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('invite')}
            className={`pb-2.5 px-3 border-b-2 transition-all ${
              activeTab === 'invite' 
                ? 'border-[#FF6B4A] text-main font-bold' 
                : 'border-transparent text-muted hover:text-main'
            }`}
          >
            Create Invitation
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`pb-2.5 px-3 border-b-2 transition-all ${
              activeTab === 'manage' 
                ? 'border-[#FF6B4A] text-main font-bold' 
                : 'border-transparent text-muted hover:text-main'
            }`}
          >
            Active & Pending Invites
          </button>
        </div>

        {/* Body Container */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'invite' ? (
            createdInvite ? (
              /* Success & Link Generated View */
              <div className="p-5 bg-emerald-950/20 border border-emerald-500/20 rounded-xl space-y-4 text-center animate-fade-in">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-300">Invitation Link Generated</h3>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    A cryptographically verified invitation has been created for <strong className="text-main">{createdInvite.email}</strong>.
                    Send this link to the client to let them sign up or claim their client portal.
                  </p>
                </div>

                <div className="p-3 bg-app rounded-lg border border-divider text-left space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-muted font-mono">
                    <span>Single-use link expires in 7 days</span>
                    <span className="text-emerald-400 font-bold">READY</span>
                  </div>
                  <div className="flex items-center gap-2 bg-card-bg p-2 rounded border border-divider">
                    <input 
                      readOnly 
                      value={createdInvite.inviteUrl} 
                      className="bg-transparent text-xs font-mono text-zinc-300 w-full outline-none truncate selection:bg-[#FF6B4A]/30"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-3 py-1.5 bg-[#FF6B4A] hover:bg-[#FF5530] text-main rounded text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copied ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCreatedInvite(null);
                      setEmail('');
                      setFullName('');
                      setSelectedClientId('');
                    }}
                    className="flex-1 py-2 bg-hover hover:bg-hover text-main rounded-lg text-xs font-semibold border border-divider transition-colors"
                  >
                    Create Another
                  </button>
                  <button
                    onClick={handleResetAndClose}
                    className="flex-1 py-2 bg-[#FF6B4A] hover:bg-[#FF5530] text-main rounded-lg text-xs font-bold transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Create Form */
              <form onSubmit={handleCreateInvite} className="space-y-4">
                <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-lg flex items-start gap-2.5">
                  <Shield size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-muted space-y-0.5">
                    <span className="font-bold text-emerald-400 block">Atomic Client Account Linking</span>
                    <p className="text-[11px] text-muted">
                      Generates a secure, 7-day single-use token that automatically links the client record, project room, and invoice ledger upon acceptance.
                    </p>
                  </div>
                </div>

                {/* Existing Client Picker */}
                {clients.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-muted block mb-1">
                      Select Existing Client Record (Optional)
                    </label>
                    <select
                      value={selectedClientId}
                      onChange={(e) => handleSelectClient(e.target.value)}
                      className="w-full bg-hover border border-divider rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-[#FF6B4A]"
                    >
                      <option value="">-- Choose existing client or enter new below --</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.company_name ? `(${c.company_name})` : ''} - {c.email || 'No email'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Full Name */}
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">
                    Client Contact Name
                  </label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-2.5 text-muted" />
                    <input
                      type="text"
                      placeholder="e.g. Sarah Jenkins"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-hover border border-divider rounded-lg pl-9 pr-3 py-2 text-xs text-main focus:outline-none focus:border-[#FF6B4A]"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">
                    Client Email Address <span className="text-[#FF6B4A]">*</span>
                  </label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-2.5 text-muted" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. client@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-hover border border-divider rounded-lg pl-9 pr-3 py-2 text-xs text-main focus:outline-none focus:border-[#FF6B4A]"
                    />
                  </div>
                </div>

                {/* Permissions Toggles */}
                <div className="p-3.5 bg-hover rounded-xl border border-divider space-y-2.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted block">
                    Client Contact Access Controls
                  </span>

                  <label className="flex items-center justify-between cursor-pointer text-xs">
                    <span className="text-zinc-300">Approve Milestones & Deliverables</span>
                    <input
                      type="checkbox"
                      checked={canApprove}
                      onChange={(e) => setCanApprove(e.target.checked)}
                      className="rounded border-divider text-[#FF6B4A] focus:ring-0 w-4 h-4"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer text-xs">
                    <span className="text-zinc-300">Submit Scope Change Requests</span>
                    <input
                      type="checkbox"
                      checked={canRequestChanges}
                      onChange={(e) => setCanRequestChanges(e.target.checked)}
                      className="rounded border-divider text-[#FF6B4A] focus:ring-0 w-4 h-4"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer text-xs">
                    <span className="text-zinc-300">View Invoices & Financial Statements</span>
                    <input
                      type="checkbox"
                      checked={canViewFinancials}
                      onChange={(e) => setCanViewFinancials(e.target.checked)}
                      className="rounded border-divider text-[#FF6B4A] focus:ring-0 w-4 h-4"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={generating}
                  className="w-full py-2.5 bg-[#FF6B4A] hover:bg-[#FF5530] text-main rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Generating Secure Link...</span>
                    </>
                  ) : (
                    <>
                      <Link2 size={14} />
                      <span>Create & Generate Invite Link</span>
                    </>
                  )}
                </button>
              </form>
            )
          ) : (
            /* Manage Active & Pending Invites Tab */
            <div className="space-y-3">
              {loadingInvites ? (
                <div className="py-8 text-center text-xs text-muted space-y-2">
                  <RefreshCw size={16} className="animate-spin mx-auto text-[#FF6B4A]" />
                  <span>Loading invitations...</span>
                </div>
              ) : invitesList.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted space-y-2">
                  <Clock size={20} className="mx-auto text-zinc-600" />
                  <p>No invitations created for this project yet.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {invitesList.map((inv) => {
                    const isAccepted = inv.status === 'accepted';
                    const isPending = inv.status === 'pending';
                    const isRevoked = inv.status === 'revoked';
                    const isExpired = inv.status === 'expired' || (isPending && new Date(inv.expires_at) < new Date());

                    return (
                      <div 
                        key={inv.id}
                        className="p-3 bg-hover rounded-xl border border-divider text-xs flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-main truncate">
                              {inv.client?.name || inv.email}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase font-bold ${
                              isAccepted 
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                : isPending && !isExpired
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}>
                              {isAccepted ? 'Accepted' : isExpired ? 'Expired' : isRevoked ? 'Revoked' : 'Pending'}
                            </span>
                          </div>

                          <div className="text-[11px] text-muted truncate">
                            {inv.email}
                            {isAccepted && inv.accepted_user && (
                              <span className="text-zinc-500 ml-1.5">
                                • Claimed by {inv.accepted_user.email}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isPending && !isExpired && (
                            <button
                              onClick={() => {
                                const url = `${window.location.origin}/invite/client?token=${inv.token}`;
                                navigator.clipboard.writeText(url);
                                toast.success('Invite link copied to clipboard!');
                              }}
                              className="p-1.5 rounded-lg bg-card-bg hover:bg-white/[0.08] text-muted hover:text-main border border-divider transition-colors"
                              title="Copy Link"
                            >
                              <Copy size={13} />
                            </button>
                          )}

                          <button
                            disabled={actionLoadingId === inv.id}
                            onClick={() => handleResend(inv.id)}
                            className="p-1.5 rounded-lg bg-card-bg hover:bg-white/[0.08] text-muted hover:text-main border border-divider transition-colors disabled:opacity-50"
                            title="Resend Invite (Generates fresh link)"
                          >
                            <RefreshCw size={13} className={actionLoadingId === inv.id ? 'animate-spin' : ''} />
                          </button>

                          {!isAccepted && !isRevoked && (
                            <button
                              disabled={actionLoadingId === inv.id}
                              onClick={() => handleRevoke(inv.id)}
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors disabled:opacity-50"
                              title="Revoke Invite"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
