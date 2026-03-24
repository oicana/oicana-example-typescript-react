import {
    BlobInputDefinition,
    BlobWithMetadata,
    CompilationMode,
    initialize,
    JsonInputDefinition,
    Template,
} from '@oicana/browser';
import wasmUrl from '@oicana/browser-wasm/oicana_browser_wasm_bg.wasm?url';

const templateFiles: Map<string, Promise<Uint8Array>> = new Map();
const templateCache: Map<string, Promise<Template>> = new Map();
let initState: 'idle' | 'initializing' | 'initialized' | 'error' = 'idle';
let initPromise: Promise<void> | undefined = undefined;
let initError: unknown;

const initializeWasm = async () => {
    switch (initState) {
        case 'idle':
            try {
                initState = 'initializing';
                initPromise = initialize(wasmUrl);
                await initPromise;
                initState = 'initialized';
            } catch (error) {
                initError = error;
                initState = 'error';
                throw error;
            }
            break;
        case 'initializing':
            return initPromise;
        case 'initialized':
            return Promise.resolve();
        case 'error':
            return Promise.reject(initError);
    }
};

export enum TemplatingWorkerResponseKind {
    Ready,
    Broken,
    Preview,
    Compile,
    Datasets,
    Source,
    Error,
}

export type TemplatingWorkerResponse =
    | {
          kind: TemplatingWorkerResponseKind.Broken | TemplatingWorkerResponseKind.Ready;
      }
    | {
          kind: TemplatingWorkerResponseKind.Preview | TemplatingWorkerResponseKind.Compile;
          data: Uint8Array<ArrayBuffer>;
          templateId: string;
      }
    | {
          kind: TemplatingWorkerResponseKind.Datasets;
          templateId: string;
          inputs: (BlobInputDefinition | JsonInputDefinition)[];
      }
    | {
          kind: TemplatingWorkerResponseKind.Source;
          key: string;
          file: string;
          value: string;
      }
    | {
          kind: TemplatingWorkerResponseKind.Error;
          templateId: string;
          error: string;
      };

export enum TemplatingWorkerRequestKind {
    Preview,
    Compile,
    Datasets,
    Source,
}

export type TemplatingWorkerRequest =
    | {
          kind: TemplatingWorkerRequestKind.Preview;
          jsonInput: Map<string, string>;
          blobInput: Map<string, BlobWithMetadata>;
          templateId: string;
          templatePath: string;
          pixelsPerPt: number;
      }
    | {
          kind: TemplatingWorkerRequestKind.Compile;
          jsonInput: Map<string, string>;
          blobInput: Map<string, BlobWithMetadata>;
          templateId: string;
          templatePath: string;
      }
    | {
          kind: TemplatingWorkerRequestKind.Datasets;
          templateId: string;
          templatePath: string;
      }
    | {
          kind: TemplatingWorkerRequestKind.Source;
          key: string;
          templateId: string;
          templatePath: string;
          file: string;
      };

const postMessage = (port: MessagePort, message: TemplatingWorkerResponse) => {
    switch (message.kind) {
        case TemplatingWorkerResponseKind.Preview:
        case TemplatingWorkerResponseKind.Compile: {
            const copy = new Uint8Array(message.data);
            port.postMessage({ ...message, data: copy.buffer }, [copy.buffer]);
            break;
        }
        default:
            port.postMessage(message);
    }
};

const handleError = (port: MessagePort, templateId: string, e: unknown) => {
    console.error(`Error: ${e}`);
    const error = e instanceof Error ? e.message : String(e);
    postMessage(port, { kind: TemplatingWorkerResponseKind.Error, templateId, error });
};

const isReady = async () => {
    try {
        await initializeWasm();
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
};

const getTemplate = async (templateId: string, templatePath: string): Promise<Template> => {
    if (templateId === undefined) {
        throw Error('template id was not defined');
    }
    if (!templateCache.has(templateId)) {
        const prepareTemplate = async () => {
            const files = await loadTemplate(templatePath);
            return new Template(files);
        };
        templateCache.set(templateId, prepareTemplate());
    }
    return (await templateCache.get(templateId))!;
};

const loadTemplate = async (templatePath: string): Promise<Uint8Array> => {
    if (!templateFiles.has(templatePath)) {
        const fetchTemplate = async (): Promise<Uint8Array> => {
            const response = await fetch(`/templates/${templatePath}`);
            const arrayBuffer = await response.arrayBuffer();
            return new Uint8Array(arrayBuffer);
        };
        templateFiles.set(templatePath, fetchTemplate());
    }
    return (await templateFiles.get(templatePath))!;
};

addEventListener('connect', async (event: Event) => {
    const messageEvent = event as MessageEvent;
    console.log('Shared worker received a connection.');
    const port = messageEvent.ports[0];

    port.onmessage = async (event: MessageEvent<TemplatingWorkerRequest>) => {
        if (!(await isReady())) {
            console.error('Ignoring message because of error during WASM initialisation');
            return;
        }

        switch (event.data.kind) {
            case TemplatingWorkerRequestKind.Preview: {
                try {
                    const { templateId, templatePath, pixelsPerPt, jsonInput, blobInput } = event.data;
                    const template = await getTemplate(templateId, templatePath);
                    const data = template.compile(
                        jsonInput,
                        blobInput,
                        { format: 'png', pixelsPerPt },
                        CompilationMode.Development,
                    );
                    postMessage(port, { kind: TemplatingWorkerResponseKind.Preview, data, templateId });
                } catch (e) {
                    handleError(port, event.data.templateId, e);
                }
                break;
            }
            case TemplatingWorkerRequestKind.Compile: {
                try {
                    const { templateId, templatePath, jsonInput, blobInput } = event.data;
                    const template = await getTemplate(templateId, templatePath);
                    const data = template.compile(jsonInput, blobInput, { format: 'pdf' }, CompilationMode.Development);
                    postMessage(port, { kind: TemplatingWorkerResponseKind.Compile, data, templateId });
                } catch (e) {
                    handleError(port, event.data.templateId, e);
                }
                break;
            }
            case TemplatingWorkerRequestKind.Datasets: {
                try {
                    const { templateId, templatePath } = event.data;
                    const template = await getTemplate(templateId, templatePath);
                    const { inputs } = template.inputs();
                    postMessage(port, { kind: TemplatingWorkerResponseKind.Datasets, inputs, templateId });
                } catch (e) {
                    handleError(port, event.data.templateId, e);
                }
                break;
            }
            case TemplatingWorkerRequestKind.Source: {
                try {
                    const { templateId, templatePath, file, key } = event.data;
                    const template = await getTemplate(templateId, templatePath);
                    const source = template.source(file);
                    postMessage(port, { kind: TemplatingWorkerResponseKind.Source, value: source, file, key });
                } catch (e) {
                    handleError(port, event.data.templateId, e);
                }
                break;
            }
        }
    };
    port.start();

    if (await isReady()) {
        postMessage(port, { kind: TemplatingWorkerResponseKind.Ready });
    } else {
        postMessage(port, { kind: TemplatingWorkerResponseKind.Broken });
    }
});

export const sendMessageToWorker = (port: MessagePort, request: TemplatingWorkerRequest) => {
    port.postMessage(request);
};
