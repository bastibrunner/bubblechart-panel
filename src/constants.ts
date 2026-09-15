/**
 * All Constants here
 */

export const TestIds = {
  panel: {
    root: 'data-testid Panel header Group Color Scheme',
  },
};

/** Default soft cap on leaf bubbles shown in the chart. */
export const DEFAULT_MAX_NODES = 500;

/**
 * Absolute ceiling: never attempt to pack/render more leaf nodes than this,
 * even if the user raises maxNodes above it.
 */
export const HARD_MAX_NODES = 5000;

/**
 * If the query returns more series than this, refuse to parse/pack at all
 * (HARD_MAX_NODES * 10). Soft-capping still requires a full scan, which can freeze Grafana.
 */
export const PARSE_REFUSE_THRESHOLD = HARD_MAX_NODES * 10;

/** Default: auto-hide labels when displayed leaf count exceeds this (0 disables). */
export const DEFAULT_HIDE_LABELS_ABOVE = 200;

/** Default minimum packed radius for creating label text elements. */
export const DEFAULT_MIN_BUBBLE_RADIUS_FOR_LABEL = 8;

/** Debounce delay (ms) for resize-driven chart updates. */
export const RESIZE_DEBOUNCE_MS = 150;

/**
 * Performance defaults summary (panel options under "Performance"):
 * - maxNodes (500): soft cap; keep largest leaves by absolute value when over limit.
 * - HARD_MAX_NODES (5000): absolute render ceiling applied to maxNodes.
 * - PARSE_REFUSE_THRESHOLD (50000): skip processing and show an error banner.
 * - hideLabelsAbove (200): auto-hide all labels when leaf count exceeds this (0 = off).
 * - minBubbleRadiusForLabel (8): skip text DOM for smaller packed bubbles.
 * - Resize updates are debounced by RESIZE_DEBOUNCE_MS; data parse ignores panel size.
 */
