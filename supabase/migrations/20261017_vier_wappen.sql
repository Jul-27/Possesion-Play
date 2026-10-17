-- „Vier Wappen": Schiedsrichter in der Datenbank (17.10.2026)
--
-- Beide Spieler wählen GLEICHZEITIG. Derselbe Spieler darf in einer Runde nur einmal
-- vergeben werden — wer zuerst bestätigt, bekommt ihn. Zwei Browser können das nicht
-- untereinander ausmachen: Lesen sie beide „noch frei" und schreiben dann, gewinnt der
-- spätere Schreibvorgang und überschreibt den früheren. Deshalb entscheidet hier eine
-- Funktion, die die Zeile mit FOR UPDATE sperrt; der zweite Aufruf wartet und sieht
-- dann die erste Wahl.
--
-- Auch die Uhr ist die der Datenbank: Start und Wahlzeit stammen aus now() bzw.
-- clock_timestamp(), nicht aus den Browsern, deren Uhren um Sekunden auseinander
-- liegen können. vier_jetzt() liefert die Zeit, gegen die die Browser ihre Uhr eichen.
--
-- Der Stand liegt in games.board.stand (siehe src/vier.js); Punkte rechnen die
-- Browser selbst aus der Spielerliste — die Datenbank kennt keine Vereine.

-- Zeitstempel immer in derselben Form: ISO, Millisekunden, UTC („…T12:00:03.123Z").
create or replace function public.vier_iso(t timestamptz)
returns text
language sql
immutable
set search_path to 'public'
as $$ select to_char(t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;

create or replace function public.vier_jetzt()
returns text
language sql
volatile
set search_path to 'public'
as $$ select public.vier_iso(clock_timestamp()) $$;

-- Erste Runde starten (drei Sekunden Vorlauf). Idempotent: Rufen beide Browser
-- gleichzeitig, setzt nur der erste den Start.
create or replace function public.vier_starten(p_code text)
returns void
language sql
volatile
set search_path to 'public'
as $$
  update public.games
     set board = jsonb_set(board, '{stand,start}', to_jsonb(public.vier_iso(clock_timestamp() + interval '3 seconds'))),
         updated_at = now()
   where code = p_code
     and status = 'playing'
     and board->>'kind' = 'vier'
     and board->'stand'->>'start' is null
$$;

-- Eine Wahl abgeben. Antwort: { ergebnis, jetzt }, ergebnis ∈
--   ok | vergeben | zu_spaet | noch_nicht | schon_gewaehlt | vorbei | unbekannt
-- Eine Sekunde Kulanz über die 30 hinaus: Die Anfrage ist unterwegs, während die
-- Uhr im Browser noch läuft.
create or replace function public.vier_waehlen(
  p_code text, p_spieler integer, p_runde integer, p_key text, p_name text)
returns jsonb
language plpgsql
volatile
set search_path to 'public'
as $$
declare
  g public.games;
  st jsonb;
  t0 timestamptz;
  jetzt timestamptz := clock_timestamp();
  andere text := case when p_spieler = 1 then '2' else '1' end;
  antwort text;
begin
  if p_spieler not in (1, 2) or coalesce(p_key, '') = '' then
    return jsonb_build_object('ergebnis', 'unbekannt', 'jetzt', public.vier_iso(jetzt));
  end if;

  select * into g from public.games where code = p_code for update;
  jetzt := clock_timestamp();  -- nach dem Warten auf die Sperre
  if not found or g.board->>'kind' is distinct from 'vier' then
    return jsonb_build_object('ergebnis', 'unbekannt', 'jetzt', public.vier_iso(jetzt));
  end if;

  st := g.board->'stand';
  if g.status <> 'playing' or (st->>'runde')::int <> p_runde then
    antwort := 'vorbei';
  elsif st->>'start' is null or jetzt < (st->>'start')::timestamptz then
    antwort := 'noch_nicht';
  elsif jetzt > (st->>'start')::timestamptz + interval '31 seconds' then
    antwort := 'zu_spaet';
  elsif (st->'wahl') ? p_spieler::text then
    antwort := 'schon_gewaehlt';
  elsif st->'wahl'->andere->>'key' = p_key then
    antwort := 'vergeben';
  else
    update public.games
       set board = jsonb_set(board, array['stand', 'wahl', p_spieler::text],
                             jsonb_build_object('key', p_key, 'name', p_name, 'zeit', public.vier_iso(jetzt))),
           updated_at = now()
     where code = p_code;
    antwort := 'ok';
  end if;

  return jsonb_build_object('ergebnis', antwort, 'jetzt', public.vier_iso(jetzt));
end
$$;

-- Runde abschließen und die nächste starten — oder die Partie beenden. Idempotent
-- über die Rundennummer: Rufen beide Browser, zählt nur der erste. Geht erst, wenn
-- beide gewählt haben oder die Zeit um ist. Ob Schluss ist und wer gewonnen hat,
-- rechnen die Browser (src/vier.js spielEnde) — beide kommen auf dasselbe.
create or replace function public.vier_weiter(
  p_code text, p_runde integer, p_ende boolean, p_sieger integer)
returns boolean
language plpgsql
volatile
set search_path to 'public'
as $$
declare
  g public.games;
  st jsonb;
  verlauf jsonb;
begin
  select * into g from public.games where code = p_code for update;
  if not found or g.board->>'kind' is distinct from 'vier' or g.status <> 'playing' then return false; end if;

  st := g.board->'stand';
  if (st->>'runde')::int <> p_runde or st->>'start' is null then return false; end if;
  if not (((st->'wahl') ? '1' and (st->'wahl') ? '2')
          or clock_timestamp() >= (st->>'start')::timestamptz + interval '30 seconds') then
    return false;
  end if;

  verlauf := coalesce(st->'verlauf', '[]'::jsonb)
             || jsonb_build_array(jsonb_build_object('1', st->'wahl'->'1', '2', st->'wahl'->'2'));

  if p_ende then
    update public.games
       set board = jsonb_set(board, '{stand}', st || jsonb_build_object('verlauf', verlauf, 'wahl', '{}'::jsonb, 'ende', true)),
           status = 'finished',
           last_move = coalesce(last_move, '{}'::jsonb) || jsonb_build_object('winner', nullif(p_sieger, 0)),
           updated_at = now()
     where code = p_code;
  else
    update public.games
       set board = jsonb_set(board, '{stand}', jsonb_build_object(
             'runde', p_runde + 1,
             'start', public.vier_iso(clock_timestamp() + interval '3 seconds'),
             'wahl', '{}'::jsonb,
             'verlauf', verlauf,
             'ende', false)),
           updated_at = now()
     where code = p_code;
  end if;
  return true;
end
$$;

grant execute on function public.vier_jetzt() to anon, authenticated;
grant execute on function public.vier_starten(text) to anon, authenticated;
grant execute on function public.vier_waehlen(text, integer, integer, text, text) to anon, authenticated;
grant execute on function public.vier_weiter(text, integer, boolean, integer) to anon, authenticated;
