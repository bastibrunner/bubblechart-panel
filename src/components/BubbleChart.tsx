import React, {useEffect, useMemo, useRef} from 'react';
import {BubbleChartLabels, BubbleChartProps, CircleData, TreeRecord} from 'types';
import {Tooltip as ReactTooltip} from 'react-tooltip';
import * as d3 from 'd3';
import {GrafanaThemeType, formattedValueToString, getValueFormat} from '@grafana/data';
import {Selection} from 'd3-selection';
import {} from 'd3-hierarchy';
import * as chromatic from 'd3-scale-chromatic';
import {config} from '@grafana/runtime';
import {
  DEFAULT_HIDE_LABELS_ABOVE,
  DEFAULT_MIN_BUBBLE_RADIUS_FOR_LABEL,
  RESIZE_DEBOUNCE_MS,
} from '../constants';
import {
  buildHighlightTooltipHtml,
  isLeafNode,
  sharesHighlightLabelValues,
  toHighlightableLeaf,
} from '../utils/highlightByLabels';
import {getNodeDisplayName} from '../utils/displayNameTemplate';

type MergedOpt = {
  textfont: string;
  textanchor: string;
  textshadow: string;
  bubbleChartLabels: BubbleChartLabels[];
  highlightLabels: string[];
  colorScheme: string;
  thresholds: number[];
  gradientThresholds: number[];
  thresholdColors: string[];
  gradientColors: string[];
  groupDepthColors: string[];
  colorLabel: string;
  labelColorMappings: Array<{value: string; color: string}>;
  unit: string;
  decimals: number | undefined;
  bgColor: string;
  hideLabelsAbove: number;
  minBubbleRadiusForLabel: number;
};

function parseThresholds(thresholds: string): number[] {
  return thresholds.split(',').map((strValue: string) => Number(strValue.trim()));
}

function buildMergedOpt(opt: BubbleChartProps['opt']): MergedOpt {
  const defaultFonts = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  const defaultShadow = '0 1px 0 #fff, 1px 0 0 #fff, -1px 0 0 #fff, 0 -1px 0 #fff';
  return {
    textfont: opt.textfont?.trim() || defaultFonts,
    textanchor: opt.textanchor?.trim() || 'middle',
    textshadow: opt.textshadow?.trim() || defaultShadow,
    bubbleChartLabels: opt.displayLabels || [],
    highlightLabels: Array.isArray(opt.highlightLabels) ? opt.highlightLabels : [],
    colorScheme: opt.colorSchemeParams?.colorScheme?.trim() || 'Group',
    thresholds: parseThresholds(opt.colorSchemeParams?.thresholds?.trim() || '50,80'),
    gradientThresholds: parseThresholds(opt.colorSchemeParams?.gradientThresholds?.trim() || '0,100'),
    thresholdColors:
      (opt.colorSchemeParams?.thresholdColors ?? []).length > 0
        ? (opt.colorSchemeParams?.thresholdColors as string[])
        : ['rgba(237, 129, 40, 0.89)', 'rgba(50, 172, 45, 0.97)'],
    gradientColors:
      (opt.colorSchemeParams?.gradientColors ?? []).length > 0
        ? (opt.colorSchemeParams?.gradientColors as string[])
        : ['red', 'green'],
    groupDepthColors:
      (opt.colorSchemeParams?.groupDepthColors ?? []).length > 0
        ? (opt.colorSchemeParams?.groupDepthColors as string[])
        : ['hsl(152,80%,80%)', 'hsl(228,30%,40%)'],
    colorLabel: opt.colorSchemeParams?.colorLabel?.trim() || '',
    labelColorMappings: opt.colorSchemeParams?.labelColorMappings || [],
    unit: opt.unit?.trim() || 'short',
    decimals: opt.decimals,
    bgColor: config.bootData.user.theme === GrafanaThemeType.Light ? 'rgb(230,230,230)' : 'rgb(38,38,38)',
    hideLabelsAbove:
      typeof opt.hideLabelsAbove === 'number' ? opt.hideLabelsAbove : DEFAULT_HIDE_LABELS_ABOVE,
    minBubbleRadiusForLabel:
      typeof opt.minBubbleRadiusForLabel === 'number'
        ? opt.minBubbleRadiusForLabel
        : DEFAULT_MIN_BUBBLE_RADIUS_FOR_LABEL,
  };
}

