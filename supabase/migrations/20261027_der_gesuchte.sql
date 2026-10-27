-- „Der Gesuchte" als Duell: Schiedsrichter in der Datenbank (27.10.2026)
--
-- Beide sehen dasselbe Brett, alle 12 Sekunden kommt derselbe Hinweis, nach 90
-- Sekunden ist die Runde vorbei. Wer zuerst richtig rät, gewinnt sie; zwei
-- Rundensiege gewinnen das Spiel, eine Runde ohne Sieger wird mit neuem Brett
-- wiederholt. Ob „zuerst" stimmt, entscheidet diese Funktion — mit gesperrter Zeile
-- und der Uhr der Datenbank, wie bei „Vier Wappen" (vier_iso, vier_jetzt).
--
-- Der Stand liegt in games.board.stand (siehe src/gesuchtDuell.js):
--   { runde, start, sieger, fehler: {"1","2"}, sperre: {"1","2"}, siege: {"1","2"},
--     verlauf: [{ sieger, ziel }], ende }

create or replace function public.gesucht_starten(p_code text)
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
     and board->>'kind' = 'gesucht'
     and board->'stand'->>'start' is null
$$;

-- Ist die laufende Runde vorbei? Sieger gesetzt, Zeit um, oder beide ohne Versuche.
create or replace function public.gesucht_vorbei(st jsonb, jetzt timestamptz)
returns boolean
language sql
immutable
set search_path to 'public'
as $$
  select st->>'sieger' is not null
      or (st->>'start' is not null and jetzt >= (st->>'start')::timestamptz + interval '90 seconds')
      or (coalesce((st->'fehler'->>'1')::int, 0) >= 3 and coalesce((st->'fehler'->>'2')::int, 0) >= 3)
$$;

-- Raten. Antwort { ergebnis, jetzt }, ergebnis ∈
--   richtig | falsch | gesperrt | keine_versuche | vorbei | noch_nicht | unbekannt
create or replace function public.gesucht_raten(p_code text, p_spieler integer, p_runde integer, p_key text)
returns jsonb
language plpgsql
volatile
set search_path to 'public'
as $$
declare
  g public.games;
  st jsonb;
  ziel text;
  jetzt timestamptz;
  s text := p_spieler::text;
  fehler int;
begin
  if p_spieler not in (1, 2) or coalesce(p_key, '') = '' then
    return jsonb_build_object('ergebnis', 'unbekannt', 'jetzt', public.vier_iso(clock_timestamp()));
  end if;
  select * into g from public.games where code = p_code for update;
  jetzt := clock_timestamp();
  if not found or g.board->>'kind' is distinct from 'gesucht' then
    return jsonb_build_object('ergebnis', 'unbekannt', 'jetzt', public.vier_iso(jetzt));
  end if;
  st := g.board->'stand';
  if g.status <> 'playing' or (st->>'runde')::int <> p_runde or public.gesucht_vorbei(st, jetzt) then
    return jsonb_build_object('ergebnis', 'vorbei', 'jetzt', public.vier_iso(jetzt));
  end if;
  if st->>'start' is null or jetzt < (st->>'start')::timestamptz then
    return jsonb_build_object('ergebnis', 'noch_nicht', 'jetzt', public.vier_iso(jetzt));
  end if;
  fehler := coalesce((st->'fehler'->>s)::int, 0);
  if fehler >= 3 then
    return jsonb_build_object('ergebnis', 'keine_versuche', 'jetzt', public.vier_iso(jetzt));
  end if;
  if st->'sperre'->>s is not null and jetzt < (st->'sperre'->>s)::timestamptz then
    return jsonb_build_object('ergebnis', 'gesperrt', 'jetzt', public.vier_iso(jetzt));
  end if;

  ziel := g.board->'runden'->p_runde->>'ziel';
  if p_key = ziel then
    st := st || jsonb_build_object('sieger', p_spieler, 'endzeit', public.vier_iso(jetzt),
            'siege', coalesce(st->'siege', '{}'::jsonb) || jsonb_build_object(s, coalesce((st->'siege'->>s)::int, 0) + 1));
    update public.games set board = jsonb_set(board, '{stand}', st), updated_at = now() where code = p_code;
    return jsonb_build_object('ergebnis', 'richtig', 'jetzt', public.vier_iso(jetzt));
  end if;

  st := st || jsonb_build_object(
    'fehler', coalesce(st->'fehler', '{}'::jsonb) || jsonb_build_object(s, fehler + 1),
    'sperre', coalesce(st->'sperre', '{}'::jsonb) || jsonb_build_object(s, public.vier_iso(jetzt + interval '10 seconds')));
  -- Haben jetzt beide keine Versuche mehr, ist die Runde hier zu Ende.
  if public.gesucht_vorbei(st, jetzt) then st := st || jsonb_build_object('endzeit', public.vier_iso(jetzt)); end if;
  update public.games set board = jsonb_set(board, '{stand}', st), updated_at = now() where code = p_code;
  return jsonb_build_object('ergebnis', 'falsch', 'jetzt', public.vier_iso(jetzt));
