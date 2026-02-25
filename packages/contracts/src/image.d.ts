import type { ImageListCursor, UploadResult } from "./types";
export declare function isValidImageId(imageId: string): boolean;
export declare function imageIdToObjectPath(imageId: string): string;
export declare function imageIdToMetaPath(imageId: string): string;
export declare function buildImageApiUrls(imageId: string): UploadResult["urls"];
export declare function encodeImageListCursor(cursor: ImageListCursor): string;
export declare function decodeImageListCursor(cursor: string): ImageListCursor | null;
//# sourceMappingURL=image.d.ts.map