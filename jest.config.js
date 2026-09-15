// force timezone to UTC to allow tests to work regardless of local timezone
// generally used by snapshots, but can affect specific tests
process.env.TZ = 'UTC';

const { grafanaESModules, nodeModulesToTransform } = require('./.config/jest/utils');

module.exports = {
  // Jest configuration provided by Grafana scaffolding
  ...require('./.config/jest.config'),
  // d3-hierarchy (and its d3-array dependency) are ESM-only; allow Jest to transform them.
  transformIgnorePatterns: [
    nodeModulesToTransform([
      ...grafanaESModules,
      'd3-array',
      'd3-hierarchy',
      'd3-path',
      'd3-shape',
      'internmap',
    ]),
  ],
};
