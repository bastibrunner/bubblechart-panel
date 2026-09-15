import {TreeRecord} from 'types';

const TEMPLATE_TOKEN = /\{\{\s*([^}]+?)\s*\}\}/g;

/**
 * Replace `{{label}}` tokens with values from `labels`. Missing keys become empty strings.
 * Mirrors Grafana series-name override style templating.
 */
export function interpolateDisplayName(
  template: string,
  labels: Record<string, string> | undefined
): string {
  if (!template) {
    return '';
  }
  return template.replace(TEMPLATE_TOKEN, (_match, rawKey: string) => {
    const key = rawKey.trim();
    if (!key || !labels) {
      return '';
    }
    const value = labels[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

/**
 * Labels whose value is the same across every provided map.
 * Used so parent groups can only reference labels that are constant within the group.
 */
export function uniqueLabelsAcross(
  labelMaps: Array<Record<string, string> | undefined>
): Record<string, string> {
  const defined = labelMaps.filter(
    (m): m is Record<string, string> => !!m && Object.keys(m).length > 0
  );
  if (defined.length === 0) {
    return {};
  }
  if (defined.length === 1) {
    return {...defined[0]};
  }

  const result: Record<string, string> = {};
  const first = defined[0];
  for (const key of Object.keys(first)) {
    const value = first[key];
    if (defined.every((m) => m[key] === value)) {
      result[key] = value;
    }
  }
  return result;
}

export function getNodeDisplayName(node: Pick<TreeRecord, 'name' | 'displayName'>): string {
  return node.displayName ?? node.name;
}

/**
 * Walk the tree bottom-up, collect unique labels per node, and set `displayName`
 * from the override template for the group-by label at that depth.
 * Depth 1 uses `groupLabels[0]`, depth 2 uses `groupLabels[1]`, etc.
 * Leaves keep their full label map; parents only get labels shared by all descendants.
 */
export function applyGroupDisplayNames(
  tree: TreeRecord,
  groupLabels: string[] | undefined,
  overrides: Record<string, string> | undefined
): void {
  if (!overrides || !groupLabels?.length) {
    return;
  }
  const hasAnyTemplate = groupLabels.some((key) => {
    const template = overrides[key];
    return typeof template === 'string' && template.trim().length > 0;
  });
  if (!hasAnyTemplate) {
    return;
  }

  const walk = (node: TreeRecord, depth: number): Record<string, string> => {
    let unique: Record<string, string>;
    if (!node.children?.length) {
      unique = node.labels ? {...node.labels} : {};
    } else {
      const childUniques = node.children.map((child) => walk(child, depth + 1));
      unique = uniqueLabelsAcross(childUniques);
    }

    if (depth > 0) {
      const groupLabel = groupLabels[depth - 1];
      const template = groupLabel ? overrides[groupLabel] : undefined;
      if (typeof template === 'string' && template.trim().length > 0) {
        node.displayName = interpolateDisplayName(template, unique);
      }
    }

    return unique;
  };

  walk(tree, 0);
}
