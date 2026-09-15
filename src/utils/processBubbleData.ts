import {
  DataFrame,
  Field,
  FieldType,
  getValueFormat,
  reduceField,
  ReducerID,
} from '@grafana/data';
import {
  BubbleChartOptions,
  ParsedSeriesRecord,
  ProcessedBubbleData,
  StatOptions,
  TreeRecord,
} from 'types';
import {DEFAULT_MAX_NODES, HARD_MAX_NODES, PARSE_REFUSE_THRESHOLD} from '../constants';

function resolveReducerId(stat: StatOptions | string): ReducerID {
  switch (stat) {
    case StatOptions.Min:
    case 'min':
      return ReducerID.min;
    case StatOptions.Max:
    case 'max':
      return ReducerID.max;
    case StatOptions.Avg:
    case 'avg':
      return ReducerID.mean;
    case StatOptions.Current:
    case 'current':
      // Preserve legacy mapping: "current" used the first calculator result key.
      return ReducerID.first;
    case StatOptions.Total:
    case 'total':
      return ReducerID.sum;
    default:
      return ReducerID.sum;
  }
}

function getFieldCalcValue(field: Field, reducerId: ReducerID): number {
  const existing = field.state?.calcs?.[reducerId];
  if (typeof existing === 'number' && !Number.isNaN(existing)) {
    return existing;
  }
  const calcs = reduceField({field, reducers: [reducerId]});
  const value = calcs[reducerId];
  return typeof value === 'number' && !Number.isNaN(value) ? value : 0;
}

export function parseSeries(
  series: DataFrame[],
  options: Pick<BubbleChartOptions, 'stat' | 'unit' | 'groupBy' | 'groupLabels' | 'groupSeparator'>
): ParsedSeriesRecord[] {
  const areAllSeriesNamesSame =
    series.length > 0 && series.every((serieFrame: DataFrame) => serieFrame.name === series[0]?.name);

  const reducerId = resolveReducerId(options.stat);
  const parsed: ParsedSeriesRecord[] = [];

  for (const serieFrame of series) {
    const valueFields: Field[] = [];
    for (const aField of serieFrame.fields) {
      if (aField.type === FieldType.number) {
        valueFields.push(aField);
      }
    }

    // Preserve existing behavior: only the first numeric field per frame.
    const valueField = valueFields[0];
    if (!valueField) {
      continue;
    }

    const operatorValue = getFieldCalcValue(valueField, reducerId);
    const result = getValueFormat(options.unit)(operatorValue, 2, undefined, undefined);

    let aliases = [valueField.name];
    if (options.groupBy === 'Name') {
      const streamName = areAllSeriesNamesSame
        ? valueField.name + ' ' + JSON.stringify(valueField.labels)
        : serieFrame.name;
      aliases = streamName?.split(options.groupSeparator) || [valueField.name];
    } else if (options.groupBy === 'Label') {
      if (options.groupLabels === undefined || options.groupLabels.length === 0) {
        aliases = [valueField.name];
      } else {
        aliases = options.groupLabels.map((label: string) => valueField.labels?.[label] || '');
      }
    }

    parsed.push({
      name: serieFrame.name || valueField.name,
      aliases,
      value: result.text,
      labels: valueField.labels ? {...valueField.labels} : undefined,
    });
  }

  return parsed;
}

/**
 * Build a hierarchy using Map-indexed children for O(1) sibling lookups.
 */
export function createTreeFromRecords(records: ParsedSeriesRecord[]): TreeRecord {
  const tree: TreeRecord = {name: 'BubbleChart', children: []};
  const indexByParent = new WeakMap<object, Map<string, TreeRecord>>();

  const getChildIndex = (parent: TreeRecord): Map<string, TreeRecord> => {
    let map = indexByParent.get(parent);
    if (!map) {
      map = new Map();
      if (parent.children) {
        for (const child of parent.children) {
          map.set(child.name, child);
        }
      }
      indexByParent.set(parent, map);
    }
    return map;
  };

  for (const record of records) {
    const aliases = [...record.aliases];
    let current = tree;

    for (let i = 0; i < aliases.length; i++) {
      const alias = aliases[i];
      const isLeaf = i === aliases.length - 1;
      const childIndex = getChildIndex(current);
      let group = childIndex.get(alias);

      if (!group) {
        group = isLeaf ? {name: alias} : {name: alias, children: []};
        if (!current.children) {
          current.children = [];
        }
        current.children.push(group);
        childIndex.set(alias, group);
      } else if (!isLeaf && !group.children) {
        group.children = [];
      }

      if (isLeaf) {
        group.value = Number(record.value);
        if (record.labels) {
          group.labels = record.labels;
        }
      }

      current = group;
    }
  }

  return tree;
}

function numericValue(record: ParsedSeriesRecord): number {
  const n = Number(record.value);
  return Number.isNaN(n) ? 0 : Math.abs(n);
}

/**
 * Cap leaf records to effectiveMax (top-N by absolute value), then build the tree.
 */
export function processBubbleData(
  series: DataFrame[],
  options: Pick<
    BubbleChartOptions,
    'stat' | 'unit' | 'groupBy' | 'groupLabels' | 'groupSeparator' | 'maxNodes'
  >
): ProcessedBubbleData {
  const requestedMax =
    typeof options.maxNodes === 'number' && options.maxNodes > 0
      ? options.maxNodes
      : DEFAULT_MAX_NODES;
  const effectiveMax = Math.min(requestedMax, HARD_MAX_NODES);

  // Refuse to process pathological query sizes — even soft-capping requires scanning all series.
  if (series.length > PARSE_REFUSE_THRESHOLD) {
    return {
      tree: {name: 'BubbleChart', children: []},
      totalLeafCount: series.length,
      displayedLeafCount: 0,
      truncated: true,
      blocked: true,
    };
  }

  const records = parseSeries(series, options);
  const totalLeafCount = records.length;

  let displayed = records;
  let truncated = false;

  if (totalLeafCount > effectiveMax) {
    displayed = [...records]
      .sort((a, b) => numericValue(b) - numericValue(a))
      .slice(0, effectiveMax);
    truncated = true;
  }

  if (displayed.length > HARD_MAX_NODES) {
    return {
      tree: {name: 'BubbleChart', children: []},
      totalLeafCount,
      displayedLeafCount: 0,
      truncated: true,
      blocked: true,
    };
  }

  const tree = createTreeFromRecords(displayed);

  return {
    tree,
    totalLeafCount,
    displayedLeafCount: displayed.length,
    truncated,
    blocked: false,
  };
}
