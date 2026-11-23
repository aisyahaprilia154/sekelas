-- Jalankan sekali di SQL Editor proyek Supabase untuk Sekelas.
-- Satu baris menyimpan katalog satu browser. Penggantian katalog bersifat atomik.
create table if not exists public.sekelas_catalogs (
  id uuid primary key,
  catalog jsonb not null default '[]'::jsonb check (jsonb_typeof(catalog) = 'array'),
  source text not null,
  revision integer not null check (revision > 0)
);

alter table public.sekelas_catalogs enable row level security;
revoke all on public.sekelas_catalogs from anon, authenticated;
grant select, insert, update, delete on public.sekelas_catalogs to service_role;
