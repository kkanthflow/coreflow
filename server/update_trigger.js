require('dotenv').config({path: '../.env'});
const postgres = require('postgres');
// URL decode the password so postgres.js doesn't fail if it's already decoded or handle it correctly
const dbUrl = process.env.DATABASE_URL;
const sql = postgres(dbUrl, {ssl: 'require'});

const query = `
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users ("openId", email, name, role)
  VALUES (
    new.id::text, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE((new.raw_user_meta_data->>'role')::public.role, 'student'::public.role)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

sql.unsafe(query).then(() => {
  console.log('success');
  process.exit(0);
}).catch(console.error);
