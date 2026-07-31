-- Storage bucket for idea/inspiration image attachments
-- Created via supabase db query --linked

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('idea-images', 'idea-images', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Policies (idempotent via manual creation)
-- "Users can upload idea images"      — INSERT for authenticated users
-- "Anyone can read idea images"       — SELECT for public access
-- "Users can delete own idea images"  — DELETE for owner only
