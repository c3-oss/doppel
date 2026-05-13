module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['workspace', 'server', 'web', 'cli', 'core', 'agents', 'docs', 'test', 'deps', 'release', 'infra'],
    ],
    'scope-empty': [2, 'never'],
  },
};
