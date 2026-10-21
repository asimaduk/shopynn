module.exports = (api) => {
  const isProduction = api.env('production');
  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
      // Release bundles: drop console.log/info/debug (they can leak request data); keep warn/error.
      ...(isProduction ? [['transform-remove-console', { exclude: ['error', 'warn'] }]] : []),
      // Must stay last.
      'react-native-worklets/plugin',
    ],
  };
};
