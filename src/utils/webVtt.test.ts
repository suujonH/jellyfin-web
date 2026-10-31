import { describe, expect, it } from 'vitest';

import { parseWebVtt } from './webVtt';

describe('parseWebVtt', () => {
    it('Should give the cues as track events', () => {
        const text = 'WEBVTT\r\nX-TIMESTAMP-MAP=MPEGTS:0,LOCAL:00:00:00.000\r\n\r\n'
            + '00:00:01.500 --> 00:00:03.000\r\nHello\r\n\r\n'
            + 'cue-2\r\n01:02:03.004 --> 01:02:05.000 line:90%\r\n<i>Two</i>\r\nlines\r\n';

        expect(parseWebVtt(text).TrackEvents).toEqual([
            { StartPositionTicks: 15000000, EndPositionTicks: 30000000, Text: 'Hello' },
            { StartPositionTicks: 37230040000, EndPositionTicks: 37250000000, Text: '<i>Two</i>\nlines' }
        ]);
    });

    it('Should read a timestamp without hours', () => {
        expect(parseWebVtt('WEBVTT\n\n00:10.000 --> 01:00.250\nShort').TrackEvents).toEqual([
            { StartPositionTicks: 100000000, EndPositionTicks: 602500000, Text: 'Short' }
        ]);
    });

    it('Should leave out the blocks that are not cues', () => {
        const text = 'WEBVTT\n\nNOTE a note\n\nSTYLE\n::cue { color: yellow }\n\n00:00:00.000 --> 00:00:01.000\nOnly';

        expect(parseWebVtt(text).TrackEvents.map(e => e.Text)).toEqual([ 'Only' ]);
    });
});
