import React, { type PropsWithChildren } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ExpandMore from '@mui/icons-material/ExpandMore';

import globalize from 'lib/globalize';

/** Settings that rarely need changing, folded away. */
const AdvancedSettings = ({ children }: PropsWithChildren) => (
    <Accordion variant='outlined' disableGutters slotProps={{ transition: { unmountOnExit: true } }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography>{globalize.translate('NetworkStorageAdvanced')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
            <Stack spacing={2}>{children}</Stack>
        </AccordionDetails>
    </Accordion>
);

export default AdvancedSettings;
