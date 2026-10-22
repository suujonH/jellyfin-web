import React, { useCallback } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import Page from 'components/Page';
import globalize from 'lib/globalize';
import JobsTab from 'apps/dashboard/features/hls/components/JobsTab';
import SettingsTab from 'apps/dashboard/features/hls/components/SettingsTab';
import StatusTab from 'apps/dashboard/features/hls/components/StatusTab';
import { HlsTab } from 'apps/dashboard/features/hls/constants/hlsTab';

const TABS = Object.values(HlsTab) as string[];

export const Component = () => {
    const navigate = useNavigate();
    const { tab } = useParams();

    const handleTabChange = useCallback((_: React.SyntheticEvent, newValue: HlsTab) => {
        navigate(`/dashboard/hls/${newValue}`);
    }, [ navigate ]);

    if (!tab || !TABS.includes(tab)) {
        return <Navigate replace to={`/dashboard/hls/${HlsTab.Status}`} />;
    }

    return (
        <Page
            id='hlsPage'
            title={globalize.translate('HeaderHls')}
            className='mainAnimatedPage type-interior'
        >
            <Box className='content-primary'>
                <Stack spacing={2}>
                    <Typography variant='h1'>{globalize.translate('HeaderHls')}</Typography>
                    <Tabs value={tab} onChange={handleTabChange} variant='scrollable' allowScrollButtonsMobile>
                        <Tab label={globalize.translate('HlsTabStatus')} value={HlsTab.Status} />
                        <Tab label={globalize.translate('HlsTabSettings')} value={HlsTab.Settings} />
                        <Tab label={globalize.translate('HlsTabJobs')} value={HlsTab.Jobs} />
                    </Tabs>

                    {tab === HlsTab.Status && <StatusTab />}
                    {tab === HlsTab.Settings && <SettingsTab />}
                    {tab === HlsTab.Jobs && <JobsTab />}
                </Stack>
            </Box>
        </Page>
    );
};

Component.displayName = 'HlsPage';
