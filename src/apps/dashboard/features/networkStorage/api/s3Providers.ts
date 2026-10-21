import type { StorageAccess } from './networkStorage';

/** S3 services whose connection settings follow from a few values. They all take the same S3 requests. */
export enum S3Provider {
    Aws = 'Aws',
    R2 = 'R2',
    B2 = 'B2',
    Wasabi = 'Wasabi',
    Custom = 'Custom'
}

/** What a provider needs from the user, besides the bucket and the keys. */
export interface ProviderSettings {
    provider: S3Provider;
    /** The Cloudflare account id, for R2. */
    accountId: string;
    /** The region, for Amazon S3, B2 and Wasabi. */
    region: string;
}

const R2_HOST = /^([0-9a-f]{32})\.r2\.cloudflarestorage\.com$/i;
const B2_HOST = /^s3\.([a-z0-9-]+)\.backblazeb2\.com$/i;
const WASABI_HOST = /^s3\.([a-z0-9-]+)\.wasabisys\.com$/i;
// Only the regional endpoint the preset builds; others, such as s3-accelerate, are kept as entered.
const AWS_HOST = /^s3\.([a-z]{2}(?:-gov|-iso[a-z]*)?-[a-z]+-\d)\.amazonaws\.com$/i;

const getHost = (value: string) => {
    const text = value.trim();
    if (!text) return '';
    try {
        return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : 'https://' + text).host.toLowerCase();
    } catch {
        return '';
    }
};

/** The provider the endpoint of an access belongs to. */
const matchEndpoint = (access: StorageAccess): ProviderSettings => {
    const endpoint = access.Endpoint?.trim() ?? '';
    const region = access.Region?.trim() ?? '';
    const empty = { accountId: '', region: '' };
    if (!endpoint) return { ...empty, provider: S3Provider.Aws, region };

    let url: URL;
    try {
        url = new URL(endpoint);
    } catch {
        return { ...empty, provider: S3Provider.Custom };
    }

    // The presets are bare https hosts; anything else was entered by hand.
    if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.port) return { ...empty, provider: S3Provider.Custom };
    const host = url.host.toLowerCase();

    let match = R2_HOST.exec(host);
    if (match) return { ...empty, provider: S3Provider.R2, accountId: match[1] };
    match = B2_HOST.exec(host);
    if (match) return { ...empty, provider: S3Provider.B2, region: match[1] };
    match = WASABI_HOST.exec(host);
    if (match) return { ...empty, provider: S3Provider.Wasabi, region: match[1] };
    match = AWS_HOST.exec(host);
    if (match) return { ...empty, provider: S3Provider.Aws, region: match[1] };
    return { ...empty, provider: S3Provider.Custom };
};

/** The account id typed or pasted: a whole R2 endpoint is taken too. */
export const normalizeAccountId = (value: string) => R2_HOST.exec(getHost(value))?.[1] ?? value.trim();

/** The region typed or pasted: a whole endpoint of the provider is taken too. */
export const normalizeRegion = (provider: S3Provider, value: string) => {
    const host = getHost(value);
    const patterns: Partial<Record<S3Provider, RegExp>> = { [S3Provider.B2]: B2_HOST, [S3Provider.Wasabi]: WASABI_HOST, [S3Provider.Aws]: AWS_HOST };
    const pattern = patterns[provider];
    return (pattern && host ? pattern.exec(host)?.[1] : undefined) ?? value.trim().toLowerCase();
};

/** Whether the provider has what it needs to build its connection settings. */
export const isComplete = (settings: ProviderSettings) => {
    switch (settings.provider) {
        case S3Provider.R2:
            return /^[0-9a-f]{32}$/i.test(settings.accountId);
        case S3Provider.B2:
        case S3Provider.Wasabi:
            return /^[a-z0-9-]+$/.test(settings.region);
        default:
            return true;
    }
};

/** The access with the endpoint, region and addressing style of its provider. A custom access is kept as entered. */
export const applyProvider = (access: StorageAccess, settings: ProviderSettings): StorageAccess => {
    switch (settings.provider) {
        case S3Provider.Aws:
            return {
                ...access,
                Endpoint: '',
                Region: settings.region || 'us-east-1',
                // A bucket with a dot in its name does not match the certificate of its virtual host.
                UsePathStyle: access.Bucket.includes('.')
            };
        case S3Provider.R2:
            return { ...access, Endpoint: `https://${settings.accountId.toLowerCase()}.r2.cloudflarestorage.com`, Region: 'auto', UsePathStyle: true };
        case S3Provider.B2:
            return { ...access, Endpoint: `https://s3.${settings.region}.backblazeb2.com`, Region: settings.region, UsePathStyle: true };
        case S3Provider.Wasabi:
            return { ...access, Endpoint: `https://s3.${settings.region}.wasabisys.com`, Region: settings.region, UsePathStyle: true };
        default:
            return access;
    }
};

/**
 * Which provider an access was set up for, read back from its settings.
 * An access whose region or addressing style differs from what the provider would set stays custom, so saving it keeps them.
 */
export const detectProvider = (access: StorageAccess): ProviderSettings => {
    const settings = matchEndpoint(access);
    if (settings.provider === S3Provider.Custom) return settings;

    // The endpoint already matched; a region left empty takes the one of the provider.
    const preset = applyProvider(access, settings);
    const same = (access.Region?.trim() || preset.Region) === preset.Region
        && preset.UsePathStyle === access.UsePathStyle;
    return same ? settings : { provider: S3Provider.Custom, accountId: '', region: '' };
};
