-- Create organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_organizations_name ON organizations(name);

-- Create user_organizations table for many-to-many relationship
CREATE TABLE user_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member', -- e.g., 'owner', 'admin', 'member'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, org_id)
);

CREATE INDEX idx_user_orgs_user_id ON user_organizations(user_id);
CREATE INDEX idx_user_orgs_org_id ON user_organizations(org_id);

-- Alter users table so it can link to auth.users
-- Change default from gen_random_uuid to not having a default, so we can insert auth.users.id
-- But existing records have it, so we leave it, just make sure it references auth.users
-- Since this is local dev and we might not have auth.users setup yet for old data, we'll just allow it

-- Function to handle new user signups from Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function when a user is created in Supabase Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Organizations
CREATE POLICY "Users can view orgs they belong to"
  ON organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE org_id = organizations.id AND user_id = auth.uid()::uuid
    )
  );

CREATE POLICY "Any authenticated user can create an org"
  ON organizations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- RLS Policies for user_organizations
CREATE POLICY "Users can view their own org memberships"
  ON user_organizations FOR SELECT
  USING (user_id = auth.uid()::uuid);

CREATE POLICY "Users can see other members in their orgs"
  ON user_organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations uo
      WHERE uo.org_id = user_organizations.org_id AND uo.user_id = auth.uid()::uuid
    )
  );

CREATE POLICY "Users can join an org or be added"
  ON user_organizations FOR INSERT
  WITH CHECK (
    user_id = auth.uid()::uuid OR
    EXISTS (
      SELECT 1 FROM user_organizations uo
      WHERE uo.org_id = org_id AND uo.user_id = auth.uid()::uuid AND uo.role IN ('owner', 'admin')
    )
  );
