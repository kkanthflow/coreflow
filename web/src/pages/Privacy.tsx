import { ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import AuvrynLogo from '../components/AuvrynLogo';

export default function Privacy() {
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
          <h1 className="text-4xl font-extrabold tracking-tight">AUVRYN Privacy Policy</h1>
        </div>
        
        <p className="text-muted text-sm mb-12">Last Updated: September 27, 2026</p>

        <article className="prose prose-invert prose-zinc max-w-none text-sm text-muted space-y-8">
          <section>
            <h2 className="text-xl font-bold text-main">1. Introduction</h2>
            <p>Welcome to AUVRYN. We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, and share information about you when you use the AUVRYN web platform and mobile applications.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">2. Scope of This Privacy Policy</h2>
            <p>This policy applies to all AUVRYN services, including the web application and the Expo/React Native mobile applications available for Android and iOS.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">3. Information We Collect</h2>
            <p>We collect information you provide directly to us when you create an account, update your profile, participate in interactive features, or communicate with us.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">4. Account Information</h2>
            <p>We collect your name, email address, password, and organizational affiliation to provide access to our services.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">5. Google Sign-In</h2>
            <p>When a user signs in with Google, AUVRYN may receive basic Google Account information such as name, email address, profile image, and Google account identifier, depending on permissions granted by the user.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">6. Google API Data Usage</h2>
            <p>AUVRYN accesses only basic authentication data (openid, email, profile) from Google. This data is used exclusively for authenticating you and creating your AUVRYN account profile. We do not access, store, or share other Google API data (like Gmail or Drive).</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">7. Organization and Workspace Data</h2>
            <p>We store data regarding your roles, departments, and actions within AUVRYN workspaces for auditing and access control purposes.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">8. Project and Task Data</h2>
            <p>Information related to projects, tasks, comments, and statuses are stored securely to provide project management capabilities.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">9. Files and Uploaded Content</h2>
            <p>Files uploaded to AUVRYN are securely stored in our cloud infrastructure (Supabase). Access to these files is strictly governed by organization permissions.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">10. Client Data</h2>
            <p>Data associated with clients managed within your AUVRYN workspaces is processed exclusively to provide CRM and billing functionalities.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">11. Meetings and Communication</h2>
            <p>We facilitate audio and video communications. We do not secretly record meetings. If a meeting recording feature is utilized by your organization, participants will be notified.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">12. Mobile Device Information</h2>
            <p>When using our mobile app, we may collect device models, operating system versions, and unique device identifiers to optimize performance and deliver notifications.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">13. Push Notifications</h2>
            <p>If you opt-in, we use Firebase/Expo push notifications. We process push notification tokens to deliver relevant alerts (e.g., chat messages, task assignments). You can disable these at any time.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">14. Camera and Microphone Permissions</h2>
            <p><strong>Camera:</strong> Used when you choose to participate in video functionality or scan documents.</p>
            <p><strong>Microphone:</strong> Used when you choose to participate in audio/voice functionality.</p>
            <p>These permissions are strictly optional and accessed only when you actively use these features.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">15. Local Device Storage</h2>
            <p>We may store authentication tokens and cached data locally on your device to improve app performance and maintain session states.</p>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-main">16. Cookies and Web Authentication</h2>
            <p>Our web platform uses necessary cookies to manage authentication sessions and ensure secure access to protected routes.</p>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-main">17. Device Identifiers</h2>
            <p>We process device identifiers exclusively for security, session management, and delivering push notifications.</p>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-main">18. Technical and Diagnostic Information</h2>
            <p>We collect crash logs and performance metrics to identify bugs and improve the AUVRYN platform.</p>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-main">19. How We Use Information</h2>
            <p>We use the information we collect to provide, maintain, and improve AUVRYN, to process transactions, and to communicate with you regarding your account.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">20. Data Storage</h2>
            <p>Your data is stored securely using Supabase infrastructure.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">21. Data Security</h2>
            <p>We implement Row-Level Security (RLS) in our databases and encrypt data in transit and at rest to protect your information.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">22. Data Sharing</h2>
            <p>We do not sell your personal data. We only share data with authorized third-party service providers necessary to operate our platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">23. Third-Party Service Providers</h2>
            <p>We integrate with Supabase (Database/Auth), Google (OAuth), Vercel (Web Hosting), Expo (Mobile Services), and LiveKit (WebRTC). These providers process data under strict confidentiality agreements.</p>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-main">24. Data Retention</h2>
            <p>We retain your data for as long as your account is active or as needed to provide our services and comply with legal obligations.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">25. Data Deletion</h2>
            <p>You may request the deletion of your personal data by contacting us or using in-app account deletion features.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">26. User Rights</h2>
            <p>You have the right to access, update, or delete your personal information at any time.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">27. Account Removal</h2>
            <p>Removing your account will anonymize or delete your personal identifiable information from our active databases.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">28. Children's Privacy</h2>
            <p>AUVRYN is intended for professional use and is not directed at children under the age of 16.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">29. International Processing</h2>
            <p>Your information may be transferred to and processed in countries other than your own, subject to appropriate security safeguards.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">30. Changes to This Privacy Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-main">31. Contact Information</h2>
            <p>If you have any questions about this Privacy Policy, please contact us at auvryn.support@gmail.com or visit our <Link to="/contact" className="text-[#FF6B4A] hover:underline">Contact page</Link>.</p>
          </section>
        </article>
      </div>
    </div>
  );
}
