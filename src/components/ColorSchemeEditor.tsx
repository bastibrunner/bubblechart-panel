import {css} from '@emotion/css';
import React, {useMemo} from 'react';
import {FieldType, GrafanaTheme2, SelectableValue, StandardEditorProps} from '@grafana/data';
import {Field, ColorPicker, RadioButtonGroup, useStyles2, Input, Button, Alert, Select} from '@grafana/ui';
import {ColorSchemeOptions, ColorSchemeParams, LabelColorMapping} from 'types';
import * as chromatic from 'd3-scale-chromatic';

export interface ColorSchemeEditorSettings {}
interface Props extends StandardEditorProps<string | string[] | null, ColorSchemeEditorSettings> {}

export const ColorSchemeEditor: React.FC<Props> = ({context, onChange}) => {
  const styles = useStyles2(getStyles);
  const config: ColorSchemeParams = context.options.colorSchemeParams;

  const onFieldChange = <K extends keyof ColorSchemeParams>(field: K, value: ColorSchemeParams[K]) => {
    onChange({
      ...context.options.colorSchemeParams, 
      [field]: value
    });
  };

  const invertColors = () => {
    onChange({
      ...context.options.colorSchemeParams, 
      thresholdColors: [...config.thresholdColors].reverse()});
  };

  const labelKeyOptions: Array<SelectableValue<string>> = useMemo(() => {
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
    return Array.from(keys).sort().map((key) => ({value: key, label: key}));
  }, [context?.data]);

  const uniqueLabelValues = useMemo(() => {
    const colorLabel = config.colorLabel;
    if (!colorLabel || !context?.data) {
      return [] as string[];
    }
    const values = new Set<string>();
    for (const frame of context.data) {
      for (const field of frame.fields) {
        if (field.type !== FieldType.number || !field.labels) {
          continue;
        }
        const labelValue = field.labels[colorLabel];
        if (labelValue !== undefined && labelValue !== '') {
          values.add(labelValue);
        }
      }
    }
    return Array.from(values).sort();
  }, [config.colorLabel, context?.data]);

  const getMappedColor = (value: string, index: number): string => {
    const mapping = (config.labelColorMappings || []).find((m) => m.value === value);
    if (mapping) {
      return mapping.color;
    }
    const palette = chromatic.schemeCategory10;
    return palette[index % palette.length];
  };

  const setLabelColor = (value: string, color: string) => {
    const existing = config.labelColorMappings || [];
    const next: LabelColorMapping[] = existing.filter((m) => m.value !== value);
    next.push({value, color});
    onFieldChange('labelColorMappings', next);
  };

  const addLabelMapping = () => {
    const existing = config.labelColorMappings || [];
    const palette = chromatic.schemeCategory10;
    onFieldChange('labelColorMappings', [
      ...existing,
      {value: '', color: palette[existing.length % palette.length]},
    ]);
  };

  const updateLabelMapping = (index: number, patch: Partial<LabelColorMapping>) => {
    const existing = [...(config.labelColorMappings || [])];
    existing[index] = {...existing[index], ...patch};
    onFieldChange('labelColorMappings', existing);
  };

  const removeLabelMapping = (index: number) => {
    const existing = [...(config.labelColorMappings || [])];
    existing.splice(index, 1);
    onFieldChange('labelColorMappings', existing);
  };

  return (
    <>
      <Field>
        <RadioButtonGroup
          id='colorSchemes'
          options={[
            {
              value: ColorSchemeOptions.Group,
              label: 'Group',
            },
            {
              value: ColorSchemeOptions.Threshold,
              label: 'Threshold',
            },
            {
              value: ColorSchemeOptions.Gradient,
              label: 'Gradient',
            },
            {
              value: ColorSchemeOptions.Unique,
              label: 'Unique',
            },
            {
              value: ColorSchemeOptions.Label,
              label: 'Label',
            },
          ]}
          value={config.colorScheme}
          onChange={(val) => onFieldChange('colorScheme', val)}
        />
      </Field>
      {(config.colorScheme === ColorSchemeOptions.Group) && (
        <>
          <Alert title="" severity="info">Define two colors to create a hierarchical color scheme for circles based on their group. Set colors, such as Green and Yellow, to visually represent different shades within each group. Customize the color scheme to align with your specific data patterns.</Alert>
          <Field horizontal={true} label="Colors" description="Select two colors to represent distinct shades in the circle hierarchy">
            <div className={styles.container}>
              <div className={styles.picker}>
                <ColorPicker
                  color={config.groupDepthColors[0]}
                  onChange={(color) => onFieldChange('groupDepthColors', [color, config.groupDepthColors[1]])}
                  enableNamedColors={false}
                />
              </div>
              <div className={styles.picker}>
                <ColorPicker
                  color={config.groupDepthColors[1]}
                  onChange={(color) => onFieldChange('groupDepthColors', [config.groupDepthColors[0], color])}
                  enableNamedColors={false}
                />
              </div>
            </div>
          </Field>
        </>
      )}

      {(config.colorScheme === ColorSchemeOptions.Gradient) && (
        <>
          <Alert title="" severity="info">Use a gradient scale to color circles based on their values. Define threshold values like 20, 50 and corresponding colors to create a visually appealing gradient effect that reflects the data distribution.</Alert>
          <Field horizontal={true} label="Gradient Values" description="Set threshold values. Only two values are supported, such as 20,50">
            <Input type="text" placeholder="20,50" value={config.gradientThresholds} onChange={(event) => onFieldChange('gradientThresholds', event.currentTarget.value)} />
          </Field>
          <Field horizontal={true} label="Colors" description="Select two colors to create an appealing gradient effect">
            <div className={styles.container}>
              <div className={styles.picker}>
                <ColorPicker
                  color={config.gradientColors[0]}
                  onChange={(color) => onFieldChange('gradientColors', [color, config.gradientColors[1]])}
                  enableNamedColors={false}
                />
              </div>
              <div className={styles.picker}>
                <ColorPicker
                  color={config.gradientColors[1]}
                  onChange={(color) => onFieldChange('gradientColors', [config.gradientColors[0], color])}
                  enableNamedColors={false}
                />
              </div>
            </div>
          </Field>
        </>
      )}

      {(config.colorScheme === ColorSchemeOptions.Threshold) && (
        <>
          <Alert title="" severity="info">Color circles based on predefined threshold values to visually represent your data. Set threshold values, like 20,50 , resulting in color bands: Green for values under 20, Yellow for 20-50, and Red for values exceeding 50. Customize the color scheme to align with your specific data patterns.</Alert>
          <Field horizontal={true} label="Threshold Values" description="Set threshold values. Only two values are supported, such as 20,50">
            <Input type="text" placeholder="20,50" value={config.thresholds} onChange={(event) => onFieldChange('thresholds', event.currentTarget.value)} />
          </Field>
          <Field horizontal={true} label="Colors" description="Select three colors to define distinct bands based on threshold values.">
            <div className={styles.container}>
              <div className={styles.picker}>
                <ColorPicker
                  color={config.thresholdColors[0]}
                  onChange={(color) => onFieldChange('thresholdColors', [color, config.thresholdColors[1], config.thresholdColors[2]])}
                  enableNamedColors={false}
                />
              </div>
              <div className={styles.picker}>
                <ColorPicker
                  color={config.thresholdColors[1]}
                  onChange={(color) => onFieldChange('thresholdColors', [config.thresholdColors[0], color, config.thresholdColors[2]])}
                  enableNamedColors={false}
                />
              </div>
              <div className={styles.picker}>
                <ColorPicker
                  color={config.thresholdColors[2]}
                  onChange={(color) => onFieldChange('thresholdColors', [config.thresholdColors[0], config.thresholdColors[1], color])}
                  enableNamedColors={false}
                />
              </div>
              <Button
                size="md"
                onClick={(event) => invertColors()}
              >Invert</Button>
            </div>
          </Field>
        </>
      )}
      {(config.colorScheme === ColorSchemeOptions.Unique) && (
        <>
          <Alert title="" severity="info">Apply unique color to circles, distinguishing them based on specific characteristics. This scheme allows for clear differentiation and categorization of circles, making it easy to interpret the data.</Alert>
        </>
      )}
      {(config.colorScheme === ColorSchemeOptions.Label) && (
        <>
          <Alert title="" severity="info">Color circles based on a series label. Choose a label key, then assign colors to its values. Unmapped values receive an automatic palette color.</Alert>
          <Field label="Color by label" description="Select which series label determines the circle color">
            <Select
              options={labelKeyOptions}
              value={config.colorLabel || null}
              onChange={(option) => onFieldChange('colorLabel', option?.value || '')}
              placeholder="Select a label"
              isClearable
              allowCustomValue
            />
          </Field>
          {uniqueLabelValues.length > 0 && (
            <Field label="Detected values" description="Colors for label values found in the current data">
              <div className={styles.mappingList}>
                {uniqueLabelValues.map((value, index) => (
                  <div key={value} className={styles.mappingRow}>
                    <span className={styles.mappingValue}>{value}</span>
                    <div className={styles.picker}>
                      <ColorPicker
                        color={getMappedColor(value, index)}
                        onChange={(color) => setLabelColor(value, color)}
                        enableNamedColors={false}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Field>
          )}
          <Field label="Custom mappings" description="Add or override colors for specific label values (useful when values are not yet in the query result)">
            <div className={styles.mappingList}>
              {(config.labelColorMappings || []).map((mapping, index) => (
                <div key={index} className={styles.mappingRow}>
                  <Input
                    type="text"
                    placeholder="Label value"
                    value={mapping.value}
                    onChange={(event) => updateLabelMapping(index, {value: event.currentTarget.value})}
                  />
                  <div className={styles.picker}>
                    <ColorPicker
                      color={mapping.color}
                      onChange={(color) => updateLabelMapping(index, {color})}
                      enableNamedColors={false}
                    />
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => removeLabelMapping(index)}>
                    Remove
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="secondary" onClick={addLabelMapping}>
                Add mapping
              </Button>
            </div>
          </Field>
        </>
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: flex;
    flex-wrap: nowrap;
    justify-content: flex-end;
    align-items: center;
  `,
  picker: css`
    margin-right: 3px;
    cursor: pointer;
    background: rgb(17, 18, 23);
    padding: 3px;
    height: 32px;
    width: 38px;
    border: 1px solid rgba(204, 204, 220, 0.2);
    display: flex;
    flex-direction: row;
    -webkit-box-align: center;
    align-items: center;
    justify-content: center;
    align-content: flex-end;
    flex-shrink: 0;
  `,
  mappingList: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  `,
  mappingRow: css`
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    width: 100%;
  `,
  mappingValue: css`
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
});
