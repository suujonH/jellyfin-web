/** A cue of a subtitle, as the server sends a subtitle in JSON. */
export interface TrackEvent {
    StartPositionTicks: number;
    EndPositionTicks: number;
    Text: string;
}

const TICKS_PER_SECOND = 10000000;
const CUE_TIMING = /^((?:\d+:)?\d{2}:\d{2}\.\d{3})\s+-->\s+((?:\d+:)?\d{2}:\d{2}\.\d{3})/;

const toTicks = (timestamp: string) => Math.round(
    timestamp.split(':').reduce((seconds, part) => seconds * 60 + Number(part), 0) * TICKS_PER_SECOND
);

/**
 * Parses a WebVTT file into the track events the server sends for a subtitle in JSON.
 * The blocks that are not cues, such as the header, notes and styles, are left out; the text of a cue is kept as it is.
 * @param text The WebVTT file.
 * @returns The track events, in the order of the file.
 */
export function parseWebVtt(text: string): { TrackEvents: TrackEvent[] } {
    const events: TrackEvent[] = [];
    for (const block of text.replace(/\r\n?/g, '\n').trim().split(/\n{2,}/)) {
        const lines = block.split('\n');
        // The timing is the first line of a cue, or the second after its identifier.
        const timing = lines.findIndex(line => line.includes('-->'));
        const match = timing === 0 || timing === 1 ? CUE_TIMING.exec(lines[timing].trim()) : null;
        if (match) {
            events.push({
                StartPositionTicks: toTicks(match[1]),
                EndPositionTicks: toTicks(match[2]),
                Text: lines.slice(timing + 1).join('\n')
            });
        }
    }

    return { TrackEvents: events };
}
