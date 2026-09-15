import {
  buildHighlightTooltipHtml,
  findLeavesMatchingHighlightLabels,
  HighlightableLeaf,
  sharesHighlightLabelValues,
  toHighlightableLeaf,
} from './highlightByLabels';

describe('sharesHighlightLabelValues', () => {
  it('returns false when no highlight labels are selected', () => {
    expect(
      sharesHighlightLabelValues({env: 'prod'}, {env: 'prod'}, [])
    ).toBe(false);
  });

  it('returns true when all selected labels match', () => {
    expect(
      sharesHighlightLabelValues(
        {env: 'prod', region: 'eu', host: 'a'},
        {env: 'prod', region: 'eu', host: 'b'},
        ['env', 'region']
      )
    ).toBe(true);
  });

  it('returns false when any selected label differs', () => {
    expect(
      sharesHighlightLabelValues(
        {env: 'prod', region: 'eu'},
        {env: 'prod', region: 'us'},
        ['env', 'region']
      )
    ).toBe(false);
  });

  it('returns false when a selected label is missing on either side', () => {
    expect(
      sharesHighlightLabelValues({env: 'prod'}, {env: 'prod'}, ['env', 'region'])
    ).toBe(false);
    expect(
      sharesHighlightLabelValues({env: 'prod', region: 'eu'}, {env: 'prod'}, ['env', 'region'])
    ).toBe(false);
  });

  it('returns false when labels are undefined', () => {
    expect(sharesHighlightLabelValues(undefined, {env: 'prod'}, ['env'])).toBe(false);
    expect(sharesHighlightLabelValues({env: 'prod'}, undefined, ['env'])).toBe(false);
  });
});

describe('findLeavesMatchingHighlightLabels', () => {
  const leaves: HighlightableLeaf[] = [
    {name: 'a', value: 1, labels: {env: 'prod', service: 'api'}, color: 'red'},
    {name: 'b', value: 2, labels: {env: 'prod', service: 'api'}, color: 'blue'},
    {name: 'c', value: 3, labels: {env: 'prod', service: 'web'}, color: 'green'},
    {name: 'd', value: 4, labels: {env: 'dev', service: 'api'}, color: 'yellow'},
  ];

  it('returns empty when highlight labels are empty', () => {
    expect(findLeavesMatchingHighlightLabels(leaves, leaves[0], [])).toEqual([]);
  });

  it('matches leaves that share all selected label values', () => {
    const matches = findLeavesMatchingHighlightLabels(leaves, leaves[0], ['env', 'service']);
    expect(matches.map((m) => m.name)).toEqual(['a', 'b']);
  });

  it('matches more broadly when fewer labels are selected', () => {
    const matches = findLeavesMatchingHighlightLabels(leaves, leaves[0], ['env']);
    expect(matches.map((m) => m.name)).toEqual(['a', 'b', 'c']);
  });
});

describe('buildHighlightTooltipHtml', () => {
  it('lists name and formatted value for each match', () => {
    const html = buildHighlightTooltipHtml(
      [
        {name: 'a', value: 10, color: '#111'},
        {name: 'b', value: 20, color: '#222'},
      ],
      (v) => String(v)
    );
    expect(html).toContain('<strong>a</strong>');
    expect(html).toContain('10');
    expect(html).toContain('<strong>b</strong>');
    expect(html).toContain('20');
    expect(html).toContain('background:#111');
    expect(html).toContain('background:#222');
  });
});

describe('toHighlightableLeaf', () => {
  it('prefers displayName over name', () => {
    expect(
      toHighlightableLeaf(
        {data: {name: 'foo', displayName: 'Label1 foo with same', value: 1}},
        'red'
      ).name
    ).toBe('Label1 foo with same');
  });
});
