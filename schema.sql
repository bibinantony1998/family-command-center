-- Create tables and RLS policies

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Families Table
create table families (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  secret_key text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Profiles Table (Linked to auth.users)
create table profiles (
  id uuid references auth.users not null primary key,
  display_name text,
  role text check (role in ('parent', 'child')),
  avatar_url text,
  family_id uuid references families(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Groceries Table
create table groceries (
  id uuid primary key default uuid_generate_v4(),
  item_name text not null,
  category text,
  is_purchased boolean default false,
  added_by uuid references profiles(id),
  family_id uuid references families(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Notes Table (Bulletins)
create table notes (
  id uuid primary key default uuid_generate_v4(),
  content text not null,
  color text,
  author_id uuid references profiles(id),
  family_id uuid references families(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Chores Table
create table chores (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  points integer default 0,
  is_completed boolean default false,
  assigned_to uuid references profiles(id),
  family_id uuid references families(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Row Level Security (RLS)

alter table families enable row level security;
alter table profiles enable row level security;
alter table groceries enable row level security;
alter table notes enable row level security;
alter table chores enable row level security;

-- Policies

-- Helper function to get family_id safely (prevents recursion)
create or replace function get_my_family_id()
returns uuid
language sql
security definer
stable
as $$
  select family_id from profiles where id = auth.uid();
$$;

-- Profiles: Users can view their own profile and profiles in their family
create policy "Users can view family profiles" on profiles
  for select using (
    auth.uid() = id or 
    family_id = get_my_family_id()
  );
  
create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

create policy "Users can insert own profile" on profiles
  for insert with check (auth.uid() = id);

-- Families: 
create policy "Users can view own family" on families
  for select using (
    id = get_my_family_id()
  );

create policy "Users can create families" on families
  for insert with check (auth.role() = 'authenticated');

-- Groceries: View/Edit if in same family
create policy "Family view groceries" on groceries
  for select using (
    family_id = get_my_family_id()
  );

create policy "Family insert groceries" on groceries
  for insert with check (
    family_id = get_my_family_id()
  );

create policy "Family update groceries" on groceries
  for update using (
    family_id = get_my_family_id()
  );
  
create policy "Family delete groceries" on groceries
  for delete using (
    family_id = get_my_family_id()
  );

-- Notes
create policy "Family view notes" on notes
  for select using (
    family_id = get_my_family_id()
  );

create policy "Family insert notes" on notes
  for insert with check (
    family_id = get_my_family_id()
  );

create policy "Family update notes" on notes
  for update using (
    family_id = get_my_family_id()
  );

create policy "Family delete notes" on notes
  for delete using (
    family_id = get_my_family_id()
  );

-- Chores
create policy "Family view chores" on chores
  for select using (
    family_id = get_my_family_id()
  );

create policy "Family insert chores" on chores
  for insert with check (
    family_id = get_my_family_id()
  );

create policy "Family update chores" on chores
  for update using (
    family_id = get_my_family_id()
  );

create policy "Family delete chores" on chores
  for delete using (
    family_id = get_my_family_id()
  );

-- Trigger to create profile on signup
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, display_name, role)
  values (new.id, new.raw_user_meta_data->>'display_name', 'parent');
  return new;
end;
$$ language plpgsql security definer;
