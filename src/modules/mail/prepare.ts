import type { GraphMessage } from '../../integrations/microsoft-graph/graph.types';

const ENTITIES: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&rsquo;': "'", '&lsquo;': "'", '&ldquo;': '"', '&rdquo;': '"' };

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? ' ');
}

// Where the new part of a reply ends. Outlook, Gmail and Apple Mail each mark it differently.
const QUOTE_START = [
  /^On .{6,120} wrote:\s*$/,          // Gmail, Apple Mail
  /^-{2,}\s*Original Message\s*-{2,}/i, // older Outlook
  /^From: .+$/,                        // Outlook desktop and web, when followed by Sent:
  /^_{10,}$/,                          // Outlook separator line
];
const SIGNATURE = [/^--\s*$/, /^Sent from my (iPhone|iPad|Android)/i, /^Get Outlook for (iOS|Android)/i];

/**
 * The text a model sees and every quote is checked against: the new part of the
 * message only, without quoted history or signature. Quoted history is already an
 * earlier message in the same conversation, so reading it again would extract the
 * same commitments twice.
 */
export function prepare(msg: GraphMessage): { text: string; participants: string[] } {
  const raw = msg.body.contentType === 'html' ? htmlToText(msg.body.content) : msg.body.content;
  const lines = raw.replace(/\r/g, '').split('\n');
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? '').trimEnd();
    if (line.startsWith('>')) break;
    if (QUOTE_START.some((re) => re.test(line.trim()))) {
      if (!line.trim().startsWith('From:') || /^Sent:/.test((lines[i + 1] ?? '').trim())) break;
    }
    if (SIGNATURE.some((re) => re.test(line.trim()))) break;
    kept.push(line);
  }
  const text = kept.join('\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
  const participants = [msg.from.emailAddress, ...msg.toRecipients.map((r) => r.emailAddress), ...msg.ccRecipients.map((r) => r.emailAddress)]
    .map((a) => a.address.toLowerCase());
  return { text, participants: [...new Set(participants)] };
}
