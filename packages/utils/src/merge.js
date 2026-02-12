/**
 * Config merging utilities
 */
export function mergeConfigs(base, override) {
    return { ...base, ...override };
}
export function deepMerge(base, override) {
    const result = { ...base };
    for (const [key, value] of Object.entries(override)) {
        if (value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            result[key] &&
            typeof result[key] === 'object' &&
            !Array.isArray(result[key])) {
            result[key] = deepMerge(result[key], value);
        }
        else {
            result[key] = value;
        }
    }
    return result;
}
//# sourceMappingURL=merge.js.map