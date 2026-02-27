import { metadataToPhoto as mapMetadataToPhoto } from "@luminafe/gallery-core";
import type { ImageMetadata, Photo } from "@/features/photos/types";

interface RuntimeProcessLike {
  env?: Record<string, string | undefined>;
}

function getRuntimeEnv(name: string): string | undefined {
  const processLike = (globalThis as { process?: RuntimeProcessLike }).process;
  return processLike?.env?.[name];
}

export function metadataToPhoto(metadata: ImageMetadata): Photo {
  return mapMetadataToPhoto(metadata, {
    cdnRepo: {
      owner: getRuntimeEnv("RSBUILD_GH_OWNER"),
      repo: getRuntimeEnv("RSBUILD_GH_REPO"),
      branch: getRuntimeEnv("RSBUILD_GH_BRANCH"),
    },
    apiBasePath: "/api",
    includeCacheBust: true,
  }) as Photo;
}
