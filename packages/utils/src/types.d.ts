export interface Logger {
    log: (message: string) => void;
    error: (message: string) => void;
    warn: (message: string) => void;
    debug: (message: string) => void;
}
export interface ValidationError {
    field: string;
    message: string;
    value?: unknown;
}
//# sourceMappingURL=types.d.ts.map