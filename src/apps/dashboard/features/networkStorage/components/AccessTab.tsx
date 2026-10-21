import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import ConfirmDialog from 'components/ConfirmDialog';
import Toast from 'apps/dashboard/components/Toast';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { getErrorMessage, networkStorageRequest, S3_PROTOCOL, type StorageAccess, type TestResult } from '../api/networkStorage';
import {
    applyProvider,
    detectProvider,
    isComplete,
    normalizeAccountId,
    normalizeRegion,
    type ProviderSettings,
    S3Provider
} from '../api/s3Providers';
import AdvancedSettings from './AdvancedSettings';

const createAccess = (): StorageAccess => ({
    Protocol: S3_PROTOCOL,
    Name: '',
    Endpoint: '',
    Bucket: '',
    Region: '',
    UsePathStyle: true,
    AccessKey: '',
    SecretKey: '',
    SessionToken: '',
    UrlLifetimeSeconds: 43200,
    IsArchive: true
});

/** What is sent: the settings of the provider, and a secret left empty keeps the stored one. */
const toRequest = (access: StorageAccess, settings: ProviderSettings): StorageAccess => ({
    ...applyProvider(access, settings),
    SecretKey: !access.SecretKey && access.HasSecretKey ? null : access.SecretKey,
    SessionToken: !access.SessionToken && access.HasSessionToken ? null : access.SessionToken
});

/** Forgets a stored secret: the field, left empty, then removes it. */
const ClearSecret = ({ onClick }: { onClick: () => void }) => (
    <InputAdornment position='end'>
        <Button size='small' onClick={onClick}>{globalize.translate('NetworkStorageSecretClear')}</Button>
    </InputAdornment>
);

const getProviderName = (access: StorageAccess) => globalize.translate(`NetworkStorageProvider${detectProvider(access).provider}`);

interface AccessFormProps {
    access: StorageAccess;
    onSaved: () => void;
    onCancel: () => void;
}

