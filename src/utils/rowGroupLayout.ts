import {hierarchy, pack, HierarchyCircularNode, HierarchyNode} from 'd3-hierarchy';
import {TreeRecord} from '../types';

export type PackLayoutResult = {
  root: HierarchyCircularNode<TreeRecord>;
  nodes: Array<HierarchyCircularNode<TreeRecord>>;
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
 * Pack each first-level group independently and place them on a row/grid.
 * The synthetic root is sized to encompass all groups but is not a visual enclosure
 * for packing — callers typically omit drawing it.
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
  const cellW = width / cols;
  const cellH = height / nrows;
  const cellSize = Math.max(1, Math.min(cellW, cellH) - gap);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i] as HierarchyCircularNode<TreeRecord>;
    const col = i % cols;
    const row = Math.floor(i / cols);
    // Cell centers in a coordinate system with origin at panel center.
    const cx = (col + 0.5) * cellW - width / 2;
    const cy = (row + 0.5) * cellH - height / 2;

    const packer = pack<TreeRecord>().size([cellSize, cellSize]).padding(padding);
    // Pack this subtree as if it were its own root.
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

  // Overview root covering all group circles (for zoom-out).
  root.x = (minX + maxX) / 2;
  root.y = (minY + maxY) / 2;
  // Half-diagonal of the axis-aligned bounds so corner groups are covered.
  root.r = Math.hypot((maxX - minX) / 2, (maxY - minY) / 2);

  return {root, nodes: root.descendants()};
}
