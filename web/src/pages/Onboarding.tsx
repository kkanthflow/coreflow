import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Legacy Onboarding route:
 * Users are explicitly routed to /register/setup to choose between:
 * 1. Register Freelancer
 * 2. Create Organization
 * 3. Join Organization
 * Automatic Freelancer assignment is strictly prevented.
 */
export default function Onboarding() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/register/setup', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-app flex flex-col items-center justify-center text-main">
      <div className="w-10 h-10 border-2 border-[#FF6B4A] border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-muted text-sm font-mono">Redirecting to workspace setup...</p>
    </div>
  );
}
