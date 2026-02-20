/// <reference types="@cloudflare/workers-types" />

export {
  buildImageApiUrls,
  decodeImageListCursor,
  encodeImageListCursor,
  imageIdToMetaPath,
  imageIdToObjectPath,
  isValidImageId,
} from "@lumina/contracts";
export type {
  Env,
  ImageMetadata,
  UploadResult,
  BatchFinalizeRequest,
  BatchFinalizeResult,
  ImageListCursor,
  ImageIndexEntry,
  ImageIndexFile,
  GitHubFileResponse,
} from "@lumina/contracts";

export { decodeBase64Utf8, createGitHubClient, GitHubClient } from "@lumina/github-storage";

export {
  corsHeaders,
  errorResponse,
  jsonResponse,
  mapGitHubErrorToHttp,
  validateUploadToken,
} from "./utils/http";
export { buildSignedAssetUrl, validateSignedAssetAccess } from "./utils/share";