const AccessForm = ({ access: initial, onSaved, onCancel }: AccessFormProps) => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    const [ access, setAccess ] = useState<StorageAccess>({ ...initial, SecretKey: '', SessionToken: '' });
    const [ settings, setSettings ] = useState<ProviderSettings>(() => detectProvider(initial));
    const [ testResult, setTestResult ] = useState<TestResult>();
    const [ error, setError ] = useState<string>();
    const [ isBusy, setIsBusy ] = useState(false);

    const setField = useCallback(<K extends keyof StorageAccess>(name: K, value: StorageAccess[K]) => {
        setAccess(previous => ({ ...previous, [name]: value }));
        setTestResult(undefined);
    }, []);

    const setSetting = useCallback(<K extends keyof ProviderSettings>(name: K, value: ProviderSettings[K]) => {
        setSettings(previous => ({ ...previous, [name]: value }));
        setTestResult(undefined);
    }, []);

    const changeProvider = useCallback((provider: S3Provider) => {
        // A custom access starts from what the preset would have sent, so its fields are not blank.
        if (provider === S3Provider.Custom) {
            setAccess(previous => applyProvider(previous, settings));
        }
        setSettings({ provider, accountId: '', region: '' });
        setTestResult(undefined);
    }, [ settings ]);

    const request = useMemo(() => toRequest(access, settings), [ access, settings ]);
    const canSubmit = !!access.Bucket.trim() && isComplete(settings);

    // The settings a test answers for; a result for settings since changed is not shown.
    const latestRequest = useRef(request);
    latestRequest.current = request;

    const test = useCallback(async () => {
        setIsBusy(true);
        setError(undefined);
        try {
            const result = await networkStorageRequest<TestResult>(api!, '/Accesses/Test', { method: 'POST', data: request });
            if (latestRequest.current === request) setTestResult(result);
        } catch (err) {
            setError(getErrorMessage(err) ?? globalize.translate('NetworkStorageError'));
        } finally {
            setIsBusy(false);
        }
    }, [ api, request ]);

    const save = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setIsBusy(true);
        setError(undefined);
        try {
            await networkStorageRequest<StorageAccess>(api!, access.Id ? `/Accesses/${access.Id}` : '/Accesses', {
                method: access.Id ? 'PUT' : 'POST',
                data: request
            });
            await queryClient.invalidateQueries({ queryKey: [ 'NetworkStorageAccesses' ] });
            await queryClient.invalidateQueries({ queryKey: [ 'NetworkStorageStorages' ] });
            await queryClient.invalidateQueries({ queryKey: [ 'NetworkStorageResources' ] });
            onSaved();
        } catch (err) {
            setError(getErrorMessage(err) ?? globalize.translate('NetworkStorageError'));
        } finally {
            setIsBusy(false);
        }
    }, [ access.Id, api, onSaved, queryClient, request ]);

    const keepHelper = globalize.translate('NetworkStorageSecretKeep');
    const { provider } = settings;

    return (
        <Card variant='outlined' component='form' onSubmit={save}>
            <CardContent>
                <Stack spacing={2}>
                    <TextField
                        select
                        label={globalize.translate('NetworkStorageProvider')}
                        value={provider}
                        onChange={e => changeProvider(e.target.value as S3Provider)}
                    >
                        {Object.values(S3Provider).map(p => (
                            <MenuItem key={p} value={p}>{globalize.translate(`NetworkStorageProvider${p}`)}</MenuItem>
                        ))}
                    </TextField>

                    {provider === S3Provider.R2 && (
                        <TextField
                            required
                            label={globalize.translate('NetworkStorageAccountId')}
                            helperText={globalize.translate('NetworkStorageAccountIdHelp')}
                            value={settings.accountId}
                            error={!!settings.accountId && !isComplete(settings)}
                            onChange={e => setSetting('accountId', normalizeAccountId(e.target.value))}
                        />
                    )}
                    {(provider === S3Provider.Aws || provider === S3Provider.B2 || provider === S3Provider.Wasabi) && (
                        <TextField
                            required={provider !== S3Provider.Aws}
                            label={globalize.translate('NetworkStorageRegion')}
                            helperText={globalize.translate(`NetworkStorageRegion${provider}Help`)}
                            placeholder={provider === S3Provider.Aws ? 'us-east-1' : undefined}
                            value={settings.region}
                            onChange={e => setSetting('region', normalizeRegion(provider, e.target.value))}
                        />
                    )}
                    {provider === S3Provider.Custom && (
                        <>
                            <TextField
                                label={globalize.translate('NetworkStorageEndpoint')}
                                helperText={globalize.translate('NetworkStorageEndpointHelp')}
                                value={access.Endpoint ?? ''}
                                onChange={e => setField('Endpoint', e.target.value)}
                            />
                            <TextField
                                label={globalize.translate('NetworkStorageRegion')}
                                helperText={globalize.translate('NetworkStorageRegionHelp')}
                                placeholder='us-east-1'
                                value={access.Region ?? ''}
                                onChange={e => setField('Region', e.target.value)}
                            />
                        </>
                    )}

                    <TextField
                        required
                        label={globalize.translate('NetworkStorageBucket')}
                        helperText={globalize.translate('NetworkStorageBucketHelp')}
                        value={access.Bucket}
                        onChange={e => setField('Bucket', e.target.value.trim())}
                    />
                    <TextField
                        label={globalize.translate('NetworkStorageAccessKey')}
                        value={access.AccessKey ?? ''}
                        autoComplete='off'
                        onChange={e => setField('AccessKey', e.target.value.trim())}
                    />
                    <TextField
                        type='password'
                        label={globalize.translate('NetworkStorageSecretKey')}
                        helperText={access.HasSecretKey ? keepHelper : undefined}
                        slotProps={{ input: { endAdornment: access.HasSecretKey && <ClearSecret onClick={() => setField('HasSecretKey', false)} /> } }}
                        value={access.SecretKey ?? ''}
                        autoComplete='new-password'
                        onChange={e => setField('SecretKey', e.target.value.trim())}
                    />
                    <FormControlLabel
                        label={globalize.translate('NetworkStorageArchive')}
                        control={<Switch checked={access.IsArchive} onChange={e => setField('IsArchive', e.target.checked)} />}
                    />
                    <Typography variant='body2' color='text.secondary' sx={{ mt: '0 !important' }}>
                        {globalize.translate('NetworkStorageArchiveHelp')}
                    </Typography>

                    <AdvancedSettings>
                        <TextField
                            label={globalize.translate('LabelName')}
                            value={access.Name ?? ''}
                            onChange={e => setField('Name', e.target.value)}
                        />
                        {provider === S3Provider.Custom && (
                            <FormControlLabel
                                label={globalize.translate('NetworkStorageUsePathStyle')}
                                control={<Switch checked={access.UsePathStyle} onChange={e => setField('UsePathStyle', e.target.checked)} />}
                            />
                        )}
                        {/* A token entered or stored is sent with any provider, so it stays visible. */}
                        {(provider === S3Provider.Aws || provider === S3Provider.Custom || access.HasSessionToken || !!access.SessionToken) && (
                            <TextField
                                type='password'
                                label={globalize.translate('NetworkStorageSessionToken')}
                                helperText={access.HasSessionToken ? keepHelper : undefined}
                                slotProps={{ input: { endAdornment: access.HasSessionToken && <ClearSecret onClick={() => setField('HasSessionToken', false)} /> } }}
                                value={access.SessionToken ?? ''}
                                autoComplete='new-password'
                                onChange={e => setField('SessionToken', e.target.value.trim())}
                            />
                        )}
                        <TextField
                            type='number'
                            label={globalize.translate('NetworkStorageInternalLifetime')}
                            helperText={globalize.translate('NetworkStorageInternalLifetimeHelp')}
                            value={access.UrlLifetimeSeconds}
                            slotProps={{ htmlInput: { min: 60, max: 604800 } }}
                            onChange={e => setField('UrlLifetimeSeconds', Number(e.target.value))}
                        />
                    </AdvancedSettings>

                    {testResult && (
                        <Alert severity={testResult.Success ? 'success' : 'error'}>
                            {testResult.Success ? globalize.translate('NetworkStorageTestSuccess') : globalize.translate('NetworkStorageTestFailed')}
                            {testResult.StatusCode ? ` (${testResult.StatusCode})` : ''}
                            {testResult.Message ? ` ${testResult.Message}` : ''}
                        </Alert>
                    )}
                    {error && <Alert severity='error'>{error}</Alert>}
                </Stack>
            </CardContent>
            <CardActions>
                <Button type='submit' variant='contained' disabled={isBusy || !canSubmit}>{globalize.translate('Save')}</Button>
                <Button disabled={isBusy || !canSubmit} onClick={test}>{globalize.translate('NetworkStorageTest')}</Button>
                <Button disabled={isBusy} onClick={onCancel}>{globalize.translate('ButtonCancel')}</Button>
            </CardActions>
        </Card>
    );
};

