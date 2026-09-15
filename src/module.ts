import {FieldOverrideContext, FieldType, PanelPlugin, } from '@grafana/data';
import {StatOptions, BubbleChartOptions, BubbleChartLabels, OthersAggregate} from './types';
import {BubbleChartPanel} from 'components/BubbleChartPanel';
import {FieldConfig} from '@grafana/schema';
import './bubble-panel.css';
import {ColorSchemeEditor} from 'components/ColorSchemeEditor';
import {GroupDisplayNameOverridesEditor} from 'components/GroupDisplayNameOverridesEditor';
import {BubbleChartPanelMigrationHandler} from 'migrations';
import {
  DEFAULT_GROUP_REMAINDER_TO_OTHERS,
  DEFAULT_HIDE_LABELS_ABOVE,
  DEFAULT_MAX_NODES,
  DEFAULT_MIN_BUBBLE_RADIUS_FOR_LABEL,
  HARD_MAX_NODES,
} from './constants';

export const plugin = new PanelPlugin < BubbleChartOptions, FieldConfig> (BubbleChartPanel)
  .setMigrationHandler(BubbleChartPanelMigrationHandler)
  .setPanelOptions((builder) => {
    builder
      .addMultiSelect({
        name: 'Labels',
        path: 'displayLabels',
        description: 'Select the labels to be displayed in the bubble chart circles',
        defaultValue: BubbleChartLabels.Name,
        settings: {
          options: [
            { value: BubbleChartLabels.Name, label: 'Name' },
            { value: BubbleChartLabels.Value, label: 'Value' },
          ],
        },
      })
      .addSelect({
        path: 'stat',
        name: 'Calculation',
        defaultValue: 'current',
        description: 'Choose a reducer function',
        settings: {
          options: [
            {
              value: StatOptions.Min,
              label: 'min',
            },
            {
              value: StatOptions.Max,
              label: 'max',
            },
            {
              value: StatOptions.Avg,
              label: 'avg',
            },
            {
              value: StatOptions.Current,
              label: 'current',
            },
            {
              value: StatOptions.Total,
              label: 'total',
            },
          ],
        }
      })
      .addUnitPicker({
        path: 'unit',
        name: 'Unit',
        description: 'Choose a unit for the displayed values',
        defaultValue: 'short',
      })
      .addTextInput({
        path: 'decimals',
        name: 'Decimals',
        description: 'Number of decimals',
        defaultValue: '2',
      })
      .addRadio({
        name: 'Group by',
        path: 'groupBy',
        description: 'Select the type of grouping to be used: Name or Label',
        defaultValue: 'Name',
        settings: {
          options: [
            { value: "Name", label: "Name" },
            { value: "Label", label: "Label" },
          ],
        }
      })
      .addMultiSelect({
        name: 'Labels',
        path: 'groupLabels',
        description: 'Select labels from the dropdown to customize the order of grouping.',        
        settings: {
          allowCustomValue: true,
          options: [],
          getOptions: async (context: FieldOverrideContext) => {
            const labelOptions: Array<{
              value: string;
              label: string;
            }> = [];
            
            if (context && context.data) {
              const frame = context.data[0];
              for (const field of frame.fields) {
                if (field.type !== FieldType.number) {
                  continue;
                }
                const labels = field.labels;
                for (const key in labels) {
                  labelOptions.push({ value: key, label: key });
                }
              }
            } 
            return Promise.resolve(labelOptions);
          },
        },
        showIf(currentOptions, data) {
          return currentOptions.groupBy === "Label";
        },
      })
      .addTextInput({
        path: 'groupSeparator',
        name: 'Separator',
        description: "For the 'Name' option, use this to split names using a defined character for hierarchical grouping. For example, if '$tag_env,$tag_host' is defined as aliases in the datasource query tab, using ',' as a splitter will group all host circles under the same environment.",
        defaultValue: ',',
        showIf(currentOptions, data) {
          return currentOptions.groupBy === "Name";
        },
      })
      .addCustomEditor({
        id: 'groupDisplayNameOverrides',
        path: 'groupDisplayNameOverrides',
        name: 'Display name overrides',
        description:
          'Override the display name for each group-by level. Use {{label}} placeholders for labels that have a unique value within that group (same style as series name overrides).',
        editor: GroupDisplayNameOverridesEditor,
        defaultValue: {},
        showIf(currentOptions) {
          return currentOptions.groupBy === 'Label';
        },
      })
      .addMultiSelect({
        name: 'Highlight by labels',
        path: 'highlightLabels',
        description:
          'Select labels whose shared values should be highlighted across groups. Hovering a bubble highlights every other bubble with the same values for all selected labels, and the tooltip lists their metrics.',
        settings: {
          allowCustomValue: true,
          options: [],
          getOptions: async (context: FieldOverrideContext) => {
            const keys = new Set<string>();
            if (context?.data) {
              for (const frame of context.data) {
                for (const field of frame.fields) {
                  if (field.type !== FieldType.number || !field.labels) {
                    continue;
                  }
                  for (const key of Object.keys(field.labels)) {
                    keys.add(key);
                  }
                }
              }
            }
            return Promise.resolve(
              Array.from(keys)
                .sort()
                .map((key) => ({value: key, label: key}))
            );
          },
        },
      })
      .addNumberInput({
        path: 'maxNodes',
        name: 'Max nodes',
        description: `Maximum leaf bubbles to render. Largest values are kept when the query returns more. Hard limit is ${HARD_MAX_NODES}.`,
        defaultValue: DEFAULT_MAX_NODES,
        settings: {
          min: 1,
          max: HARD_MAX_NODES,
          integer: true,
        },
        category: ['Performance'],
      })
      .addBooleanSwitch({
        path: 'groupRemainderToOthers',
        name: 'Group remainder into Others',
        description:
          'When the query exceeds Max nodes, keep the largest bubbles and fold the rest into a single Others bubble instead of dropping them.',
        defaultValue: DEFAULT_GROUP_REMAINDER_TO_OTHERS,
        category: ['Performance'],
      })
      .addSelect({
        path: 'othersAggregate',
        name: 'Others aggregation',
        description: 'How to compute the value of the Others bubble from the folded series.',
        defaultValue: OthersAggregate.Sum,
        settings: {
          options: [
            {value: OthersAggregate.Sum, label: 'Sum'},
            {value: OthersAggregate.Avg, label: 'Average'},
            {value: OthersAggregate.Min, label: 'Min'},
            {value: OthersAggregate.Max, label: 'Max'},
            {value: OthersAggregate.Count, label: 'Count'},
          ],
        },
        showIf(currentOptions) {
          return currentOptions.groupRemainderToOthers === true;
        },
        category: ['Performance'],
      })
      .addNumberInput({
        path: 'hideLabelsAbove',
        name: 'Hide labels above',
        description: 'Automatically hide all bubble labels when the displayed leaf count exceeds this value. Set to 0 to disable.',
        defaultValue: DEFAULT_HIDE_LABELS_ABOVE,
        settings: {
          min: 0,
          integer: true,
        },
        category: ['Performance'],
      })
      .addNumberInput({
        path: 'minBubbleRadiusForLabel',
        name: 'Min radius for labels',
        description: 'Do not create label text for bubbles smaller than this packed radius (before zoom). Reduces DOM cost on dense charts.',
        defaultValue: DEFAULT_MIN_BUBBLE_RADIUS_FOR_LABEL,
        settings: {
          min: 0,
        },
        category: ['Performance'],
      })
      .addCustomEditor({
        name: 'Color scheme',
        id: 'colorSchemeParams',
        path: 'colorSchemeParams',
        // description: 'Choose the color scheme to use. ',
        editor: ColorSchemeEditor,
        defaultValue: {
          colorScheme: 'Group',
          groupDepthColors: ['#73bf69', '#FAD22A'],
          thresholds: '20,50',
          gradientThresholds: '20,50',
          thresholdColors: ['#73bf69', '#FAD22A', '#f2495c'],
          gradientColors: ['#73bf69', '#f2495c'],
          colorLabel: '',
          labelColorMappings: [],
        },
        category: ['Color scheme'],
      })
  })
  .setNoPadding();



