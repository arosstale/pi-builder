import type { ValidationError } from './types';
export declare function validateConfig(config: Record<string, unknown>): ValidationError[];
export declare function mergeConfigs<T extends Record<string, unknown>>(base: T, override: Partial<T>): T;
//# sourceMappingURL=validation.d.ts.map