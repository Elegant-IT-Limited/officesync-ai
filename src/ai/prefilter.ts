import type { GraphMessage } from './types';

/**
 * Mail no model needs to read. Checked from headers and sender before anything is
 * sent anywhere: in a normal inbox this is the largest share of messages, and every
 * one skipped here is a model call that never happens.
 */
export function prefilter(msg: GraphMessage): string | null {
  const h = new Map((msg.internetMessageHeaders ?? []).map((x) => [x.name.toLowerCase(), x.value.toLowerCase()]));
  const from = msg.from.emailAddress.address.toLowerCase();
  if (h.has('list-unsubscribe') || h.has('list-id')) return 'mailing_list';
  const auto = h.get('auto-submitted');
  if (auto && auto !== 'no') return 'auto_submitted';
  if (['bulk', 'list', 'junk'].includes(h.get('precedence') ?? '')) return 'bulk';
  if (/^(no-?reply|do-?not-?reply|mailer-daemon|postmaster|notifications?)@/.test(from)) return 'automated_sender';
  if (/^(accepted|declined|tentative|canceled|cancelled):/i.test(msg.subject.trim())) return 'calendar_response';
  return null;
}
