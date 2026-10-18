-- Pink AI Radar：账号收藏表与行级权限
-- 在 Supabase Dashboard > SQL Editor 中完整执行一次。

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  news_id bigint not null check (news_id > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, news_id)
);

create index if not exists favorites_user_id_idx on public.favorites(user_id);

alter table public.favorites enable row level security;

revoke all on table public.favorites from anon, authenticated;
grant select, insert, update, delete on table public.favorites to authenticated;

drop policy if exists "Users can read own favorites" on public.favorites;
create policy "Users can read own favorites"
on public.favorites for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create own favorites" on public.favorites;
create policy "Users can create own favorites"
on public.favorites for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own favorites" on public.favorites;
create policy "Users can update own favorites"
on public.favorites for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own favorites" on public.favorites;
create policy "Users can delete own favorites"
on public.favorites for delete
to authenticated
using ((select auth.uid()) = user_id);
