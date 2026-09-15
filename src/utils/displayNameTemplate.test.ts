import {
  applyGroupDisplayNames,
  getNodeDisplayName,
  interpolateDisplayName,
  uniqueLabelsAcross,
} from './displayNameTemplate';
import {ParsedSeriesRecord, StatOptions, TreeRecord} from '../types';
import {createTreeFromRecords, processBubbleData} from './processBubbleData';
import {FieldType, MutableDataFrame} from '@grafana/data';
import {OthersAggregate} from '../types';
import {DEFAULT_MAX_NODES} from '../constants';

describe('interpolateDisplayName', () => {
  it('replaces {{label}} tokens', () => {
    expect(interpolateDisplayName('Label1 {{l1}} with {{l4}}', {l1: 'foo', l4: 'same'})).toBe(
      'Label1 foo with same'
    );
  });

  it('replaces missing labels with empty string', () => {
    expect(interpolateDisplayName('{{l2}} on {{l1}}', {l2: 'bar'})).toBe('bar on ');
  });

  it('trims whitespace inside tokens', () => {
    expect(interpolateDisplayName('{{ l1 }}', {l1: 'foo'})).toBe('foo');
  });
});

describe('uniqueLabelsAcross', () => {
  it('keeps only labels with identical values', () => {
    expect(
      uniqueLabelsAcross([
        {l1: 'foo', l2: 'bar', l3: 'a', l4: 'same'},
        {l1: 'foo', l2: 'blub', l3: 'b', l4: 'same'},
      ])
    ).toEqual({l1: 'foo', l4: 'same'});
  });

  it('returns a copy for a single map', () => {
    const only = {l1: 'foo', l2: 'bar'};
    expect(uniqueLabelsAcross([only])).toEqual(only);
    expect(uniqueLabelsAcross([only])).not.toBe(only);
  });
});

describe('applyGroupDisplayNames', () => {
  it('applies per-level templates using unique labels in each group', () => {
    const records: ParsedSeriesRecord[] = [
      {
        name: 's1',
        aliases: ['foo', 'bar'],
        value: 1,
        labels: {l1: 'foo', l2: 'bar', l3: 'somevalue', l4: 'same'},
      },
      {
        name: 's2',
        aliases: ['foo', 'blub'],
        value: 2,
        labels: {l1: 'foo', l2: 'blub', l3: 'someothervalue', l4: 'same'},
      },
    ];
    const tree = createTreeFromRecords(records);
    applyGroupDisplayNames(tree, ['l1', 'l2'], {
      l1: 'Label1 {{l1}} with {{l4}}',
      l2: '{{l2}} on {{l1}}',
    });

    const outer = tree.children!.find((c) => c.name === 'foo')!;
    expect(getNodeDisplayName(outer)).toBe('Label1 foo with same');

    const inner1 = outer.children!.find((c) => c.name === 'bar')!;
    const inner2 = outer.children!.find((c) => c.name === 'blub')!;
    expect(getNodeDisplayName(inner1)).toBe('bar on foo');
    expect(getNodeDisplayName(inner2)).toBe('blub on foo');
  });

  it('leaves name unchanged when override is empty', () => {
    const tree: TreeRecord = {
      name: 'BubbleChart',
      children: [{name: 'foo', labels: {l1: 'foo'}, value: 1}],
    };
    applyGroupDisplayNames(tree, ['l1'], {l1: ''});
    expect(tree.children![0].displayName).toBeUndefined();
    expect(getNodeDisplayName(tree.children![0])).toBe('foo');
  });
});

describe('processBubbleData display name overrides', () => {
  function labeledFrame(name: string, labels: Record<string, string>, value: number): MutableDataFrame {
    return new MutableDataFrame({
      name,
      fields: [
        {name: 'time', type: FieldType.time, values: [1]},
        {name: 'value', type: FieldType.number, values: [value], labels},
      ],
    });
  }

  it('resolves overrides end-to-end in Label mode', () => {
    const result = processBubbleData(
      [
        labeledFrame('s1', {l1: 'foo', l2: 'bar', l3: 'somevalue', l4: 'same'}, 10),
        labeledFrame('s2', {l1: 'foo', l2: 'blub', l3: 'someothervalue', l4: 'same'}, 20),
      ],
      {
        stat: StatOptions.Total,
        unit: 'short',
        groupBy: 'Label',
        groupLabels: ['l1', 'l2'],
        groupSeparator: ',',
        groupDisplayNameOverrides: {
          l1: 'Label1 {{l1}} with {{l4}}',
          l2: '{{l2}} on {{l1}}',
        },
        maxNodes: DEFAULT_MAX_NODES,
        groupRemainderToOthers: false,
        othersAggregate: OthersAggregate.Sum,
      }
    );

    const outer = result.tree.children!.find((c) => c.name === 'foo')!;
    expect(outer.displayName).toBe('Label1 foo with same');
    expect(outer.children!.find((c) => c.name === 'bar')!.displayName).toBe('bar on foo');
    expect(outer.children!.find((c) => c.name === 'blub')!.displayName).toBe('blub on foo');
  });
});
