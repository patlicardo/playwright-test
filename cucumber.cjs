/**
 * @see https://github.com/cucumber/cucumber-js/blob/main/docs/configuration.md
 */
/** @type {import('@cucumber/cucumber').IProfiles} */
module.exports = {
  default: {
    requireModule: ['ts-node/register'],
    require: [
      'features/support/world.ts',
      'features/support/hooks.ts',
      'features/steps/**/*.ts',
    ],
    paths: ['features/**/*.feature'],
    format: ['progress', 'html:cucumber-report/index.html'],
  },
};
