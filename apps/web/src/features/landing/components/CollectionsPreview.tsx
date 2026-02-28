import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import type { Photo } from "@/features/photos/types";

interface CollectionsPreviewProps {
  photos: Photo[];
}

interface Collection {
  id: string;
  name: string;
  count: number;
  coverPhoto: Photo;
  filterParam: string;
}

const CollectionsPreview: React.FC<CollectionsPreviewProps> = ({ photos }) => {
  const collections = useMemo(() => {
    const categoryMap = new Map<string, Photo[]>();
    const locationMap = new Map<string, Photo[]>();

    for (const photo of photos) {
      if (photo.category) {
        const list = categoryMap.get(photo.category) || [];
        list.push(photo);
        categoryMap.set(photo.category, list);
      }
      if (photo.location) {
        const list = locationMap.get(photo.location) || [];
        list.push(photo);
        locationMap.set(photo.location, list);
      }
    }

    const result: Collection[] = [];

    result.push({
      id: "latest",
      name: "Latest",
      count: Math.min(photos.length, 50),
      coverPhoto: photos[0],
      filterParam: "?sort=date&order=desc",
    });

    const sortedCategories = [...categoryMap.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 3);

    for (const [category, categoryPhotos] of sortedCategories) {
      if (categoryPhotos.length >= 3) {
        result.push({
          id: `category-${category}`,
          name: category,
          count: categoryPhotos.length,
          coverPhoto: categoryPhotos[0],
          filterParam: `?category=${encodeURIComponent(category)}`,
        });
      }
    }

    const sortedLocations = [...locationMap.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 2);

    for (const [location, locationPhotos] of sortedLocations) {
      if (locationPhotos.length >= 3) {
        result.push({
          id: `location-${location}`,
          name: location,
          count: locationPhotos.length,
          coverPhoto: locationPhotos[0],
          filterParam: `?location=${encodeURIComponent(location)}`,
        });
      }
    }

    return result.slice(0, 6);
  }, [photos]);

  if (collections.length === 0 || !photos[0]) return null;

  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1720px] px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8 flex items-center justify-between"
        >
          <h2 className="font-display text-2xl text-white sm:text-3xl">
            Collections
          </h2>
          <Link
            to="/gallery"
            className="flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white"
          >
            View All
            <ArrowRight size={16} />
          </Link>
        </motion.div>

        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
          {collections.map((collection, index) => (
            <motion.div
              key={collection.id}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="flex-shrink-0"
            >
              <Link
                to={`/gallery${collection.filterParam}`}
                className="group relative block h-64 w-48 overflow-hidden rounded-2xl sm:h-80 sm:w-60"
              >
                <img
                  src={collection.coverPhoto.thumbnail}
                  alt={collection.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <h3 className="text-lg font-medium text-white">
                    {collection.name}
                  </h3>
                  <p className="text-sm text-white/60">
                    {collection.count} photos
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CollectionsPreview;
