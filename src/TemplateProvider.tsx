import {
    createContext,
    Dispatch,
    FC,
    PropsWithChildren,
    SetStateAction,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';
import {
    sendMessageToWorker,
    TemplatingWorkerRequestKind,
    TemplatingWorkerResponse,
    TemplatingWorkerResponseKind,
} from './templating.worker.ts';
import { BlobInputDefinition, BlobWithMetadata, Inputs, JsonInputDefinition, PageSize } from '@oicana/browser';
import { useTemplates } from './LoadingContext.tsx';

interface TemplateState {
    compilePreview: () => void;
    exportPdf: () => void;
    timings: number[];
    pages: PageSize[];
    documentToken: number;
    pageImages: Map<number, string>;
    requestPage: (pageIndex: number, pixelsPerPt: number) => void;
    zoom: number;
    setZoom: Dispatch<SetStateAction<number>>;
    setTemplateId: Dispatch<SetStateAction<string>>;
    templateId?: string;
    updateBlobInputs: (key: string, value: BlobWithMetadata) => void;
    updateJsonInputs: (key: string, value: string) => void;
    inputs?: Inputs;
    defaultJsonDatasets: Map<string, string>;
    workerState: WorkerState;
    error?: string;
    clearError: () => void;
    warnings?: string;
    clearWarnings: () => void;
}

export type WorkerState = 'ready' | 'error' | 'initializing';

export const useTemplate = () => {
    return useContext(TemplateContext);
};

const TemplateContext = createContext<TemplateState>({
    compilePreview: () => {},
    exportPdf: () => {},
    timings: [],
    pages: [],
    documentToken: 0,
    pageImages: new Map(),
    requestPage: () => {},
    zoom: 1,
    setZoom: () => {},
    setTemplateId: () => {},
    updateJsonInputs: () => {},
    updateBlobInputs: () => {},
    defaultJsonDatasets: new Map(),
    workerState: 'initializing',
    clearError: () => {},
    clearWarnings: () => {},
});

const downloadPdf = (data: ArrayBuffer | Uint8Array<ArrayBuffer>, fileName: string) => {
    const blob = new Blob([data], {
        type: 'application/pdf',
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.style.display = 'none';
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
};

export const TemplateProvider: FC<PropsWithChildren> = ({ children }) => {
    const templates = useTemplates();
    const sharedWorkerRef = useRef<SharedWorker | undefined>(undefined);
    const blobInputs = useRef<Map<string, BlobWithMetadata>>(new Map<string, BlobWithMetadata>());
    const jsonInputs = useRef<Map<string, string>>(new Map<string, string>());

    const [workerState, setWorkerState] = useState<WorkerState>('initializing');
    const [inputs, setInputs] = useState<Inputs>();
    const [templateId, setTemplateId] = useState<string>('');
    const [defaultJsonDatasets, setDefaultJsonDatasets] = useState(new Map<string, string>());

    const [zoom, setZoom] = useState<number>(1);
    const [timings, setTimings] = useState<number[]>([]);
    const [error, setError] = useState<string | undefined>(undefined);
    const [warnings, setWarnings] = useState<string | undefined>(undefined);

    const [pages, setPages] = useState<PageSize[]>([]);
    const [documentToken, setDocumentToken] = useState<number>(0);
    const [pageImages, setPageImages] = useState<Map<number, string>>(new Map());

    const tokenRef = useRef<number>(0);
    const pageImagesRef = useRef<Map<number, string>>(new Map());
    // pageIndex -> highest pixelsPerPt already requested for the current document.
    const requestedRef = useRef<Map<number, number>>(new Map());

    const clearError = useCallback(() => {
        setError(undefined);
    }, []);

    const clearWarnings = useCallback(() => {
        setWarnings(undefined);
    }, []);

    const prepareForNewDocument = useCallback((pageCount: number) => {
        requestedRef.current = new Map();
        let changed = false;
        const next = new Map(pageImagesRef.current);
        for (const [index, url] of next) {
            if (index >= pageCount) {
                URL.revokeObjectURL(url);
                next.delete(index);
                changed = true;
            }
        }
        if (changed) {
            pageImagesRef.current = next;
            setPageImages(next);
        }
    }, []);

    const setPageImage = useCallback((pageIndex: number, url: string) => {
        const previous = pageImagesRef.current.get(pageIndex);
        if (previous !== undefined) {
            URL.revokeObjectURL(previous);
        }
        const next = new Map(pageImagesRef.current);
        next.set(pageIndex, url);
        pageImagesRef.current = next;
        setPageImages(next);
    }, []);

    useEffect(() => {
        if (!sharedWorkerRef.current || templateId === undefined) {
            return;
        }
        jsonInputs.current.clear();
        blobInputs.current.clear();
        setDefaultJsonDatasets(new Map());
        sharedWorkerRef.current.port.postMessage({
            kind: TemplatingWorkerRequestKind.Datasets,
            templateId,
            templatePath: templates.get(templateId)!,
        });
    }, [templateId, templates]);

    const compilePreview = useCallback(() => {
        if (!sharedWorkerRef.current || !templateId) {
            return;
        }
        setTimings([Date.now()]);
        sendMessageToWorker(sharedWorkerRef.current.port, {
            kind: TemplatingWorkerRequestKind.Compile,
            jsonInput: jsonInputs.current,
            blobInput: blobInputs.current,
            templateId,
            templatePath: templates.get(templateId)!,
        });
    }, [templateId, templates]);

    const exportPdf = useCallback(() => {
        if (!sharedWorkerRef.current || !templateId) {
            return;
        }
        setTimings([Date.now()]);
        sendMessageToWorker(sharedWorkerRef.current.port, {
            kind: TemplatingWorkerRequestKind.ExportPdf,
            jsonInput: jsonInputs.current,
            blobInput: blobInputs.current,
            templateId,
            templatePath: templates.get(templateId)!,
        });
    }, [templateId, templates]);

    const requestPage = useCallback((pageIndex: number, pixelsPerPt: number) => {
        if (!sharedWorkerRef.current) {
            return;
        }
        // Skip pages we already rendered at an equal or higher resolution.
        const requested = requestedRef.current.get(pageIndex);
        if (requested !== undefined && requested >= pixelsPerPt) {
            return;
        }
        requestedRef.current.set(pageIndex, pixelsPerPt);
        sendMessageToWorker(sharedWorkerRef.current.port, {
            kind: TemplatingWorkerRequestKind.RenderPage,
            token: tokenRef.current,
            pageIndex,
            pixelsPerPt,
        });
    }, []);

    useEffect(() => {
        compilePreview();
    }, [compilePreview]);

    const updateBlobInputs = useCallback(
        (key: string, value: BlobWithMetadata) => {
            blobInputs.current.set(key, value);
            compilePreview();
        },
        [compilePreview],
    );

    const updateJsonInputs = useCallback(
        (key: string, value: string) => {
            jsonInputs.current.set(key, value);
            compilePreview();
        },
        [compilePreview],
    );

    useEffect(() => {
        return () => {
            for (const url of pageImagesRef.current.values()) {
                URL.revokeObjectURL(url);
            }
        };
    }, []);

    useEffect(() => {
        if (sharedWorkerRef.current) {
            return;
        }
        const sharedWorker = new SharedWorker(new URL('./templating.worker.ts', import.meta.url), { type: 'module' });
        console.log('Connecting to WebWorker...');

        sharedWorker.port.onmessage = (event: MessageEvent<TemplatingWorkerResponse>) => {
            switch (event.data.kind) {
                case TemplatingWorkerResponseKind.Compiled: {
                    const { token, pages, warnings } = event.data;
                    setTimings((timings) => [timings[0], Date.now()]);
                    prepareForNewDocument(pages.length);
                    tokenRef.current = token;
                    setDocumentToken(token);
                    setPages(pages);
                    setError(undefined);
                    setWarnings(warnings);
                    break;
                }
                case TemplatingWorkerResponseKind.Page: {
                    const { token, pageIndex, data } = event.data;
                    // Drop pages that belong to a superseded document.
                    if (token !== tokenRef.current) {
                        break;
                    }
                    setPageImage(pageIndex, URL.createObjectURL(new Blob([data], { type: 'image/png' })));
                    break;
                }
                case TemplatingWorkerResponseKind.Pdf: {
                    setTimings((timings) => [timings[0], Date.now()]);
                    downloadPdf(event.data.data, `${event.data.templateId}_${Date.now()}.pdf`);
                    setError(undefined);
                    setWarnings(event.data.warnings);
                    break;
                }
                case TemplatingWorkerResponseKind.Error: {
                    setTimings((timings) => [timings[0], Date.now()]);
                    setError(event.data.error);
                    setWarnings(undefined);
                    break;
                }
                case TemplatingWorkerResponseKind.Datasets: {
                    const { inputs, templateId } = event.data;
                    const data: Inputs = { json: [], blob: [] };
                    for (const input of inputs) {
                        const maybeSet = input as unknown as { type: string };
                        if (maybeSet.type === 'json') {
                            const jsonSet = input as JsonInputDefinition;
                            sendMessageToWorker(sharedWorker.port, {
                                kind: TemplatingWorkerRequestKind.Source,
                                templateId,
                                templatePath: templates.get(templateId)!,
                                key: jsonSet.key,
                                file: jsonSet.default,
                            });
                            data.json.push(jsonSet);
                        } else {
                            data.blob.push(input as BlobInputDefinition);
                        }
                    }
                    setInputs(data);
                    break;
                }
                case TemplatingWorkerResponseKind.Source: {
                    const { value, key } = event.data;
                    setDefaultJsonDatasets((defaultSets) => {
                        defaultSets.set(key, value);
                        return new Map(defaultSets);
                    });
                    break;
                }
                case TemplatingWorkerResponseKind.Ready: {
                    setWorkerState('ready');
                    setTimings([Date.now()]);
                    break;
                }
                case TemplatingWorkerResponseKind.Broken: {
                    setWorkerState('error');
                    break;
                }
            }
        };
        sharedWorker.port.onmessageerror = (event) => {
            console.error('Received error from worker:', event.data);
        };
        sharedWorker.port.start();

        sharedWorkerRef.current = sharedWorker;

        return () => {
            if (sharedWorkerRef.current) {
                sharedWorkerRef.current.port.close();
                sharedWorkerRef.current = undefined;
            }
        };
    }, [templates, prepareForNewDocument, setPageImage]);

    return (
        <TemplateContext.Provider
            value={{
                compilePreview,
                exportPdf,
                timings,
                pages,
                documentToken,
                pageImages,
                requestPage,
                zoom,
                setZoom,
                updateBlobInputs,
                updateJsonInputs,
                inputs,
                setTemplateId,
                templateId,
                defaultJsonDatasets,
                workerState,
                error,
                clearError,
                warnings,
                clearWarnings,
            }}
        >
            {children}
        </TemplateContext.Provider>
    );
};
