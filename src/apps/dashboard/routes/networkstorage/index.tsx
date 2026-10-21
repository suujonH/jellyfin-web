import React, { useCallback } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import Page from 'components/Page';
import globalize from 'lib/globalize';
import AccessTab from 'apps/dashboard/features/networkStorage/components/AccessTab';
import ExternalTab from 'apps/dashboard/features/networkStorage/components/ExternalTab';
import StatusTab from 'apps/dashboard/features/networkStorage/components/StatusTab';
import { NetworkStorageTab } from 'apps/dashboard/features/networkStorage/constants/networkStorageTab';

const TABS = Object.values(NetworkStorageTab) as string[];

export const Component = () => {
    const navigate = useNavigate();
    const { tab } = useParams();

    const handleTabChange = useCallback((_: React.SyntheticEvent, newValue: NetworkStorageTab) => {
        navigate(`/dashboard/networkstorage/${newValue}`);
    }, [ navigate ]);

    if (!tab || !TABS.includes(tab)) {
        return <Navigate replace to={`/dashboard/networkstorage/${NetworkStorageTab.Status}`} />;
    }

    return (
        <Page
            id='networkStoragePage'
            title={globalize.translate('HeaderNetworkStorage')}
            className='mainAnimatedPage type-interior'
        >
            <Box className='content-primary'>
                <Stack spacing={2}>
                    <Typography variant='h1'>{globalize.translate('HeaderNetworkStorage')}</Typography>
                    <Tabs value={tab} onChange={handleTabChange} variant='scrollable' allowScrollButtonsMobile>
                        <Tab label={globalize.translate('NetworkStorageTabStatus')} value={NetworkStorageTab.Status} />
                        <Tab label={globalize.translate('NetworkStorageTabAccess')} value={NetworkStorageTab.Access} />
                        <Tab label={globalize.translate('NetworkStorageTabExternal')} value={NetworkStorageTab.External} />
                    </Tabs>

                    {tab === NetworkStorageTab.Status && <StatusTab />}
                    {tab === NetworkStorageTab.Access && <AccessTab />}
                    {tab === NetworkStorageTab.External && <ExternalTab />}
                </Stack>
            </Box>
        </Page>
    );
};

Component.displayName = 'NetworkStoragePage';