/** The credentials the server reads the storages with. */
const AccessTab = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    const [ editing, setEditing ] = useState<StorageAccess>();
    const [ deleting, setDeleting ] = useState<StorageAccess>();
    const [ isSavedToastOpen, setIsSavedToastOpen ] = useState(false);
    const [ error, setError ] = useState<string>();

    const accesses = useQuery({
        queryKey: [ 'NetworkStorageAccesses', api?.basePath ],
        queryFn: ({ signal }) => networkStorageRequest<StorageAccess[]>(api!, '/Accesses', { signal }),
        enabled: !!api
    });

    const onCancel = useCallback(() => setEditing(undefined), []);
    const onSaved = useCallback(() => {
        setEditing(undefined);
        setIsSavedToastOpen(true);
    }, []);
    const closeToast = useCallback(() => setIsSavedToastOpen(false), []);
    const add = useCallback(() => setEditing(createAccess()), []);
    const cancelDelete = useCallback(() => setDeleting(undefined), []);

    const confirmDelete = useCallback(async () => {
        const target = deleting;
        setDeleting(undefined);
        if (!target?.Id) return;
        setError(undefined);
        try {
            await networkStorageRequest(api!, `/Accesses/${target.Id}`, { method: 'DELETE' });
            await queryClient.invalidateQueries({ queryKey: [ 'NetworkStorageAccesses' ] });
            await queryClient.invalidateQueries({ queryKey: [ 'NetworkStorageStorages' ] });
            await queryClient.invalidateQueries({ queryKey: [ 'NetworkStorageResources' ] });
        } catch (err) {
            setError(getErrorMessage(err) ?? globalize.translate('NetworkStorageError'));
        }
    }, [ api, deleting, queryClient ]);

    return (
        <Stack spacing={2}>
            <Toast open={isSavedToastOpen} onClose={closeToast} message={globalize.translate('SettingsSaved')} />
            <ConfirmDialog
                open={!!deleting}
                title={globalize.translate('Delete')}
                text={globalize.translate('NetworkStorageDeleteConfirm', deleting?.Name || deleting?.Bucket || '')}
                confirmButtonColor='error'
                confirmButtonText={globalize.translate('Delete')}
                onCancel={cancelDelete}
                onConfirm={confirmDelete}
            />

            {(error || accesses.isError) && <Alert severity='error'>{error ?? globalize.translate('NetworkStorageError')}</Alert>}

            {editing && !editing.Id && <AccessForm access={editing} onSaved={onSaved} onCancel={onCancel} />}
            {!editing && (
                <div>
                    <Button variant='contained' onClick={add}>{globalize.translate('Add')}</Button>
                </div>
            )}

            {accesses.data?.length === 0 && !editing && (
                <Typography>{globalize.translate('NetworkStorageNoAccesses')}</Typography>
            )}

            {accesses.data?.map(access => (
                editing?.Id && editing.Id === access.Id ? (
                    <AccessForm key={access.Id} access={editing} onSaved={onSaved} onCancel={onCancel} />
                ) : (
                    <Card key={access.Id} variant='outlined'>
                        <CardContent>
                            <Stack direction='row' spacing={1} alignItems='center'>
                                <Typography fontWeight='bold'>
                                    {access.Name || access.Bucket}
                                </Typography>
                                {access.IsArchive && <Chip size='small' label={globalize.translate('NetworkStorageArchived')} />}
                            </Stack>
                            <Typography variant='body2' color='text.secondary'>
                                {`${getProviderName(access)} · ${access.Bucket}`}
                                {access.Region && access.Region !== 'auto' ? ` · ${access.Region}` : ''}
                            </Typography>
                        </CardContent>
                        <CardActions>
                            <Button disabled={!!editing} onClick={() => setEditing(access)}>{globalize.translate('Edit')}</Button>
                            <Button color='error' disabled={!!editing} onClick={() => setDeleting(access)}>{globalize.translate('Delete')}</Button>
                        </CardActions>
                    </Card>
                )
            ))}
        </Stack>
    );
};

export default AccessTab;
