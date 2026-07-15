-- Create security_tables migration

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  success BOOLEAN NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  device_id VARCHAR(255),
  platform VARCHAR(50),
  user_agent TEXT,
  country VARCHAR(100),
  city VARCHAR(100),
  failure_reason VARCHAR(255),
  risk_score INT DEFAULT 0,
  organization_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON public.login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON public.login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON public.login_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_org ON public.login_attempts(organization_id);

CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events(created_at);

CREATE TABLE IF NOT EXISTS public.rate_limit_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL,
  target VARCHAR(255) NOT NULL,
  locked_until TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_locks_target ON public.rate_limit_locks(target, type);
CREATE INDEX IF NOT EXISTS idx_rate_limit_locks_until ON public.rate_limit_locks(locked_until);

CREATE TABLE IF NOT EXISTS public.device_security (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR(255) NOT NULL UNIQUE,
  platform VARCHAR(50),
  browser_fingerprint VARCHAR(255),
  user_agent TEXT,
  failed_attempts INT DEFAULT 0,
  captcha_required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_device_security_id ON public.device_security(device_id);

-- Enable RLS for security tables to protect them
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_security ENABLE ROW LEVEL SECURITY;

-- Helper macro/expression for checking if the user is an administrator
-- Admins can view security tables
DROP POLICY IF EXISTS "Admins can view login attempts" ON public.login_attempts;
CREATE POLICY "Admins can view login attempts" ON public.login_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()::uuid AND u.role IN ('managing_director'::user_role, 'ceo'::user_role, 'cto'::user_role)
    )
  )
  ;

DROP POLICY IF EXISTS "Admins can view security events" ON public.security_events;
CREATE POLICY "Admins can view security events" ON public.security_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()::uuid AND u.role IN ('managing_director'::user_role, 'ceo'::user_role, 'cto'::user_role)
    )
  )
  ;

DROP POLICY IF EXISTS "Admins can view rate limit locks" ON public.rate_limit_locks;
CREATE POLICY "Admins can view rate limit locks" ON public.rate_limit_locks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()::uuid AND u.role IN ('managing_director'::user_role, 'ceo'::user_role, 'cto'::user_role)
    )
  )
  ;

DROP POLICY IF EXISTS "Admins can delete rate limit locks" ON public.rate_limit_locks;
CREATE POLICY "Admins can delete rate limit locks" ON public.rate_limit_locks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()::uuid AND u.role IN ('managing_director'::user_role, 'ceo'::user_role, 'cto'::user_role)
    )
  )
  ;

DROP POLICY IF EXISTS "Admins can view device security" ON public.device_security;
CREATE POLICY "Admins can view device security" ON public.device_security
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()::uuid AND u.role IN ('managing_director'::user_role, 'ceo'::user_role, 'cto'::user_role)
    )
  )
  ;

-- Service role has full access to perform checks and log attempts
GRANT ALL ON public.login_attempts TO service_role;
GRANT ALL ON public.security_events TO service_role;
GRANT ALL ON public.rate_limit_locks TO service_role;
GRANT ALL ON public.device_security TO service_role;
