import { Mail, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import AuvrynLogo from '../components/AuvrynLogo';

export default function Contact() {
  return (
    <div className="min-h-screen bg-app text-main font-sans selection:bg-[#FF6B4A]/30 selection:text-main pb-24">
      <nav className="fixed top-0 w-full z-50 bg-app/80 backdrop-blur-md border-b border-divider">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-hover border border-divider flex items-center justify-center shrink-0">
              <AuvrynLogo size={16} />
            </div>
            <span className="text-main font-bold text-sm tracking-tight">AUVRYN</span>
          </Link>
          <Link to="/login" className="px-4 py-2 bg-[#FF6B4A] hover:bg-[#FF552B] text-main text-xs font-semibold rounded-lg transition-colors">
            Sign In
          </Link>
        </div>
      </nav>

      <div className="pt-32 px-6 max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#FF6B4A]/10 text-[#FF6B4A] mb-6">
          <MessageSquare size={32} />
        </div>
        
        <h1 className="text-4xl font-extrabold tracking-tight mb-4">Contact AUVRYN</h1>
        <p className="text-muted text-lg mb-12">We are here to help. Reach out to our support and legal teams.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
          <div className="p-6 bg-card-bg border border-divider rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-hover border border-divider flex items-center justify-center text-main mb-4">
              <Mail size={20} />
            </div>
            <h3 className="text-lg font-bold text-main mb-2">General Support</h3>
            <p className="text-sm text-muted mb-4">For account issues, billing, and general inquiries.</p>
            <a href="mailto:support@auvryn.com" className="text-[#FF6B4A] font-semibold hover:underline">support@auvryn.com</a>
          </div>

          <div className="p-6 bg-card-bg border border-divider rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-hover border border-divider flex items-center justify-center text-main mb-4">
              <Mail size={20} />
            </div>
            <h3 className="text-lg font-bold text-main mb-2">Privacy & Legal</h3>
            <p className="text-sm text-muted mb-4">For privacy concerns and data removal requests.</p>
            <a href="mailto:auvryn.support@gmail.com" className="text-[#FF6B4A] font-semibold hover:underline">auvryn.support@gmail.com</a>
          </div>
        </div>
      </div>
    </div>
  );
}
