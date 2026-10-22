import type { Api } from '@jellyfin/sdk';
import type { AxiosRequestConfig } from 'axios';

/** The video qualities the server can encode, by the height of the picture. */
export const HLS_QUALITIES = [ 2160, 1440, 1080, 720, 480, 360, 240, 144 ];

export enum HlsJobKind {
    Source = 'Source',
    Media = 'Media'
}

export enum HlsJobStatus {
    Pending = 'Pending',
    Running = 'Running',
    Verifying = 'Verifying',
    Complete = 'Complete',
    Failed = 'Failed',
    Cancelled = 'Cancelled'
}

export interface HlsLibraryQualities {
    LibraryId: string;
    Qualities: number[];
}

export interface HlsOptions {
    Enabled: boolean;
    /** None means every library. */
    Libraries: string[];
    Qualities: number[];
    /** Narrow the global qualities for the libraries that have their own. */
    LibraryQualities: HlsLibraryQualities[];
    AllowOriginal: boolean;
    AllowLocalOriginal: boolean;
    LeaseMinutes: number;
    MaxAttempts: number;
    OrphanRetentionHours: number;
    PlaybackTokenHours: number;
    /** Sent empty to keep the key of the server, so that saving never ends the grants already issued. */
    PlaybackSigningKey: string;
}

export interface HlsStoreProblem {
    Base: string;
    Problem: string;
}

export interface HlsJobCounts {
    Pending: number;
    Running: number;
    Verifying: number;
    Complete: number;
    Failed: number;
    Cancelled: number;
    PendingDeletions: number;
    Media: number;
    PublishedRenditions: number;
}

export interface HlsReverifyReport {
    Date: string;
    Checked: number;
    Failed: number;
    Aborted?: string | null;
}

export interface HlsStatus {
    Enabled: boolean;
    SettingsError?: string | null;
    StoreProblems: HlsStoreProblem[];
    Counts: HlsJobCounts;
    LastReverify?: HlsReverifyReport | null;
}

export interface HlsJobSummary {
    Id: string;
    Kind: HlsJobKind;
    ItemId?: string | null;
    Sha256?: string | null;
    Status: HlsJobStatus;
    Attempt: number;
    Worker?: string | null;
    Error?: string | null;
    DateModified: string;
}

export const hlsRequest = async <T>(api: Api, path: string, options: AxiosRequestConfig = {}) => (
    await api.axiosInstance.request<T>({
        ...options,
        url: api.getUri(`Hls${path}`),
        headers: { Authorization: api.authorizationHeader, ...options.headers }
    })
).data;

/** A library id as the server writes it in one place or another, for comparing: lower case, without dashes. */
export const normalizeId = (id: string | null | undefined) => (id ?? '').replace(/-/g, '').toLowerCase();
