import { createContext, domToCanvas } from "modern-screenshot";

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

// The page is captured from the top (full document) and the viewport is cut out
// afterwards. Fixed descendants are laid out against the top of that capture, so
// shift them by the scroll offset to land where the user saw them. Sticky elements
// are left in flow; their stuck position is not recoverable from the clone alone.
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
// bounded by `timeout` (default 30 s). Lazy images below the fold and
// `preload="none"` videos never load on their own, so every capture sat out the
// full 30 s; media that isn't in by now isn't on screen anyway.
const MEDIA_WAIT_TIMEOUT = 3000;
// The same `timeout` also bounds each font/image fetch while embedding. Aborted
// font fetches left the whole capture blank on font-heavy sites, so fetches get
// more time once the media wait is over (set on the context in between).
const FETCH_TIMEOUT = 15000;
// Browsers cap canvas size (Safari/iOS around 16.7 M pixels); the full-document
// capture is scaled down on long pages to stay below that.
const MAX_CANVAS_PIXELS = 16_000_000;

// Videos without a decoded frame can't be drawn; cloning them hung the capture.
function isUnloadedVideo(el: Element) {
  return el instanceof HTMLVideoElement && el.readyState < 2;
}

export async function captureViewportScreenshot(
  options: CaptureViewportScreenshotOptions = {},
): Promise<Blob | null> {
  const { scrollX, scrollY, innerWidth, innerHeight } = window;
  const doc = document.documentElement;
  const scale = Math.min(
    window.devicePixelRatio || 1,
    Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, doc.scrollWidth * doc.scrollHeight)),
  );

  try {
    // Shifting the clone by the scroll offset (the previous approach) rendered
    // blank on some sites once scrolled; capturing from the top and cropping is
    // reliable across Chromium, Firefox and Safari.
    const context = await createContext(document.body, {
      scale,
      timeout: MEDIA_WAIT_TIMEOUT,
      // Embedding every format of every @font-face (woff2, woff, ttf…) made the
      // SVG so large that it rendered blank on font-heavy sites; one format suffices.
      font: { preferredFormat: "woff2" },
      onCloneNode: (cloned) => reanchorFixedElements(cloned, scrollX, scrollY),
      // Inverted from html2canvas: return true to INCLUDE, false to EXCLUDE
      filter: (node: Node) => {
        if (!(node instanceof Element)) return true;
        if (node.hasAttribute("data-ff-widget")) return false;
        if (options.lightweight && isMediaElement(node)) return false;
        if (isUnloadedVideo(node)) return false;
        return true;
      },
    });
    context.timeout = FETCH_TIMEOUT;
    const page = await domToCanvas(context);

    const viewport = document.createElement("canvas");
    viewport.width = Math.round(innerWidth * scale);
    viewport.height = Math.round(innerHeight * scale);
    viewport
      .getContext("2d")
      ?.drawImage(
        page,
        scrollX * scale,
        scrollY * scale,
        innerWidth * scale,
        innerHeight * scale,
        0,
        0,
        viewport.width,
        viewport.height,
      );
    return await new Promise<Blob | null>((resolve) =>
      viewport.toBlob(resolve, "image/png"),
    );
  } catch (err) {
    console.warn("[faster-fixes] screenshot capture failed:", err);
    return null;
  }
}
