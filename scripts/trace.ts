// Replays the demo inbox through the pipeline and prints what each stage decided.
// Model replies are the recorded ones from test/support/recorded.ts, so the run is deterministic and offline.
import 'reflect-metadata';
import { sql } from 'drizzle-orm';
import { MailService } from '../src/modules/mail/mail.service';
import { MeetingsService } from '../src/modules/meetings/meetings.service';
import { SchedulingService } from '../src/modules/scheduling/scheduling.service';
import { testApp } from '../test/support/app';
import { clientThread, ctx, DANA, injection, invoicePaid, kickoffVtt, newsletter, OMAR, PRIYA } from '../test/support/fixtures';
import { fakeOpenRouter, GRAPH_SUGGESTIONS } from '../test/support/recorded';

const c = (n: number) => (s: string) => `\x1b[${n}m${s}\x1b[0m`;
const dim = c(2), bold = c(1), green = c(32), yellow = c(33), cyan = c(36), red = c(31), mag = c(35);
const short = (m: string) => m.replace(/^~?[a-z-]+\//, '');

async function main() {
  const or = fakeOpenRouter();
  const { db, get } = await testApp({ fetch: or.fetch, graph: { findMeetingTimes: async () => GRAPH_SUGGESTIONS } });
  const [mail, meetings, scheduling] = [get(MailService), get(MeetingsService), get(SchedulingService)];
  const w = ctx();
  const name = (email: string | null) => w.members.find((m) => m.email === email)?.name.split(' ')[0] ?? dim('unassigned');

  console.log(bold('officesync-ai') + dim(`  replay  workspace ${w.tenantId.slice(0, 8)}  tz ${w.timeZone}  models via OpenRouter (recorded)`) + '\n');
  for (const msg of [newsletter, invoicePaid, clientThread, injection]) {
    const t = await mail.processEmail(w, msg);
    console.log(`${cyan(msg.id.slice(6, 14))}  ${bold(msg.subject)}  ${dim(msg.from.emailAddress.address)}`);
    if (t.outcome === 'skipped') { console.log(`  ${dim('prefilter')}  skipped: ${t.skippedReason}  ${dim('0 model calls')}\n`); continue; }
    console.log(`  ${dim('triage   ')}  ${t.triage!.kind} · ${t.triage!.priority}${t.triage!.needsReply ? ' · needs reply' : ''}${t.schedulingAsk ? ' · scheduling ask' : ''}  ${dim(short(t.triage!.model))}`);
    if (t.extraction) {
      console.log(`  ${dim('extract  ')}  ${t.extraction.kept} kept, ${t.extraction.dropped.length} dropped  ${dim(short(t.extraction.model))}`);
      for (const s of t.suggestions) console.log(`    ${green('+')} ${s.title}  ${dim('→')} ${name(s.owner)}${s.due ? dim('  due ') + s.due : ''}${s.flags.length ? '  ' + yellow(s.flags.join(',')) : ''}`);
      for (const d of t.extraction.dropped) console.log(`    ${red('-')} ${d.title}  ${dim(d.reason)}`);
    }
    console.log('');
  }

  const m = await meetings.summarise(w, 'mtg-kickoff', kickoffVtt, [DANA, OMAR, PRIYA], new Date('2026-09-22T15:00:00Z'));
  await meetings.queue(w, 'mtg-kickoff', m);
  console.log(`${cyan('teams   ')}  ${bold('Phase 2 kickoff')}  ${dim('transcript, 7 turns')}`);
  for (const d of m.decisions) console.log(`  ${mag('decided')}  ${d.text}`);
  for (const a of m.actions) console.log(`    ${green('+')} ${a.title}  ${dim('→')} ${w.members.find((x) => x.id === a.ownerId)?.name.split(' ')[0] ?? 'unassigned'}${a.due ? dim('  due ') + a.due : ''}`);
  for (const d of m.dropped) console.log(`    ${red('-')} ${d}  ${dim('not said in the meeting')}`);
  console.log('');

  const s = await scheduling.proposeSlots(w, 'Also, can we find 30 minutes next week with you and Omar to review the timeline?', DANA);
  console.log(`${cyan('schedule')}  ${bold('"30 minutes next week with you and Omar"')}  ${dim('free/busy from Graph findMeetingTimes')}`);
  if (s.status === 'slots') for (const x of s.slots) console.log(`    ${green('○')} ${new Date(x.start.dateTime.slice(0, 19) + 'Z').toUTCString().slice(0, 22).replace(' 2026', '')} ET`);
  console.log('');

  const q = await db.execute(sql`select count(*)::int as n from ai_suggestions where status = 'pending'`);
  const cost = await db.execute(sql`select count(*)::int as calls, sum(cost_usd)::float as usd from ai_calls`);
  const row = (q as any).rows[0], k = (cost as any).rows[0];
  console.log(`${bold('review queue')}  ${row.n} pending  ${dim('· 0 tasks created until a person accepts')}`);
  console.log(`${bold('ledger      ')}  ${k.calls} model calls  ${dim('$' + k.usd.toFixed(4) + ' total, recorded prices')}`);
}
main();
