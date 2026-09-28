/**
 * Module boundaries, checked in CI with `npm run lint:deps`.
 * A module reaches another module through its service, never through its
 * repository or its table. The only exception is a table referencing another
 * module's table for a foreign key.
 */
module.exports = {
  forbidden: [
    {
      name: 'no-reaching-into-another-module',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/', pathNot: '\\.table\\.ts$' },
      to: { path: '^src/modules/[^/]+/.+\\.(repository|table)\\.ts$', pathNot: '^src/modules/$1/' },
    },
    {
      name: 'integrations-are-leaves',
      comment: 'Adapters know how to talk to an outside system, nothing about product modules.',
      severity: 'error',
      from: { path: '^src/integrations/' },
      to: { path: '^src/(modules|workers)/' },
    },
    {
      name: 'modules-do-not-know-the-runtime',
      comment: 'Feature modules must run the same in a test, a script and a queue worker.',
      severity: 'error',
      from: { path: '^src/modules/' },
      to: { path: '^src/(workers/|main\\.ts|app\\.module\\.ts)' },
    },
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
  },
};
