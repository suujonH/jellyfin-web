import React, { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { formatSize, networkStorageRequest, type ResourcePage, ResourceState } from '../api/networkStorage';

const ALL_ROWS = -1;
const DEFAULT_STATES = [ ResourceState.Invalid, ResourceState.Unknown ];

const STATE_COLORS: Record<ResourceState, 'success' | 'error' | 'default'> = {
    [ResourceState.Valid]: 'success',
    [ResourceState.Invalid]: 'error',
    [ResourceState.Unknown]: 'default'
};

interface StorageResourcesProps {
    storageKey: string;
}

/** The resources of one storage, invalid and unknown ones first. */
const StorageResources = ({ storageKey }: StorageResourcesProps) => {
    const { api } = useApi();
    const [ states, setStates ] = useState<ResourceState[]>(DEFAULT_STATES);
    const [ page, setPage ] = useState(0);
    const [ pageSize, setPageSize ] = useState(10);

    const query = useQuery({
        queryKey: [ 'NetworkStorageResources', api?.basePath, storageKey, states, page, pageSize ],
        queryFn: ({ signal }) => networkStorageRequest<ResourcePage>(api!, `/Storages/${encodeURIComponent(storageKey)}/Resources`, {
            signal,
            params: {
                states,
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

    const toggleState = useCallback((state: ResourceState, checked: boolean) => {
        setStates(previous => checked ? [ ...previous, state ] : previous.filter(s => s !== state));
        setPage(0);
    }, []);

    const onPageChange = useCallback((_: unknown, value: number) => setPage(value), []);
    const onPageSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setPageSize(Number(e.target.value));
        setPage(0);
    }, []);

    return (
        <Stack spacing={1}>
            <FormGroup row>
                {Object.values(ResourceState).map(state => (
                    <FormControlLabel
                        key={state}
                        label={globalize.translate(`NetworkStorageState${state}`)}
                        control={
                            <Checkbox
                                checked={states.includes(state)}
                                onChange={e => toggleState(state, e.target.checked)}
                            />
                        }
                    />
                ))}
            </FormGroup>

            {query.isError && <Alert severity='error'>{globalize.translate('NetworkStorageError')}</Alert>}

            {data && data.TotalRecordCount === 0 ? (
                <Typography color='text.secondary'>{globalize.translate('NetworkStorageNoResources')}</Typography>
            ) : (
                <Table size='small'>
                    <TableHead>
                        <TableRow>
                            <TableCell>{globalize.translate('LabelName')}</TableCell>
                            <TableCell>{globalize.translate('NetworkStorageTarget')}</TableCell>
                            <TableCell>{globalize.translate('NetworkStorageSize')}</TableCell>
                            <TableCell>{globalize.translate('NetworkStorageStateHeader')}</TableCell>
                            <TableCell>{globalize.translate('NetworkStorageIssueHeader')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {data?.Items.map(resource => (
                            <TableRow key={resource.ItemId}>
                                <TableCell>
                                    {resource.SeriesName ? `${resource.SeriesName} - ${resource.Name ?? ''}` : resource.Name}
                                </TableCell>
                                <TableCell sx={{ wordBreak: 'break-all' }}>{resource.Target ?? resource.Path}</TableCell>
                                <TableCell>{resource.Size == null ? '-' : formatSize(resource.Size)}</TableCell>
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
            )}

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

export default StorageResources;
