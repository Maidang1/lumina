/// <reference types="@cloudflare/workers-types" />

export {
  buildImageApiUrls,
  decodeImageListCursor,
  encodeImageListCursor,
  imageIdToMetaPath,
  imageIdToObjectPath,
  isValidImageId,
} from "@luminafe/contracts";
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
} from "@luminafe/contracts";

export {
  decodeBase64Utf8,
  createGitHubClient,
  GitHubClient,
} from "@luminafe/github-storage";

export {
  corsHeaders,
  buildJsDelivrUrl,
  errorResponse,
  jsonResponse,
  mapGitHubErrorToHttp,
  validateUploadToken,
} from "./utils/http";
export { buildSignedAssetUrl, validateSignedAssetAccess } from "./utils/share";
