import { useEffect, useState } from 'react';

/**
 * The current width of an element, kept up to date as it is resized. Viewport media queries can't
 * answer "how wide is this window?" for a page shown inside a resizable desktop window.
 * Pass the element (from a callback ref held in state) - it is null until the first render.
 */
export const useElementWidth = (element) => {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!element) return undefined;
    setWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return width;
};
