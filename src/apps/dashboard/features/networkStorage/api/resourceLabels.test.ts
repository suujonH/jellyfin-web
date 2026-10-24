import { describe, expect, it, vi } from 'vitest';

import { type HlsRendition, HlsRenditionKind, ResourceState, type StorageResource } from './networkStorage';
import { getRenditionLabel, getResourceTitle, sortRenditions } from './resourceLabels';

vi.mock('lib/globalize', () => ({ default: { translate: (key: string, ...args: unknown[]) => [ key, ...args ].join('|') } }));

const resource = (overrides: Partial<StorageResource> = {}): StorageResource => ({
    ItemId: '1',
    Name: 'Pilot',
    HasTrueCache: false,
    State: ResourceState.Valid,
    FailureCount: 0,
    SourceInStorage: false,
    HlsSize: 0,
    TotalSize: 0,
    HlsRenditions: [],
    IsOrphan: false,
    ...overrides
});

const rendition = (overrides: Partial<HlsRendition> = {}): HlsRendition => ({
    Key: 'a1',
    Kind: HlsRenditionKind.Audio,
    Quality: 0,
    Language: '',
    Title: '',
    Channels: 2,
    Size: 0,
    FileCount: 0,
    Location: 's3://media/hls',
    InStorage: true,
    ...overrides
});

describe('resourceLabels', () => {
    it('names a resource', () => {
        expect(getResourceTitle(resource({ IsOrphan: true, Sha256: 'abcdef0123456789' }))).toBe('NetworkStorageOrphan|abcdef012345');
        expect(getResourceTitle(resource({ SeasonNumber: 1, EpisodeNumber: 2 }))).toBe('S01E02 Pilot');
        expect(getResourceTitle(resource({ EpisodeNumber: 3 }))).toBe('S00E03 Pilot');
        expect(getResourceTitle(resource())).toBe('Pilot');
    });

    it('labels each kind of rendition', () => {
        expect(getRenditionLabel(rendition({ Key: 'v1080', Kind: HlsRenditionKind.Video, Quality: 1080 }))).toBe('1080p');
        expect(getRenditionLabel(rendition({ Language: 'jpn' }))).toBe('NetworkStorageHlsAudio|jpn');
        expect(getRenditionLabel(rendition({ Key: 's2', Kind: HlsRenditionKind.Subtitle, Title: 'Signs' }))).toBe('NetworkStorageHlsSubtitle|Signs');
        expect(getRenditionLabel(rendition({ Key: 'preview', Kind: HlsRenditionKind.Preview }))).toBe('NetworkStorageHlsPreview');
    });

    it('sorts video from the highest quality first', () => {
        const sorted = sortRenditions([
            rendition({ Key: 'preview', Kind: HlsRenditionKind.Preview }),
            rendition({ Key: 'v720', Kind: HlsRenditionKind.Video, Quality: 720 }),
            rendition({ Key: 's2', Kind: HlsRenditionKind.Subtitle }),
            rendition({ Key: 'a1' }),
            rendition({ Key: 'v1080', Kind: HlsRenditionKind.Video, Quality: 1080 })
        ]);

        expect(sorted.map(r => r.Key)).toEqual([ 'v1080', 'v720', 'a1', 's2', 'preview' ]);
    });
});
