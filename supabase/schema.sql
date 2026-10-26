-- Защищённая схема клуба самбо. Выполните в Supabase → SQL Editor.
-- Создайте пользователя тренера через Authentication → Users → Add user.
-- В Authentication → Settings отключите публичную регистрацию (Allow new users to sign up).

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  group_time text not null check (group_time in ('18:00', '19:00', '20:00')),
  attendance integer not null default 0 check (attendance between 0 and 100),
  behavior integer not null default 1 check (behavior between 1 and 5),
  performance integer not null default 1 check (performance between 1 and 5),
  photo_url text not null default '',
  photo_path text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.students add column if not exists photo_path text not null default '';
-- Переносим пути ранее загруженных фотографий из старых публичных URL в поле пути.
update public.students
set photo_path = substring(photo_url from '/object/public/student-photos/([^?]+)')
where coalesce(photo_path, '') = '' and photo_url like '%/object/public/student-photos/%';
alter table public.students enable row level security;


drop policy if exists "Public can read students" on public.students;
drop policy if exists "Public can add students" on public.students;
drop policy if exists "Public can update students" on public.students;
drop policy if exists "Public can delete students" on public.students;
drop policy if exists "Trainers can read students" on public.students;
drop policy if exists "Trainers can add students" on public.students;
drop policy if exists "Trainers can update students" on public.students;
drop policy if exists "Trainers can delete students" on public.students;

create policy "Trainers can read students" on public.students for select to authenticated using (auth.uid() is not null);
create policy "Trainers can add students" on public.students for insert to authenticated with check (auth.uid() is not null);
create policy "Trainers can update students" on public.students for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Trainers can delete students" on public.students for delete to authenticated using (auth.uid() is not null);


insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('student-photos', 'student-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Public can view student photos" on storage.objects;
drop policy if exists "Public can upload student photos" on storage.objects;
drop policy if exists "Public can update student photos" on storage.objects;
drop policy if exists "Trainers can read student photos" on storage.objects;
drop policy if exists "Trainers can upload student photos" on storage.objects;
drop policy if exists "Trainers can update student photos" on storage.objects;
drop policy if exists "Trainers can delete student photos" on storage.objects;

create policy "Trainers can read student photos" on storage.objects for select to authenticated using (bucket_id = 'student-photos' and auth.uid() is not null);
create policy "Trainers can upload student photos" on storage.objects for insert to authenticated with check (bucket_id = 'student-photos' and auth.uid() is not null);
create policy "Trainers can update student photos" on storage.objects for update to authenticated using (bucket_id = 'student-photos' and auth.uid() is not null) with check (bucket_id = 'student-photos' and auth.uid() is not null);
create policy "Trainers can delete student photos" on storage.objects for delete to authenticated using (bucket_id = 'student-photos' and auth.uid() is not null);
