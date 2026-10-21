import React, { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import Toast from 'apps/dashboard/components/Toast';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { type ExternalAddress, ExternalAuthMode, getErrorMessage, networkStorageRequest, type StorageAccess } from '../api/networkStorage';
import { detectProvider } from '../api/s3Providers';
import AdvancedSettings from './AdvancedSettings';

// The choice of no external address, which keeps the storage private.
const NO_ADDRESS = 'None';

interface ExternalFormProps {
    access: StorageAccess;
    onSaved: () => void;
}

const ExternalForm = ({ access, onSaved }: ExternalFormProps) => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    const [ address, setAddress ] = useState<ExternalAddress>();
    const [ error, setError ] = useState<string>();
    const [ isBusy, setIsBusy ] = useState(false);

    const stored = useQuery({
        queryKey: [ 'NetworkStorageExternal', api?.basePath, access.Id ],
        queryFn: ({ signal }) => networkStorageRequest<ExternalAddress>(api!, `/Accesses/${access.Id}/External`, { signal }),
        enabled: !!api && !!access.Id
    });

    useEffect(() => {
        if (stored.data) setAddress({ ...stored.data, Secret: '' });
    }, [ stored.data ]);

    const setField = useCallback(<K extends keyof ExternalAddress>(name: K, value: ExternalAddress[K]) => {
        setAddress(previous => previous && ({ ...previous, [name]: value }));
    }, []);

    // Setting an external address makes the storage public; none keeps it private.
    // The base URL means something different in each mode: only the saved mode keeps its saved one.
    const changeMode = useCallback((value: ExternalAuthMode | null) => {
        setAddress(previous => previous && ({
            ...previous,
            AuthMode: value,
            BaseUrl: value === stored.data?.AuthMode ? stored.data.BaseUrl : ''
        }));
    }, [ stored.data ]);

    const save = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!address) return;
        setIsBusy(true);
        setError(undefined);
        try {
            const saved = await networkStorageRequest<ExternalAddress>(api!, `/Accesses/${access.Id}/External`, {
                method: 'PUT',
                // A secret left empty keeps the stored one.
                data: { ...address, Secret: !address.Secret && address.HasSecret ? null : address.Secret }
            });
            // A read started before the save must not bring the old settings back.
            await queryClient.cancelQueries({ queryKey: [ 'NetworkStorageExternal', api?.basePath, access.Id ] });
            queryClient.setQueryData([ 'NetworkStorageExternal', api?.basePath, access.Id ], saved);
            onSaved();
        } catch (err) {
            setError(getErrorMessage(err) ?? globalize.translate('NetworkStorageError'));
        } finally {
            setIsBusy(false);
        }
    }, [ access.Id, api, address, onSaved, queryClient ]);

    const mode = address?.AuthMode;

    return (
        <Card variant='outlined' component='form' onSubmit={save}>
            <CardContent>
                <Stack spacing={2}>
                    <Typography fontWeight='bold'>
                        {access.Name || access.Bucket}
                        <Typography component='span' variant='body2' color='text.secondary'>
                            {' · ' + globalize.translate('NetworkStorageProvider' + detectProvider(access).provider) + ' · ' + access.Bucket}
                        </Typography>
                    </Typography>
                    {access.IsArchive && <Alert severity='info'>{globalize.translate('NetworkStorageArchiveHelp')}</Alert>}
                    {stored.isError && <Alert severity='error'>{globalize.translate('NetworkStorageError')}</Alert>}
                    {address && (
                        <>
                            <TextField
                                select
                                label={globalize.translate('NetworkStorageAuthMode')}
                                helperText={globalize.translate(mode ? `NetworkStorageAuth${mode}Help` : 'NetworkStoragePrivateHelp')}
                                value={mode ?? NO_ADDRESS}
                                onChange={e => changeMode(e.target.value === NO_ADDRESS ? null : e.target.value as ExternalAuthMode)}
                            >
                                <MenuItem value={NO_ADDRESS}>{globalize.translate('NetworkStorageAuthNone')}</MenuItem>
                                {Object.values(ExternalAuthMode).map(m => (
                                    <MenuItem key={m} value={m}>{globalize.translate(`NetworkStorageAuth${m}`)}</MenuItem>
                                ))}
                            </TextField>
                            {mode && (
                                <>
                                    {(mode === ExternalAuthMode.CloudflareWorker || mode === ExternalAuthMode.PublicBucket) && (
                                        <TextField
                                            required
                                            label={globalize.translate('NetworkStorageBaseUrl')}
                                            helperText={globalize.translate(`NetworkStorageBaseUrl${mode}Help`)}
                                            value={address.BaseUrl ?? ''}
                                            onChange={e => setField('BaseUrl', e.target.value.trim())}
                                        />
                                    )}
                                    {mode === ExternalAuthMode.CloudflareWorker && (
                                        <TextField
                                            type='password'
                                            required={!address.HasSecret}
                                            label={globalize.translate('NetworkStorageWorkerSecret')}
                                            helperText={address.HasSecret ? globalize.translate('NetworkStorageSecretKeep') : undefined}
                                            value={address.Secret ?? ''}
                                            autoComplete='new-password'
                                            onChange={e => setField('Secret', e.target.value)}
                                        />
                                    )}
                                    {(mode === ExternalAuthMode.CloudflareWorker || mode === ExternalAuthMode.PresignedUrl) && (
                                        <AdvancedSettings>
                                            {mode === ExternalAuthMode.PresignedUrl && (
                                                <TextField
                                                    label={globalize.translate('NetworkStorageBaseUrl')}
                                                    helperText={globalize.translate('NetworkStorageBaseUrlPresignedUrlHelp')}
                                                    value={address.BaseUrl ?? ''}
                                                    onChange={e => setField('BaseUrl', e.target.value.trim())}
                                                />
                                            )}
                                            <TextField
                                                required
                                                type='number'
                                                label={globalize.translate('NetworkStorageExternalLifetime')}
                                                helperText={globalize.translate('NetworkStorageExternalLifetimeHelp')}
                                                value={address.UrlLifetimeSeconds}
                                                slotProps={{ htmlInput: { min: 60, max: 604800 } }}
                                                onChange={e => setField('UrlLifetimeSeconds', Number(e.target.value))}
                                            />
                                        </AdvancedSettings>
                                    )}
                                </>
                            )}
                        </>
                    )}
                    {error && <Alert severity='error'>{error}</Alert>}
                </Stack>
            </CardContent>
            <CardActions>
                <Button type='submit' variant='contained' disabled={isBusy || !address}>{globalize.translate('Save')}</Button>
            </CardActions>
        </Card>
    );
};

/** Whether clients may read a storage themselves, and with which addresses. */
const ExternalTab = () => {
    const { api } = useApi();
    const [ isSavedToastOpen, setIsSavedToastOpen ] = useState(false);

    const accesses = useQuery({
        queryKey: [ 'NetworkStorageAccesses', api?.basePath ],
        queryFn: ({ signal }) => networkStorageRequest<StorageAccess[]>(api!, '/Accesses', { signal }),
        enabled: !!api
    });

    const onSaved = useCallback(() => setIsSavedToastOpen(true), []);
    const closeToast = useCallback(() => setIsSavedToastOpen(false), []);

    return (
        <Stack spacing={2}>
            <Toast open={isSavedToastOpen} onClose={closeToast} message={globalize.translate('SettingsSaved')} />
            {accesses.isError && <Alert severity='error'>{globalize.translate('NetworkStorageError')}</Alert>}
            {accesses.data?.length === 0 && <Typography>{globalize.translate('NetworkStorageNoAccesses')}</Typography>}
            {accesses.data?.map(access => <ExternalForm key={access.Id} access={access} onSaved={onSaved} />)}
        </Stack>
    );
};

export default ExternalTab;