/** Estimate font size from radius — avoids getComputedTextLength during animation. */
function estimateFontSize(
  d: d3.HierarchyCircularNode<TreeRecord>,
  k: number,
  root: d3.HierarchyCircularNode<TreeRecord>
): number {
  if (d === root) {
    return Math.round(Math.max(0.5, d.children ? d.r / 4 : Math.min(2 * d.r, k * d.r / 4)));
  }
  return Math.round(Math.max(0.5, d.children ? d.r / 4 : (k * d.r) / 8));
}

const BubbleChart: React.FC<BubbleChartProps> = ({data, width, height, opt, nodeCount = 0}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const viewRef = useRef<d3.ZoomView | null>(null);
  const focusRef = useRef<d3.HierarchyCircularNode<TreeRecord> | null>(null);
  const layoutRef = useRef<{
    root: d3.HierarchyCircularNode<TreeRecord>;
    nodes: Array<d3.HierarchyCircularNode<TreeRecord>>;
    circle: Selection<SVGCircleElement, d3.HierarchyCircularNode<TreeRecord>, SVGGElement, undefined> | null;
    text: Selection<SVGTextElement, d3.HierarchyCircularNode<TreeRecord>, SVGGElement, undefined> | null;
    node: Selection<d3.BaseType, unknown, SVGGElement, undefined> | null;
    g: Selection<SVGGElement, unknown, null, undefined> | null;
    margin: number;
  } | null>(null);

  const mergedOpt = useMemo(() => buildMergedOpt(opt), [opt]);

  const labelsEnabled = useMemo(() => {
    const hasLabelContent =
      mergedOpt.bubbleChartLabels.includes(BubbleChartLabels.Name) ||
      mergedOpt.bubbleChartLabels.includes(BubbleChartLabels.Value);
    if (!hasLabelContent) {
      return false;
    }
    if (mergedOpt.hideLabelsAbove > 0 && nodeCount > mergedOpt.hideLabelsAbove) {
      return false;
    }
    return true;
  }, [mergedOpt.bubbleChartLabels, mergedOpt.hideLabelsAbove, nodeCount]);

  // Debounced size used so dragging the panel does not thrash pack/DOM.
  const [debouncedSize, setDebouncedSize] = React.useState({width, height});
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSize({width, height});
    }, RESIZE_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [width, height]);

  // Full rebuild when data or options change (or debounced size for pack diameter).
  useEffect(() => {
    if (data.children?.length === 0) {
      return;
    }

    const svgElement = svgRef.current;
    if (!svgElement) {
      return;
    }

    const {width: w, height: h} = debouncedSize;
    const svgSelection = d3.select(svgElement);
    svgSelection.selectAll('*').remove();
    svgSelection.attr('width', w).attr('height', h).attr('viewBox', `0 0 ${w} ${h}`);

    const bgColor = mergedOpt.bgColor;
    const margin = 20;
    const diameter = h;
    const g = svgSelection.append('g').attr('transform', 'translate(' + w / 2 + ',' + h / 2 + ')');

    const groupDepthColor = d3
      .scaleLinear<string>()
      .domain([-1, 5])
      .range(mergedOpt.groupDepthColors as [string, string])
      .interpolate(d3.interpolateHcl as any);

    const gradientColor = d3
      .scaleLinear<string>()
      .domain(mergedOpt.gradientThresholds)
      .range(mergedOpt.gradientColors as [string, string]);

    const colorPalette = chromatic.schemeCategory10;
    const uniqueColor = d3.scaleOrdinal().range(colorPalette);
    const labelColor = d3.scaleOrdinal<string, string>().range(colorPalette);
    const labelColorMap = new Map<string, string>(
      (mergedOpt.labelColorMappings || [])
        .filter((m) => m.value !== '')
        .map((m) => [m.value, m.color])
    );

    const pack = d3
      .pack()
      .size([diameter - margin, diameter - margin])
      .padding(2);

    const root: d3.HierarchyCircularNode<TreeRecord> = d3
      .hierarchy(data)
      .sum((d: TreeRecord) => d.value || 1)
      .sort(
        (a: d3.HierarchyNode<TreeRecord>, b: d3.HierarchyNode<TreeRecord>) =>
          (b.data.value || 1) - (a.data.value || 1)
      ) as d3.HierarchyCircularNode<TreeRecord>;

    const nodes = (pack(root as d3.HierarchyNode<unknown>) as d3.HierarchyCircularNode<TreeRecord>).descendants();

    function getCircleColor(d: d3.HierarchyCircularNode<TreeRecord>): string {
      const newVal = Number(d.data.value);
      if (mergedOpt.colorScheme === 'Group') {
        return String(groupDepthColor(d.depth));
      } else if (mergedOpt.colorScheme === 'Threshold' && mergedOpt.thresholds.length > 0) {
        if (d.children) {
          return bgColor;
        }
        for (let i = mergedOpt.thresholds.length; i > 0; i--) {
          if (newVal >= mergedOpt.thresholds[i - 1]) {
            return mergedOpt.thresholdColors[i];
          }
        }
        return mergedOpt.thresholdColors[0];
      } else if (mergedOpt.colorScheme === 'Gradient') {
        return d.children ? bgColor : String(gradientColor(Number(d.value)));
      } else if (mergedOpt.colorScheme === 'Unique') {
        return d.children ? bgColor : (uniqueColor(String(d.value)) as string);
      } else if (mergedOpt.colorScheme === 'Label') {
        if (d.children) {
          return bgColor;
        }
        const labelKey = mergedOpt.colorLabel;
        const labelValue =
          labelKey && d.data.labels ? d.data.labels[labelKey] : d.data.name;
        const key = labelValue ?? d.data.name ?? '';
        if (labelColorMap.has(key)) {
          return labelColorMap.get(key)!;
        }
        return labelColor(key);
      }
      return 'green';
    }

    function formatValue(value: any): string {
      let formattedValue = value.toString();
      if (mergedOpt.unit?.length || mergedOpt.decimals != null) {
        const fmt = getValueFormat(mergedOpt.unit ?? 'short');
        if (!Number.isNaN(value)) {
          formattedValue = formattedValueToString(fmt(value, mergedOpt.decimals));
        }
      }
      return formattedValue;
    }

    function getTooltipText(d: d3.HierarchyCircularNode<TreeRecord>): string {
      const toolTipCell =
        '<div data-testid="series-icon" style="vertical-align: middle; background:' +
        getCircleColor(d) +
        ';width: 14px;height: 4px;border-radius: 9999px;display: inline-block;margin-right: 8px;"></div>';
      return d === undefined
        ? toolTipCell + ''
        : toolTipCell +
            '  <strong>' +
            getNodeDisplayName(d.data) +
            (!d.children || d.children.length === 0
              ? '</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' +
                formatValue(d.data.value) +
                '</span>'
              : '</strong>');
    }

    function clearHighlight() {
      if (!layoutRef.current?.circle) {
        return;
      }
      layoutRef.current.circle
        .classed('node--related', false)
        .classed('node--dimmed', false);
    }

    function applyHighlight(hovered: d3.HierarchyCircularNode<TreeRecord>) {
      const highlightLabels = mergedOpt.highlightLabels;
      const circleSel = layoutRef.current?.circle;
      if (!circleSel || !highlightLabels.length || !isLeafNode(hovered)) {
        clearHighlight();
        return [];
      }

      const related = new Set(
        nodes.filter(
          (n) =>
            isLeafNode(n) &&
            sharesHighlightLabelValues(hovered.data.labels, n.data.labels, highlightLabels)
        )
      );

      if (!related.size) {
        clearHighlight();
        return [];
      }

      circleSel
        .classed('node--related', (n) => related.has(n))
        .classed('node--dimmed', (n) => !related.has(n));

      return Array.from(related).map((n) => toHighlightableLeaf(n, getCircleColor(n)));
    }

    function getText(d: d3.HierarchyCircularNode<TreeRecord>): string {
      let textContent = '';
      const hasName = mergedOpt.bubbleChartLabels.includes(BubbleChartLabels.Name);
      const hasValue = mergedOpt.bubbleChartLabels.includes(BubbleChartLabels.Value);
      if (hasName) {
        textContent += getNodeDisplayName(d.data);
      }
      if (hasName && hasValue) {
        textContent += ':  ';
      }
      if (hasValue && d.data.value !== undefined) {
        textContent += formatValue(d.data.value);
      }
      return textContent;
    }

    function zoomTo(v: d3.ZoomView) {
      const k = diameter / v[2];
      viewRef.current = v;
      const layout = layoutRef.current;
      if (!layout?.node || !layout.circle) {
        return;
      }
      layout.node.attr('transform', (d: any) =>
        isNaN(d.x) ? 'translate(0,0)' : 'translate(' + (d.x - v[0]) * k + ',' + (d.y - v[1]) * k + ')'
      );
      layout.circle.attr('r', (d: any) => (isNaN(d.r) ? 0.5 : (d.r <= 0 ? 1 : d.r) * k));

      if (layout.text) {
        // No getComputedTextLength — estimate from radius and hide when too small.
        layout.text
          .style('font-size', (d: d3.HierarchyCircularNode<TreeRecord>) => estimateFontSize(d, k, root) + 'px')
          .style('display', (d: d3.HierarchyCircularNode<TreeRecord>) => {
            const fontPx = estimateFontSize(d, k, root);
            const label = getNodeDisplayName(d.data);
            const approxWidth = (label?.length || 1) * fontPx * 0.55;
            const maxTextWidth = d.r * k * 2;
            return approxWidth > maxTextWidth || d.r * k < mergedOpt.minBubbleRadiusForLabel
              ? 'none'
              : 'block';
          });
      }
    }

    function zoom(d: d3.HierarchyCircularNode<TreeRecord>, event: MouseEvent) {
      focusRef.current = d;
      const currentView = viewRef.current;
      if (!currentView) {
        return;
      }
      d3.transition<MouseEvent>()
        .duration(event.altKey ? 7500 : 750)
        .tween('zoom', function () {
          const i = d3.interpolateZoom(currentView, [d.x, d.y, d.r * 2 + margin]);
          return function (t) {
            zoomTo(i(t));
          };
        });
    }

    function createCircles(
      gSel: Selection<SVGGElement, unknown, null, undefined>,
      nodeList: Array<d3.HierarchyCircularNode<TreeRecord>>
    ) {
      return gSel
        .selectAll<SVGCircleElement, CircleData>('circle')
        .data(nodeList)
        .enter()
        .append('circle')
        .attr('class', (d) =>
          d.parent ? (d.children ? 'node' : 'node node--leaf') : 'node node--root'
        )
        .style('fill', (d) => getCircleColor(d))
        .attr('id', (d) => d.name)
        .attr('r', (d) => (d.r && d.r > 0 ? d.r : 1))
        .attr('data-tooltip-id', 'my-tooltip')
        .on('click', (event: MouseEvent, d) => {
          if (focusRef.current !== d) {
            zoom(d, event);
            event.stopPropagation();
          }
        })
        .on('mouseover', function (_event: MouseEvent, d) {
          const matches = applyHighlight(d);
          const tooltipHtml =
            matches.length > 0
              ? buildHighlightTooltipHtml(matches, (value) =>
                  value === undefined ? '' : formatValue(value)
                )
              : getTooltipText(d);
          d3.select(this).attr('data-tooltip-html', tooltipHtml);
        })
        .on('mouseout', () => {
          clearHighlight();
        });
    }

    function createTexts(
      gSel: Selection<SVGGElement, unknown, null, undefined>,
      nodeList: Array<d3.HierarchyCircularNode<TreeRecord>>
    ) {
      if (!labelsEnabled) {
        return null;
      }
      // Only leaf nodes large enough to show a label — skip parents (opacity was 0) and tiny bubbles.
      const labelNodes = nodeList.filter(
        (d) =>
          !d.children &&
          d.r >= mergedOpt.minBubbleRadiusForLabel &&
          getText(d).length > 0
      );

      return gSel
        .selectAll<SVGTextElement, CircleData>('text')
        .data(labelNodes)
        .enter()
        .append('text')
        .attr('font', mergedOpt.textfont)
        .attr('text-anchor', mergedOpt.textanchor)
        .attr('dy', '.35em')
        .attr('text-anchor', 'middle')
        .text((d) => getText(d))
        .style('pointer-events', 'none')
        .style('opacity', 1)
        .style('font-size', (d) => estimateFontSize(d, 2, root) + 'px');
    }

    const circle = createCircles(g, nodes);
    const text = createTexts(g, nodes);
    const node = g.selectAll('circle, text') as Selection<
      d3.BaseType,
      unknown,
      SVGGElement,
      undefined
    >;

    layoutRef.current = {
      root,
      nodes,
      circle,
      text,
      node,
      g,
      margin,
    };
    focusRef.current = root;
    zoomTo([root.x, root.y, root.r * 2 + margin]);

    return () => {
      layoutRef.current = null;
    };
  }, [data, mergedOpt, debouncedSize, labelsEnabled]);

  return (
    <div>
      <svg
        ref={svgRef}
        width={debouncedSize.width}
        height={debouncedSize.height}
        viewBox={`0 0 ${debouncedSize.width} ${debouncedSize.height}`}
        id="BubbleChart"
      />
      <ReactTooltip id="my-tooltip" />
    </div>
  );
};

export default BubbleChart;
