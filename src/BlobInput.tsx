import { ChangeEvent, FC, useState } from 'react';
import { imageMimeToTypstFormat } from './imageMimeToTypstFormat.ts';
import { useTemplate } from './TemplateProvider.tsx';
import { Box, Button, Card, CardContent, Chip, Typography } from '@mui/material';
import { VisuallyHiddenInput } from './preview.styles.ts';

interface BlobInputProps {
    dataset: string;
}

export const BlobInput: FC<BlobInputProps> = ({ dataset }) => {
    const { updateBlobInputs } = useTemplate();
    const [fileName, setFileName] = useState<string | null>(null);

    const onImageChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.item(0);
        if (!file) return;
        const reader = new FileReader();
        const fileType = imageMimeToTypstFormat(file.type);

        setFileName(file.name);

        reader.onload = (e) => {
            if (e.target && e.target.result) {
                const arrayBuffer = e.target.result as ArrayBuffer;
                const uint8Array = new Uint8Array(arrayBuffer);
                const metadata = fileType !== undefined ? { image_format: fileType } : {};
                updateBlobInputs(dataset, { data: uint8Array, metadata });
            }
        };

        reader.readAsArrayBuffer(file);
    };

    return (
        <Card elevation={2} sx={{ transition: 'all 0.2s ease-in-out', '&:hover': { elevation: 4 } }}>
            <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mb: 1 }}>
                    File Input
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Button component="label" variant="contained" fullWidth sx={{ py: 1.5 }}>
                        {`Select ${dataset} file`}
                        <VisuallyHiddenInput type="file" onChange={onImageChange} />
                    </Button>
                    {fileName && (
                        <Chip
                            label={fileName}
                            color="primary"
                            variant="outlined"
                            sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                        />
                    )}
                </Box>
            </CardContent>
        </Card>
    );
};
