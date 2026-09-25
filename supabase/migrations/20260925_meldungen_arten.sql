-- Fehler melden: drei Arten und der Zusammenhang des abgelehnten Zugs (25.09.2026)
--
-- Bisher kannte pc_reports nur „Spieler → Verein fehlt". Titel und Nationalität
-- ließen sich nicht melden, und beim Melden aus einem abgelehnten Zug ging verloren,
-- WELCHES Feld abgelehnt hatte — beim gemeldeten Fall „Ferran Torres gilt nicht als
-- Weltmeister" ließ sich der Zug danach nicht mehr nachvollziehen.
--
-- Rückwärtsverträglich: `kind` hat die Vorgabe 'verein', die Funktion nimmt die
-- beiden neuen Parameter optional. Die bis zum Merge ausgelieferte Fassung des Spiels
-- ruft pc_report_submit weiter mit neun Argumenten auf.
--
-- Für Titel und Nationen tragen club_key/club_name das ZIEL der Meldung
-- (club_key = 'WM', club_name = 'Weltmeister'); die Spalten heißen weiter so, damit
-- Export und Auswertung unverändert lesen können.

alter table public.pc_reports
  add column if not exists kind text not null default 'verein',
  add column if not exists last_context jsonb;

alter table public.pc_reports drop constraint if exists pc_reports_kind_check;
alter table public.pc_reports
  add constraint pc_reports_kind_check check (kind in ('verein', 'titel', 'nation'));

alter table public.pc_reports drop constraint if exists pc_reports_paar_unique;
alter table public.pc_reports
  add constraint pc_reports_paar_unique unique (player_key, kind, club_name);

drop function if exists public.pc_report_submit(text, text, integer, text, text, text, text, text, text);

create function public.pc_report_submit(
  p_player_key text, p_player_name text, p_player_by integer,
  p_club_key text, p_club_name text, p_client text, p_mode text,
  p_game_code text, p_data_asof text,
  p_kind text default 'verein', p_context jsonb default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if coalesce(btrim(p_player_key), '') = '' or coalesce(btrim(p_club_name), '') = '' then
    raise exception 'Spieler und Ziel sind Pflicht';
  end if;
  if coalesce(p_kind, 'verein') not in ('verein', 'titel', 'nation') then
    raise exception 'Unbekannte Meldeart';
  end if;
  -- Der Zusammenhang ist ein kleines Objekt (Feld, Modus, Datenstand) — mehr nicht.
  if p_context is not null and length(p_context::text) > 2000 then
    raise exception 'Zusammenhang zu groß';
  end if;

  insert into pc_reports as r
    (player_key, player_name, player_by, club_key, club_name, reporters, modes, game_codes,
     data_asof, kind, last_context)
  values
    (btrim(p_player_key), btrim(p_player_name), p_player_by,
     nullif(btrim(coalesce(p_club_key, '')), ''), btrim(p_club_name),
     case when coalesce(p_client, '') = '' then '{}'::text[] else array[p_client] end,
     case when coalesce(p_mode, '') = '' then '{}'::text[] else array[p_mode] end,
     case when coalesce(p_game_code, '') = '' then '{}'::text[] else array[p_game_code] end,
     p_data_asof, coalesce(p_kind, 'verein'), p_context)
  on conflict (player_key, kind, club_name) do update set
    reports          = r.reports + 1,
    reporters        = (select array(select distinct e from unnest(r.reporters || excluded.reporters) e)),
    modes            = (select array(select distinct e from unnest(r.modes || excluded.modes) e)),
    game_codes       = (select array(select distinct e from unnest(r.game_codes || excluded.game_codes) e)),
    club_key         = coalesce(r.club_key, excluded.club_key),
    last_context     = coalesce(excluded.last_context, r.last_context),
    last_reported_at = now();
end $function$;

-- Die Funktion ist der einzige Schreibweg für den öffentlichen Schlüssel. Rechte wie
-- bei der alten Fassung: anon, authenticated, service_role — nicht PUBLIC.
revoke execute on function public.pc_report_submit(text, text, integer, text, text, text, text, text, text, text, jsonb)
  from public;
grant execute on function public.pc_report_submit(text, text, integer, text, text, text, text, text, text, text, jsonb)
  to anon, authenticated, service_role;
