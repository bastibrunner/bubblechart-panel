import {TreeRecord} from 'types';

/**
 * Returns true when `candidate` shares the same value as `reference` for every
 * key in `highlightLabels`. Missing labels on either side do not match.
 */
export function sharesHighlightLabelValues(
  reference: Record<string, string> | undefined,
  candidate: Record<string, string> | undefined,
  highlightLabels: string[]
): boolean {
  if (!highlightLabels.length) {
    return false;
  }
  if (!reference || !candidate) {
    return false;
  }
  for (const key of highlightLabels) {
    const refValue = reference[key];
    const candidateValue = candidate[key];
    if (refValue === undefined || candidateValue === undefined || refValue !== candidateValue) {
      return false;
    }
  }
  return true;
}

export type HighlightableLeaf = {
  name: string;
  value?: number;
  labels?: Record<string, string>;
  color: string;
};

/**
 * Among leaf records, return those that match the hovered leaf on all selected
 * highlight label keys. Includes the hovered leaf itself when it matches.
 */
export function findLeavesMatchingHighlightLabels(
  leaves: HighlightableLeaf[],
  hovered: HighlightableLeaf,
  highlightLabels: string[]
): HighlightableLeaf[] {
  if (!highlightLabels.length || !hovered.labels) {
    return [];
  }
  return leaves.filter((leaf) =>
    sharesHighlightLabelValues(hovered.labels, leaf.labels, highlightLabels)
  );
}

/** Build HTML rows for a multi-node highlight tooltip. */
export function buildHighlightTooltipHtml(
  matches: HighlightableLeaf[],
  formatValue: (value: number | undefined) => string
): string {
  if (!matches.length) {
    return '';
  }
  return matches
    .map((match) => {
      const pill =
        '<div data-testid="series-icon" style="vertical-align: middle; background:' +
        match.color +
        ';width: 14px;height: 4px;border-radius: 9999px;display: inline-block;margin-right: 8px;"></div>';
      return (
        '<div style="margin: 2px 0;">' +
        pill +
        '<strong>' +
        match.name +
        '</strong>&nbsp;&nbsp;&nbsp;&nbsp;' +
        formatValue(match.value) +
        '</div>'
      );
    })
    .join('');
}

/** Leaf nodes only (no children) from a hierarchy node list. */
export function isLeafNode(d: {children?: unknown[] | null}): boolean {
  return !d.children || d.children.length === 0;
}

/** Extract highlight-relevant fields from a packed tree node. */
export function toHighlightableLeaf(
  d: {data: TreeRecord},
  color: string
): HighlightableLeaf {
  return {
    name: d.data.name,
    value: d.data.value,
    labels: d.data.labels,
    color,
  };
}
