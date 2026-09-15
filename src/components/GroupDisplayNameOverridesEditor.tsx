import React from 'react';
import {StandardEditorProps, GrafanaTheme2} from '@grafana/data';
import {Field, Input, Alert, useStyles2} from '@grafana/ui';
import {css} from '@emotion/css';

type Overrides = Record<string, string>;

interface Props extends StandardEditorProps<Overrides> {}

/**
 * One display-name template input per selected group-by label.
 * Templates use `{{label}}` tokens for labels that are unique within the group.
 */
export const GroupDisplayNameOverridesEditor: React.FC<Props> = ({value, onChange, context}) => {
  const styles = useStyles2(getStyles);
  const groupLabels: string[] = context?.options?.groupLabels || [];
  const overrides: Overrides = value || {};

  if (!groupLabels.length) {
    return (
      <Alert severity="info" title="Select group labels">
        Choose labels under &quot;Labels&quot; (group by) first, then override each level&apos;s display name
        here.
      </Alert>
    );
  }

  const update = (label: string, template: string) => {
    onChange({
      ...overrides,
      [label]: template,
    });
  };

  return (
    <div className={styles.container}>
      <p className={styles.help}>
        Use <code>{'{{labelName}}'}</code> placeholders for any label with a unique value in that group.
        Leave empty to show the group label value.
      </p>
      {groupLabels.map((label) => (
        <Field
          key={label}
          label={label}
          description={`Display name template for the "${label}" grouping level`}
        >
          <Input
            value={overrides[label] ?? ''}
            placeholder={`{{${label}}}`}
            onChange={(e) => update(label, e.currentTarget.value)}
          />
        </Field>
      ))}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(1)};
  `,
  help: css`
    margin: 0 0 ${theme.spacing(1)} 0;
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
});
