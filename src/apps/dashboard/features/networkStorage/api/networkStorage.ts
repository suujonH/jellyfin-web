import type { Api } from '@jellyfin/sdk';
import type { AxiosRequestConfig } from 'axios';

export enum ResourceState {
    Valid = 'Valid',
    Invalid = 'Invalid',
    Unknown = 'Unknown'
}

export enum ExternalAuthMode {
    CloudflareWorker = 'CloudflareWorker',
    PublicBucket = 'PublicBucket',
    PresignedUrl = 'PresignedUrl'
}

export interface StorageSummary {
    Key: string;
    Protocol: string;
    Name: string;
    AccessId?: string | null;
    IsArchive: boolean;
    RequiresAccess: boolean;
    ResourceCount: number;
    ValidCount: number;
    InvalidCount: number;
    UnknownCount: number;
    TotalSize: number;
    UndeclaredSizeCount: number;
}

export interface StorageResource {
    ItemId: string;
    Name?: string | null;
    SeriesName?: string | null;
    Type?: string | null;
    Path?: string | null;
    Target?: string | null;
    Size?: number | null;
    HasTrueCache: boolean;
    State: ResourceState;
    Issue?: string | null;
    StatusCode?: number | null;
    FailureSource?: string | null;
    DateLastFailed?: string | null;
    FailureCount: number;
}

export interface ResourcePage {
    Items: StorageResource[];
    TotalRecordCount: number;
    StartIndex: number;
}

export interface StorageAccess {
    Id?: string;
    Protocol: string;
    Name?: string | null;
    Endpoint?: string | null;
    Bucket: string;
    Region?: string | null;
    UsePathStyle: boolean;
    AccessKey?: string | null;
    /** Left out to keep the stored secret; empty to remove it. */
    SecretKey?: string | null;
    SessionToken?: string | null;
    HasSecretKey?: boolean;
    HasSessionToken?: boolean;
    UrlLifetimeSeconds: number;
    /** Clients cannot play from an archive, and the server neither streams nor transcodes it for them. */
    IsArchive: boolean;
}

export interface ExternalAddress {
    AccessId: string;
    /** Whether an external address is set; follows AuthMode and is ignored when saving. */
    IsPublic?: boolean;
    /** Not set: no external address, and the storage stays private. */
    AuthMode?: ExternalAuthMode | null;
    BaseUrl?: string | null;
    /** Left out to keep the stored secret. */
    Secret?: string | null;
    HasSecret?: boolean;
    UrlLifetimeSeconds: number;
}

export interface TestResult {
    Success: boolean;
    StatusCode?: number | null;
    Message?: string | null;
}

export interface TaskInfo {
    Id: string;
    Key?: string;
    State: 'Idle' | 'Cancelling' | 'Running';
    CurrentProgressPercentage?: number | null;
    LastExecutionResult?: { EndTimeUtc?: string; Status?: string; ErrorMessage?: string | null } | null;
}

export const S3_PROTOCOL = 's3';
export const UNRESOLVED_STORAGE_KEY = 'unresolved';

export const networkStorageRequest = async <T>(api: Api, path: string, options: AxiosRequestConfig = {}) => (
    await api.axiosInstance.request<T>({
        ...options,
        url: api.getUri(`NetworkStorage${path}`),
        headers: { Authorization: api.authorizationHeader, ...options.headers }
    })
).data;

export const CHECK_TASK_KEY = 'CheckNetworkStorage';

/** The check task, found by its key, so that a check started earlier or elsewhere is followed too. */
export const getCheckTask = async (api: Api, signal?: AbortSignal) => (
    await api.axiosInstance.request<TaskInfo[]>({
        url: api.getUri('ScheduledTasks'),
        headers: { Authorization: api.authorizationHeader },
        signal
    })
).data.find(t => t.Key === CHECK_TASK_KEY) ?? null;

/** The message of a refused request: the server answers 400 with the reason as text. */
export const getErrorMessage = (err: unknown) => {
    const data = (err as { response?: { data?: unknown } })?.response?.data;
    return typeof data === 'string' && data.length > 0 ? data : undefined;
};

export const formatSize = (bytes: number) => {
    const units = [ 'B', 'KB', 'MB', 'GB', 'TB', 'PB' ];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }
    return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
};
