type PrefetchPriority = "high" | "low";

interface PrefetchOptions {
  priority?: PrefetchPriority;
}

const MAX_CACHE_SIZE = 20;

class ImagePrefetchService {
  private cacheOrder: string[] = [];

  private cacheSet = new Set<string>();

  has(url: string): boolean {
    return this.cacheSet.has(url);
  }

  prefetch(url: string, options: PrefetchOptions = {}): void {
    if (!url || this.cacheSet.has(url)) {
      return;
    }

    const image = new Image();
    const priority = options.priority ?? "low";
    if ("fetchPriority" in image) {
      (image as HTMLImageElement & { fetchPriority?: "high" | "low" | "auto" }).fetchPriority = priority;
    }
    image.decoding = "async";
    image.onload = () => {
      this.record(url);
    };
    image.onerror = () => {
      this.record(url);
    };
    image.src = url;
  }

  private record(url: string): void {
    if (this.cacheSet.has(url)) {
      return;
    }

    this.cacheSet.add(url);
    this.cacheOrder.push(url);

    if (this.cacheOrder.length <= MAX_CACHE_SIZE) {
      return;
    }

    const evicted = this.cacheOrder.shift();
    if (evicted) {
      this.cacheSet.delete(evicted);
    }
  }
}

export const imagePrefetchService = new ImagePrefetchService();
