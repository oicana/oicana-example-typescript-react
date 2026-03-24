import { createContext, FC, PropsWithChildren, useContext, useMemo } from 'react';

const LoadingContext = createContext<{ templates: Map<string, string> }>({ templates: new Map<string, string>() });

export const useTemplates = (): Map<string, string> => {
    const { templates } = useContext(LoadingContext);

    return templates;
};

export const LoadingScreen: FC<PropsWithChildren> = ({ children }) => {
    const templateIndex = useMemo(() => {
        const index = new Map<string, string>();
        index.set('invoice', 'invoice-0.1.0.zip');
        index.set('certificate', 'certificate-0.1.0.zip');
        index.set('dependency', 'dependency-0.1.0.zip');
        index.set('fonts', 'fonts-0.1.0.zip');
        index.set('invoice_zugferd', 'invoice_zugferd-0.1.0.zip');
        index.set('minimal', 'minimal-0.1.0.zip');
        index.set('table', 'table-0.1.0.zip');
        index.set('multi_input', 'multi_input-0.1.0.zip');
        index.set('accessibility', 'accessibility-0.1.0.zip');
        return index;
    }, []);

    return <LoadingContext.Provider value={{ templates: templateIndex }}>{children}</LoadingContext.Provider>;
};
