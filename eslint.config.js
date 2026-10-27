const globals = require('globals');
module.exports = [
  { files: ['src/**/*.js','test/**/*.js'], languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: { ...globals.node, ...globals.jest } }, rules: { 'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] } }
];
