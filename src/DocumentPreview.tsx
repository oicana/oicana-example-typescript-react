import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useTemplate } from './TemplateProvider.tsx';

// Render resolution bounds (pixels per point) handed to the worker.
const MIN_PIXELS_PER_PT = 0.5;
const MAX_PIXELS_PER_PT = 4;
const PAGE_GAP = 16;
const COLUMN_PADDING = 24;
// Render pages this many pixels above/below the viewport before they appear.
const OVERSCAN = '400px 0px';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const DocumentPreview: FC = () => {
    const { pages, pageImages, requestPage, zoom, documentToken } = useTemplate();

    const containerRef = useRef<HTMLDivElement>(null);
    const visibleRef = useRef<Set<number>>(new Set());
    const [containerWidth, setContainerWidth] = useState(0);

    useEffect(() => {
        const element = containerRef.current;
        if (!element) {
            return;
        }
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
            }
        });
        observer.observe(element);
        setContainerWidth(element.clientWidth);
        return () => observer.disconnect();
    }, []);

    const maxPageWidthPt = useMemo(() => pages.reduce((max, page) => Math.max(max, page.width), 0), [pages]);

    const available = Math.max(containerWidth - 2 * COLUMN_PADDING, 0);
    const fitScale = maxPageWidthPt > 0 && available > 0 ? available / maxPageWidthPt : 1;
    // CSS pixels per typographic point at the current zoom.
    const pxPerPt = fitScale * zoom;
    // Render a little above the display scale (and for the device pixel ratio) so
    // pages stay sharp, but cap it so extreme zoom does not produce huge images.
    const renderPixelsPerPt = clamp(pxPerPt * (window.devicePixelRatio || 1), MIN_PIXELS_PER_PT, MAX_PIXELS_PER_PT);

    const renderPppRef = useRef(renderPixelsPerPt);
    renderPppRef.current = renderPixelsPerPt;

    // Forget which pages were visible whenever a fresh document is compiled.
    useEffect(() => {
        visibleRef.current = new Set();
    }, [documentToken]);

    // Only render pages that are near the viewport
    useEffect(() => {
        const root = containerRef.current;
        if (!root || pages.length === 0) {
            return;
        }
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    const index = Number((entry.target as HTMLElement).dataset.pageIndex);
                    if (entry.isIntersecting) {
                        visibleRef.current.add(index);
                        requestPage(index, renderPppRef.current);
                    } else {
                        visibleRef.current.delete(index);
                    }
                }
            },
            { root, rootMargin: OVERSCAN, threshold: 0.01 },
        );
        for (const element of root.querySelectorAll('[data-page-index]')) {
            observer.observe(element);
        }
        return () => observer.disconnect();
    }, [pages.length, documentToken, requestPage]);

    // When the zoom (and thus render resolution) changes, re-render the pages
    // that are currently visible so they stay crisp.
    useEffect(() => {
        for (const index of visibleRef.current) {
            requestPage(index, renderPixelsPerPt);
        }
    }, [renderPixelsPerPt, requestPage]);

    if (pages.length === 0) {
        return (
            <Box
                ref={containerRef}
                sx={{
                    flex: 1,
                    overflow: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'grey.900',
                }}
            >
                <Typography variant="body1" color="text.secondary">
                    Preview will appear here
                </Typography>
            </Box>
        );
    }

    return (
        <Box ref={containerRef} sx={{ flex: 1, overflow: 'auto', bgcolor: 'grey.900' }}>
            <Box
                sx={{
                    width: 'fit-content',
                    margin: '0 auto',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: `${PAGE_GAP}px`,
                    p: `${COLUMN_PADDING}px`,
                }}
            >
                {pages.map((page, index) => {
                    const image = pageImages.get(index);
                    return (
                        <Box
                            key={index}
                            data-page-index={index}
                            sx={{
                                position: 'relative',
                                flexShrink: 0,
                                width: page.width * pxPerPt,
                                height: page.height * pxPerPt,
                                bgcolor: '#fff',
                                boxShadow: 4,
                            }}
                        >
                            {image ? (
                                <Box
                                    component="img"
                                    src={image}
                                    alt={`Page ${index + 1}`}
                                    sx={{ display: 'block', width: '100%', height: '100%' }}
                                />
                            ) : (
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        inset: 0,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 1,
                                        color: 'grey.500',
                                    }}
                                >
                                    <CircularProgress size={24} thickness={5} />
                                    <Typography variant="caption">Page {index + 1}</Typography>
                                </Box>
                            )}
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
};
