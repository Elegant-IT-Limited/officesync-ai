# officesync-ai

The AI pipeline behind OfficeSyncPro: Microsoft Graph mail and Teams transcripts turned into task suggestions, meeting summaries, follow-up reminders and meeting slots, every one of them waiting in a review queue until a person accepts it. This is the reference build for the case study at [eleganttechbd.com/works/officesyncpro-ai-microsoft-365-automation](https://eleganttechbd.com/works/officesyncpro-ai-microsoft-365-automation). Every code block and terminal capture on that page is generated from this repository.

Node 22, TypeScript strict, zod 4 contracts, Drizzle ORM on PostgreSQL, Jest. Models through OpenRouter with a fallback list per stage.

## Layout

```
sql/0001_ai_pipeline.sql   ai_items (claims), ai_suggestions (the review queue), ai_calls (the ledger)
src/ai/prefilter.ts        mail no model needs to read, decided from headers
src/ai/prepare.ts          the new part of a reply only: no quoted history, no signature
src/ai/openrouter.ts       one structured call: fallback list, strict JSON schema, no-retention providers, ledger
src/ai/triage.ts           kind, priority, needs reply, scheduling ask
src/ai/extract.ts          commitments, and the verifier that decides which survive
src/ai/due-date.ts         "by Friday" to a date, in the workspace time zone, never by a model
src/ai/meeting.ts          Teams transcript (WebVTT) to summary, decisions and action items
src/ai/followup.ts         threads that went quiet, counted in working days
src/ai/schedule.ts         plain-language request to Graph findMeetingTimes slots
src/ai/review.ts           the only path from a suggestion to a task
src/ai/pipeline.ts         one Graph change notification, end to end
scripts/trace.ts           the demo inbox through every stage
test/                      8 suites, 44 tests, PostgreSQL 17 in-process, no network
docs/decisions.md          why it is built this way
docs/captures/             terminal output the case study page is generated from
```

## Run it

```bash
npm install
npm test          # 44 tests, PostgreSQL 17 via PGlite, no network
npm run trace     # the demo inbox through every stage, with recorded model replies
```

No environment is needed for the tests or the trace. `.env.example` lists what a live deployment reads.

## What the tests prove

- Quoted history never becomes a task, and every suggestion waits for a person (`pipeline.spec.ts`)
- A redelivered Graph notification costs no model call
- Newsletters and automated mail never reach a model (`prepare.spec.ts`)
- An email cannot assign work to an address outside the thread and the workspace
- Deadlines resolve in the workspace time zone; ambiguous ones are asked, not guessed (`due-date.spec.ts`)
- Only slots Graph returned are offered; an ambiguous name stops the flow before Graph is called (`schedule.spec.ts`)
- A meeting decision nobody said is dropped (`meeting.spec.ts`)
- Reminders count working days only (`followup.spec.ts`)
- Fallbacks, retries and schema repair are recorded with the model that actually answered (`openrouter.spec.ts`)
- Accept is idempotent and scoped to one workspace (`review.spec.ts`)

Model replies are recorded payloads in `test/recorded.ts`, in the shape OpenRouter returns. Graph's `findMeetingTimes` is recorded too.

## License

MIT. See `LICENSE`.
