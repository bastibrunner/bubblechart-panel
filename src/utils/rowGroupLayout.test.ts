import {packFirstGroupInRows, packHierarchyCircle} from './rowGroupLayout';
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
    // All first-level groups lie inside the root radius.
    for (const child of root.children!) {
      const dx = child.x - root.x;
      const dy = child.y - root.y;
      expect(Math.hypot(dx, dy) + child.r).toBeLessThanOrEqual(root.r + 1e-6);
    }
  });

  it('places first-level groups on a grid without a shared pack enclosure', () => {
    const {root, nodes} = packFirstGroupInRows(sampleTree, 800, 400, 2);
    const groups = root.children!;
    expect(groups).toHaveLength(4);

    // With 2 per row: (0,0), (1,0), (0,1), (1,1) — distinct cell centers.
    const xs = groups.map((g) => g.x);
    const ys = groups.map((g) => g.y);
    expect(new Set(xs.map((x) => Math.round(x))).size).toBe(2);
    expect(new Set(ys.map((y) => Math.round(y))).size).toBe(2);

    // Groups are not nested inside each other as a single pack cluster:
    // horizontal span of group centers should be clearly wider than one group radius.
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    expect(maxX - minX).toBeGreaterThan(groups[0].r);

    // Every leaf still has a radius.
    const leaves = nodes.filter((n) => !n.children);
    expect(leaves.length).toBe(5);
    for (const leaf of leaves) {
      expect(leaf.r).toBeGreaterThan(0);
    }

    // Overview root covers all groups.
    for (const group of groups) {
      const dx = group.x - root.x;
      const dy = group.y - root.y;
      expect(Math.hypot(dx, dy) + group.r).toBeLessThanOrEqual(root.r + 1e-6);
    }
  });

  it('puts all groups on one row when maxGroupsPerRow >= group count', () => {
    const {root} = packFirstGroupInRows(sampleTree, 800, 200, 10);
    const ys = root.children!.map((g) => Math.round(g.y));
    expect(new Set(ys).size).toBe(1);
  });

  it('falls back to circle pack when the tree has no children', () => {
    const empty: TreeRecord = {name: 'BubbleChart', children: []};
    const {root} = packFirstGroupInRows(empty, 400, 400, 4);
    expect(root.data.name).toBe('BubbleChart');
    expect(root.r).toBeGreaterThan(0);
  });
});
