-- mail: every Graph item the pipeline has seen. The unique key makes a redelivered
-- change notification a no-op instead of a second round of model calls.
create table ai_items (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  source          text not null check (source in ('email', 'meeting')),
  source_id       text not null,
  conversation_id text,
  kind            text,
  priority        text,
  needs_reply     boolean,
  skipped_reason  text,
  processed_at    timestamptz not null default now(),
  unique (tenant_id, source, source_id)
);
