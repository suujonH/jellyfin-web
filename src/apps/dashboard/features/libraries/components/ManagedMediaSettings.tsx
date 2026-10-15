import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ExpandMore from '@mui/icons-material/ExpandMore';

import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { managedRequest } from '../api/managedMedia';

interface Settings {
    MaximumResolution: number;
    MaximumFrameRate: number;
    GenerateAutomaticCaptions: boolean;
    WhisperExecutable: string;
    WhisperModel: string;
    CaptionOcrExecutable: string;
    ImportExecutable: string;
    ExternalMediaBaseUrl: string;
    [key: string]: unknown;
}

export default function ManagedMediaSettings() {
    const { api } = useApi();
    const query = useQuery({
        queryKey: ['ManagedMediaSettings', api?.basePath],
        queryFn: ({ signal }) => managedRequest<Settings>(api!, '/Settings', { signal }),
        enabled: !!api
    });
    const [settings, setSettings] = useState<Settings>();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(false);
    useEffect(() => {
        setSettings(query.data);
    }, [query.data]);
    const set = (key: keyof Settings, value: unknown) => setSettings(previous => previous && ({ ...previous, [key]: value }));
    const save = async () => {
        setBusy(true);
        setError(false);
        try {
            await managedRequest(api!, '/Settings', { method: 'PUT', data: settings });
            await query.refetch();
        } catch (err) {
            console.error('[ManagedMediaSettings]', err);
            setError(true);
        } finally {
            setBusy(false);
        }
    };
    return (
        <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>{globalize.translate('ManagedMediaSettings')}</AccordionSummary>
            <AccordionDetails>
                {(error || query.isError) && <Alert severity='error'>{globalize.translate('ManagedMediaSettingsError')}</Alert>}
                {settings && <Stack spacing={2}>
                    <TextField type='number' label={globalize.translate('ManagedMediaMaximumResolution')} value={settings.MaximumResolution} onChange={e => set('MaximumResolution', Number(e.target.value))} />
                    <TextField type='number' label={globalize.translate('ManagedMediaMaximumFrameRate')} value={settings.MaximumFrameRate} onChange={e => set('MaximumFrameRate', Number(e.target.value))} />
                    <FormControlLabel control={<Checkbox checked={settings.GenerateAutomaticCaptions} onChange={e => set('GenerateAutomaticCaptions', e.target.checked)} />} label={globalize.translate('ManagedMediaAutomaticCaptions')} />
                    <TextField label={globalize.translate('ManagedMediaWhisperExecutable')} value={settings.WhisperExecutable} onChange={e => set('WhisperExecutable', e.target.value)} />
                    <TextField label={globalize.translate('ManagedMediaWhisperModel')} value={settings.WhisperModel} onChange={e => set('WhisperModel', e.target.value)} />
                    <TextField label={globalize.translate('ManagedMediaOcrExecutable')} value={settings.CaptionOcrExecutable} onChange={e => set('CaptionOcrExecutable', e.target.value)} />
                    <TextField label={globalize.translate('ManagedMediaImportExecutable')} value={settings.ImportExecutable} onChange={e => set('ImportExecutable', e.target.value)} />
                    <TextField label={globalize.translate('ManagedMediaExternalUrl')} value={settings.ExternalMediaBaseUrl} onChange={e => set('ExternalMediaBaseUrl', e.target.value)} />
                    <Button disabled={busy} onClick={save}>{globalize.translate('Save')}</Button>
                </Stack>}
            </AccordionDetails>
        </Accordion>
    );
}
