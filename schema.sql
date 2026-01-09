-- FAMILY COMMAND CENTER - DATABASE SCHEMA
-- Run this script in the Supabase SQL Editor to initialize the database.

-- 1. RESET (Safety: Drop existing objects to ensure clean state)
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop function if exists get_my_family_id() cascade;

drop table if exists redemptions cascade;
drop table if exists rewards cascade;
drop table if exists game_scores cascade;
drop table if exists chores cascade;
drop table if exists notes cascade;
drop table if exists groceries cascade;
drop table if exists profiles cascade;
drop table if exists families cascade;

-- 2. EXTENSIONS
create extension if not exists "uuid-ossp";

-- 3. TABLES

-- Families
create table families (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  secret_key text unique not null,
  created_by uuid references auth.users default auth.uid(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Profiles (Linked to auth.users)
create table profiles (
  id uuid references auth.users not null primary key,
  display_name text,
  role text check (role in ('parent', 'child')),
  avatar_url text,
  family_id uuid references families(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Groceries
create table groceries (
  id uuid primary key default uuid_generate_v4(),
  item_name text not null,
  quantity text,
  category text,
  is_purchased boolean default false,
  added_by uuid references profiles(id),
  family_id uuid references families(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Notes
create table notes (
  id uuid primary key default uuid_generate_v4(),
  content text not null,
  color text,
  author_id uuid references profiles(id),
  family_id uuid references families(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Chores
create table chores (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  points integer default 0,
  is_completed boolean default false,
  assigned_to uuid references profiles(id),
  family_id uuid references families(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Game Scores
create table game_scores (
  id uuid primary key default uuid_generate_v4(),
  game_id text not null,
  level integer not null,
  points integer not null,
  played_at timestamp with time zone default timezone('utc'::text, now()) not null,
  profile_id uuid references profiles(id),
  family_id uuid references families(id) not null
);

-- Rewards
create table rewards (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid references families(id) not null,
  name text not null,
  cost integer not null check (cost > 0),
  icon text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Redemptions
create table redemptions (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid references families(id) not null,
  kid_id uuid references profiles(id) not null,
  reward_id uuid references rewards(id) not null,
  status text not null check (status in ('pending', 'approved', 'rejected', 'fulfilled')) default 'pending',
  redeemed_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);


-- 4. ROW LEVEL SECURITY (RLS)

alter table families enable row level security;
alter table profiles enable row level security;
alter table groceries enable row level security;
alter table notes enable row level security;
alter table chores enable row level security;
alter table game_scores enable row level security;
alter table rewards enable row level security;
alter table redemptions enable row level security;

-- 5. FUNCTIONS & POLICIES

-- Helper: Get Family ID
create or replace function get_my_family_id()
returns uuid
language sql
security definer
stable
as $$
  select family_id from profiles where id = auth.uid();
$$;

-- PROFILES Policies
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

create policy "Users can insert own profile" on profiles
  for insert with check (auth.uid() = id);

create policy "Users can view family members" on profiles
  for select using (
    family_id = get_my_family_id()
  );

-- FAMILIES Policies
create policy "Users can view own family" on families
  for select using (
    id = get_my_family_id() 
    or 
    created_by = auth.uid()
  );

create policy "Users can create families" on families
  for insert with check (auth.role() = 'authenticated');

-- GROCERIES Policies
create policy "Family view groceries" on groceries
  for select using (family_id = get_my_family_id());

create policy "Family insert groceries" on groceries
  for insert with check (family_id = get_my_family_id());

create policy "Family update groceries" on groceries
  for update using (family_id = get_my_family_id());
  
create policy "Family delete groceries" on groceries
  for delete using (family_id = get_my_family_id());

-- NOTES Policies
create policy "Family view notes" on notes
  for select using (family_id = get_my_family_id());

create policy "Family insert notes" on notes
  for insert with check (family_id = get_my_family_id());

create policy "Family update notes" on notes
  for update using (family_id = get_my_family_id());

create policy "Family delete notes" on notes
  for delete using (family_id = get_my_family_id());

-- CHORES Policies
create policy "Family view chores" on chores
  for select using (family_id = get_my_family_id());

create policy "Parents can insert chores" on chores
  for insert with check (
    family_id = get_my_family_id() 
    and 
    exists (select 1 from profiles where id = auth.uid() and role = 'parent')
  );

create policy "Family update chores" on chores
  for update using (family_id = get_my_family_id());

create policy "Parents can delete chores" on chores
  for delete using (
    family_id = get_my_family_id() 
    and 
    exists (select 1 from profiles where id = auth.uid() and role = 'parent')
  );

-- GAME SCORES Policies
create policy "Family view game scores" on game_scores
  for select using (family_id = get_my_family_id());

create policy "Users can insert own scores" on game_scores
  for insert with check (profile_id = auth.uid());

create policy "Users can view own scores" on game_scores
  for select using (profile_id = auth.uid());

-- REWARDS Policies
create policy "Family view rewards" on rewards
  for select using (family_id = get_my_family_id());

create policy "Parents manage rewards" on rewards
  for all using (
    family_id = get_my_family_id() and 
    exists (select 1 from profiles where id = auth.uid() and role = 'parent')
  );

-- REDEMPTIONS Policies
create policy "Parents view all redemptions" on redemptions
  for select using (
    family_id = get_my_family_id() and
    exists (select 1 from profiles where id = auth.uid() and role = 'parent')
  );

create policy "Kids view own redemptions" on redemptions
  for select using (id = auth.uid() or kid_id = auth.uid());

create policy "Kids can request redemption" on redemptions
  for insert with check (
    kid_id = auth.uid() and
    exists (select 1 from profiles where id = auth.uid() and role = 'child')
  );

create policy "Parents can update redemption status" on redemptions
  for update using (
    family_id = get_my_family_id() and
    exists (select 1 from profiles where id = auth.uid() and role = 'parent')
  );

-- 6. AUTH TRIGGER
-- Automatically creates a profile entry when a user signs up.
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, display_name, role, family_id)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'display_name', 'New User'),
    coalesce(new.raw_user_meta_data->>'role', 'parent'),
    (new.raw_user_meta_data->>'family_id')::uuid
  )
  on conflict (id) do update
  set 
    display_name = excluded.display_name,
    role = excluded.role,
    family_id = excluded.family_id;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger Binding
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 7. POINTS & REDEMPTION LOGIC

-- Add Balance to Profiles (Safe update)
create table if not exists _dummy (id int); -- just to ensure we can run do block
do $$ 
begin
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'balance') then
    alter table profiles add column balance integer default 0;
  end if;
end $$;

-- RPC: Request Redemption (Deducts points immediately -> "Hold")
create or replace function request_redemption(reward_id_param uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_cost int;
  v_balance int;
  v_family_id uuid;
  v_redemption_id uuid;
begin
  -- 1. Get Reward Cost and Family ID
  select cost, family_id into v_cost, v_family_id from rewards where id = reward_id_param;
  
  if not found then
    return json_build_object('error', 'Reward not found');
  end if;

  -- 2. Check Balance
  select balance into v_balance from profiles where id = auth.uid();
  
  if v_balance < v_cost then
    return json_build_object('error', 'Insufficient balance');
  end if;

  -- 3. Deduct Points (Hold)
  update profiles set balance = balance - v_cost where id = auth.uid();

  -- 4. Create Redemption Record
  insert into redemptions (family_id, kid_id, reward_id, status)
  values (v_family_id, auth.uid(), reward_id_param, 'pending')
  returning id into v_redemption_id;

  return json_build_object('success', true, 'redemption_id', v_redemption_id);
end;
$$;

-- RPC: Approve Redemption (Keep points deducted, just mark approved)
create or replace function approve_redemption(redemption_id_param uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'parent') then
    raise exception 'Only parents can approve';
  end if;

  update redemptions set status = 'approved', updated_at = now() where id = redemption_id_param;
end;
$$;

-- RPC: Reject Redemption (Refund points)
create or replace function reject_redemption(redemption_id_param uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_kid_id uuid;
  v_reward_id uuid;
  v_cost int;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'parent') then
    raise exception 'Only parents can reject';
  end if;

  -- Get details
  select kid_id, reward_id into v_kid_id, v_reward_id from redemptions where id = redemption_id_param;
  select cost into v_cost from rewards where id = v_reward_id;

  -- Refund
  update profiles set balance = balance + v_cost where id = v_kid_id;

  -- Mark rejected
  update redemptions set status = 'rejected', updated_at = now() where id = redemption_id_param;
end;
$$;

