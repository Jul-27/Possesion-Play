-- Bestenliste im Freundeskreis (angewandt am 25.07.2026)
--
-- Zugriff läuft AUSSCHLIESSLICH über die Funktionen unten. Die Tabellen haben RLS an
-- und bewusst KEINE Policies — damit ist über die REST-API kein direkter Tabellenzugriff
-- möglich. Sonst könnte jeder mit dem öffentlichen Schlüssel sämtliche Gruppen auslesen
-- und der Gruppencode wäre bloße Verschleierung statt Schutz.
--
-- Restschwäche, bewusst in Kauf genommen: Ohne Anmeldung lässt sich nicht prüfen, ob ein
-- gemeldetes Ergebnis wirklich erspielt wurde, und lb_create_group ist ohne Begrenzung
-- aufrufbar. Für einen privaten Freundeskreis vertretbar; für eine öffentliche Rangliste
-- bräuchte es Anmeldung und serverseitige Prüfung.

create table if not exists public.lb_groups (
  code       text primary key,
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.lb_entries (
  group_code   text not null references public.lb_groups(code) on delete cascade,
  client_id    text not null,
  display_name text not null,
  mode         text not null,
  day          date not null,
  score        integer not null,
  detail       jsonb,
  created_at   timestamptz not null default now(),
  -- ein Eintrag je Person, Modus und Tag: verhindert Hochtreiben durch Wiederholen
  primary key (group_code, client_id, mode, day)
);

create index if not exists lb_entries_lookup on public.lb_entries (group_code, mode, day);

alter table public.lb_groups  enable row level security;
alter table public.lb_entries enable row level security;

-- Funktionen: siehe Migration leaderboard_functions
-- lb_create_group(name) -> code | lb_group_name(code) | lb_submit(...) | lb_top(code, mode, day)
