-- review: the queue. Nothing in here exists in the product until a person accepts it.
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
  -- the same sentence can only ever be suggested once per workspace
  unique (tenant_id, dedup_key)
);
-- the queue view: one workspace, pending first, newest first
create index ai_suggestions_queue on ai_suggestions (tenant_id, status, created_at desc);