end
$$;

-- Nächste Runde oder Abpfiff. Idempotent über die Rundennummer; geht erst, wenn die
-- Runde vorbei ist. Wer zwei Runden gewonnen hat, gewinnt; sind die vorbereiteten
-- Bretter aufgebraucht, entscheidet die Zahl der Rundensiege (sonst unentschieden).
create or replace function public.gesucht_weiter(p_code text, p_runde integer)
returns boolean
language plpgsql
volatile
set search_path to 'public'
as $$
declare
  g public.games;
  st jsonb;
  jetzt timestamptz := clock_timestamp();
  s1 int; s2 int;
  sieger int;
  verlauf jsonb;
  bretter int;
begin
  select * into g from public.games where code = p_code for update;
  if not found or g.board->>'kind' is distinct from 'gesucht' or g.status <> 'playing' then return false; end if;
  st := g.board->'stand';
  if (st->>'runde')::int <> p_runde or not public.gesucht_vorbei(st, jetzt) then return false; end if;

  s1 := coalesce((st->'siege'->>'1')::int, 0);
  s2 := coalesce((st->'siege'->>'2')::int, 0);
  verlauf := coalesce(st->'verlauf', '[]'::jsonb)
             || jsonb_build_array(jsonb_build_object('sieger', st->'sieger', 'ziel', g.board->'runden'->p_runde->>'ziel'));
  bretter := jsonb_array_length(g.board->'runden');

  if s1 >= 2 or s2 >= 2 or p_runde + 1 >= bretter then
    sieger := case when s1 > s2 then 1 when s2 > s1 then 2 else null end;
    update public.games
       set board = jsonb_set(board, '{stand}', st || jsonb_build_object('verlauf', verlauf, 'ende', true)),
           status = 'finished',
           last_move = coalesce(last_move, '{}'::jsonb) || jsonb_build_object('winner', sieger),
           updated_at = now()
     where code = p_code;
  else
    update public.games
       set board = jsonb_set(board, '{stand}', jsonb_build_object(
             'runde', p_runde + 1,
             'start', public.vier_iso(jetzt + interval '3 seconds'),
             'sieger', null, 'fehler', '{}'::jsonb, 'sperre', '{}'::jsonb,
             'siege', jsonb_build_object('1', s1, '2', s2),
             'verlauf', verlauf, 'ende', false)),
           updated_at = now()
     where code = p_code;
  end if;
  return true;
end
$$;

grant execute on function public.gesucht_starten(text) to anon, authenticated;
grant execute on function public.gesucht_raten(text, integer, integer, text) to anon, authenticated;
grant execute on function public.gesucht_weiter(text, integer) to anon, authenticated;
