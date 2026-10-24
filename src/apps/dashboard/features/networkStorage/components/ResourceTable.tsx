import React, { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { EMPTY_ID, formatSize, networkStorageRequest, type ResourcePage, ResourceState } from '../api/networkStorage';
import { getRenditionLabel, getResourceTitle, sortRenditions } from '../api/resourceLabels';

const ALL_ROWS = -1;

export const STATE_COLORS: Record<ResourceState, 'success' | 'error' | 'default'> = {
    [ResourceState.Valid]: 'success',
    [ResourceState.Invalid]: 'error',
    [ResourceState.Unknown]: 'default'
};

interface ResourceTableProps {
    storageKey: string;
    states: ResourceState[];
    /** The key of a group; not set for the whole storage. */
    group?: string;
}

/** The resources of one storage or of one group of it, with what of each is in the storage. */
const ResourceTable = ({ storageKey, states, group }: ResourceTableProps) => {
    const { api } = useApi();
    const [ page, setPage ] = useState(0);
    const [ pageSize, setPageSize ] = useState(10);

    const query = useQuery({
        queryKey: [ 'NetworkStorageResources', api?.basePath, storageKey, states, group, page, pageSize ],
        queryFn: ({ signal }) => networkStorageRequest<ResourcePage>(api!, `/Storages/${encodeURIComponent(storageKey)}/Resources`, {
            signal,
            params: {
                states,
                group,
                startIndex: pageSize === ALL_ROWS ? 0 : page * pageSize,
                limit: pageSize === ALL_ROWS ? undefined : pageSize
            },
            paramsSerializer: { indexes: null }
        }),
        // No state selected matches nothing; the server would read an empty list as every state.
        enabled: !!api && states.length > 0
    });
    const data = states.length > 0 ? query.data : { Items: [], TotalRecordCount: 0, StartIndex: 0 };

    // A refresh, such as after a check, can leave fewer resources than the selected page starts at.
    const total = data?.TotalRecordCount;
    useEffect(() => {
        if (total !== undefined && pageSize !== ALL_ROWS && page > 0 && page * pageSize >= total) {
            setPage(Math.max(0, Math.ceil(total / pageSize) - 1));
        }
    }, [ page, pageSize, total ]);

    // Other states show other resources.
    useEffect(() => setPage(0), [ states ]);

    const onPageChange = useCallback((_: unknown, value: number) => setPage(value), []);
    const onPageSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setPageSize(Number(e.target.value));
        setPage(0);
    }, []);

    return (
        <Stack spacing={1}>
            {query.isError && <Alert severity='error'>{globalize.translate('NetworkStorageError')}</Alert>}

            <Table size='small'>
                <TableHead>
                    <TableRow>
                        <TableCell>{globalize.translate('LabelName')}</TableCell>
                        <TableCell>{globalize.translate('NetworkStorageTotalHeader')}</TableCell>
                        <TableCell>{globalize.translate('NetworkStorageHlsHeader')}</TableCell>
                        <TableCell>{globalize.translate('NetworkStorageSourceHeader')}</TableCell>
                        <TableCell>{globalize.translate('NetworkStorageStateHeader')}</TableCell>
                        <TableCell>{globalize.translate('NetworkStorageIssueHeader')}</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {data?.Items.map(resource => (
                        <TableRow key={resource.ItemId === EMPTY_ID ? resource.Sha256 : resource.ItemId}>
                            <TableCell>
                                {getResourceTitle(resource)}
                                {resource.IsOrphan && resource.DateOrphanExpires && (
                                    <Typography variant='caption' display='block' color='text.secondary'>
                                        {globalize.translate('NetworkStorageOrphanExpires', new Date(resource.DateOrphanExpires).toLocaleString())}
                                    </Typography>
                                )}
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatSize(resource.TotalSize)}</TableCell>
                            <TableCell>
                                <Stack direction='row' spacing={0.5} flexWrap='wrap' useFlexGap>
                                    {sortRenditions(resource.HlsRenditions).map(rendition => {
                                        const chip = (
                                            <Chip
                                                key={rendition.Key}
                                                size='small'
                                                variant={rendition.InStorage ? 'filled' : 'outlined'}
                                                label={`${getRenditionLabel(rendition)} ${formatSize(rendition.Size)}`}
                                            />
                                        );
                                        return rendition.InStorage ? chip : (
                                            <Tooltip key={rendition.Key} title={globalize.translate('NetworkStorageElsewhere', rendition.StorageKey ?? rendition.Location)}>
                                                {chip}
                                            </Tooltip>
                                        );
                                    })}
                                </Stack>
                            </TableCell>
                            <TableCell>
                                {resource.IsOrphan || resource.Size == null ? '-' : formatSize(resource.Size)}
                                {!resource.IsOrphan && !resource.SourceInStorage && (
                                    <Typography variant='caption' display='block' color='text.secondary' sx={{ wordBreak: 'break-all' }}>
                                        {globalize.translate('NetworkStorageElsewhere', resource.Target ?? resource.Path ?? '')}
                                    </Typography>
                                )}
                            </TableCell>
                            <TableCell>
                                <Chip
                                    size='small'
                                    color={STATE_COLORS[resource.State]}
                                    label={globalize.translate(`NetworkStorageState${resource.State}`)}
                                />
                            </TableCell>
                            <TableCell>
                                {resource.Issue && globalize.translate(`NetworkStorageIssue${resource.Issue}`)}
                                {resource.StatusCode ? ` (${resource.StatusCode})` : ''}
                                {resource.DateLastFailed && (
                                    <Typography variant='caption' display='block' color='text.secondary'>
                                        {new Date(resource.DateLastFailed).toLocaleString()}
                                        {resource.FailureSource && ' · ' + globalize.translate('NetworkStorageSource' + resource.FailureSource)}
                                    </Typography>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <TablePagination
                component='div'
                count={data?.TotalRecordCount ?? 0}
                page={pageSize === ALL_ROWS ? 0 : page}
                rowsPerPage={pageSize}
                rowsPerPageOptions={[ 10, 100, { label: globalize.translate('All'), value: ALL_ROWS } ]}
                onPageChange={onPageChange}
                onRowsPerPageChange={onPageSizeChange}
            />
        </Stack>
    );
};

export default ResourceTable;
