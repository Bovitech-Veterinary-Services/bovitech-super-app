-- =====================================================================
--  Bovitech Super App — database update 09 (v2.7): the ezyVet archive
--  • Keeps the old ezyVet history (consults and their notes, invoices, payments,
--    messages, documents and memos) read-only in the practice database, with a
--    full-text index so every record can be searched in a second.
--  • Only an admin can load it (Settings → Admin jobs → Import the ezyVet export).
--  Safe to run more than once.
--  Supabase → SQL Editor → New query → paste ALL of this → Run.
-- =====================================================================

create table if not exists public.ezy_archive (
  kind       text not null,             -- consult, invoice, payment, comm, doc, memo
  id         text not null,             -- the ezyVet id
  contact_id text,                      -- ezyVet contact id (the client)
  animal_id  text,                      -- ezyVet animal id (the herd / flock / animal)
  d          date,                      -- the record's date
  data       jsonb not null,
  body       text not null default '',  -- all its words, for searching
  tsv        tsvector generated always as (to_tsvector('english', body)) stored,
  loaded_at  timestamptz not null default now(),
  primary key (kind, id)
);
create index if not exists ezy_archive_contact on public.ezy_archive (contact_id);
create index if not exists ezy_archive_animal  on public.ezy_archive (animal_id);
create index if not exists ezy_archive_d       on public.ezy_archive (d);
create index if not exists ezy_archive_tsv     on public.ezy_archive using gin (tsv);
alter table public.ezy_archive enable row level security;   -- no policies: only the functions below can reach it
revoke all on table public.ezy_archive from anon, authenticated;

drop function if exists public.ezy_list(text, text, text, text[], integer);
drop function if exists public.ezy_search(text, text, text, text, text[], date, date, text, integer);

-- admin: add or replace a batch of archive rows  [{kind,id,contact_id,animal_id,d,data,body}]
create or replace function public.ezy_put(k text, items jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform public.require_admin(k);
  insert into public.ezy_archive (kind, id, contact_id, animal_id, d, data, body)
  select x->>'kind', x->>'id', nullif(x->>'contact_id', ''), nullif(x->>'animal_id', ''), nullif(x->>'d', '')::date, coalesce(x->'data', '{}'::jsonb), coalesce(x->>'body', '')
  from jsonb_array_elements(items) x
  on conflict (kind, id) do update set contact_id = excluded.contact_id, animal_id = excluded.animal_id, d = excluded.d, data = excluded.data, body = excluded.body, loaded_at = now();
  get diagnostics n = row_count; return n;
end $$;

-- admin: how much is loaded
create or replace function public.ezy_status(k text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_device(k);
  return coalesce((select jsonb_object_agg(kind, n) from (select kind, count(*) n from public.ezy_archive group by kind) s), '{}'::jsonb);
end $$;

-- everyone signed in on a trusted device: the history for a client and/or animal (newest first, without the long text)
create or replace function public.ezy_list(k text, contacts text[], animals text[], kinds text[], lim integer default 500) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_device(k);
  return coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'id', id, 'contact_id', contact_id, 'animal_id', animal_id, 'd', d, 'data', data - 'body') order by d desc nulls last, id desc) from (
    select * from public.ezy_archive
    where (contacts is null or contact_id = any(contacts)) and (animals is null or animal_id = any(animals)) and (kinds is null or kind = any(kinds))
    order by d desc nulls last limit least(greatest(lim, 1), 3000)) s), '[]'::jsonb);
end $$;

-- one whole record
create or replace function public.ezy_get(k text, kind_ text, id_ text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_device(k);
  return (select jsonb_build_object('kind', kind, 'id', id, 'contact_id', contact_id, 'animal_id', animal_id, 'd', d, 'data', data) from public.ezy_archive where kind = kind_ and id = id_);
end $$;

-- search every record's words; matches come back with the matching bits marked «like this»
create or replace function public.ezy_search(k text, q text, contacts text[] default null, animals text[] default null, kinds text[] default null,
  from_ date default null, to_ date default null, who text default null, lim integer default 100) returns jsonb
language plpgsql security definer set search_path = public as $$
declare tq tsquery; like_ text;
begin
  perform public.require_device(k);
  if coalesce(trim(q), '') = '' then return '[]'::jsonb; end if;
  tq := websearch_to_tsquery('english', q);
  like_ := '%' || replace(replace(replace(trim(q), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return coalesce((select jsonb_agg(r order by r_rank desc, r_d desc nulls last) from (
    select jsonb_build_object('kind', kind, 'id', id, 'contact_id', contact_id, 'animal_id', animal_id, 'd', d,
             'title', data->>'title', 'who', data->>'who', 'animal', data->>'animal', 'client', data->>'client',
             'hit', ts_headline('english', body, case when numnode(tq) > 0 then tq else to_tsquery('english', 'zzzzzz') end,
                    'StartSel=«, StopSel=», MaxFragments=3, MaxWords=24, MinWords=8, FragmentDelimiter= … ')) r,
           ts_rank(tsv, tq) + (case when body ilike like_ then 1 else 0 end) r_rank, d r_d
    from public.ezy_archive
    where (tsv @@ tq or body ilike like_)
      and (contacts is null or contact_id = any(contacts)) and (animals is null or animal_id = any(animals))
      and (kinds is null or kind = any(kinds)) and (from_ is null or d >= from_) and (to_ is null or d <= to_)
      and (who is null or data->>'who' ilike '%' || who || '%')
    order by r_rank desc, d desc nulls last limit least(greatest(lim, 1), 300)) s), '[]'::jsonb);
end $$;

revoke all on function public.ezy_put(text, jsonb), public.ezy_status(text), public.ezy_list(text, text[], text[], text[], integer),
  public.ezy_get(text, text, text), public.ezy_search(text, text, text[], text[], text[], date, date, text, integer) from public, anon;
grant execute on function public.ezy_put(text, jsonb), public.ezy_status(text), public.ezy_list(text, text[], text[], text[], integer),
  public.ezy_get(text, text, text), public.ezy_search(text, text, text[], text[], text[], date, date, text, integer) to authenticated;

-- everyone signed in on a trusted device: the newest record date for each ezyVet animal (for "patients not seen in 12 months")
create or replace function public.ezy_last(k text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_device(k);
  return coalesce((select jsonb_object_agg(animal_id, d) from (select animal_id, max(d) d from public.ezy_archive where animal_id is not null and d is not null group by animal_id) s), '{}'::jsonb);
end $$;
revoke all on function public.ezy_last(text) from public, anon;
grant execute on function public.ezy_last(text) to authenticated;
