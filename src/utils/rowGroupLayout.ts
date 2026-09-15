import {hierarchy, pack, HierarchyCircularNode, HierarchyNode} from 'd3-hierarchy';
import {TreeRecord} from '../types';

export type PackLayoutResult = {
  root: HierarchyCircularNode<TreeRecord>;
  nodes: Array<HierarchyCircularNode<TreeRecord>>;
  /** Axis-aligned content size in layout coords (row layout only). */
  contentSize?: {width: number; height: number};
};

function buildHierarchy(data: TreeRecord): HierarchyNode<TreeRecord> {
  return hierarchy(data)
    .sum((d: TreeRecord) => d.value || 1)
    .sort(
      (a: HierarchyNode<TreeRecord>, b: HierarchyNode<TreeRecord>) =>
        (b.data.value || 1) - (a.data.value || 1)
    );
}

/**
 * Standard circular pack of the full tree into a square of the given diameter.
 */
export function packHierarchyCircle(
  data: TreeRecord,
  diameter: number,
  padding = 2
): PackLayoutResult {
  const packer = pack<TreeRecord>().size([diameter, diameter]).padding(padding);
  const root = packer(buildHierarchy(data));
  return {root, nodes: root.descendants()};
}

/**
 * View extent (maps to zoom `v[2]`) that fits a content rectangle into the panel
 * with isotropic scale, matching `k = diameter / viewSize` where diameter is the
 * shorter panel side.
 */
export function overviewViewSize(
  contentWidth: number,
  contentHeight: number,
  panelWidth: number,
  panelHeight: number,
  diameter: number,
  margin: number
): number {
  const cw = Math.max(contentWidth, 1);
  const ch = Math.max(contentHeight, 1);
  const pw = Math.max(panelWidth, 1);
  const ph = Math.max(panelHeight, 1);
  // diameter / viewSize === min(pw/cw, ph/ch)
  return diameter * Math.max(cw / pw, ch / ph) + margin;
}

/**
 * Pack each first-level group independently and place them on a tight row/grid
 * centered in the available area. The synthetic root is positioned at the content
 * center; callers set overview zoom from contentSize (not root.r alone).
 */
export function packFirstGroupInRows(
  data: TreeRecord,
  width: number,
  height: number,
  maxGroupsPerRow: number,
  padding = 2,
  gap = 8
): PackLayoutResult {
  const root = buildHierarchy(data) as HierarchyCircularNode<TreeRecord>;
  const groups = root.children ?? [];

  if (groups.length === 0) {
    return packHierarchyCircle(data, Math.min(width, height), padding);
  }

  const cols = Math.max(1, Math.floor(maxGroupsPerRow) || 1);
  const nrows = Math.ceil(groups.length / cols);
  // Equal square cells sized to fit the grid; do not stretch across empty panel space.
  const cellSize = Math.max(1, Math.min(width / cols, height / nrows) - gap);
  const stride = cellSize + gap;
  const gridW = cols * stride - gap;
  const gridH = nrows * stride - gap;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i] as HierarchyCircularNode<TreeRecord>;
    const col = i % cols;
    const row = Math.floor(i / cols);
    // Cell centers relative to grid center (panel origin).
    const cx = (col + 0.5) * stride - gridW / 2;
    const cy = (row + 0.5) * stride - gridH / 2;

    const packer = pack<TreeRecord>().size([cellSize, cellSize]).padding(padding);
    const savedParent = group.parent;
    group.parent = null;
    packer(group);
    group.parent = savedParent;

    const dx = cx - group.x;
    const dy = cy - group.y;
    group.each((node) => {
      const circular = node as HierarchyCircularNode<TreeRecord>;
      circular.x += dx;
      circular.y += dy;
      minX = Math.min(minX, circular.x - circular.r);
      maxX = Math.max(maxX, circular.x + circular.r);
      minY = Math.min(minY, circular.y - circular.r);
      maxY = Math.max(maxY, circular.y + circular.r);
    });
  }

  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;
  root.x = (minX + maxX) / 2;
  root.y = (minY + maxY) / 2;
  // Placeholder; BubbleChart overwrites with aspect-aware overview radius.
  root.r = Math.max(contentWidth, contentHeight) / 2;

  return {
    root,
    nodes: root.descendants(),
    contentSize: {width: contentWidth, height: contentHeight},
  };
}
