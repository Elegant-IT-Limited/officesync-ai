export interface Turn { speaker: string; text: string; at: string }

/**
 * Teams transcripts arrive from Graph as WebVTT with <v Speaker> voice tags.
 * Consecutive cues by one speaker become one turn, so a sentence split across
 * two cues is still one quote the verifier can find.
 */
export function parseVtt(vtt: string): Turn[] {
  const turns: Turn[] = [];
  const cue = /(\d{2}:\d{2}:\d{2})\.\d{3} --> [^\n]+\n<v ([^>]+)>([\s\S]*?)<\/v>/g;
  for (const m of vtt.matchAll(cue)) {
    const [, at, speaker, text] = m as unknown as [string, string, string, string];
    const last = turns[turns.length - 1];
    if (last && last.speaker === speaker) last.text += ' ' + text.trim();
    else turns.push({ speaker, text: text.trim(), at });
  }
  return turns;
}
