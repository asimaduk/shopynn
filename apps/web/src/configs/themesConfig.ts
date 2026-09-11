import { FuseThemesType } from '@fuse/core/FuseSettings/FuseSettingsTypes';

/**
 * The lightPaletteText object defines the text color palette for the light theme.
 */
export const lightPaletteText = {
	primary: 'rgb(17, 24, 39)',
	secondary: 'rgb(107, 114, 128)',
	disabled: 'rgb(149, 156, 169)'
};

/**
 * The darkPaletteText object defines the text color palette for the dark theme.
 */
export const darkPaletteText = {
	primary: 'rgb(255,255,255)',
	secondary: 'rgb(148, 163, 184)',
	disabled: 'rgb(156, 163, 175)'
};

/**
 * Active Shopynn color themes (light / dark). Extra Fuse gallery presets removed.
 */
export const themesConfig: FuseThemesType = {
	default: {
		palette: {
			mode: 'light',
			divider: 'rgba(214,214,214,0.7)',
			text: {
				primary: '#212121',
				secondary: '#5F6368'
			},
			common: {
				black: '#000000',
				white: '#FFFFFF'
			},
			primary: {
				light: '#536D89',
				main: '#0A74DA',
				dark: '#00418A',
				contrastText: '#FFFFFF'
			},
			secondary: {
				light: '#6BC9F7',
				main: '#00A4EF',
				dark: '#0078D7',
				contrastText: '#FFFFFF'
			},
			background: {
				paper: '#F4F4F4',
				default: '#E8E8E8'
			},
			error: {
				light: '#FFCDD2',
				main: '#D32F2F',
				dark: '#B71C1C',
				contrastText: '#FFFFFF'
			}
		}
	},
	defaultDark: {
		palette: {
			mode: 'dark',
			divider: 'rgba(79,79,79,0.5)',
			text: {
				primary: '#E0E0E0',
				secondary: '#B0BEC5'
			},
			common: {
				black: '#000000',
				white: '#FFFFFF'
			},
			primary: {
				light: '#536D89',
				main: '#0A74DA',
				dark: '#00418A',
				contrastText: '#FFFFFF'
			},
			secondary: {
				light: '#6BC9F7',
				main: '#00A4EF',
				dark: '#0078D7',
				contrastText: '#FFFFFF'
			},
			background: {
				paper: '#1E1E1E',
				default: '#121212'
			},
			error: {
				light: '#FFCDD2',
				main: '#D32F2F',
				dark: '#B71C1C',
				contrastText: '#FFFFFF'
			}
		}
	}
};

export default themesConfig;
