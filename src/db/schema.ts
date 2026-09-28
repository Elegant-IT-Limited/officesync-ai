// Every table, for the typed Drizzle client. Each module owns its own table file;
// this barrel exists only so the client knows them all.
export { aiCalls } from '../modules/ai/ai.table';
export { aiItems } from '../modules/mail/mail.table';
export { aiSuggestions } from '../modules/review/review.table';
