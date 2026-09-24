# Contributing

Thanks for taking the time. This repository is the reference build behind a published case study, so the bar is: every change keeps the tests green and keeps the code readable by someone who has never seen it.

## Before you start

You need Node 22 or newer. Nothing else: the tests run PostgreSQL 17 in-process through PGlite and every model or Graph reply is recorded.

```bash
npm install
npm run typecheck
npm test
npm run trace
```

## Sending a change

1. Open an issue first if the change is more than a fix, so we can agree on the shape.
2. Branch from `main`. One change per pull request.
3. Add or update a test for any behaviour you change. Recorded replies live in `test/recorded.ts`; add a new one rather than loosening an assertion.
4. Run `npm run typecheck` and `npm test`. CI runs the same.
5. Write the commit message as a short imperative subject, then a body that says why. The history in this repository shows the style.

## What we will not merge

- A change that makes any test depend on the network or a live API key.
- A change that creates a task, reminder or invite anywhere other than `src/ai/review.ts`.
- A change that lets a model choose an owner, a date or a meeting slot without the verifier or Graph confirming it.
