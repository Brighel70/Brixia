-- Check if the player IDs from the error logs exist in the people table

-- 1. Check the specific player IDs that are causing errors
SELECT 
    id,
    given_name,
    family_name,
    full_name,
    app_role,
    player_categories
FROM public.people 
WHERE id IN (
    '5631b3d8-200e-4943-ad77-d28c976edfa2',
    'da240113-4613-4a05-b8bd-3408d8bf358e',
    '69662b48-d7ce-4873-8eb0-7f70282ea1e4'
);

-- 2. Count total people in the table
SELECT COUNT(*) as total_people FROM public.people;

-- 3. Check people with U18 category
SELECT 
    id,
    given_name,
    family_name,
    full_name,
    app_role,
    player_categories
FROM public.people 
WHERE player_categories::text LIKE '%d9c82f91-8087-47f5-9b90-9b729572f0e8%'
   OR player_categories::text LIKE '%Under 18%'
ORDER BY family_name, given_name;

-- 4. Check all categories to understand the structure
SELECT id, name FROM public.categories ORDER BY name;

-- 5. Check if there are any attendance records for these player IDs
SELECT 
    a.id,
    a.player_id,
    a.session_id,
    a.status,
    p.given_name,
    p.family_name
FROM public.attendance a
LEFT JOIN public.people p ON a.player_id = p.id
WHERE a.player_id IN (
    '5631b3d8-200e-4943-ad77-d28c976edfa2',
    'da240113-4613-4a05-b8bd-3408d8bf358e',
    '69662b48-d7ce-4873-8eb0-7f70282ea1e4'
);
