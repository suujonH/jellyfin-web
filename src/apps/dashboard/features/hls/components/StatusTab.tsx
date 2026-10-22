import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { type HlsJobCounts, hlsRequest, type HlsStatus } from '../api/hls';

const POLL_MS = 5000;

const JOB_COUNTS: (keyof HlsJobCounts)[] = [ 'Pending', 'Running', 'Verifying', 'Complete', 'Failed', 'Cancelled' ];

/** The jobs, the roots that cannot be trusted, the deletions waiting and the last verification. */
const StatusTab = () => {
    const { api } = useApi();

    const status = useQuery({
        queryKey: [ 'HlsStatus', api?.basePath ],
        queryFn: ({ signal }) => hlsRequest<HlsStatus>(api!, '/Status', { signal }),
        enabled: !!api,
        refetchInterval: POLL_MS
    });

    if (status.isError) {
        return <Alert severity='error'>{globalize.translate('HlsError')}</Alert>;
    }

    const data = status.data;
    if (!data) {
        return null;
    }

    const report = data.LastReverify;

    return (
        <Stack spacing={2}>
            {!data.Enabled && <Alert severity='info'>{globalize.translate('HlsDisabled')}</Alert>}
            {data.SettingsError && <Alert severity='error'>{globalize.translate('HlsSettingsError', data.SettingsError)}</Alert>}

            <Card variant='outlined'>
                <CardContent>
                    <Stack spacing={1}>
                        <Typography fontWeight='bold'>{globalize.translate('HlsJobs')}</Typography>
                        <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
                            {JOB_COUNTS.map(key => (
                                <Chip
                                    key={key}
                                    size='small'
                                    variant='outlined'
                                    color={key === 'Failed' && data.Counts.Failed > 0 ? 'error' : 'default'}
                                    label={globalize.translate('HlsJobStatus' + key) + ' ' + data.Counts[key]}
                                />
                            ))}
                        </Stack>
                        <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
                            <Chip size='small' label={globalize.translate('HlsMediaCount', data.Counts.Media)} />
                            <Chip size='small' label={globalize.translate('HlsPublishedCount', data.Counts.PublishedRenditions)} />
                            <Chip size='small' label={globalize.translate('HlsPendingDeletions', data.Counts.PendingDeletions)} />
                        </Stack>
                    </Stack>
                </CardContent>
            </Card>

            <Card variant='outlined'>
                <CardContent>
                    <Stack spacing={1}>
                        <Typography fontWeight='bold'>{globalize.translate('HlsStores')}</Typography>
                        {data.StoreProblems.length === 0 ? (
                            <Typography color='text.secondary'>{globalize.translate('HlsStoresOk')}</Typography>
                        ) : data.StoreProblems.map(problem => (
                            <Alert key={problem.Base} severity='warning'>
                                <Typography sx={{ wordBreak: 'break-all' }} fontWeight='bold'>{problem.Base}</Typography>
                                {problem.Problem}
                            </Alert>
                        ))}
                    </Stack>
                </CardContent>
            </Card>

            <Card variant='outlined'>
                <CardContent>
                    <Stack spacing={1}>
                        <Typography fontWeight='bold'>{globalize.translate('HlsLastVerify')}</Typography>
                        {report ? (
                            <>
                                <Typography>
                                    {globalize.translate('HlsLastVerifyResult', new Date(report.Date).toLocaleString(), report.Checked, report.Failed)}
                                </Typography>
                                {report.Aborted && <Alert severity='warning'>{globalize.translate('HlsVerifyAborted', report.Aborted)}</Alert>}
                            </>
                        ) : (
                            <Typography color='text.secondary'>{globalize.translate('HlsNeverVerified')}</Typography>
                        )}
                    </Stack>
                </CardContent>
            </Card>
        </Stack>
    );
};

export default StatusTab;
