import React, { useEffect, useRef, useState } from 'react';
import axios, { type CancelTokenSource } from 'axios';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import Page from 'components/Page';
import globalize from 'lib/globalize';
import { useApi } from 'hooks/useApi';
import { useVirtualFolders } from 'apps/dashboard/features/libraries/api/useVirtualFolders';
import { managedRequest, sendUpload, uploadFingerprint, type ManagedJob } from 'apps/dashboard/features/libraries/api/managedMedia';
import ManagedMediaSettings from 'apps/dashboard/features/libraries/components/ManagedMediaSettings';

export const Component = () => {
    const { api, user } = useApi();
    const folders = useVirtualFolders();
    const jobs = useQuery({
        queryKey: ['ManagedMedia', api?.basePath, user?.Id],
        queryFn: ({ signal }) => managedRequest<ManagedJob[]>(api!, '', { signal }),
        enabled: !!api,
        refetchInterval: 3000
    });
    const [library, setLibrary] = useState('');
    const [libraryName, setLibraryName] = useState('');
    const [title, setTitle] = useState('');
    const [source, setSource] = useState('');
    const [file, setFile] = useState<File>();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [uploaded, setUploaded] = useState(0);
    const [captionLanguage, setCaptionLanguage] = useState('und');
    const cancel = useRef<CancelTokenSource>();
    useEffect(() => () => cancel.current?.cancel(), []);
    const libraries = folders.data?.filter(folder => (folder.LibraryOptions as { ManagedFolderId?: string })?.ManagedFolderId);
    const selectedLibrary = library || libraries?.[0]?.ItemId || '';

    const perform = async (action: () => Promise<void>) => {
        setError('');
        setBusy(true);
        try {
            await action();
            await jobs.refetch();
        } catch (err) {
            if (!axios.isCancel(err)) {
                console.error('[ManagedMedia]', err);
                setError(globalize.translate('ManagedMediaActionFailed'));
            }
        } finally {
            setBusy(false);
        }
    };

    const upload = () => perform(async () => {
        if (!api || !file) return;
        cancel.current = axios.CancelToken.source();
        const storageKey = `managed-upload:${api.basePath}:${user?.Id}:${selectedLibrary}:${await uploadFingerprint(file)}`;
        let saved: string | null = null;
        try {
            saved = localStorage.getItem(storageKey);
        } catch { /* Storage is optional. */ }
        const current = await managedRequest<ManagedJob[]>(api, '');
        let job = current.find(value => value.Id === saved && value.State === 'Uploading');
        if (!job) {
            job = await managedRequest<ManagedJob>(api, '/Uploads', { method: 'POST', data: {
                LibraryId: selectedLibrary, Title: title.trim() || file.name.replace(/\.[^.]+$/, ''), FileName: file.name, Size: file.size
            } });
            try {
                localStorage.setItem(storageKey, job.Id);
            } catch { /* Upload still works without storage. */ }
        }
        setUploaded(job.Offset);
        await sendUpload(api, job, file, cancel.current.token, setUploaded);
        try {
            localStorage.removeItem(storageKey);
        } catch { /* Storage is optional. */ }
        setFile(undefined);
    });

    return (
        <Page id='mediaLibraryPage' title={globalize.translate('HeaderLibraries')} className='mainAnimatedPage type-interior'>
            <Box className='content-primary'>
                <Stack spacing={3} mt={2}>
                    <Alert severity='info'>{globalize.translate('ManagedMediaIntroduction')}</Alert>
                    <ManagedMediaSettings />
                    {(error || jobs.isError || folders.isError) && <Alert severity='error'>{error || globalize.translate('LibrariesLoadError')}</Alert>}
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <TextField label={globalize.translate('LabelDisplayName')} value={libraryName} onChange={e => setLibraryName(e.target.value)} disabled={busy} />
                        <Button disabled={busy || !libraryName.trim() || !api} onClick={() => perform(async () => {
                            const id = await managedRequest<string>(api!, '/Libraries', { method: 'POST', params: { name: libraryName.trim() } });
                            await folders.refetch();
                            setLibrary(id);
                            setLibraryName('');
                        })}>{globalize.translate('ButtonAddMediaLibrary')}</Button>
                    </Stack>
                    <Paper sx={{ p: 2 }}>
                        <Stack spacing={2}>
                            <TextField select label={globalize.translate('HeaderLibraries')} value={selectedLibrary} disabled={busy || !libraries?.length} onChange={e => setLibrary(e.target.value)}>
                                {libraries?.map(folder => <MenuItem key={folder.ItemId} value={folder.ItemId || ''}>{folder.Name}</MenuItem>)}
                            </TextField>
                            <TextField label={globalize.translate('LabelTitle')} value={title} onChange={e => setTitle(e.target.value)} disabled={busy} />
                            <Button component='label' disabled={busy}>
                                {file?.name || globalize.translate('ManagedMediaChooseVideo')}
                                <input hidden type='file' accept='video/*,.mkv,.m2ts,.ts' onChange={e => {
                                    setFile(e.target.files?.[0]);
                                    setUploaded(0);
                                }} />
                            </Button>
                            <Stack direction='row' spacing={2}>
                                <Button variant='contained' disabled={busy || !file || !selectedLibrary} onClick={() => upload()}>{globalize.translate('ManagedMediaUploadResume')}</Button>
                                {busy && <Button onClick={() => cancel.current?.cancel()}>{globalize.translate('Pause')}</Button>}
                            </Stack>
                            {file && <LinearProgress variant='determinate' value={100 * uploaded / Math.max(1, file.size)} aria-label={globalize.translate('ManagedMediaUploadResume')} />}
                            <TextField label={globalize.translate('ManagedMediaImportSource')} helperText={globalize.translate('ManagedMediaImportHelp')} value={source} onChange={e => setSource(e.target.value)} disabled={busy} />
                            <Button disabled={busy || !selectedLibrary || !source.trim() || !title.trim()} onClick={() => perform(async () => {
                                await managedRequest(api!, '/Imports', { method: 'POST', data: { LibraryId: selectedLibrary, Title: title.trim(), Source: source.trim() } });
                                setSource('');
                            })}>{globalize.translate('ManagedMediaImport')}</Button>
                        </Stack>
                    </Paper>
                    <TextField label={globalize.translate('ManagedMediaCaptionLanguage')} value={captionLanguage} onChange={e => setCaptionLanguage(e.target.value)} />
                    {jobs.data?.map(job => (
                        <Paper key={job.Id} sx={{ p: 2 }}>
                            <Stack spacing={1}>
                                <Typography variant='h3'>{job.Title}</Typography>
                                <Typography>{globalize.translate(`ManagedMediaState${job.State}`)}{job.Published && job.State !== 'Ready' ? ` · ${globalize.translate('ManagedMediaPreviousAvailable')}` : ''}</Typography>
                                {job.State === 'Processing' && <LinearProgress variant={job.TotalOutputs ? 'determinate' : 'indeterminate'} value={100 * job.CompletedOutputs / Math.max(1, job.TotalOutputs)} />}
                                {job.State === 'Uploading' && <Typography>{Math.round(job.Offset / Math.max(1, job.Size) * 100)}% · {globalize.translate('ManagedMediaResumeHelp')}</Typography>}
                                {job.Error && <Alert severity='error'>{job.Error}</Alert>}
                                <Stack direction='row' spacing={1}>
                                    {job.Archived && api && <Button component='a' href={api.getUri(`ManagedMedia/${job.Id}/Archive`, { ApiKey: api.accessToken })}>{globalize.translate('ManagedMediaDownloadOriginal')}</Button>}
                                    {['Ready', 'Failed', 'Cancelled'].includes(job.State) && <Button disabled={busy} onClick={() => perform(async () => { await managedRequest(api!, `/${job.Id}/Retry`, { method: 'POST' }); })}>{globalize.translate('ManagedMediaReprocess')}</Button>}
                                    {['Uploading', 'Importing', 'Queued', 'Processing'].includes(job.State) && <Button disabled={busy} onClick={() => perform(async () => { await managedRequest(api!, `/${job.Id}/Cancel`, { method: 'POST' }); })}>{globalize.translate('Cancel')}</Button>}
                                    {['Ready', 'Failed', 'Cancelled'].includes(job.State) && <Button component='label' disabled={busy}>
                                        {globalize.translate('ManagedMediaAddCaptions')}
                                        <input hidden type='file' accept='.vtt,text/vtt' onChange={e => {
                                            const caption = e.target.files?.[0];
                                            if (caption) {
                                                void perform(async () => {
                                                    await managedRequest(api!, `/${job.Id}/Captions`, { method: 'POST', params: { language: captionLanguage, name: caption.name }, headers: { 'Content-Type': 'text/vtt' }, data: caption });
                                                });
                                            }
                                        }} />
                                    </Button>}
                                </Stack>
                            </Stack>
                        </Paper>
                    ))}
                </Stack>
            </Box>
        </Page>
    );
};

Component.displayName = 'LibrariesPage';
