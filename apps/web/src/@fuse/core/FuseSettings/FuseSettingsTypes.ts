import { Palette } from '@mui/material/styles/createPalette';
import { PartialDeep } from 'type-fest';
import { themeLayoutDefaultsProps } from 'src/components/theme-layouts/themeLayoutConfigs';

export type FuseThemeType = { palette: PartialDeep<Palette> };
export type FuseThemesType = Record<string, FuseThemeType>;
export type FuseSettingsConfigType = {
	layout: { style?: string; config?: PartialDeep<themeLayoutDefaultsProps> };
	customScrollbars?: boolean;
	direction: 'rtl' | 'ltr';
	theme: { main: FuseThemeType; navbar: FuseThemeType; toolbar: FuseThemeType; footer: FuseThemeType };
	defaultAuth?: string[];
	loginRedirectUrl: string;
};
