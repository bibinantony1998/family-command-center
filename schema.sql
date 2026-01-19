-- FAMILY COMMAND CENTER - DATABASE SCHEMA
-- Run this script in the Supabase SQL Editor to initialize the database.

-- 1. RESET (Safety: Drop existing objects to ensure clean state)
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop function if exists get_my_family_id() cascade;
drop function if exists get_my_role() cascade;
drop function if exists switch_family(uuid) cascade;
drop function if exists join_family_by_code(text) cascade;

drop table if exists notifications cascade;
drop table if exists settlements cascade;
drop table if exists expense_splits cascade;
drop table if exists expenses cascade;
drop table if exists redemptions cascade;
drop table if exists rewards cascade;
drop table if exists game_scores cascade;
drop table if exists chores cascade;
drop table if exists notes cascade;
drop table if exists groceries cascade;
drop table if exists family_members cascade;
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
  currency text default 'INR',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Profiles (Linked to auth.users)
-- Now includes current_family_id for session context
create table profiles (
  id uuid references auth.users not null primary key,
  display_name text,
  role text check (role in ('parent', 'child')), -- kept for legacy/default, but family_members.role is source of truth
  avatar_url text,
  family_id uuid references families(id), -- kept for legacy/migration
  current_family_id uuid references families(id), -- NEW: Active family context
  balance integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Family Members (NEW: Many-to-Many)
create table family_members (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references profiles(id) on delete cascade not null,
  family_id uuid references families(id) on delete cascade not null,
  role text check (role in ('parent', 'child', 'member')) default 'member',
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(profile_id, family_id)
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
alter table family_members enable row level security;
alter table groceries enable row level security;
alter table notes enable row level security;
alter table chores enable row level security;
alter table game_scores enable row level security;
alter table rewards enable row level security;
alter table redemptions enable row level security;

-- 5. FUNCTIONS & POLICIES

-- Helper: Get Family ID (UPDATED)
create or replace function get_my_family_id()
returns uuid
language sql
security definer
stable
as $$
  select coalesce(current_family_id, family_id) from profiles where id = auth.uid();
$$;

-- Helper: Get My Role (NEW)
create or replace function get_my_role()
returns text
language sql
security definer
stable
as $$
  select role from family_members 
  where profile_id = auth.uid() 
  and family_id = get_my_family_id();
$$;

-- Helper: Switch Family (NEW)
create or replace function switch_family(target_family_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from family_members where profile_id = auth.uid() and family_id = target_family_id) then
    raise exception 'You are not a member of this family';
  end if;
  update profiles set current_family_id = target_family_id where id = auth.uid();
end;
$$;

-- Helper: Get ALL My Family IDs (Secure/Non-Recursive)
create or replace function get_my_family_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select family_id from family_members where profile_id = auth.uid();
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
    exists (
      select 1 from family_members fm 
      where fm.profile_id = profiles.id 
      and fm.family_id in (select get_my_family_ids())
    )
  );

-- FAMILY MEMBERS Policies
create policy "Users can view own memberships" on family_members
  for select using (profile_id = auth.uid());

create policy "Family members can view other members" on family_members
  for select using (
    family_id in (select get_my_family_ids())
  );

create policy "Users can join families" on family_members
  for insert with check (profile_id = auth.uid());

-- FAMILIES Policies
create policy "Users can view own families" on families
  for select using (
    exists (
      select 1 from family_members where family_members.family_id = families.id and family_members.profile_id = auth.uid()
    )
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
    get_my_role() = 'parent'
  );

create policy "Family update chores" on chores
  for update using (family_id = get_my_family_id());

create policy "Parents can delete chores" on chores
  for delete using (
    family_id = get_my_family_id() 
    and 
    get_my_role() = 'parent'
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
    get_my_role() = 'parent'
  );

-- REDEMPTIONS Policies
create policy "Parents view all redemptions" on redemptions
  for select using (
    family_id = get_my_family_id() and
    get_my_role() = 'parent'
  );

create policy "Kids view own redemptions" on redemptions
  for select using (id = auth.uid() or kid_id = auth.uid());

create policy "Kids can request redemption" on redemptions
  for insert with check (
    kid_id = auth.uid() and
    get_my_role() = 'child'
  );

create policy "Parents can update redemption status" on redemptions
  for update using (
    family_id = get_my_family_id() and
    get_my_role() = 'parent'
  );

-- 6. AUTH TRIGGER
-- Automatically creates a profile entry when a user signs up.
create or replace function public.handle_new_user() 
returns trigger as $$
declare
  v_family_id uuid;
begin
  v_family_id := (new.raw_user_meta_data->>'family_id')::uuid;

  insert into public.profiles (id, display_name, role, family_id, current_family_id)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'display_name', 'New User'),
    coalesce(new.raw_user_meta_data->>'role', 'parent'),
    v_family_id,
    v_family_id
  )
  on conflict (id) do update
  set 
    display_name = excluded.display_name,
    role = excluded.role,
    family_id = excluded.family_id,
    current_family_id = excluded.current_family_id;

  -- Add to family_members if family exists
  if v_family_id is not null then
    insert into public.family_members (profile_id, family_id, role)
    values (
      new.id, 
      v_family_id, 
      coalesce(new.raw_user_meta_data->>'role', 'parent')
    )
    on conflict (profile_id, family_id) do update
    set role = excluded.role;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Trigger Binding
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 7. POINTS & REDEMPTION LOGIC

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
  if get_my_role() != 'parent' then
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
  if get_my_role() != 'parent' then
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

