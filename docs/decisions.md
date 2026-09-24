# Decisions

Short records of the choices that shaped this pipeline, and what would have to change for us to revisit them.

## 1. The model proposes, code decides

Every stage that calls a model returns a proposal: a classification, a list of commitments, a summary, a parsed scheduling request. None of those become anything in the product until code has checked them and a person has accepted them. The verifier in `src/ai/extract.ts` drops any commitment whose quote is not in the new part of the message, and clears any owner who is neither on the thread nor in the workspace. `src/ai/review.ts` is the only path that creates a task.

We chose this over trusting model output because the failure mode of a wrong task in a client-facing CRM is trust, not a bug report. A dropped suggestion costs nothing. A wrong one costs the feature.

## 2. Dates are resolved in code, in the workspace time zone

The model copies the phrase a person wrote ("by Friday", "end of week"). `src/ai/due-date.ts` turns it into a date relative to when the message was sent, in the workspace's zone. Anything ambiguous ("next Tuesday") is left unresolved and flagged, so the task keeps the words and asks.

Models are unreliable at calendar arithmetic, and a wrong deadline is the most visible kind of wrong. A 60-line function with a table of tests is cheaper than a prompt that mostly works.

## 3. Read the new part of a reply only

`src/ai/prepare.ts` cuts quoted history and signatures before anything is embedded or sent to a model. Quoted history is an earlier message in the same conversation that has already been processed. Reading it again produces duplicate tasks, and it is the most common way an extraction model "finds" a commitment that is not really in the email.

## 4. Prefilter from headers before any model call

`List-Unsubscribe`, `Auto-Submitted`, `Precedence: bulk`, automated senders and calendar responses are skipped from headers alone. In a working inbox this is the largest share of mail. Skipping it before a model sees it is the single biggest cost lever, and it keeps newsletter content out of any provider's request log.

## 5. One review queue for every lane

Email, Teams transcripts, quiet threads and scheduling requests all produce rows in `ai_suggestions` with the same shape and the same three actions. The product learns one AI feature, not four. Adding a lane means adding a producer, not a UI.

## 6. OpenRouter with a fallback list, strict schemas and no-retention providers

Each stage names its models in priority order (`ROUTES` in `src/ai/openrouter.ts`). OpenRouter falls back when a provider is down or rate limited, so a single vendor outage does not stop the pipeline, and swapping a model is a config change. Every request sets `provider.data_collection = "deny"` so it is only routed to providers that do not store or train on prompts, and `require_parameters = true` so a provider that cannot honour the strict JSON schema is never picked.

We considered Microsoft's Copilot APIs. They answer only for users with a Copilot add-on license, and most OfficeSyncPro workspaces are small teams without one. Building on OpenRouter gives every seat the same AI.

## 7. At-least-once delivery is handled at the first write

Microsoft Graph redelivers change notifications. `processEmail` claims the message by its Graph id with an `ON CONFLICT DO NOTHING` insert before doing anything else. A redelivery finds the claim and stops before a token is spent. Suggestions are keyed on the source sentence for the same reason.

## 8. Tests never touch the network

Model replies are recorded payloads in `test/recorded.ts`, in the exact shape OpenRouter returns. Graph's `findMeetingTimes` is a recorded response too. The database is a real PostgreSQL 17 running in-process through PGlite. This keeps CI deterministic and fast, and means a test failure is always ours.
