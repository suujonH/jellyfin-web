import type { Api } from '@jellyfin/sdk';
import axios from 'axios';
import { describe, expect, it, vi } from 'vitest';

import { sendUpload, uploadFingerprint, type ManagedJob } from './managedMedia';

describe('resumable managed uploads', () => {
    it('resumes at the server offset, uses bounded chunks, then completes', async () => {
        const request = vi.fn(async config => ({ data: { Offset: config.params?.offset + config.data?.size } }));
        const api = { getUri: (path: string) => path, axiosInstance: { request }, authorizationHeader: 'test' } as unknown as Api;
        const file = new File([new Uint8Array(17 * 1024 * 1024)], 'video.mkv');
        const job = { Id: 'upload', Size: file.size, Offset: 2 * 1024 * 1024 } as ManagedJob;
        const progress = vi.fn();
        await sendUpload(api, job, file, axios.CancelToken.source().token, progress);
        expect(request).toHaveBeenCalledTimes(3);
        expect(request.mock.calls[0][0].params.offset).toBe(job.Offset);
        expect(request.mock.calls[0][0].data.size).toBe(8 * 1024 * 1024);
        expect(request.mock.calls[1][0].data.size).toBe(7 * 1024 * 1024);
        expect(request.mock.calls[2][0].url).toBe('ManagedMedia/Uploads/upload/Complete');
        expect(progress).toHaveBeenLastCalledWith(file.size);
    });

    it('never completes after an interrupted chunk and can resume from the last acknowledged offset', async () => {
        const request = vi.fn().mockRejectedValueOnce(new Error('disconnected'));
        const api = { getUri: (path: string) => path, axiosInstance: { request } } as unknown as Api;
        const file = new File(['video bytes'], 'video.mkv');
        const job = { Id: 'upload', Size: file.size, Offset: 3 } as ManagedJob;
        await expect(sendUpload(api, job, file, axios.CancelToken.source().token, vi.fn())).rejects.toThrow('disconnected');
        expect(request).toHaveBeenCalledTimes(1);
        request.mockImplementation(async config => ({ data: { Offset: config.params?.offset + config.data?.size } }));
        await sendUpload(api, job, file, axios.CancelToken.source().token, vi.fn());
        expect(request.mock.calls[1][0].params.offset).toBe(3);
        expect(request.mock.calls[2][0].url).toContain('/Complete');
    });

    it('detects a different file even if its name, length and timestamp match', async () => {
        const first = new File(['first'], 'video.mkv', { lastModified: 100 });
        const second = new File(['other'], 'video.mkv', { lastModified: 100 });
        expect(await uploadFingerprint(first)).not.toBe(await uploadFingerprint(second));
        expect(await uploadFingerprint(first)).toBe(await uploadFingerprint(first));
    });
});
