import { useEffect } from 'react';

/**
 * Sets document.title for the current view and restores the previous title on unmount.
 * Pass `null`/`undefined` to skip (e.g. while data is loading).
 */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
