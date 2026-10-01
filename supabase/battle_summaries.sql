-- HİLAL savaş özetleri (Supabase hilal-oyun projesi). Oyuncu sonuç ekranında
-- EVET dediyse her savaşın sonunda tek satır gelir (bkz. src/telemetry/remote.ts).
-- İstemci yayımlanabilir anahtarla yalnızca ekler: okuma, düzeltme, silme yok.

create table public.battle_summaries (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  commander text not null check (commander in ('metehan', 'alp-arslan', 'kilicarslan')),
  outcome text not null check (outcome in ('victory', 'defeat', 'abandoned', 'quit')),
  stars smallint not null check (stars between 0 and 3),
  -- Bir savaşın özeti birkaç KB; sınır kötü niyetli büyük gövdeleri keser.
  summary jsonb not null check (pg_column_size(summary) <= 32768)
);

alter table public.battle_summaries enable row level security;

create policy "anonim ekleme" on public.battle_summaries
  for insert to anon with check (true);

revoke all on public.battle_summaries from anon, authenticated;
grant insert on public.battle_summaries to anon;
