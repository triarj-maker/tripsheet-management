-- Separate, minimal correction. No rows or unrelated privileges are changed.
begin;
revoke truncate on public.profiles from anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles r where r.rolname in ('anon','authenticated')
    and has_table_privilege(r.oid, 'public.profiles', 'TRUNCATE')) then
    raise exception 'TRUNCATE is inherited or granted via PUBLIC; inspect grants before a separately reviewed correction';
  end if;
end $$;
commit;
