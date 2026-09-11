import themesConfig from 'src/configs/themesConfig';

const themeOptions = [
	{
		id: 'Default',
		section: {
			main: themesConfig.default,
			navbar: themesConfig.defaultDark,
			toolbar: themesConfig.default,
			footer: themesConfig.defaultDark
		}
	},
	{
		id: 'Default Dark',
		section: {
			main: themesConfig.defaultDark,
			navbar: themesConfig.defaultDark,
			toolbar: themesConfig.defaultDark,
			footer: themesConfig.defaultDark
		}
	}
];

export default themeOptions;
