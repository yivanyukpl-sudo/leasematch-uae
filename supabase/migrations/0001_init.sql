-- LeaseMatch: accounts + property intake (flow 1)

create extension if not exists "pgcrypto";

-- One row per auth.users user, holding app-specific profile data.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('tenant','owner','broker','pm')),
  full_name text not null,
  company_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever someone signs up, reading role/name
-- out of the metadata passed at signup time.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, company_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'tenant'),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'company_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Properties a provider (owner / broker / pm) lists.
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  property_type text not null,
  location text not null,
  price numeric not null,
  beds int not null default 0,
  baths int not null default 1,
  sqft int,
  furnished text not null default 'unfurnished' check (furnished in ('furnished','unfurnished')),
  description text,
  amenities text[] not null default '{}',
  status text not null default 'pending_verification'
    check (status in ('pending_verification','live','vacant','under_offer','leased')),
  created_at timestamptz not null default now()
);

alter table public.properties enable row level security;

-- Any signed-in user can browse live listings (needed for the tenant-side
-- search flow we build next); providers can also see their own non-live rows.
create policy "properties: read live, or own"
  on public.properties for select
  using (status = 'live' or auth.uid() = provider_id);

create policy "properties: providers insert their own"
  on public.properties for insert
  with check (
    auth.uid() = provider_id
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('owner','broker','pm')
    )
  );

create policy "properties: providers update their own"
  on public.properties for update
  using (auth.uid() = provider_id);

create index properties_provider_id_idx on public.properties(provider_id);
create index properties_status_idx on public.properties(status);
