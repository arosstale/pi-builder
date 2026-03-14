/**
 * Generate unique IDs
 */
export function generateId(prefix) {
    const id = crypto.randomUUID();
    return prefix ? `${prefix}_${id}` : id;
}
export function generateSlug(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}
//# sourceMappingURL=id.js.map