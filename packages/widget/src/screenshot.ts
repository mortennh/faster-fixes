import { domToBlob } from "modern-screenshot";

export type CaptureViewportScreenshotOptions = {
  // Skip images and videos so the capture finishes fast when the full one timed out
  lightweight?: boolean;
};

function isMediaElement(el: Element) {
  return (
    el instanceof HTMLImageElement ||
    el instanceof HTMLVideoElement ||
    el instanceof HTMLPictureElement
  );
}

// Translating the body clone turns it into the containing block for fixed descendants,
// which would drag them off-screen along with the document. Shift them back so they
// keep their viewport position. Sticky elements are left in flow; their stuck position
// is not recoverable from the clone alone.
function reanchorFixedElements(cloned: Node, scrollX: number, scrollY: number) {
  if (!(cloned instanceof HTMLElement)) return;
  for (const el of cloned.querySelectorAll<HTMLElement>("[style]")) {
    if (el.style.position !== "fixed") continue;
    // Prepend so the offset applies in body coordinates, after the element's own transform
    el.style.transform =
      `translate(${scrollX}px, ${scrollY}px) ${el.style.transform}`.trim();
  }
}

// modern-screenshot first waits until every <img>/<video> in the page has loaded,
// bounded by `timeout` (default 30 s, also the per-request fetch timeout). Lazy
// images below the fold and `preload="none"` videos never load on their own, so
// every capture sat out the full 30 s. Media that isn't in by now isn't visible
// in the viewport anyway.
const MEDIA_TIMEOUT = 3000;

// Videos without a decoded frame can't be drawn; cloning them hung the capture.
function isUnloadedVideo(el: Element) {
  return el instanceof HTMLVideoElement && el.readyState < 2;
}

// Only the viewport ends up in the image, but the library clones the whole
// document and computes styles for every node — on long pages that takes tens of
// seconds and the screenshot often never arrives. Skip element subtrees lying
// fully outside the viewport (plus a margin for shadows/overflow). Zero-size boxes
// (e.g. display: contents) can't be judged and are kept.
const VIEWPORT_MARGIN = 200;

function isOutsideViewport(el: Element) {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  return (
    rect.bottom < -VIEWPORT_MARGIN ||
    rect.top > window.innerHeight + VIEWPORT_MARGIN ||
    rect.right < -VIEWPORT_MARGIN ||
    rect.left > window.innerWidth + VIEWPORT_MARGIN
  );
}

export function captureViewportScreenshot(
  options: CaptureViewportScreenshotOptions = {},
): Promise<Blob | null> {
  const { scrollX, scrollY } = window;

  return domToBlob(document.body, {
    width: window.innerWidth,
    height: window.innerHeight,
    scale: window.devicePixelRatio || 1,
    // restoreScrollPosition only handles scrolled children. Window scroll lives on
    // documentElement, not body, so the root clone must be shifted by hand or every
    // screenshot shows the top of the document.
    style: { transform: `translate(${-scrollX}px, ${-scrollY}px)` },
    features: { restoreScrollPosition: true },
    timeout: MEDIA_TIMEOUT,
    // Embedding every format of every @font-face (woff2, woff, ttf…) made the SVG
    // so large that it rendered blank on font-heavy sites; one format suffices.
    font: { preferredFormat: "woff2" },
    onCloneNode: (cloned) => reanchorFixedElements(cloned, scrollX, scrollY),
    // Inverted from html2canvas: return true to INCLUDE, false to EXCLUDE
    filter: (node: Node) => {
      if (!(node instanceof Element)) return true;
      if (node.hasAttribute("data-ff-widget")) return false;
      if (options.lightweight && isMediaElement(node)) return false;
      if (isUnloadedVideo(node)) return false;
      // The filter receives the original (live) node, so its layout box is real.
      if (isOutsideViewport(node)) return false;
      return true;
    },
  }).catch((err) => {
    console.warn("[faster-fixes] screenshot capture failed:", err);
    return null;
  });
}
