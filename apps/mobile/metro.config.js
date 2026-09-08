const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

// Keep a single React instance — duplicate copies break hooks ("useEffect of null").
const mobileNodeModules = path.resolve(projectRoot, 'node_modules');
const reactNativeNodeModules = path.resolve(workspaceRoot, 'node_modules/react-native/node_modules');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(projectRoot);

const config = {
	watchFolders: [workspaceRoot],
	resolver: {
		assetExts: [...defaultConfig.resolver.assetExts, 'bin'],
		nodeModulesPaths: [
			mobileNodeModules,
			path.resolve(workspaceRoot, 'node_modules'),
		],
		extraNodeModules: {
			react: path.resolve(mobileNodeModules, 'react'),
			scheduler: path.resolve(reactNativeNodeModules, 'scheduler'),
		},
		resolveRequest: (context, moduleName, platform) => {
			if (
				moduleName === 'react' ||
				moduleName === 'react/jsx-runtime' ||
				moduleName === 'react/jsx-dev-runtime'
			) {
				return {
					filePath: require.resolve(moduleName, { paths: [mobileNodeModules] }),
					type: 'sourceFile',
				};
			}
			if (moduleName === 'scheduler') {
				return {
					filePath: require.resolve('scheduler', { paths: [reactNativeNodeModules] }),
					type: 'sourceFile',
				};
			}
			return context.resolveRequest(context, moduleName, platform);
		},
	},
};

module.exports = mergeConfig(defaultConfig, config);
