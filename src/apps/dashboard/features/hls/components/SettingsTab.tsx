import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import Toast from 'apps/dashboard/components/Toast';
import { useVirtualFolders } from 'apps/dashboard/features/libraries/api/useVirtualFolders';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { getErrorMessage } from '../../networkStorage/api/networkStorage';
import AdvancedSettings from '../../networkStorage/components/AdvancedSettings';
import { HLS_QUALITIES, type HlsOptions, hlsRequest, normalizeId } from '../api/hls';

type NumberField = 'LeaseMinutes' | 'MaxAttempts' | 'OrphanRetentionHours' | 'PlaybackTokenHours';

const NUMBER_FIELDS: { name: NumberField, min: number, max: number }[] = [
    { name: 'LeaseMinutes', min: 1, max: 60 },
    { name: 'MaxAttempts', min: 1, max: 20 },
    { name: 'OrphanRetentionHours', min: 0, max: 8760 },
    { name: 'PlaybackTokenHours', min: 1, max: 168 }
];

const toggle = (values: number[], value: number, checked: boolean) => (
    checked ? [ ...values.filter(v => v !== value), value ].sort((a, b) => b - a) : values.filter(v => v !== value)
);

/** What is pre-encoded, which qualities, when the original may be played, and the settings of the jobs. */
const SettingsTab = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    const folders = useVirtualFolders();
    const [ options, setOptions ] = useState<HlsOptions>();
    // Apart from the list, so that taking the last library out does not choose every library.
    const [ isAllLibraries, setIsAllLibraries ] = useState(false);
    const [ error, setError ] = useState<string>();
    const [ isBusy, setIsBusy ] = useState(false);
    const [ isSavedToastOpen, setIsSavedToastOpen ] = useState(false);

    const stored = useQuery({
        queryKey: [ 'HlsSettings', api?.basePath ],
        // The signing key is not kept: the cache is stored in the browser, and saving keeps the key of the server anyway.
        queryFn: async ({ signal }) => ({ ...await hlsRequest<HlsOptions>(api!, '/Settings', { signal }), PlaybackSigningKey: '' }),
        enabled: !!api
    });

    useEffect(() => {
        if (stored.data) {
            setOptions(stored.data);
            setIsAllLibraries(stored.data.Libraries.length === 0);
        }
    }, [ stored.data ]);

    const setField = useCallback(<K extends keyof HlsOptions>(name: K, value: HlsOptions[K]) => {
        setOptions(previous => previous && ({ ...previous, [name]: value }));
    }, []);

    const libraries = useMemo(() => (folders.data ?? []).filter(f => !!f.ItemId), [ folders.data ]);
    const isChosen = (id: string) => isAllLibraries || !!options?.Libraries.some(l => normalizeId(l) === normalizeId(id));
    const getOwnQualities = (id: string) => options?.LibraryQualities.find(l => normalizeId(l.LibraryId) === normalizeId(id));

    // Leaving "every library" keeps every library chosen, for the ones not wanted to be taken out.
    const setAllLibraries = useCallback((checked: boolean) => {
        setIsAllLibraries(checked);
        setField('Libraries', checked ? [] : libraries.map(f => f.ItemId!));
    }, [ libraries, setField ]);

    const setLibrary = useCallback((id: string, checked: boolean) => {
        setOptions(previous => previous && ({
            ...previous,
            Libraries: checked ?
                [ ...previous.Libraries, id ] :
                previous.Libraries.filter(l => normalizeId(l) !== normalizeId(id))
        }));
    }, []);

    // A library with qualities of its own starts with the global ones; the entry of a library is kept while it is not chosen.
    const setOwnQualities = useCallback((id: string, checked: boolean) => {
        setOptions(previous => previous && ({
            ...previous,
            LibraryQualities: checked ?
                [ ...previous.LibraryQualities, { LibraryId: id, Qualities: [ ...previous.Qualities ] } ] :
                previous.LibraryQualities.filter(l => normalizeId(l.LibraryId) !== normalizeId(id))
        }));
    }, []);

    const setLibraryQuality = useCallback((id: string, quality: number, checked: boolean) => {
        setOptions(previous => previous && ({
            ...previous,
            LibraryQualities: previous.LibraryQualities.map(l => (
                normalizeId(l.LibraryId) === normalizeId(id) ? { ...l, Qualities: toggle(l.Qualities, quality, checked) } : l
            ))
        }));
    }, []);

    const save = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!options) return;
        // No library chosen would be read as every library.
        if (!isAllLibraries && !options.Libraries.some(id => libraries.some(f => normalizeId(f.ItemId) === normalizeId(id)))) {
            setError(globalize.translate('HlsLibrariesRequired'));
            return;
        }

        setIsBusy(true);
        setError(undefined);
        try {
            // The libraries deleted since are left out: their entries are not shown, and could not be changed.
            const exists = (id: string) => libraries.some(f => normalizeId(f.ItemId) === normalizeId(id));
            // An empty signing key keeps that of the server.
            await hlsRequest<string>(api!, '/Settings', {
                method: 'PUT',
                data: {
                    ...options,
                    Libraries: isAllLibraries ? [] : options.Libraries.filter(exists),
                    LibraryQualities: options.LibraryQualities.filter(l => exists(l.LibraryId)),
                    PlaybackSigningKey: ''
                }
            });
            await queryClient.invalidateQueries({ queryKey: [ 'HlsSettings' ] });
            await queryClient.invalidateQueries({ queryKey: [ 'HlsStatus' ] });
            setIsSavedToastOpen(true);
        } catch (err) {
            setError(getErrorMessage(err) ?? globalize.translate('HlsError'));
        } finally {
            setIsBusy(false);
        }
    }, [ api, isAllLibraries, libraries, options, queryClient ]);

    const closeToast = useCallback(() => setIsSavedToastOpen(false), []);

    if (stored.isError || folders.isError) {
        return <Alert severity='error'>{globalize.translate('HlsError')}</Alert>;
    }

    // The form waits for the libraries, which saving leaves the deleted ones out by.
    if (!options || !folders.data) {
        return null;
    }

    return (
        <Stack spacing={2} component='form' onSubmit={save}>
            <Toast open={isSavedToastOpen} onClose={closeToast} message={globalize.translate('SettingsSaved')} />

            <FormControlLabel
                label={globalize.translate('HlsEnabled')}
                control={<Switch checked={options.Enabled} onChange={e => setField('Enabled', e.target.checked)} />}
            />

            <Card variant='outlined'>
                <CardContent>
                    <Stack spacing={1}>
                        <Typography fontWeight='bold'>{globalize.translate('HlsQualities')}</Typography>
                        <Typography variant='body2' color='text.secondary'>{globalize.translate('HlsQualitiesHelp')}</Typography>
                        <FormGroup row>
                            {HLS_QUALITIES.map(quality => (
                                <FormControlLabel
                                    key={quality}
                                    label={`${quality}p`}
                                    control={
                                        <Checkbox
                                            checked={options.Qualities.includes(quality)}
                                            onChange={e => setField('Qualities', toggle(options.Qualities, quality, e.target.checked))}
                                        />
                                    }
                                />
                            ))}
                        </FormGroup>
                    </Stack>
                </CardContent>
            </Card>

            <Card variant='outlined'>
                <CardContent>
                    <Stack spacing={1}>
                        <Typography fontWeight='bold'>{globalize.translate('HlsLibraries')}</Typography>
                        <FormControlLabel
                            label={globalize.translate('HlsAllLibraries')}
                            control={<Checkbox checked={isAllLibraries} onChange={e => setAllLibraries(e.target.checked)} />}
                        />
                        {libraries.map(folder => {
                            const id = folder.ItemId!;
                            const own = getOwnQualities(id);
                            return (
                                <Stack key={id} spacing={0.5} sx={{ pl: 2 }}>
                                    <Stack direction='row' spacing={2} alignItems='center' flexWrap='wrap' useFlexGap>
                                        <FormControlLabel
                                            label={folder.Name}
                                            control={
                                                <Checkbox
                                                    checked={isChosen(id)}
                                                    disabled={isAllLibraries}
                                                    onChange={e => setLibrary(id, e.target.checked)}
                                                />
                                            }
                                        />
                                        {isChosen(id) && (
                                            <FormControlLabel
                                                label={globalize.translate('HlsOwnQualities')}
                                                control={
                                                    <Switch
                                                        size='small'
                                                        checked={!!own}
                                                        onChange={e => setOwnQualities(id, e.target.checked)}
                                                    />
                                                }
                                            />
                                        )}
                                    </Stack>
                                    {isChosen(id) && own && (
                                        <FormGroup row sx={{ pl: 4 }}>
                                            {/* Only the qualities chosen for every library are encoded. */}
                                            {HLS_QUALITIES.filter(q => options.Qualities.includes(q)).map(quality => (
                                                <FormControlLabel
                                                    key={quality}
                                                    label={`${quality}p`}
                                                    control={
                                                        <Checkbox
                                                            size='small'
                                                            checked={own.Qualities.includes(quality)}
                                                            onChange={e => setLibraryQuality(id, quality, e.target.checked)}
                                                        />
                                                    }
                                                />
                                            ))}
                                        </FormGroup>
                                    )}
                                </Stack>
                            );
                        })}
                    </Stack>
                </CardContent>
            </Card>

            <Card variant='outlined'>
                <CardContent>
                    <Stack spacing={1}>
                        <Typography fontWeight='bold'>{globalize.translate('HlsOriginal')}</Typography>
                        <FormControlLabel
                            label={globalize.translate('HlsAllowOriginal')}
                            control={<Switch checked={options.AllowOriginal} onChange={e => setField('AllowOriginal', e.target.checked)} />}
                        />
                        <FormControlLabel
                            label={globalize.translate('HlsAllowLocalOriginal')}
                            control={
                                <Switch
                                    checked={options.AllowLocalOriginal}
                                    disabled={!options.AllowOriginal}
                                    onChange={e => setField('AllowLocalOriginal', e.target.checked)}
                                />
                            }
                        />
                        <Typography variant='body2' color='text.secondary'>{globalize.translate('HlsOriginalHelp')}</Typography>
                    </Stack>
                </CardContent>
            </Card>

            <AdvancedSettings>
                {NUMBER_FIELDS.map(field => (
                    <TextField
                        key={field.name}
                        type='number'
                        required
                        label={globalize.translate(`Hls${field.name}`)}
                        helperText={globalize.translate(`Hls${field.name}Help`, field.min, field.max)}
                        value={options[field.name]}
                        slotProps={{ htmlInput: { min: field.min, max: field.max, step: 1 } }}
                        onChange={e => setField(field.name, Number(e.target.value))}
                    />
                ))}
            </AdvancedSettings>

            {error && <Alert severity='error'>{error}</Alert>}
            <Stack direction='row'>
                <Button type='submit' variant='contained' disabled={isBusy}>{globalize.translate('Save')}</Button>
            </Stack>
        </Stack>
    );
};

export default SettingsTab;
