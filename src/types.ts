import {PanelProps} from '@grafana/data';
import * as common from '@grafana/schema';

export type SeriesSize = 'sm' | 'md' | 'lg';

export interface BubbleChartPanelProps extends PanelProps {
  opts: BubbleChartOptions;
}

export interface BubbleChartOptions extends PanelProps, common.OptionsWithTooltip, common.OptionsWithLegend {
  displayLabels: BubbleChartLabels[];
  groupBy: string;
  groupLabels: string[];
  /**
   * Per group-by label display name templates (Label mode).
   * Keys are group-by label names; values support `{{label}}` tokens for any label
   * that has a unique value within that group's dataset.
   */
  groupDisplayNameOverrides: Record<string, string>;
  /**
   * Label keys used for cross-group hover highlighting. When set, hovering a leaf
   * highlights every other leaf that shares the same values for all of these keys.
   */
  highlightLabels: string[];
  stat: StatOptions;
  unit: string;
  decimals: number;
  groupSeparator: string;
  /**
   * When true, first-level groups are laid out in a row/grid of separate root
   * circles instead of being packed inside a single outer circle.
   */
  firstGroupInRow: boolean;
  /**
   * Max number of first-level group circles on each row when firstGroupInRow is enabled.
   */
  maxGroupsPerRow: number;
  colorSchemeParams: ColorSchemeParams;
  text: string;
  showSeriesCount: boolean;
  seriesCountSize: SeriesSize;
  bgColor: string;
  displayLabel: boolean;
  textshadow: string;
  textfont: string;
  textanchor: string;
  /** Soft cap on leaf bubbles rendered (effective max is min of this and HARD_MAX_NODES). */
  maxNodes: number;
  /**
   * When truncating to maxNodes, fold the dropped series into a single "Others" leaf
   * instead of discarding them.
   */
  groupRemainderToOthers: boolean;
  /** How to aggregate values of series folded into the Others leaf. */
  othersAggregate: OthersAggregate;
  /** Hide all labels when total displayed node count exceeds this (0 = never auto-hide). */
  hideLabelsAbove: number;
  /** Minimum packed radius (before zoom scale) required to create a label text element. */
  minBubbleRadiusForLabel: number;
}

/** Result of parsing series into a hierarchy, including truncation metadata. */
export type ProcessedBubbleData = {
  tree: TreeRecord;
  totalLeafCount: number;
  displayedLeafCount: number;
  truncated: boolean;
  blocked: boolean;
  /** Number of original series folded into the Others leaf (0 when unused). */
  othersCount: number;
};

export type LabelColorMapping = {
  value: string;
  color: string;
};

export type ColorSchemeParams = {
  colorScheme: ColorSchemeOptions;
  groupDepthColors: [string, string];
  thresholds: string;
  gradientThresholds: string;
  thresholdColors: [string, string, string];
  gradientColors: [string, string];
  /** Label key used when colorScheme is Label */
  colorLabel?: string;
  /** Explicit color overrides for label values */
  labelColorMappings?: LabelColorMapping[];
}

export interface BubbleChartProps {
  data: TreeRecord;
  width: number;
  height: number;
  opt: BubbleChartOptions;
  /** Total nodes (descendants) after pack; used for LOD decisions. */
  nodeCount?: number;
}

export type ParsedSeriesRecord = {
  name: string;
  aliases: string[];
  value: number | string;
  labels?: Record<string, string>;
}

export type TreeRecord = {
  name: string;
  /** Resolved display label for tooltips/on-bubble text; falls back to `name`. */
  displayName?: string;
  children?: TreeRecord[];
  value?: number;
  labels?: Record<string, string>;
}

export interface Node {
  parent?: Node;
  children?: Node[];
  name: string;
  r: number;
}

export interface CircleData {
  parent?: Node;
  name: string;
  value: number;
  depth: number;
  r: number;
  children?: CircleData[];
}

export interface DataRecord {
  name: string;
  value: number;
  category: string;
}

export enum ColorSchemeOptions {
  Group = 'Group',
  Threshold = 'Threshold',
  Gradient = 'Gradient',
  Unique = 'Unique',
  Label = 'Label',
}

export enum StatOptions {
  Min = 'min',
  Max = 'max',
  Avg = 'avg',
  Total = 'total',
  Current = 'current'
}

/** Aggregation applied to series folded into the Others leaf. */
export enum OthersAggregate {
  Sum = 'sum',
  Avg = 'avg',
  Min = 'min',
  Max = 'max',
  Count = 'count',
}

export enum BubbleChartLabels {
  Name = 'name',
  Value = 'value'
}
