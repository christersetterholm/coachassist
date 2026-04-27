
import React, { useState, useEffect } from 'react';
import { getCachedImage, cacheImage } from '../lib/imageCache';

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

export const CachedImage: React.FC<CachedImageProps> = ({ src, className, alt, ...props }) => {
  const [displaySrc, setDisplaySrc] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let objectUrlToRevoke: string | null = null;

    const loadImage = async () => {
      // Don't try to cache data URLs or already blob URLs
      if (src.startsWith('data:') || src.startsWith('blob:')) {
        setDisplaySrc(src);
        return;
      }

      // Check cache
      const cached = await getCachedImage(src);
      if (cached && isMounted) {
        setDisplaySrc(cached);
        objectUrlToRevoke = cached;
        return;
      }

      // If not in cache, fetch and cache
      try {
        const response = await fetch(src);
        const blob = await response.blob();
        
        if (isMounted) {
          const blobUrl = URL.createObjectURL(blob);
          setDisplaySrc(blobUrl);
          objectUrlToRevoke = blobUrl;
          
          // Cache it for next time
          await cacheImage(src, blob);
        }
      } catch (err) {
        console.error('Failed to load image for caching', err);
        if (isMounted) setDisplaySrc(src); // Fallback to direct URL
      }
    };

    loadImage();

    return () => {
      isMounted = false;
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
  }, [src]);

  if (!displaySrc) {
    // Return a placeholder or the same img with the original src to let native loading happen while we wait for cache
    return <img src={src} className={className} alt={alt} {...props} />;
  }

  return <img src={displaySrc} className={className} alt={alt} {...props} />;
};
