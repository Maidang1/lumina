import { metadataToPhoto as mapMetadataToPhoto } from "@luminafe/gallery-core";
import type { ImageMetadata, Photo } from "@/types/photo";

interface CdnRepoConfig {
  owner?: string;
  repo?: string;
  branch?: string;
}

export function metadataToPhoto(
  metadata: ImageMetadata,
  cdnRepo: CdnRepoConfig = {},
): Photo {
  return mapMetadataToPhoto(metadata, {
    cdnRepo,
    apiBasePath: "/api",
  }) as Photo;
}
