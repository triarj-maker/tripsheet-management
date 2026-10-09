export const uid = i => `00000000-0000-0000-0000-${String(i).padStart(12,'0')}`;
export const fixtureSQL = `
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
    grant usage on schema auth to authenticated,anon,service_role;
    create table auth.users (id uuid primary key);
    create table profiles (id uuid primary key references auth.users(id) on delete cascade,
      full_name text not null, email text not null, phone text, role text not null,
      is_active boolean not null default true, updated_at timestamptz not null default now());
    create table trip_sheet_assignments (id int primary key, trip_sheet_id uuid, resource_user_id uuid references profiles(id), assigned_by uuid references profiles(id));
    insert into auth.users select ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,20) i;
    insert into profiles (id,full_name,email,role,is_active) values
      ('${uid(1)}','Admin','a@example.test','admin',true),
      ('${uid(2)}','Facilitator','f@example.test','facilitator',true),
      ('${uid(3)}','Expert','e@example.test','expert',true),
      ('${uid(4)}','Inactive','i@example.test','admin',false);
    insert into trip_sheet_assignments values (1,'${uid(20)}','${uid(2)}','${uid(1)}');
    create function set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
    create trigger set_profiles_updated_at before update on profiles for each row execute function set_updated_at();
    create function public.is_admin() returns boolean language sql stable security definer set search_path=public as
      $$ select exists(select 1 from profiles where id=auth.uid() and role='admin' and is_active=true) $$;
    create function public.is_active_resource(p_profile_id uuid) returns boolean language sql stable security definer set search_path=public as
      $$ select exists(select 1 from profiles where id=p_profile_id and role='resource' and is_active=true) $$;
    alter table profiles enable row level security;
    create policy admin_read on profiles for select using (public.is_admin());
    create policy own_read on profiles for select using (id=auth.uid());
    create policy admin_update on profiles for update using (public.is_admin()) with check (public.is_admin());
    create policy admin_insert on profiles for insert with check (public.is_admin());
    grant all on profiles to authenticated,anon,service_role;
  `;
