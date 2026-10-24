import globalize from 'lib/globalize';

import { type HlsRendition, HlsRenditionKind, type StorageResource } from './networkStorage';

const pad = (value: number) => String(value).padStart(2, '0');

/** The name of a resource: a content by its hash, an episode with its number. */
export const getResourceTitle = (resource: StorageResource) => {
    if (resource.IsOrphan) return globalize.translate('NetworkStorageOrphan', resource.Sha256?.slice(0, 12) ?? '');
    if (resource.EpisodeNumber != null) return `S${pad(resource.SeasonNumber ?? 0)}E${pad(resource.EpisodeNumber)} ${resource.Name ?? ''}`;
    return resource.Name ?? '';
};

export const getRenditionLabel = (rendition: HlsRendition) => {
    switch (rendition.Kind) {
        case HlsRenditionKind.Video:
            return `${rendition.Quality}p`;
        case HlsRenditionKind.Audio:
            return globalize.translate('NetworkStorageHlsAudio', rendition.Language || rendition.Title || rendition.Key);
        case HlsRenditionKind.Subtitle:
            return globalize.translate('NetworkStorageHlsSubtitle', rendition.Language || rendition.Title || rendition.Key);
        default:
            return globalize.translate('NetworkStorageHlsPreview');
    }
};

const KIND_ORDER = [ HlsRenditionKind.Video, HlsRenditionKind.Audio, HlsRenditionKind.Subtitle, HlsRenditionKind.Preview ];

/** Video from the highest quality, then audio, subtitles and the preview. */
export const sortRenditions = (renditions: HlsRendition[]) => [ ...renditions ].sort((a, b) =>
    KIND_ORDER.indexOf(a.Kind) - KIND_ORDER.indexOf(b.Kind) || b.Quality - a.Quality || a.Key.localeCompare(b.Key));
