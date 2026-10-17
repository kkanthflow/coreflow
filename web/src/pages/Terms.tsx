import { ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import AuvrynLogo from '../components/AuvrynLogo';

export default function Terms() {
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

      <div className="pt-32 px-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <ShieldCheck className="text-[#FF6B4A]" size={32} />
          <h1 className="text-4xl font-extrabold tracking-tight">AUVRYN Terms of Service</h1>
        </div>
        
        <p className="text-muted text-sm mb-12">Last Updated: September 27, 2026</p>

        <article className="prose prose-invert prose-zinc max-w-none text-sm text-muted space-y-8">
          <section>
            <h2 className="text-xl font-bold text-main">1. Acceptance of Terms</h2>
            <p>By accessing or using the AUVRYN web or mobile applications, you agree to be bound by these Terms of Service.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">2. Eligibility</h2>
            <p>You must be at least 16 years old to use the Service. By agreeing to these Terms, you represent and warrant that you meet this requirement.</p>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-main">3. Accounts</h2>
            <p>You are responsible for safeguarding the password and authentication credentials that you use to access the Service and for any activities or actions under your account.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">4. Organizations and Workspaces</h2>
            <p>Organization owners are responsible for the management, content, and membership of their workspaces. AUVRYN provides the tools, but ultimate administrative responsibility falls to the workspace administrators.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">5. User Responsibilities</h2>
            <p>You agree not to use the Service for any unlawful or prohibited purpose. You must ensure all data uploaded to the platform complies with applicable laws.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">6. Acceptable Use</h2>
            <p>You shall not transmit any worms, viruses, or any code of a destructive nature. You shall not attempt to hack, destabilize, or abuse the AUVRYN platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">7. Files and User Content</h2>
            <p>You retain full ownership of all data and files you upload. You grant AUVRYN a limited license to host and process this data solely to provide the services to you and your organization.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">8. Client Workspaces</h2>
            <p>If you invite clients to AUVRYN, you are responsible for managing their access and ensuring they comply with these Terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">9. Intellectual Property</h2>
            <p>The Service and its original content (excluding User Content), features, and functionality are and will remain the exclusive property of AUVRYN and its licensors.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">10. Third-Party Services</h2>
            <p>Our Service may contain links to or integrate with third-party web sites or services that are not owned or controlled by AUVRYN (such as Google OAuth).</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">11. Mobile Application Usage</h2>
            <p>When using our mobile applications, standard data charges from your mobile carrier may apply. You are responsible for any such fees.</p>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-main">12. Notifications</h2>
            <p>By using the platform, you agree to receive essential service notifications. You may opt out of marketing or non-essential notifications at any time.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">13. Service Availability</h2>
            <p>We strive for high uptime, but the Service is provided "AS IS". We do not warrant that the service will be uninterrupted, timely, or error-free.</p>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-main">14. Security</h2>
            <p>We implement robust security measures, but no method of transmission over the Internet or electronic storage is 100% secure.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">15. Suspension and Termination</h2>
            <p>We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">16. Disclaimers</h2>
            <p>Your use of the Service is at your sole risk. The Service is provided on an "AS IS" and "AS AVAILABLE" basis.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">17. Limitation of Liability</h2>
            <p>In no event shall AUVRYN, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">18. Changes to Terms</h2>
            <p>We reserve the right to modify or replace these Terms at any time. We will provide notice of significant changes.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">19. Contact Information</h2>
            <p>If you have any questions about these Terms, please contact us at auvryn.support@gmail.com or via our <Link to="/contact" className="text-[#FF6B4A] hover:underline">Contact page</Link>.</p>
          </section>
        </article>
      </div>
    </div>
  );
}
