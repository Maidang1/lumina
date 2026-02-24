export function isValidImageId(imageId) {
    return /^sha256:[a-f0-9]{64}$/i.test(imageId);
}
export function imageIdToObjectPath(imageId) {
    const hex = imageId.replace("sha256:", "");
    const p1 = hex.slice(0, 2);
    const p2 = hex.slice(2, 4);
    return `objects/${p1}/${p2}/sha256_${hex}`;
}
export function imageIdToMetaPath(imageId) {
    return `${imageIdToObjectPath(imageId)}/meta.json`;
}
export function buildImageApiUrls(imageId) {
    const encoded = encodeURIComponent(imageId);
    return {
        meta: `/api/v1/images/${encoded}`,
        thumb: `/api/v1/images/${encoded}/thumb`,
        original: `/api/v1/images/${encoded}/original`,
    };
}
export function encodeImageListCursor(cursor) {
    return btoa(JSON.stringify(cursor));
}
export function decodeImageListCursor(cursor) {
    try {
        const value = JSON.parse(atob(cursor));
        if (!value.created_at || !value.image_id) {
            return null;
        }
        return value;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=image.js.map