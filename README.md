# officesync-ai

The AI pipeline behind OfficeSyncPro: Microsoft Graph mail and Teams transcripts turned into task suggestions, meeting summaries, follow-up reminders and meeting slots, every one of them waiting in a review queue until a person accepts it. This is the reference build for the case study at [eleganttechbd.com/works/officesyncpro-ai-microsoft-365-automation](https://eleganttechbd.com/works/officesyncpro-ai-microsoft-365-automation). Every code block and terminal capture on that page is generated from this repository.

Node 22, TypeScript strict, NestJS 11, zod 4 contracts, Drizzle ORM on PostgreSQL, BullMQ for the Graph notification queue, Jest. Models through OpenRouter with a fallback list per stage.

## Layout

A modular monolith. Each module owns its tables and exposes a service; other modules call that service and never import its repository or table. The rule is checked in CI by dependency-cruiser (`.dependency-cruiser.cjs`).

```
migrations/<module>/        SQL migrations, one folder per owning module, applied in numeric order
src/
├── main.ts                 composition root: reads the environment, binds the real clients, starts HTTP and workers
├── app.module.ts           registers the feature modules
├── core/                   config, tenant context, session guard, domain errors, shared date and text rules
├── db/                     the Drizzle client, the table barrel, the migration runner
├── integrations/
│   ├── openrouter/         one structured call: fallback list, strict schema, retries, schema repair
│   ├── microsoft-graph/    Graph message types and findMeetingTimes
│   └── officesyncpro/      the product's internal API: workspace members, task creation
├── workers/                the BullMQ processor for Graph change notifications
└── modules/
    ├── ai/                 the single entry point for model calls: routes, injection guard, ledger
    ├── mail/               prefilter, prepare, triage, and the email pipeline
    ├── extraction/         commitments, and the verifier that decides which survive
    ├── meetings/           Teams transcript (WebVTT) to summary, decisions and action items
    ├── followups/          threads that went quiet, counted in working days
    ├── scheduling/         plain-language request to Graph findMeetingTimes slots
    └── review/             the queue every lane proposes into, its HTTP routes, and the only path from a suggestion to a task
test/                       mirrors src: core/, integrations/, modules/<module>/, and support/ for fixtures and recorded replies
scripts/                    trace (the demo inbox through every stage) and migrate
docs/decisions.md           why it is built this way
docs/captures/              terminal output the case study page is generated from
```

Inside a module the files follow one naming scheme: `*.module.ts`, `*.service.ts` (the only thing other modules import), `*.repository.ts` (database access, no rules), `*.table.ts` (Drizzle table, mirroring its migration), `*.contract.ts` (the zod schema a model must answer in), and `*.controller.ts` / `*.dto.ts` where the module has routes.

## Run it

```bash
npm ci
npm test          # 48 tests across 8 suites, PostgreSQL 17 via PGlite, no network
npm run trace     # the demo inbox through every stage, with recorded model replies
npm run lint:deps # module boundaries
```

No environment is needed for the tests or the trace. A live deployment reads `.env.example`: Postgres, Redis, an OpenRouter key and the OfficeSyncPro internal API. Run `npm run migrate` before the first start, then `npm run build && npm start`.

Routes: `GET /api/internal/suggestions`, `POST /api/internal/suggestions/:id/accept`, `POST /api/internal/suggestions/:id/dismiss`, all behind a session token.

## What the tests prove

- Quoted history never becomes a task, and every suggestion waits for a person (`test/modules/mail/pipeline.spec.ts`)
- A redelivered Graph notification costs no model call, whether it arrives during the first run or after it, and a message whose first attempt failed is finished by the retry, not dropped
- Newsletters and automated mail never reach a model (`test/modules/mail/prepare.spec.ts`)
- An email cannot assign work to an address outside the thread and the workspace
- Deadlines resolve in the workspace time zone; ambiguous ones are asked, not guessed (`test/core/dates.spec.ts`)
- Only slots Graph returned are offered; an ambiguous name stops the flow before Graph is called (`test/modules/scheduling/`)
- A meeting decision nobody said is dropped (`test/modules/meetings/`)
- Reminders count working days only, and a quiet thread is queued once however often the check runs (`test/modules/followups/`)
- Fallbacks, retries and schema repair are recorded with the model that actually answered (`test/integrations/openrouter.spec.ts`)
- Accept is idempotent, scoped to one workspace, and refused for suggestion types this service does not act on; the routes take tenant and user from the signed session only (`test/modules/review/`)

Service tests compile the real Nest module graph with recorded clients bound at the edges, so they also prove the dependency wiring resolves. Model replies are recorded payloads in `test/support/recorded.ts`, in the shape OpenRouter returns. Graph's `findMeetingTimes` is recorded too.

## License

MIT. See `LICENSE`.
