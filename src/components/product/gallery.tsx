import Image from "next/image";
import type { ImageSource, ProductImage } from "@/server/catalogue/schema";

const WIN2AGE_CAPTION =
  "Photo shows the pack printed under Win2Age Pharma, Aarvion’s earlier marketing name.";

/**
 * The product photos: a scroll-snap track that works without script, with 64px thumbnail wells
 * as anchor links to each `figure#photo-<n>`. The first photo is the page's LCP: eager, high
 * priority and explicitly sized, never a `preload` [C24]. The rest are lazy. Server-safe.
 */
export function Gallery({
  images,
  imageSource,
  name,
}: {
  images: readonly ProductImage[];
  imageSource: ImageSource;
  name: string;
}) {
  return (
    <div className="gallery">
      <div className="gallery-track" role="group" aria-label={`${name} photos`}>
        {images.map((image, i) => (
          <figure key={image.src} id={`photo-${i + 1}`}>
            <Image
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              sizes="(max-width: 960px) 100vw, 640px"
              quality={85}
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : undefined}
            />
          </figure>
        ))}
      </div>
      {images.length > 1 && (
        <ul className="gallery-thumbs">
          {images.map((image, i) => (
            <li key={image.src}>
              <a href={`#photo-${i + 1}`} aria-label={`Show photo ${i + 1} of ${images.length}`}>
                <Image src={image.src} alt="" width={64} height={64} sizes="64px" loading="lazy" />
              </a>
            </li>
          ))}
        </ul>
      )}
      {imageSource === "win2age" && <p className="gallery-note">{WIN2AGE_CAPTION}</p>}
    </div>
  );
}
