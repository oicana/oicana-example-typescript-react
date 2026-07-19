import { FC, useEffect, useMemo, useState } from 'react';
import { useTemplates } from './LoadingContext.tsx';
import { useTemplate } from './TemplateProvider.tsx';
import { InputsEditor } from './InputsEditor.tsx';
import { DocumentPreview } from './DocumentPreview.tsx';
import {
    Alert,
    AppBar,
    Box,
    Button,
    Drawer,
    FormControl,
    Grid,
    InputLabel,
    Link,
    MenuItem,
    Select,
    Stack,
    Toolbar,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import { DiagnosticDisplay } from './DiagnosticDisplay.tsx';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;
const clampZoom = (zoom: number) => Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM);

export const Preview: FC = () => {
    const { pages, zoom, setZoom, exportPdf, setTemplateId, templateId, error, clearError, warnings, clearWarnings } =
        useTemplate();
    const templates = useTemplates();
    const templateIds = useMemo(() => Array.from(templates.keys()), [templates]);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [noticeOpen, setNoticeOpen] = useState(true);

    const hasPages = pages.length > 0;
    const hasDiagnostics = !!error || !!warnings;

    const diagnostics = hasDiagnostics && (
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            <Stack spacing={1}>
                {error && <DiagnosticDisplay severity="error" message={error} onClose={clearError} />}
                {warnings && <DiagnosticDisplay severity="warning" message={warnings} onClose={clearWarnings} />}
            </Stack>
        </Box>
    );

    useEffect(() => {
        if (templateIds.length > 0) {
            setTemplateId(templateIds[0]);
        }
    }, [templateIds, setTemplateId]);

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                bgcolor: 'background.default',
                overflow: 'hidden',
            }}
        >
            <AppBar position="static" elevation={2} sx={{ bgcolor: 'background.paper', flexShrink: 0 }}>
                <Toolbar sx={{ gap: 2, flexWrap: 'wrap', py: 1 }}>
                    <Typography
                        variant="h4"
                        component="a"
                        href="https://oicana.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                            flexGrow: { xs: 1, md: 0 },
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            fontWeight: 700,
                            textDecoration: 'none',
                            display: { xs: 'none', sm: 'block' },
                        }}
                    >
                        Oicana
                    </Typography>

                    {isMobile && (
                        <Button variant="outlined" onClick={() => setDrawerOpen(true)} size="small">
                            Inputs
                        </Button>
                    )}

                    <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'block' } }} />

                    <FormControl variant="outlined" size="small" sx={{ minWidth: 160 }}>
                        <InputLabel id="template-label">Template</InputLabel>
                        <Select
                            labelId="template-label"
                            label="Template"
                            value={templateId}
                            onChange={(e) => setTemplateId(e.target.value)}
                        >
                            {templateIds.map((id) => (
                                <MenuItem value={id} key={id}>
                                    {id}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Button
                            variant="outlined"
                            size="small"
                            aria-label="Zoom out"
                            disabled={!hasPages}
                            onClick={() => setZoom((zoom) => clampZoom(zoom * 0.8))}
                            sx={{ minWidth: 36 }}
                        >
                            −
                        </Button>
                        <Typography variant="body2" sx={{ minWidth: 52, textAlign: 'center', fontFamily: 'monospace' }}>
                            {Math.round(zoom * 100)}%
                        </Typography>
                        <Button
                            variant="outlined"
                            size="small"
                            aria-label="Zoom in"
                            disabled={!hasPages}
                            onClick={() => setZoom((zoom) => clampZoom(zoom * 1.25))}
                            sx={{ minWidth: 36 }}
                        >
                            +
                        </Button>
                        <Button size="small" disabled={!hasPages} onClick={() => setZoom(1)}>
                            Fit
                        </Button>
                    </Stack>

                    <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'block' } }} />

                    <Button variant="contained" onClick={() => exportPdf()} size={isMobile ? 'small' : 'medium'}>
                        Export PDF
                    </Button>
                </Toolbar>
            </AppBar>

            {noticeOpen && (
                <Alert severity="info" onClose={() => setNoticeOpen(false)} sx={{ borderRadius: 0, flexShrink: 0 }}>
                    This is an{' '}
                    <Link href="https://github.com/oicana/oicana-example-typescript-react" target="_blank">
                        open source example
                    </Link>{' '}
                    of <Link href="https://oicana.com">Oicana</Link>'s browser integration. The document preview and the
                    exported PDF are generated locally in your browser, no server involved.
                    <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
                        {' '}
                        The raw JSON inputs are exposed here so you can explore the templates; your own application
                        would likely fill them from its UI or backend instead.
                    </Box>
                    <br />
                    <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
                        The Oicana documentation teaches{' '}
                    </Box>
                    <Link href="https://oicana.com/docs/getting-started/1-setup/" target="_blank">
                        how to create and use your own templates.
                    </Link>
                </Alert>
            )}

            <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <Grid container sx={{ height: '100%', overflow: 'hidden' }} spacing={0}>
                    {!isMobile && (
                        <Grid
                            item
                            xs={12}
                            md={5}
                            lg={4}
                            sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                        >
                            <Box
                                sx={{
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    bgcolor: 'background.paper',
                                    borderRight: 1,
                                    borderColor: 'divider',
                                    overflow: 'hidden',
                                }}
                            >
                                <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
                                    <Typography variant="h6">Template Inputs</Typography>
                                </Box>
                                <Box
                                    sx={{
                                        flex: 1,
                                        overflow: 'auto',
                                        p: 3,
                                    }}
                                >
                                    <Stack spacing={3}>
                                        <InputsEditor />
                                    </Stack>
                                </Box>
                                {diagnostics}
                            </Box>
                        </Grid>
                    )}

                    <Grid item xs={12} md={7} lg={8} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <DocumentPreview />
                    </Grid>
                </Grid>
            </Box>

            {isMobile && (
                <Drawer
                    anchor="bottom"
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    PaperProps={{
                        sx: {
                            maxHeight: '80vh',
                            borderTopLeftRadius: 16,
                            borderTopRightRadius: 16,
                            display: 'flex',
                            flexDirection: 'column',
                        },
                    }}
                >
                    <Box sx={{ p: 3, borderBottom: hasDiagnostics ? 1 : 0, borderColor: 'divider' }}>
                        <Typography variant="h6">Template Inputs</Typography>
                    </Box>
                    <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                        <Stack spacing={3}>
                            <InputsEditor />
                        </Stack>
                    </Box>
                    {diagnostics}
                </Drawer>
            )}
        </Box>
    );
};
