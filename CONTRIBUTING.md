# Contributing

Thanks for taking the time. This repository is the reference build behind a published case study, so the bar is: every change keeps the tests green and keeps the code readable by someone who has never seen it.

## Before you start

You need Node 22 or newer. Nothing else: the tests run PostgreSQL 17 in-process through PGlite and every model or Graph reply is recorded.

```bash
npm ci
npm run typecheck
npm run lint:deps
npm test
npm run trace
```

## Where things go

- A new table is a new file under `migrations/<module>/` with the next number, plus a `*.table.ts` in that module that mirrors it. The SQL is the source of truth.
- Database access lives in the module's `*.repository.ts`. Rules live in `*.service.ts`. Controllers validate, call a service and return; nothing else.
- Another module's data is reached through its service, never its repository or table. `npm run lint:deps` fails the build otherwise.
- A new outside system is an adapter in `src/integrations/`, behind an interface and an injection token, and adapters never import from `src/modules/`.
- Every model call goes through `AiService` in `src/modules/ai/`, with a zod contract. No module calls OpenRouter directly.
- Inject class dependencies with `@Inject(TheClass)`, not by type alone. esbuild-based runners such as tsx do not emit decorator metadata, and the explicit token keeps `npm run trace` and the compiled app wired the same way.

## Sending a change

1. Open an issue first if the change is more than a fix, so we can agree on the shape.
2. Branch from `main`. One change per pull request.
3. Add or update a test for any behaviour you change. Recorded replies live in `test/support/recorded.ts`; add a new one rather than loosening an assertion.
4. Run `npm run typecheck`, `npm run lint:deps` and `npm test`. CI runs the same, plus the production build.
5. Write the commit message as a short imperative subject, then a body that says why. The history in this repository shows the style.

## What we will not merge

- A change that makes any test depend on the network or a live API key.
- A change that creates a task, reminder or invite without a person accepting it in the review queue.
- A change that lets a model choose an owner, a date or a meeting slot without the verifier or Graph confirming it.
