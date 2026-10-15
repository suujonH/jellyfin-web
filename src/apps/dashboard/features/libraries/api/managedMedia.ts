import type { Api } from '@jellyfin/sdk';
import type { AxiosRequestConfig, CancelToken } from 'axios';

export interface ManagedJob {
    Id: string;
    LibraryId: string;
    Title: string;
    FileName: string;
    State: string;
    Size: number;
    Offset: number;
    CompletedOutputs: number;
    TotalOutputs: number;
    Published: boolean;
    Archived: boolean;
    Error?: string;
}

export const managedRequest = async <T>(api: Api, path: string, options: AxiosRequestConfig = {}) => (
    await api.axiosInstance.request<T>({
        ...options,
        url: api.getUri(`ManagedMedia${path}`),
        headers: { Authorization: api.authorizationHeader, ...options.headers }
    })
).data;

/** Send bounded chunks; the server is the authority for the resume offset. */
export async function sendUpload(api: Api, job: ManagedJob, file: File, cancelToken: CancelToken, progress: (offset: number) => void) {
    let offset = job.Offset;
    if (offset < 0 || offset > file.size || file.size !== job.Size) throw new Error('Invalid upload offset');
    while (offset < file.size) {
        const end = Math.min(offset + 8 * 1024 * 1024, file.size);
        const result = await managedRequest<ManagedJob>(api, `/Uploads/${job.Id}/Content`, {
            method: 'PUT', params: { offset }, cancelToken,
            headers: { 'Content-Type': 'application/octet-stream' },
            data: file.slice(offset, end)
        });
        if (result.Offset !== end) throw new Error('Unexpected upload offset');
        offset = result.Offset;
        progress(offset);
    }
    await managedRequest(api, `/Uploads/${job.Id}/Complete`, { method: 'POST', cancelToken });
}

export async function uploadFingerprint(file: File) {
    const sample = new Blob([file.slice(0, 65536), file.slice(Math.max(0, file.size - 65536))]);
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(sample);
    });
    const bytes = new Uint8Array(buffer);
    let checksum = 2166136261;
    for (const byte of bytes) checksum = Math.imul(checksum ^ byte, 16777619);
    return `${file.name}:${file.size}:${file.lastModified}:${checksum >>> 0}`;
}
