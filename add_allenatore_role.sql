-- Add missing 'allenatore' role to user_roles table

-- 1. Check current roles in user_roles table
SELECT id, name, level FROM public.user_roles ORDER BY level, name;

-- 2. Add the missing 'allenatore' role
INSERT INTO public.user_roles (id, name, level) 
VALUES (
    gen_random_uuid(),
    'allenatore', 
    2
) ON CONFLICT (name) DO NOTHING;

-- 3. Verify the role was added
SELECT id, name, level FROM public.user_roles WHERE name = 'allenatore';

-- 4. Show all roles after the addition
SELECT id, name, level FROM public.user_roles ORDER BY level, name;








