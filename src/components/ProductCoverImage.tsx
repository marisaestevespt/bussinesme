import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

function getLegacyProductFilePath(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const marker = '/storage/v1/object/public/product-files/';
    const index = url.pathname.indexOf(marker);
    if (index === -1) return null;
    return decodeURIComponent(url.pathname.slice(index + marker.length));
  } catch {
    return null;
  }
}

interface Props {
  url?: string | null;
  alt?: string;
  className?: string;
}

export function ProductCoverImage({ url, alt, className }: Props) {
  const legacyPath = useMemo(() => getLegacyProductFilePath(url), [url]);
  const [signed, setSigned] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSigned(null);
    if (!legacyPath) return;
    supabase.storage
      .from('product-files')
      .createSignedUrl(legacyPath, 60 * 60)
      .then(({ data }) => {
        if (!cancelled) setSigned(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [legacyPath]);

  const src = legacyPath ? signed : url;
  if (!src) return null;
  return <img src={src} alt={alt} className={className} />;
}