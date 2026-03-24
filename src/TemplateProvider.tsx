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
import { BlobInputDefinition, BlobWithMetadata, Inputs, JsonInputDefinition } from '@oicana/browser';
import { useTemplates } from './LoadingContext.tsx';

interface TemplateState {
    compile: (format: ExportFormat) => void;
    timings: number[];
    image?: string;
    setPixelsPerPt: Dispatch<SetStateAction<number>>;
    setTemplateId: Dispatch<SetStateAction<string>>;
    templateId?: string;
    pixelsPerPt: number;
    updateBlobInputs: (key: string, value: BlobWithMetadata) => void;
    updateJsonInputs: (key: string, value: string) => void;
    inputs?: Inputs;
    defaultJsonDatasets: Map<string, string>;
    workerState: WorkerState;
    error?: string;
    clearError: () => void;
}

export type WorkerState = 'ready' | 'error' | 'initializing';

export const useTemplate = () => {
    const {
        compile,
        timings,
        image,
        setPixelsPerPt,
        pixelsPerPt,
        updateBlobInputs,
        updateJsonInputs,
        inputs,
        setTemplateId,
        templateId,
        defaultJsonDatasets,
        workerState,
        error,
        clearError,
    } = useContext(TemplateContext);

    return {
        compile,
        timings,
        image,
        setPixelsPerPt,
        pixelsPerPt,
        updateBlobInputs,
        updateJsonInputs,
        inputs,
        setTemplateId,
        templateId,
        defaultJsonDatasets,
        workerState,
        error,
        clearError,
    };
};

const TemplateContext = createContext<TemplateState>({
    compile: () => {},
    timings: [],
    setPixelsPerPt: () => {},
    setTemplateId: () => {},
    pixelsPerPt: 1,
    updateJsonInputs: () => {},
    updateBlobInputs: () => {},
    defaultJsonDatasets: new Map(),
    workerState: 'initializing',
    clearError: () => {},
});

export enum ExportFormat {
    Pdf,
    Png,
}

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

    const [pixelsPerPt, setPixelsPerPt] = useState<number>(1);
    const [timings, setTimings] = useState<number[]>([]);
    const [image, setImageUrl] = useState<string>();
    const [error, setError] = useState<string | undefined>(undefined);

    const clearError = useCallback(() => {
        setError(undefined);
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

    const compile = useCallback(
        (format: ExportFormat) => {
            if (!sharedWorkerRef.current || templateId === undefined) {
                return;
            }
            setTimings([Date.now()]);
            sendMessageToWorker(
                sharedWorkerRef.current.port,
                format === ExportFormat.Png
                    ? {
                          kind: TemplatingWorkerRequestKind.Preview,
                          jsonInput: jsonInputs.current,
                          blobInput: blobInputs.current,
                          templateId,
                          templatePath: templates.get(templateId)!,
                          pixelsPerPt,
                      }
                    : {
                          kind: TemplatingWorkerRequestKind.Compile,
                          jsonInput: jsonInputs.current,
                          blobInput: blobInputs.current,
                          templateId,
                          templatePath: templates.get(templateId)!,
                      },
            );
        },
        [templateId, pixelsPerPt, templates],
    );

    useEffect(() => {
        compile(ExportFormat.Png);
    }, [compile]);

    const updateBlobInputs = useCallback(
        (key: string, value: BlobWithMetadata) => {
            blobInputs.current.set(key, value);
            compile(ExportFormat.Png);
        },
        [compile],
    );

    const updateJsonInputs = useCallback(
        (key: string, value: string) => {
            jsonInputs.current.set(key, value);
            compile(ExportFormat.Png);
        },
        [compile],
    );

    useEffect(() => {
        return () => {
            if (image !== undefined) URL.revokeObjectURL(image);
        };
    }, [image]);

    useEffect(() => {
        if (sharedWorkerRef.current) {
            return;
        }
        const sharedWorker = new SharedWorker(new URL('./templating.worker.ts', import.meta.url), { type: 'module' });
        console.log('Connecting to WebWorker...');

        sharedWorker.port.onmessage = (event: MessageEvent<TemplatingWorkerResponse>) => {
            switch (event.data.kind) {
                case TemplatingWorkerResponseKind.Preview: {
                    setTimings((timings) => [timings[0], Date.now()]);
                    setImageUrl(URL.createObjectURL(new Blob([event.data.data], { type: 'image/png' })));
                    setError(undefined);
                    break;
                }
                case TemplatingWorkerResponseKind.Compile: {
                    setTimings((timings) => [timings[0], Date.now()]);
                    downloadPdf(event.data.data, `${event.data.templateId}_${Date.now()}.pdf`);
                    setError(undefined);
                    break;
                }
                case TemplatingWorkerResponseKind.Error: {
                    setTimings((timings) => [timings[0], Date.now()]);
                    setError(event.data.error);
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
    }, [templates]);

    return (
        <TemplateContext.Provider
            value={{
                compile,
                timings,
                image,
                setPixelsPerPt,
                pixelsPerPt,
                updateBlobInputs,
                updateJsonInputs,
                inputs,
                setTemplateId,
                templateId,
                defaultJsonDatasets,
                workerState,
                error,
                clearError,
            }}
        >
            {children}
        </TemplateContext.Provider>
    );
};
