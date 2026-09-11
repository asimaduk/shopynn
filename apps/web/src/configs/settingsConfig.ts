import themesConfig from 'src/configs/themesConfig';
import { FuseSettingsConfigType } from '@fuse/core/FuseSettings/FuseSettingsTypes';

import i18n from '@i18n/i18n';

/**
 * The settingsConfig object is a configuration object for the Fuse application's settings.
 */
const settingsConfig: FuseSettingsConfigType = {
	/**
	 * The layout object defines the layout style and configuration for the application.
	 */
	layout: {
		/**
		 * The style property defines the layout style for the application.
		 */
		style: 'layout1', // layout1 layout2 layout3
		/**
		 * The config property defines the layout configuration for the application.
		 * Check out default layout configs at src/components/theme-layouts for example src/components/theme-layouts/layout1/Layout1Config.js
		 */
		config: {
			navbar: {
				style: 'style-2'
			}
		} // checkout default layout configs at src/components/theme-layouts for example  src/components/theme-layouts/layout1/Layout1Config.js
	},

	/**
	 * The customScrollbars property defines whether or not to use custom scrollbars in the application.
	 */
	customScrollbars: true,

	/**
	 * The direction property defines the text direction for the application.
	 */
	direction: i18n.dir(i18n.options.lng) || 'ltr', // rtl, ltr
	/**
	 * The theme object defines the color theme for the application.
	 */
	theme: {
		main: themesConfig.default,
		navbar: themesConfig.defaultDark,
		toolbar: themesConfig.default,
		footer: themesConfig.defaultDark
	},

	/**
	 * The defaultAuth property defines the default authorization roles for the application.
	 * To make the whole app auth protected by default set defaultAuth:['admin','staff','user']
	 * To make the whole app accessible without authorization by default set defaultAuth: null
	 * The individual route configs which have auth option won't be overridden.
	 */
	// defaultAuth: ['admin'],
	defaultAuth: ['staff'],

	/**
	 * The loginRedirectUrl property defines the default redirect URL for the logged-in user.
	 */
	loginRedirectUrl: '/'
};

export default settingsConfig;

/** API origin used for `/images?id=…` (and similar). Prefer Railway; never bake S3 keys into the client. */
function resolveImageApiBase(): string {
	const raw =
		process.env.NEXT_PUBLIC_API_BASE_URL ||
		process.env.API_BASE_URL ||
		(process.env.NODE_ENV === 'development'
			? `http://127.0.0.1:${process.env.NEXT_PUBLIC_PORT || 4001}`
			: 'https://shopynn-production.up.railway.app');
	const origin = String(raw).replace(/\/$/, '');
	return origin.endsWith('/api') ? origin : `${origin}/api`;
}

export const URLS = {
	serverUrl: resolveImageApiBase()
};
