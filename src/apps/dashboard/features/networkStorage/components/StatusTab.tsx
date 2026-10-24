import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ExpandMore from '@mui/icons-material/ExpandMore';

import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { formatSize, getCheckTask, networkStorageRequest, type StorageSummary, UNRESOLVED_STORAGE_KEY } from '../api/networkStorage';
import StorageResources from './StorageResources';

const TASK_POLL_MS = 2000;
const IDLE_POLL_MS = 30000;

const getStorageName = (storage: StorageSummary) => {
    if (storage.Key === UNRESOLVED_STORAGE_KEY) return globalize.translate('NetworkStorageUnresolved');
    return `${storage.Protocol}://${storage.Name}`;
};

/** Statistics of every storage, from what the library already knows, and the check that reads the resources. */
const StatusTab = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    const [ error, setError ] = useState(false);
    // The completion time of the last check seen; undefined until the task has been read once.
    const lastCheckEnd = useRef<string | null>();

    const storages = useQuery({
        queryKey: [ 'NetworkStorageStorages', api?.basePath ],
        queryFn: ({ signal }) => networkStorageRequest<StorageSummary[]>(api!, '/Storages', { signal }),
        enabled: !!api
    });

    // Found by its key, so a check started before this tab was opened is followed as well.
    const task = useQuery({
        queryKey: [ 'NetworkStorageCheckTask', api?.basePath ],
        queryFn: ({ signal }) => getCheckTask(api!, signal),
        enabled: !!api,
        // Slowly while idle, so a check started elsewhere is noticed too.
        refetchInterval: query => query.state.data?.State === 'Idle' ? IDLE_POLL_MS : TASK_POLL_MS
    });

    const isChecking = !!task.data && task.data.State !== 'Idle';
    const checkEnd = task.data?.LastExecutionResult?.EndTimeUtc ?? null;

    useEffect(() => {
        if (!task.data) return;
        // While a check runs, the end is still that of the previous one; it changes when this one finishes.
        if (lastCheckEnd.current !== undefined && lastCheckEnd.current !== checkEnd) {
            // A check finished: it replaced the recorded failures.
            void queryClient.invalidateQueries({ queryKey: [ 'NetworkStorageStorages' ] });
            void queryClient.invalidateQueries({ queryKey: [ 'NetworkStorageGroups' ] });
            void queryClient.invalidateQueries({ queryKey: [ 'NetworkStorageResources' ] });
        }
        lastCheckEnd.current = checkEnd;
    }, [ checkEnd, queryClient, task.data ]);

    const startCheck = useCallback(async () => {
        setError(false);
        try {
            await networkStorageRequest<string>(api!, '/Check', { method: 'POST' });
            await queryClient.invalidateQueries({ queryKey: [ 'NetworkStorageCheckTask' ] });
        } catch (err) {
            console.error('[NetworkStorage] failed to start the check', err);
            setError(true);
        }
    }, [ api, queryClient ]);

    const hasStorages = !!storages.data && storages.data.length > 0;

    return (
        <Stack spacing={2}>
            {hasStorages && (
                <Stack direction='row' spacing={2} alignItems='center'>
                    <Button variant='contained' disabled={isChecking || !task.data} onClick={startCheck}>
                        {globalize.translate('NetworkStorageCheck')}
                    </Button>
                    {!isChecking && checkEnd && (
                        <Typography variant='body2' color='text.secondary'>
                            {globalize.translate('NetworkStorageLastCheck', new Date(checkEnd).toLocaleString())}
                        </Typography>
                    )}
                </Stack>
            )}
            {isChecking && (
                <LinearProgress
                    variant={task.data?.CurrentProgressPercentage == null ? 'indeterminate' : 'determinate'}
                    value={task.data?.CurrentProgressPercentage ?? 0}
                />
            )}
            {!isChecking && task.data?.LastExecutionResult?.Status === 'Failed' && (
                <Alert severity='error'>{task.data.LastExecutionResult.ErrorMessage ?? globalize.translate('NetworkStorageError')}</Alert>
            )}
            {(error || storages.isError) && <Alert severity='error'>{globalize.translate('NetworkStorageError')}</Alert>}

            {storages.data?.length === 0 && (
                <Typography>{globalize.translate('NetworkStorageNoStorages')}</Typography>
            )}

            {storages.data?.map(storage => (
                <Accordion key={storage.Key} slotProps={{ transition: { unmountOnExit: true } }}>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                        <Stack spacing={1} sx={{ width: '100%' }}>
                            <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap' useFlexGap>
                                <Typography fontWeight='bold'>{getStorageName(storage)}</Typography>
                                {storage.IsArchive && <Chip size='small' label={globalize.translate('NetworkStorageArchived')} />}
                                {storage.RequiresAccess && !storage.AccessId && (
                                    <Chip size='small' color='error' label={globalize.translate('NetworkStorageIssueNoAccess')} />
                                )}
                            </Stack>
                            <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
                                <Chip size='small' label={globalize.translate('NetworkStorageResourceCount', storage.ResourceCount)} />
                                <Chip
                                    size='small'
                                    label={globalize.translate('NetworkStorageTotalSize', formatSize(storage.TotalSize))
                                        + ` · ${globalize.translate('NetworkStorageHlsSize', formatSize(storage.HlsSize))}`
                                        + ` · ${globalize.translate('NetworkStorageSourceSize', formatSize(storage.SourceSize))}`
                                        + (storage.UndeclaredSizeCount > 0 ? ` · ${globalize.translate('NetworkStorageUndeclaredSize', storage.UndeclaredSizeCount)}` : '')}
                                />
                                <Chip size='small' color='success' variant='outlined' label={`${globalize.translate('NetworkStorageStateValid')} ${storage.ValidCount}`} />
                                <Chip size='small' color='error' variant='outlined' label={`${globalize.translate('NetworkStorageStateInvalid')} ${storage.InvalidCount}`} />
                                <Chip size='small' variant='outlined' label={`${globalize.translate('NetworkStorageStateUnknown')} ${storage.UnknownCount}`} />
                            </Stack>
                        </Stack>
                    </AccordionSummary>
                    <AccordionDetails>
                        <StorageResources storageKey={storage.Key} />
                    </AccordionDetails>
                </Accordion>
            ))}
        </Stack>
    );
};

export default StatusTab;
