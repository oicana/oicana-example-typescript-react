import { Alert, AlertTitle, Box, Collapse, Typography } from '@mui/material';
import { FC } from 'react';

export type DiagnosticSeverity = 'error' | 'warning';

interface DiagnosticDisplayProps {
    severity: DiagnosticSeverity;
    message: string;
    onClose: () => void;
}

const titles: Record<DiagnosticSeverity, string> = {
    error: 'Compilation Error',
    warning: 'Compilation Warnings',
};

export const DiagnosticDisplay: FC<DiagnosticDisplayProps> = ({ severity, message, onClose }) => {
    return (
        <Collapse in={!!message}>
            <Box sx={{ width: '100%' }}>
                <Alert
                    severity={severity}
                    onClose={onClose}
                    sx={{
                        borderRadius: 2,
                        '& .MuiAlert-message': {
                            width: '100%',
                            maxWidth: '100%',
                        },
                        animation: 'slideIn 0.3s ease-out',
                        '@keyframes slideIn': {
                            from: {
                                opacity: 0,
                                transform: 'translateY(-10px)',
                            },
                            to: {
                                opacity: 1,
                                transform: 'translateY(0)',
                            },
                        },
                    }}
                >
                    <AlertTitle sx={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: 1 }}>
                        {titles[severity]}
                    </AlertTitle>
                    <Typography
                        component="pre"
                        sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.8rem',
                            whiteSpace: 'pre-wrap',
                            overflow: 'auto',
                            margin: 0,
                            lineHeight: 1.6,
                            textAlign: 'left',
                            maxHeight: '200px',
                        }}
                    >
                        {message}
                    </Typography>
                </Alert>
            </Box>
        </Collapse>
    );
};
