import { useState, type FormEvent } from 'react';
import { X, Send, CheckCircle2, AlertCircle, Building, User, Mail, Phone, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ContactTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ContactTeamModal({ isOpen, onClose }: ContactTeamModalProps) {
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [preferredContactMethod, setPreferredContactMethod] = useState<'email' | 'phone' | 'video_call'>('email');
  const [projectDescription, setProjectDescription] = useState('');
  const [estimatedBudget, setEstimatedBudget] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successReference, setSuccessReference] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!companyName.trim() || !contactPerson.trim() || !businessEmail.trim() || !projectDescription.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    if (projectDescription.trim().length < 20) {
      setError('Please provide at least 20 characters in your project description.');
      return;
    }

    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const response = await fetch(`${apiUrl}/contact/custom-development`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          companyName,
          contactPerson,
          businessEmail,
          phoneNumber: phoneNumber.trim() || undefined,
          preferredContactMethod,
          projectDescription,
          estimatedBudget: estimatedBudget || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit inquiry');
      }

      setSuccessReference(data.referenceId || 'SKV-' + Date.now().toString().slice(-6));
    } catch (err: any) {
      setError(err.message || 'An error occurred while submitting your inquiry.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetAndClose = () => {
    setSuccessReference(null);
    setError(null);
    setCompanyName('');
    setContactPerson('');
    setBusinessEmail('');
    setPhoneNumber('');
    setProjectDescription('');
    setEstimatedBudget('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#121218] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative text-zinc-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#16161f]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FF6B4A]/10 border border-[#FF6B4A]/30 flex items-center justify-center text-[#FF6B4A]">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Contact Our Team — Custom Development</h2>
              <p className="text-[11px] text-zinc-400">Bespoke integrations, company-specific modules & custom infrastructure</p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        {successReference ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-white">Inquiry Received</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
              Thank you for sharing your architecture requirements. The engineering team at{' '}
              <strong className="text-zinc-200">Skavelon Technologies</strong> will review your specifications and reach out with a detailed feasibility proposal and quotation.
            </p>
            <div className="p-3 bg-white/5 border border-white/10 rounded-lg inline-block text-xs font-mono text-zinc-300">
              Reference ID: <span className="text-[#FF6B4A] font-bold">{successReference}</span>
            </div>
            <div className="pt-4">
              <button
                onClick={handleResetAndClose}
                className="px-6 py-2.5 bg-[#FF6B4A] hover:bg-[#FF552B] text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center gap-2.5 text-xs text-rose-400">
                <AlertCircle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg text-[11px] text-zinc-400 leading-relaxed">
              Custom development is separate from standard subscription plans. Our team will review your specifications, schedule an architectural discovery call, and provide a dedicated quotation.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                  Company Name <span className="text-[#FF6B4A]">*</span>
                </label>
                <div className="relative">
                  <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    required
                    placeholder="Acme Corporation"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[#0c0c12] border border-white/10 rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#FF6B4A]/60 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                  Contact Person <span className="text-[#FF6B4A]">*</span>
                </label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    required
                    placeholder="Alex Morgan"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[#0c0c12] border border-white/10 rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#FF6B4A]/60 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                  Business Email <span className="text-[#FF6B4A]">*</span>
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="email"
                    required
                    placeholder="alex@acmecorp.com"
                    value={businessEmail}
                    onChange={(e) => setBusinessEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[#0c0c12] border border-white/10 rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#FF6B4A]/60 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                  Phone / WhatsApp (Optional)
                </label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[#0c0c12] border border-white/10 rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#FF6B4A]/60 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                  Preferred Contact Method
                </label>
                <select
                  value={preferredContactMethod}
                  onChange={(e: any) => setPreferredContactMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0c0c12] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-[#FF6B4A]/60 transition-colors"
                >
                  <option value="email">Email Response</option>
                  <option value="phone">Direct Phone Call</option>
                  <option value="video_call">Live Video Consultation (Google Meet)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                  Estimated Budget Scope (Optional)
                </label>
                <select
                  value={estimatedBudget}
                  onChange={(e) => setEstimatedBudget(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0c0c12] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-[#FF6B4A]/60 transition-colors"
                >
                  <option value="">Select an estimated range</option>
                  <option value="₹25,000 – ₹75,000">₹25,000 – ₹75,000 (Small module / integration)</option>
                  <option value="₹75,000 – ₹2,50,000">₹75,000 – ₹2,50,000 (Custom system workflow)</option>
                  <option value="₹2,50,000+">₹2,50,000+ (Full enterprise deployment)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                Requirements & Project Description <span className="text-[#FF6B4A]">*</span>
              </label>
              <textarea
                required
                rows={4}
                placeholder="Describe your workflows, security requirements, desired API integrations, team structure, or required deliverables..."
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                className="w-full px-3 py-2 bg-[#0c0c12] border border-white/10 rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#FF6B4A]/60 transition-colors"
              />
            </div>

            <div className="pt-3 border-t border-white/10 flex items-center justify-between">
              <span className="text-[10px] font-mono text-zinc-500">
                Reviewed by Skavelon Technologies Engineering
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-4 py-2 text-xs font-mono text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-[#FF6B4A] hover:bg-[#FF552B] text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(255,107,74,0.3)] disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send size={13} />
                      <span>Submit Inquiry</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
