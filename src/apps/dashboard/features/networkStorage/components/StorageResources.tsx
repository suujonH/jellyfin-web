import React, { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ExpandMore from '@mui/icons-material/ExpandMore';

import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { formatSize, networkStorageRequest, ResourceState, type StorageGroup, StorageGroupKind } from '../api/networkStorage';
import ResourceTable from './ResourceTable';

const DEFAULT_STATES = Object.values(ResourceState);

const getGroupName = (group: StorageGroup) => {
    if (group.Kind === StorageGroupKind.Orphans) return globalize.translate('NetworkStorageOrphans');
    return group.Name ?? globalize.translate('NetworkStorageUnknownLibrary');
};

const GroupSummary = ({ group }: { group: StorageGroup }) => (
    <Stack spacing={1} sx={{ width: '100%' }}>
        <Typography fontWeight='bold'>{getGroupName(group)}</Typography>
        <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
            <Chip size='small' label={globalize.translate('NetworkStorageResourceCount', group.ResourceCount)} />
            <Chip
                size='small'
                label={globalize.translate('NetworkStorageTotalSize', formatSize(group.TotalSize))
                    + (group.UndeclaredSizeCount > 0 ? ` · ${globalize.translate('NetworkStorageUndeclaredSize', group.UndeclaredSizeCount)}` : '')}
            />
            <Chip size='small' variant='outlined' label={globalize.translate('NetworkStorageHlsSize', formatSize(group.HlsSize))} />
            <Chip size='small' variant='outlined' label={globalize.translate('NetworkStorageSourceSize', formatSize(group.SourceSize))} />
            <Chip size='small' color='success' variant='outlined' label={`${globalize.translate('NetworkStorageStateValid')} ${group.ValidCount}`} />
            <Chip size='small' color='error' variant='outlined' label={`${globalize.translate('NetworkStorageStateInvalid')} ${group.InvalidCount}`} />
            <Chip size='small' variant='outlined' label={`${globalize.translate('NetworkStorageStateUnknown')} ${group.UnknownCount}`} />
        </Stack>
    </Stack>
);

interface StorageResourcesProps {
    storageKey: string;
}

/** The resources of one storage, by library and series, the contents no item refers to last. */
const StorageResources = ({ storageKey }: StorageResourcesProps) => {
    const { api } = useApi();
    const [ states, setStates ] = useState<ResourceState[]>(DEFAULT_STATES);

    const query = useQuery({
        queryKey: [ 'NetworkStorageGroups', api?.basePath, storageKey, states ],
        queryFn: ({ signal }) => networkStorageRequest<StorageGroup[]>(api!, `/Storages/${encodeURIComponent(storageKey)}/Groups`, {
            signal,
            params: { states },
            paramsSerializer: { indexes: null }
        }),
        // No state selected matches nothing; the server would read an empty list as every state.
        enabled: !!api && states.length > 0
    });
    const groups = states.length > 0 ? query.data : [];

    const toggleState = useCallback((state: ResourceState, checked: boolean) => {
        setStates(previous => checked ? [ ...previous, state ] : previous.filter(s => s !== state));
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

            {groups?.length === 0 && (
                <Typography color='text.secondary'>{globalize.translate('NetworkStorageNoResources')}</Typography>
            )}

            {groups?.map(group => (
                <Accordion key={group.Key} slotProps={{ transition: { unmountOnExit: true } }}>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                        <GroupSummary group={group} />
                    </AccordionSummary>
                    <AccordionDetails>
                        <Stack spacing={1}>
                            {group.Children.map(child => (
                                <Accordion key={child.Key} slotProps={{ transition: { unmountOnExit: true } }}>
                                    <AccordionSummary expandIcon={<ExpandMore />}>
                                        <GroupSummary group={child} />
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <ResourceTable storageKey={storageKey} states={states} group={child.Key} />
                                    </AccordionDetails>
                                </Accordion>
                            ))}
                            {(group.Kind === StorageGroupKind.Orphans || group.LooseCount > 0) && (
                                <ResourceTable storageKey={storageKey} states={states} group={group.Key} />
                            )}
                        </Stack>
                    </AccordionDetails>
                </Accordion>
            ))}
        </Stack>
    );
};

export default StorageResources;
