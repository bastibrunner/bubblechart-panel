import {overviewViewSize, packFirstGroupInRows, packHierarchyCircle} from './rowGroupLayout';
import {TreeRecord} from '../types';

describe('rowGroupLayout', () => {
  const sampleTree: TreeRecord = {
    name: 'BubbleChart',
    children: [
      {
        name: 'dc-a',
        children: [
          {name: 'host-1', value: 10},
          {name: 'host-2', value: 20},
        ],
      },
      {
        name: 'dc-b',
        children: [{name: 'host-3', value: 15}],
      },
      {
        name: 'dc-c',
        children: [{name: 'host-4', value: 5}],
      },
      {
        name: 'dc-d',
        children: [{name: 'host-5', value: 8}],
      },
    ],
  };

  it('packs the full tree into one enclosing root circle', () => {
    const {root, nodes} = packHierarchyCircle(sampleTree, 400);
    expect(root.data.name).toBe('BubbleChart');
    expect(root.children).toHaveLength(4);
    expect(nodes.length).toBeGreaterThan(4);
    for (const child of root.children!) {
      const dx = child.x - root.x;
      const dy = child.y - root.y;
      expect(Math.hypot(dx, dy) + child.r).toBeLessThanOrEqual(root.r + 1e-6);
    }
  });

  it('places first-level groups on a tight grid and reports content size', () => {
    const {root, nodes, contentSize} = packFirstGroupInRows(sampleTree, 800, 400, 2);
    const groups = root.children!;
    expect(groups).toHaveLength(4);
    expect(contentSize).toBeDefined();

    const xs = groups.map((g) => g.x);
    const ys = groups.map((g) => g.y);
    expect(new Set(xs.map((x) => Math.round(x))).size).toBe(2);
    expect(new Set(ys.map((y) => Math.round(y))).size).toBe(2);

    // Grid is tight: content should be near-square for 2x2, not stretched to 800x400.
    expect(contentSize!.width).toBeLessThan(500);
    expect(Math.abs(contentSize!.width - contentSize!.height)).toBeLessThan(20);

    const leaves = nodes.filter((n) => !n.children);
    expect(leaves.length).toBe(5);
    for (const leaf of leaves) {
      expect(leaf.r).toBeGreaterThan(0);
    }
  });

  it('puts all groups on one row when maxGroupsPerRow >= group count', () => {
    const {root, contentSize} = packFirstGroupInRows(sampleTree, 800, 200, 10);
    const ys = root.children!.map((g) => Math.round(g.y));
    expect(new Set(ys).size).toBe(1);
    expect(contentSize!.width).toBeGreaterThan(contentSize!.height);
  });

  it('falls back to circle pack when the tree has no children', () => {
    const empty: TreeRecord = {name: 'BubbleChart', children: []};
    const {root} = packFirstGroupInRows(empty, 400, 400, 4);
    expect(root.data.name).toBe('BubbleChart');
    expect(root.r).toBeGreaterThan(0);
  });

  it('overviewViewSize fits content into the panel without using the diagonal', () => {
    const diameter = 200;
    const margin = 20;
    // Wide content on a wide panel: scale limited by height ratio.
    const view = overviewViewSize(700, 150, 800, 200, diameter, margin);
    // min(800/700, 200/150) = min(1.14, 1.33) => k = 1.14; view = diameter/k + margin
    expect(view).toBeCloseTo(diameter * (700 / 800) + margin, 5);
    // Must be tighter than circular half-diagonal overview.
    const diagonalOverview = Math.hypot(700, 150) + margin;
    expect(view).toBeLessThan(diagonalOverview);
  });
});
