import React, {useMemo} from 'react';
import BubbleChart from './BubbleChart';
import {BubbleChartOptions, ProcessedBubbleData} from 'types';
import {LoadingState, PanelProps} from '@grafana/data';
import {Alert} from '@grafana/ui';
import {HARD_MAX_NODES, PARSE_REFUSE_THRESHOLD} from '../constants';
import {processBubbleData} from '../utils/processBubbleData';

interface Props extends PanelProps<BubbleChartOptions> {}

export const BubbleChartPanel: React.FC<Props> = ({options, data, width, height}) => {
  const size = Math.min(width, height);
  const {
    stat,
    unit,
    groupBy,
    groupLabels,
    groupSeparator,
    maxNodes,
  } = options;

  const processed: ProcessedBubbleData | undefined = useMemo(() => {
    if (data.state !== LoadingState.Done) {
      return undefined;
    }
    return processBubbleData(data.series, {
      stat,
      unit,
      groupBy,
      groupLabels,
      groupSeparator,
      maxNodes,
    });
  }, [data.state, data.series, stat, unit, groupBy, groupLabels, groupSeparator, maxNodes]);

  if (processed === undefined) {
    return <>Loading... please wait</>;
  }

  if (processed.blocked) {
    return (
      <div style={{width, height, padding: 8, boxSizing: 'border-box'}}>
        <Alert title="Dataset too large" severity="error">
          This query produced {processed.totalLeafCount.toLocaleString()} series, which exceeds the safe
          processing limit ({PARSE_REFUSE_THRESHOLD.toLocaleString()}). Filter or aggregate the query before
          displaying this panel. The hard render ceiling is {HARD_MAX_NODES.toLocaleString()} nodes.
        </Alert>
      </div>
    );
  }

  const warningBanner =
    processed.truncated ? (
      <div style={{position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1, padding: 4}}>
        <Alert title="Showing partial data" severity="warning">
          Showing {processed.displayedLeafCount.toLocaleString()} of {processed.totalLeafCount.toLocaleString()}{' '}
          series (largest by value). Raise Max nodes under Performance options or filter the query.
        </Alert>
      </div>
    ) : null;

  return (
    <div style={{width, height, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      {warningBanner}
      <BubbleChart
        data={processed.tree}
        width={size}
        height={size}
        opt={options}
        nodeCount={processed.displayedLeafCount}
      />
    </div>
  );
};
