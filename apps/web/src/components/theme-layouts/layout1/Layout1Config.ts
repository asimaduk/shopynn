/**
 * The Layout1 Config object.
 */
const Layout1Config = {
	title: 'Layout 1 - Vertical',
	defaults: {
		mode: 'container',
		containerWidth: 1120,
		navbar: {
			display: true,
			style: 'style-1',
			folded: false,
			position: 'left',
			open: true
		},
		toolbar: {
			display: true,
			style: 'fixed'
		},
		footer: {
			display: true,
			style: 'fixed'
		},
		leftSidePanel: {
			display: true
		},
		rightSidePanel: {
			display: true
		}
	}
};

export type Layout1ConfigDefaultsType = (typeof Layout1Config)['defaults'];

export default Layout1Config;
