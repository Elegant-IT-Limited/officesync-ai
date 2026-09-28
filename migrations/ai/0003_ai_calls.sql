-- ai: one row per model call, with the model OpenRouter actually served, tokens and cost.
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