-- RPC: Join Family By Code (NEW)
create or replace function join_family_by_code(secret_key_input text)
returns json
language plpgsql
security definer
as $$
declare
  v_family_id uuid;
  v_family_name text;
begin
  -- Find family
  select id, name into v_family_id, v_family_name
  from families 
  where secret_key = secret_key_input;

  if v_family_id is null then
    return json_build_object('success', false, 'error', 'Invalid family code');
  end if;

  -- Add to family_members
  insert into family_members (profile_id, family_id, role)
  values (auth.uid(), v_family_id, 'parent')
  on conflict (profile_id, family_id) do nothing;

  -- Switch to this family
  update profiles set current_family_id = v_family_id where id = auth.uid();
  
  return json_build_object('success', true, 'family_id', v_family_id, 'family_name', v_family_name);
end;
$$;

-- 8. TEMPORARY FIXES
-- Allow public read of families table to fix "Invalid Code" error on join.
create policy "Temp_Public_Read_Families"
on families
as permissive
for select
to authenticated
using (true);


-- 9. EXPENSE SPLITTING
create table expenses (
  id uuid primary key default uuid_generate_v4(),
  description text not null,
  amount numeric(10,2) not null check (amount > 0),
  paid_by uuid references profiles(id) not null,
  date timestamp with time zone default timezone('utc'::text, now()) not null,
  category text,
  family_id uuid references families(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table expense_splits (
  id uuid primary key default uuid_generate_v4(),
  expense_id uuid references expenses(id) on delete cascade not null,
  profile_id uuid references profiles(id) not null,
  amount numeric(10,2) not null check (amount >= 0),
  percentage numeric(5,2), -- Optional, for percentage splits
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table settlements (
  id uuid primary key default uuid_generate_v4(),
  payer_id uuid references profiles(id) not null,
  receiver_id uuid references profiles(id) not null,
  amount numeric(10,2) not null check (amount > 0),
  date timestamp with time zone default timezone('utc'::text, now()) not null,
  family_id uuid references families(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- EXPENSES Policies
alter table expenses enable row level security;

create policy "Family view expenses" on expenses
  for select using (family_id = get_my_family_id());

create policy "Family insert expenses" on expenses
  for insert with check (family_id = get_my_family_id());

create policy "Family update expenses" on expenses
  for update using (family_id = get_my_family_id());

create policy "Family delete expenses" on expenses
  for delete using (family_id = get_my_family_id());

-- EXPENSE SPLITS Policies
alter table expense_splits enable row level security;

create policy "Family view splits" on expense_splits
  for select using (
    exists (
      select 1 from expenses 
      where expenses.id = expense_splits.expense_id 
      and expenses.family_id = get_my_family_id()
    )
  );

create policy "Family insert splits" on expense_splits
  for insert with check (
    exists (
      select 1 from expenses 
      where expenses.id = expense_splits.expense_id 
      and expenses.family_id = get_my_family_id()
    )
  );

-- SETTLEMENTS Policies
alter table settlements enable row level security;

create policy "Family view settlements" on settlements
  for select using (family_id = get_my_family_id());

create policy "Family insert settlements" on settlements
  for insert with check (family_id = get_my_family_id());

create policy "Family update settlements" on settlements
  for update using (family_id = get_my_family_id());

create policy "Family delete settlements" on settlements
  for delete using (family_id = get_my_family_id());

-- 10. NOTIFICATIONS
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid references families(id) not null,
  recipient_id uuid references profiles(id) not null,
  sender_id uuid references profiles(id) not null,
  type text not null check (type in ('settle_up_reminder')),
  message text,
  is_read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- NOTIFICATIONS Policies
alter table notifications enable row level security;

create policy "Family view notifications" on notifications
  for select using (family_id = get_my_family_id());

create policy "Users can insert notifications" on notifications
  for insert with check (family_id = get_my_family_id() and sender_id = auth.uid());

create policy "Recipients can update notifications" on notifications
  for update using (recipient_id = auth.uid());
-- RPC: Leave Family
-- Removes the user from a family.
-- If the user is the LAST member, deletes the family and ALL associated data.
create or replace function leave_family(target_family_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_count int;
begin
  -- 1. Check if member exists in this family
  if not exists (select 1 from family_members where profile_id = auth.uid() and family_id = target_family_id) then
    raise exception 'You are not a member of this family';
  end if;

  -- 2. Count members BEFORE deletion to see if we are the last one
  select count(*) into v_count from family_members
  where family_id = target_family_id;

  -- 3. Remove from family_members
  delete from family_members
  where profile_id = auth.uid() and family_id = target_family_id;

  -- 4. Update Profile: Clear current_family_id if it was this family
  update profiles
  set current_family_id = null
  where id = auth.uid() and current_family_id = target_family_id;

  -- 5. If specific legacy family_id matches, clear it too (optional safety)
  update profiles
  set family_id = null
  where id = auth.uid() and family_id = target_family_id;

  -- 6. IF LAST MEMBER: CASCADE DELETE EVERYTHING
  if v_count = 1 then
    -- Delete dependent data (Order matters for constraints, though some have cascade)
    delete from notifications where family_id = target_family_id;
    delete from settlements where family_id = target_family_id;
    -- expense_splits deletes via cascade from expenses
    delete from expenses where family_id = target_family_id;
    delete from redemptions where family_id = target_family_id;
    delete from rewards where family_id = target_family_id;
    delete from game_scores where family_id = target_family_id;
    delete from chores where family_id = target_family_id;
    delete from notes where family_id = target_family_id;
    delete from groceries where family_id = target_family_id;

    -- Clear legacy references in profiles table for ANY user (not just self) to avoid FK constraint error
    update profiles set family_id = null where family_id = target_family_id;
    update profiles set current_family_id = null where current_family_id = target_family_id;

    -- Finally delete the family
    delete from families where id = target_family_id;
  end if;
end;
$$;
-- 1. ADD BALANCE TO FAMILY MEMBERS
alter table family_members 
add column if not exists balance integer default 0;

-- 2. MIGRATE EXISTING BALANCES (Best Effort)
-- Move profile balance to their 'current' family member entry
-- If current_family_id is null, try legacy family_id
do $$
declare
  r record;
begin
  for r in select id, balance, current_family_id, family_id from profiles where balance > 0 loop
    -- Determine target family
    if r.current_family_id is not null then
      update family_members set balance = r.balance 
      where profile_id = r.id and family_id = r.current_family_id;
    elsif r.family_id is not null then
      update family_members set balance = r.balance 
      where profile_id = r.id and family_id = r.family_id;
    end if;
  end loop;
end;
$$;

-- 3. UPDATED RPCS FOR REDEMPTIONS (Use family_members.balance)

-- Request Redemption
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

  -- 2. Check Balance (in FAMILY MEMBERS)
  select balance into v_balance from family_members 
  where profile_id = auth.uid() and family_id = v_family_id;
  
  if v_balance is null then v_balance := 0; end if;

  if v_balance < v_cost then
    return json_build_object('error', 'Insufficient balance');
  end if;

  -- 3. Deduct Points (Hold) from FAMILY MEMBERS
  update family_members 
  set balance = balance - v_cost 
  where profile_id = auth.uid() and family_id = v_family_id;

  -- 4. Create Redemption Record
  insert into redemptions (family_id, kid_id, reward_id, status)
  values (v_family_id, auth.uid(), reward_id_param, 'pending')
  returning id into v_redemption_id;

  return json_build_object('success', true, 'redemption_id', v_redemption_id);
end;
$$;


-- Reject Redemption (Refund)
create or replace function reject_redemption(redemption_id_param uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_kid_id uuid;
  v_reward_id uuid;
  v_family_id uuid;
  v_cost int;
begin
  if get_my_role() != 'parent' then
    raise exception 'Only parents can reject';
  end if;

  -- Get details
  select kid_id, reward_id, family_id into v_kid_id, v_reward_id, v_family_id 
  from redemptions where id = redemption_id_param;
  
  select cost into v_cost from rewards where id = v_reward_id;

  -- Refund to FAMILY MEMBERS
  update family_members 
  set balance = balance + v_cost 
  where profile_id = v_kid_id and family_id = v_family_id;

  -- Mark rejected
  update redemptions set status = 'rejected', updated_at = now() where id = redemption_id_param;
end;
$$;


-- 4. TRIGGERS FOR EARNING POINTS

-- Function to handle adding points
create or replace function handle_add_points()
returns trigger
language plpgsql
security definer
as $$
declare
  v_points int;
  v_user_id uuid;
  v_family_id uuid;
begin
  -- CHORES logic
  if TG_TABLE_NAME = 'chores' then
    -- Only award if completing and assigned
    if NEW.is_completed = true and (OLD.is_completed = false or OLD.is_completed is null) and NEW.assigned_to is not null then
      v_points := NEW.points;
      v_user_id := NEW.assigned_to;
      v_family_id := NEW.family_id;
      
      update family_members 
      set balance = balance + v_points 
      where profile_id = v_user_id and family_id = v_family_id;
    end if;
  end if;

  -- GAME SCORES logic
  if TG_TABLE_NAME = 'game_scores' then
    v_points := NEW.points;
    v_user_id := NEW.profile_id;
    v_family_id := NEW.family_id;

    if v_user_id is not null then
         update family_members 
         set balance = balance + v_points 
         where profile_id = v_user_id and family_id = v_family_id;
    end if;
  end if;

  return NEW;
end;
$$;

-- Drop old triggers if exists
drop trigger if exists on_chore_completed on chores;
drop trigger if exists on_game_score_added on game_scores;

-- Trigger: Chores
create trigger on_chore_completed
after update on chores
for each row
execute procedure handle_add_points();

-- Trigger: Game Scores
create trigger on_game_score_added
after insert on game_scores
for each row
execute procedure handle_add_points();


-- 11. CHAT MESSAGES
-- Table for storing chat messages (Direct & Group)
-- Table for storing chat messages (Direct & Group)
create table chat_messages (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid references families(id) not null,
  sender_id uuid references profiles(id) not null,
  recipient_id uuid references profiles(id), -- Null means Group Chat (all parents)
  content text not null,
  is_read boolean default false, -- DEPRECATED: Use read_by array
  read_by uuid[] default '{}', -- NEW: Array of user IDs who have read the message
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- CHAT Policies
alter table chat_messages enable row level security;

-- Select: Parents can see messages they sent, received, or group messages in their family.
create policy "Parents view chat messages" on chat_messages
  for select using (
    exists (
      select 1 from family_members fm
      where fm.family_id = chat_messages.family_id
      and fm.profile_id = auth.uid()
      and fm.role = 'parent'
    )
    and (
       sender_id = auth.uid() 
       or recipient_id = auth.uid() 
       or recipient_id is null
    )
  );

-- Insert: Only parents can send messages.
create policy "Parents send chat messages" on chat_messages
  for insert with check (
    family_id = get_my_family_id() 
    and get_my_role() = 'parent'
    and sender_id = auth.uid()
  );

-- Update: Parents can update messages (e.g. mark as read).
-- ALLOW any parent in the family to update (specifically for marking read)
  );

-- RPC: Mark Messages Read (Atomic Array Update)
create or replace function mark_messages_read(p_family_id uuid, p_recipient_id uuid default null)
returns void
language plpgsql
security definer
as $$
begin
  -- Update messages to include me in 'read_by'
  -- 1. Must be in right family
  -- 2. Must NOT be already read by me
  -- 3. Must NOT be sent by me
  
  update chat_messages
  set read_by = array_append(read_by, auth.uid())
  where family_id = p_family_id
  and not (read_by @> array[auth.uid()])
  and sender_id != auth.uid()
  and (
      -- If p_recipient_id provided (DM view):
         -- If I am viewing a DM with User B (p_recipient_id = User B ID)
         -- I want to mark messages Sent BY User B (sender_id = User B)
      (p_recipient_id is not null and sender_id = p_recipient_id)
      OR
      -- If p_recipient_id is NULL (Group Chat View):
         -- Mark all GROUP messages (recipient_id is null)
      (p_recipient_id is null and recipient_id is null)
  );
end;
$$;
