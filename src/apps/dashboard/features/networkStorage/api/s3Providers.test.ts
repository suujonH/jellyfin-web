import { describe, expect, it } from 'vitest';

import { S3_PROTOCOL, type StorageAccess } from './networkStorage';
import { applyProvider, detectProvider, isComplete, normalizeAccountId, normalizeRegion, S3Provider } from './s3Providers';

const ACCOUNT = '0123456789abcdef0123456789abcdef';

const access = (overrides: Partial<StorageAccess> = {}): StorageAccess => ({
    Protocol: S3_PROTOCOL,
    Bucket: 'media',
    UsePathStyle: false,
    UrlLifetimeSeconds: 43200,
    IsArchive: true,
    ...overrides
});

describe('s3Providers', () => {
    it('builds the settings of each provider', () => {
        expect(applyProvider(access(), { provider: S3Provider.R2, accountId: ACCOUNT, region: '' }))
            .toMatchObject({ Endpoint: `https://${ACCOUNT}.r2.cloudflarestorage.com`, Region: 'auto', UsePathStyle: true });
        expect(applyProvider(access(), { provider: S3Provider.B2, accountId: '', region: 'us-west-004' }))
            .toMatchObject({ Endpoint: 'https://s3.us-west-004.backblazeb2.com', Region: 'us-west-004', UsePathStyle: true });
        expect(applyProvider(access(), { provider: S3Provider.Wasabi, accountId: '', region: 'ap-northeast-1' }))
            .toMatchObject({ Endpoint: 'https://s3.ap-northeast-1.wasabisys.com', Region: 'ap-northeast-1', UsePathStyle: true });
        expect(applyProvider(access(), { provider: S3Provider.Aws, accountId: '', region: '' }))
            .toMatchObject({ Endpoint: '', Region: 'us-east-1', UsePathStyle: false });
        expect(applyProvider(access({ Bucket: 'media.example.com' }), { provider: S3Provider.Aws, accountId: '', region: '' }).UsePathStyle).toBe(true);

        const custom = access({ Endpoint: 'https://minio.lan:9000', UsePathStyle: true });
        expect(applyProvider(custom, { provider: S3Provider.Custom, accountId: '', region: '' })).toEqual(custom);
    });

    it('reads the provider back from the settings it built', () => {
        for (const settings of [
            { provider: S3Provider.R2, accountId: ACCOUNT, region: '' },
            { provider: S3Provider.B2, accountId: '', region: 'us-west-004' },
            { provider: S3Provider.Wasabi, accountId: '', region: 'eu-central-1' },
            { provider: S3Provider.Aws, accountId: '', region: 'ap-northeast-1' }
        ]) {
            expect(detectProvider(applyProvider(access(), settings))).toEqual(settings);
        }

        expect(detectProvider(access({ Endpoint: 'https://minio.lan:9000' })).provider).toBe(S3Provider.Custom);
        expect(detectProvider(access({ Endpoint: 'https://s3-accelerate.amazonaws.com' })).provider).toBe(S3Provider.Custom);
        expect(detectProvider(access({ Endpoint: 'https://s3-external-1.amazonaws.com' })).provider).toBe(S3Provider.Custom);
        expect(detectProvider(access({ Endpoint: 'https://s3.us-gov-west-1.amazonaws.com' }))).toEqual({ provider: S3Provider.Aws, accountId: '', region: 'us-gov-west-1' });
        expect(detectProvider(access({ Endpoint: 'https://s3.us-west-004.backblazeb2.com/prefix' })).provider).toBe(S3Provider.Custom);
        // Settings the preset would change stay custom.
        expect(detectProvider(access({ Endpoint: 'https://s3.us-east-2.amazonaws.com', Region: 'us-east-2', UsePathStyle: true })).provider).toBe(S3Provider.Custom);
        expect(detectProvider(access({ Endpoint: 'https://s3.us-west-004.backblazeb2.com', Region: 'us-east-1', UsePathStyle: true })).provider).toBe(S3Provider.Custom);
    });

    it('takes a pasted endpoint for the account id or region', () => {
        expect(normalizeAccountId(`https://${ACCOUNT}.r2.cloudflarestorage.com`)).toBe(ACCOUNT);
        expect(normalizeAccountId(` ${ACCOUNT} `)).toBe(ACCOUNT);
        expect(normalizeRegion(S3Provider.B2, 's3.us-west-004.backblazeb2.com')).toBe('us-west-004');
        expect(normalizeRegion(S3Provider.Wasabi, 'https://s3.ap-northeast-1.wasabisys.com/')).toBe('ap-northeast-1');
        expect(normalizeRegion(S3Provider.Wasabi, 'https://s3.wasabisys.com')).toBe('us-east-1');
        expect(normalizeRegion(S3Provider.Aws, 'US-EAST-2')).toBe('us-east-2');
    });

    it('asks for what the provider needs', () => {
        expect(isComplete({ provider: S3Provider.R2, accountId: 'nope', region: '' })).toBe(false);
        expect(isComplete({ provider: S3Provider.B2, accountId: '', region: '' })).toBe(false);
        expect(isComplete({ provider: S3Provider.Aws, accountId: '', region: '' })).toBe(true);
    });
});
