const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);
defaultConfig.resolver.assetExts = [...defaultConfig.resolver.assetExts, 'bin'];

const config = {};

module.exports = mergeConfig(defaultConfig, config);
