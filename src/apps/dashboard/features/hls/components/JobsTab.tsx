import React, { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import MuiLink from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import Toast from 'apps/dashboard/components/Toast';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { getErrorMessage } from '../../networkStorage/api/networkStorage';
import { HlsJobStatus, hlsRequest, type HlsJobSummary, normalizeId } from '../api/hls';

const POLL_MS = 10000;

const STATUS_COLORS: Record<HlsJobStatus, 'success' | 'error' | 'info' | 'default'> = {
    [HlsJobStatus.Pending]: 'default',
    [HlsJobStatus.Running]: 'info',
    [HlsJobStatus.Verifying]: 'info',
    [HlsJobStatus.Complete]: 'success',
    [HlsJobStatus.Failed]: 'error',
    [HlsJobStatus.Cancelled]: 'default'
};

/** The jobs changed last, and the requests that rebuild the work list or verify what is published. */
const JobsTab = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    const [ error, setError ] = useState<string>();
    const [ message, setMessage ] = useState<string>();

    const jobs = useQuery({
        queryKey: [ 'HlsJobs', api?.basePath ],
        queryFn: ({ signal }) => hlsRequest<HlsJobSummary[]>(api!, '/Jobs', { signal }),
        enabled: !!api,
        refetchInterval: POLL_MS
    });

    const itemIds = useMemo(() => [ ...new Set((jobs.data ?? []).map(j => j.ItemId).filter((id): id is string => !!id)) ].sort((a, b) => a.localeCompare(b)), [ jobs.data ]);

    // The names of the items of the jobs; a job of an item gone shows its id.
    const items = useQuery({
        queryKey: [ 'HlsJobItems', api?.basePath, itemIds ],
        queryFn: async ({ signal }) => (await getLibraryApi(api!).getItems({ ids: itemIds, enableImages: false }, { signal })).data.Items ?? [],
        enabled: !!api && itemIds.length > 0,
        // Each set of jobs names its own items; the sets left behind are dropped rather than kept with the cache.
        gcTime: 0
    });

    // Keyed as the jobs name the items, which the server writes otherwise than the ids of items.
    const names = useMemo(() => new Map((items.data ?? []).map(item => [
        normalizeId(item.Id),
        item.SeriesName ? `${item.SeriesName} - ${item.Name ?? ''}` : item.Name
    ])), [ items.data ]);

    const post = useCallback(async (path: string, done: string) => {
        setError(undefined);
        try {
            await hlsRequest<string>(api!, path, { method: 'POST' });
            setMessage(globalize.translate(done));
            await queryClient.invalidateQueries({ queryKey: [ 'HlsStatus' ] });
            await queryClient.invalidateQueries({ queryKey: [ 'HlsJobs' ] });
        } catch (err) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            setError(status === 409 ? globalize.translate('HlsVerifyRunning') : getErrorMessage(err) ?? globalize.translate('HlsError'));
        }
    }, [ api, queryClient ]);

    const rebuild = useCallback(() => post('/Rebuild', 'HlsRebuildRequested'), [ post ]);
    const verify = useCallback(() => post('/Verify', 'HlsVerifyStarted'), [ post ]);
    const closeToast = useCallback(() => setMessage(undefined), []);

    return (
        <Stack spacing={2}>
            <Toast open={!!message} onClose={closeToast} message={message} />
            <Stack direction='row' spacing={2} flexWrap='wrap' useFlexGap>
                <Button variant='contained' onClick={rebuild}>{globalize.translate('HlsRebuild')}</Button>
                <Button variant='outlined' onClick={verify}>{globalize.translate('HlsVerify')}</Button>
            </Stack>
            <Typography variant='body2' color='text.secondary'>{globalize.translate('HlsRebuildHelp')}</Typography>
            {error && <Alert severity='error'>{error}</Alert>}
            {jobs.isError && <Alert severity='error'>{globalize.translate('HlsError')}</Alert>}

            {jobs.data?.length === 0 && <Typography>{globalize.translate('HlsNoJobs')}</Typography>}
            {!!jobs.data?.length && (
                <Table size='small'>
                    <TableHead>
                        <TableRow>
                            <TableCell>{globalize.translate('LabelName')}</TableCell>
                            <TableCell>{globalize.translate('HlsJobKind')}</TableCell>
                            <TableCell>{globalize.translate('HlsJobStatus')}</TableCell>
                            <TableCell>{globalize.translate('HlsJobAttempt')}</TableCell>
                            <TableCell>{globalize.translate('HlsJobWorker')}</TableCell>
                            <TableCell>{globalize.translate('HlsJobModified')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {jobs.data.map(job => (
                            <TableRow key={job.Id}>
                                <TableCell sx={{ wordBreak: 'break-all' }}>
                                    {job.ItemId ? (
                                        <MuiLink component={Link} to={`/details?id=${normalizeId(job.ItemId)}`}>
                                            {names.get(normalizeId(job.ItemId)) ?? job.ItemId}
                                        </MuiLink>
                                    ) : job.Sha256?.slice(0, 16)}
                                    {job.Error && (
                                        <Typography variant='caption' display='block' color='error'>{job.Error}</Typography>
                                    )}
                                </TableCell>
                                <TableCell>{globalize.translate(`HlsJobKind${job.Kind}`)}</TableCell>
                                <TableCell>
                                    <Chip size='small' color={STATUS_COLORS[job.Status]} label={globalize.translate(`HlsJobStatus${job.Status}`)} />
                                </TableCell>
                                <TableCell>{job.Attempt}</TableCell>
                                <TableCell>{job.Worker ?? '-'}</TableCell>
                                <TableCell>{new Date(job.DateModified).toLocaleString()}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </Stack>
    );
};

export default JobsTab;
