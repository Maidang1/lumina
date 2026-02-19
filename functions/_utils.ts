/// <reference types="@cloudflare/workers-types" />

export {
  buildImageApiUrls,
  decodeImageListCursor,
  encodeImageListCursor,
  imageIdToMetaPath,
  imageIdToObjectPath,
  isValidImageId,
} from "./utils/image";
export { decodeBase64Utf8 } from "./utils/encoding";

export { corsHeaders, errorResponse, jsonResponse, validateUploadToken } from "./utils/http";

export { createGitHubClient, GitHubClient } from "./utils/github";
export { buildSignedAssetUrl, validateSignedAssetAccess } from "./utils/share";

export type {
  Env,
  ImageMetadata,
  UploadResult,
  ImageListCursor,
  ImageIndexEntry,
  ImageIndexFile,
  GitHubFileResponse,
} from "./utils/types";
