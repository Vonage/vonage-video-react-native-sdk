module.exports = {
  ignores: ['node_modules/', 'e2e/E2ETestingApp/ios/Pods', 'lib/'],
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
};
