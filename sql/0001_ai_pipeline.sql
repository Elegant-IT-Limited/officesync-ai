-- Every Graph item the pipeline has seen. The unique key makes a redelivered
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

-- The review queue. Nothing in here exists in the product until a person accepts it.
create table ai_suggestions (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  item_id         uuid references ai_items(id) on delete cascade,
  type            text not null check (type in ('task', 'summary', 'reminder', 'slots')),
  payload         jsonb not null,
  evidence        text,
  flags           text[] not null default '{}',
  dedup_key       text not null,
  status          text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed')),
  decided_by      uuid,
  decided_at      timestamptz,
  created_task_id uuid,
  created_at      timestamptz not null default now(),
  unique (tenant_id, dedup_key)
);
create index ai_suggestions_queue on ai_suggestions (tenant_id, status, created_at desc);

-- One row per model call: which model OpenRouter actually served, tokens, cost.
create table ai_calls (
  id                bigserial primary key,
  tenant_id         uuid not null,
  stage             text not null,
  model_used        text not null,
  prompt_tokens     int not null default 0,
  completion_tokens int not null default 0,
  cost_usd          numeric(10, 6) not null default 0,
  attempts          int not null default 1,
  created_at        timestamptz not null default now()
);
