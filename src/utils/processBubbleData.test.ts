import {FieldType, MutableDataFrame} from '@grafana/data';
import {
  DEFAULT_MAX_NODES,
  HARD_MAX_NODES,
  OTHERS_NODE_NAME,
  PARSE_REFUSE_THRESHOLD,
} from '../constants';
import {aggregateOthersValue, createTreeFromRecords, processBubbleData} from './processBubbleData';
import {OthersAggregate, ParsedSeriesRecord, StatOptions} from '../types';

function makeSeries(count: number, valueOffset = 0): MutableDataFrame[] {
  const frames: MutableDataFrame[] = [];
  for (let i = 0; i < count; i++) {
    const frame = new MutableDataFrame({
      name: `series-${i}`,
      fields: [
        {name: 'time', type: FieldType.time, values: [1, 2, 3]},
        {name: 'value', type: FieldType.number, values: [valueOffset + i, valueOffset + i, valueOffset + i]},
      ],
    });
    frames.push(frame);
  }
  return frames;
}

describe('createTreeFromRecords', () => {
  it('builds a hierarchy with Map-indexed siblings', () => {
    const records: ParsedSeriesRecord[] = [
      {name: 'a', aliases: ['env', 'host-a'], value: 10},
      {name: 'b', aliases: ['env', 'host-b'], value: 20},
      {name: 'c', aliases: ['other', 'host-c'], value: 5},
    ];
    const tree = createTreeFromRecords(records);
    expect(tree.children).toHaveLength(2);
    const env = tree.children!.find((c) => c.name === 'env');
    expect(env?.children).toHaveLength(2);
    expect(env?.children!.find((c) => c.name === 'host-b')?.value).toBe(20);
  });
});

describe('aggregateOthersValue', () => {
  const remainder: ParsedSeriesRecord[] = [
    {name: 'a', aliases: ['a'], value: 10},
    {name: 'b', aliases: ['b'], value: 20},
    {name: 'c', aliases: ['c'], value: 30},
  ];

  it('sums by default', () => {
    expect(aggregateOthersValue(remainder, OthersAggregate.Sum)).toBe(60);
  });

  it('averages', () => {
    expect(aggregateOthersValue(remainder, OthersAggregate.Avg)).toBe(20);
  });

  it('takes min and max', () => {
    expect(aggregateOthersValue(remainder, OthersAggregate.Min)).toBe(10);
    expect(aggregateOthersValue(remainder, OthersAggregate.Max)).toBe(30);
  });

  it('counts remainder series', () => {
    expect(aggregateOthersValue(remainder, OthersAggregate.Count)).toBe(3);
  });
});

describe('processBubbleData', () => {
  const baseOpts = {
    stat: StatOptions.Total,
    unit: 'short',
    groupBy: 'Name',
    groupLabels: [] as string[],
    groupSeparator: ',',
    groupDisplayNameOverrides: {},
    maxNodes: DEFAULT_MAX_NODES,
    groupRemainderToOthers: false,
    othersAggregate: OthersAggregate.Sum,
  };

  it('returns all leaves when under the soft cap', () => {
    const result = processBubbleData(makeSeries(10), baseOpts);
    expect(result.blocked).toBe(false);
    expect(result.truncated).toBe(false);
    expect(result.totalLeafCount).toBe(10);
    expect(result.displayedLeafCount).toBe(10);
    expect(result.othersCount).toBe(0);
    expect(result.tree.children!.length).toBeGreaterThan(0);
  });

  it('keeps top-N by absolute value when over maxNodes', () => {
    const result = processBubbleData(makeSeries(20, 0), {...baseOpts, maxNodes: 5});
    expect(result.truncated).toBe(true);
    expect(result.totalLeafCount).toBe(20);
    expect(result.displayedLeafCount).toBe(5);
    expect(result.othersCount).toBe(0);
    expect(result.blocked).toBe(false);
  });

  it('folds remainder into an Others leaf when enabled', () => {
    // Values 0..19 (each series sums to 3*i with Total/sum of [i,i,i] => 3*i)
    const result = processBubbleData(makeSeries(20, 0), {
      ...baseOpts,
      maxNodes: 5,
      groupRemainderToOthers: true,
      othersAggregate: OthersAggregate.Sum,
    });
    expect(result.truncated).toBe(true);
    expect(result.displayedLeafCount).toBe(5); // 4 kept + Others
    expect(result.othersCount).toBe(16);
    const others = result.tree.children!.find((c) => c.name === OTHERS_NODE_NAME);
    expect(others).toBeDefined();
    // Remainder is series 0..15 with sums 0,3,6,...,45 => sum = 3*(0+...+15) = 3*120 = 360
    expect(others!.value).toBe(360);
  });

  it('uses count aggregation for Others when selected', () => {
    const result = processBubbleData(makeSeries(10, 0), {
      ...baseOpts,
      maxNodes: 3,
      groupRemainderToOthers: true,
      othersAggregate: OthersAggregate.Count,
    });
    expect(result.othersCount).toBe(8);
    const others = result.tree.children!.find((c) => c.name === OTHERS_NODE_NAME);
    expect(others!.value).toBe(8);
  });

  it('uses only Others when maxNodes is 1 and grouping is enabled', () => {
    const result = processBubbleData(makeSeries(5, 0), {
      ...baseOpts,
      maxNodes: 1,
      groupRemainderToOthers: true,
      othersAggregate: OthersAggregate.Count,
    });
    expect(result.displayedLeafCount).toBe(1);
    expect(result.othersCount).toBe(5);
    expect(result.tree.children).toHaveLength(1);
    expect(result.tree.children![0].name).toBe(OTHERS_NODE_NAME);
    expect(result.tree.children![0].value).toBe(5);
  });

  it('clamps requested maxNodes to HARD_MAX_NODES via soft cap', () => {
    const count = DEFAULT_MAX_NODES + 50;
    const result = processBubbleData(makeSeries(count), {
      ...baseOpts,
      maxNodes: HARD_MAX_NODES + 100,
    });
    expect(result.displayedLeafCount).toBe(count);
    expect(result.truncated).toBe(false);
    expect(result.blocked).toBe(false);
  });

  it('caps displayed leaves at HARD_MAX_NODES when series exceed it', () => {
    const count = HARD_MAX_NODES + 20;
    const result = processBubbleData(makeSeries(count), {
      ...baseOpts,
      maxNodes: HARD_MAX_NODES + 100,
    });
    expect(result.displayedLeafCount).toBe(HARD_MAX_NODES);
    expect(result.totalLeafCount).toBe(count);
    expect(result.truncated).toBe(true);
    expect(result.blocked).toBe(false);
  });

  it('blocks pathological series counts without packing', () => {
    const huge = PARSE_REFUSE_THRESHOLD + 1;
    const fakeSeries = {
      length: huge,
    } as unknown as MutableDataFrame[];
    const result = processBubbleData(fakeSeries as any, baseOpts);
    expect(result.blocked).toBe(true);
    expect(result.displayedLeafCount).toBe(0);
    expect(result.totalLeafCount).toBe(huge);
  });
});
