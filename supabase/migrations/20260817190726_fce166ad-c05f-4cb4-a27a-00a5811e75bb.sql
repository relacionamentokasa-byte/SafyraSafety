-- Drop existing policies to avoid conflicts
drop policy if exists "Public access to company assets" on storage.objects;
drop policy if exists "Authenticated upload of company assets" on storage.objects;
drop policy if exists "Authenticated update of company assets" on storage.objects;
drop policy if exists "Authenticated delete of company assets" on storage.objects;

-- Create new policies
-- Allow everyone to view assets in this specific bucket
create policy "Public access to company assets"
on storage.objects for select
to public
using (bucket_id = 'company_assets_private');

-- Allow authenticated users to manage assets
create policy "Authenticated upload of company assets"
on storage.objects for insert
to authenticated
with check (bucket_id = 'company_assets_private');

create policy "Authenticated update of company assets"
on storage.objects for update
to authenticated
using (bucket_id = 'company_assets_private');

create policy "Authenticated delete of company assets"
on storage.objects for delete
to authenticated
using (bucket_id = 'company_assets_private');