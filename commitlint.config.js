export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'docs', 'chore', 'test', 'perf', 'ci', 'style', 'revert'],
    ],
    'scope-enum': [
      1,
      'always',
      ['auth', 'connections', 'scheduler', 'analytics', 'ai', 'alerts', 'whatsapp', 'billing', 'ui', 'db', 'infra', 'repo', 'docs'],
    ],
  },
}
