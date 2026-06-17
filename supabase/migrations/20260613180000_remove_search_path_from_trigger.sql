-- Reset the search path on the trigger function.
-- Setting search_path to public exclusively might be breaking internal Postgres trigger references 
-- or access to the auth schema's internal types.
ALTER FUNCTION public.handle_new_user() RESET search_path;
