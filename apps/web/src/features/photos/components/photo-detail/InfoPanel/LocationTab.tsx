import React from "react";
import { MapPin, Navigation, Globe } from "lucide-react";
import type { Photo } from "@/features/photos/types";

interface LocationTabProps {
  photo: Photo;
}

const LocationTab: React.FC<LocationTabProps> = ({ photo }) => {
  const metadata = photo.metadata;
  const exifGps = metadata?.exif;
  const hasCoordinates = exifGps?.GPSLatitude !== undefined && exifGps?.GPSLongitude !== undefined;
  const geoRegion = metadata?.geo?.region;

  if (!hasCoordinates && !photo.location && !geoRegion) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <MapPin size={32} className="mb-3 text-neutral-600" />
        <p className="text-sm text-neutral-500">No location data available</p>
        <p className="mt-1 text-xs text-neutral-600">
          This photo doesn't contain GPS information
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-3">
        <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
          Location Details
        </h3>
        <div className="space-y-2">
          {photo.location && (
            <LocationRow
              icon={<MapPin size={14} />}
              label="Place"
              value={photo.location}
            />
          )}
          {geoRegion && (
            <>
              {geoRegion.country && (
                <LocationRow
                  icon={<Globe size={14} />}
                  label="Country"
                  value={geoRegion.country}
                />
              )}
              {geoRegion.province && (
                <LocationRow
                  icon={<Navigation size={14} />}
                  label="Province"
                  value={geoRegion.province}
                />
              )}
              {geoRegion.city && (
                <LocationRow
                  icon={<MapPin size={14} />}
                  label="City"
                  value={geoRegion.city}
                />
              )}
            </>
          )}
          {hasCoordinates && (
            <LocationRow
              icon={<Navigation size={14} />}
              label="Coordinates"
              value={`${exifGps!.GPSLatitude!.toFixed(6)}, ${exifGps!.GPSLongitude!.toFixed(6)}`}
            />
          )}
        </div>
      </div>
    </div>
  );
};

interface LocationRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function LocationRow({ icon, label, value }: LocationRowProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between py-1.5 text-xs">
      <span className="flex items-center gap-2 text-neutral-500">
        {icon}
        {label}
      </span>
      <span className="text-neutral-300">{value}</span>
    </div>
  );
}

export default LocationTab;
