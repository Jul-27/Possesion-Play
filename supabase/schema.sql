-- =====================================================================
--  Possession Play – Supabase-Schema für Online-Multiplayer
--  Im Supabase-Dashboard unter "SQL Editor" einfügen und ausführen.
-- =====================================================================

create table if not exists public.games (
    code        text primary key,            -- 6-stelliger Raumcode
    board       jsonb not null,              -- 31 Felder als [{t,k}, ...]
    owners      jsonb not null default '{}', -- { "<feldindex>": 1|2 }
    turn        int  not null default 1,     -- wer am Zug ist (1|2)
    status      text not null default 'waiting', -- waiting | playing | finished
    host_id     text not null,               -- Client-ID Spieler 1
    guest_id    text,                         -- Client-ID Spieler 2
    names       jsonb not null default '{"1":"Spieler 1","2":"Spieler 2"}',
    last_move   jsonb,                        -- letzter Zug (für Anzeige/Animation)
    created_at  timestamptz default now(),
    updated_at  timestamptz default now()
);

-- Realtime braucht vollständige Zeilen bei UPDATE
alter table public.games replica identity full;

-- ---------- Row Level Security ----------------------------------------
-- Bewusst offen gehalten (Spiel unter Freunden, kein Login). Jeder mit dem
-- anon-Key darf Spiele lesen/erstellen/aktualisieren. Zum Verschärfen später
-- z.B. an Supabase-Auth koppeln und Policies auf host_id/guest_id einschränken.
alter table public.games enable row level security;

drop policy if exists "games select" on public.games;
drop policy if exists "games insert" on public.games;
drop policy if exists "games update" on public.games;

create policy "games select" on public.games for select using (true);
create policy "games insert" on public.games for insert with check (true);
create policy "games update" on public.games for update using (true) with check (true);

-- ---------- Realtime aktivieren ---------------------------------------
-- Tabelle der Realtime-Publication hinzufügen (ignoriert Fehler, falls schon drin).
do $$
begin
  alter publication supabase_realtime add table public.games;
exception when duplicate_object then null;
end $$;

-- Optional: alte Spiele automatisch aufräumen kannst du später per Cron/Edge Function.
