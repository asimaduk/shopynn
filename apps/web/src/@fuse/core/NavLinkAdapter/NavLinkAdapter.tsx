import Link from '@fuse/core/Link';
import { CSSProperties, ReactNode } from 'react';
import usePathname from '@fuse/hooks/usePathname';
import useNavigate from '@fuse/hooks/useNavigate';
import clsx from 'clsx';

export type NavLinkAdapterPropsType = {
	activeClassName?: string;
	activeStyle?: CSSProperties;
	children?: ReactNode;
	to?: string;
	href?: string;
	className?: string;
	style?: CSSProperties;
	role?: string;
	exact?: boolean;
	/** Alias for exact (React Router NavLink `end`). */
	end?: boolean;
	ref?: React.RefObject<HTMLAnchorElement>;
};

/**
 * The NavLinkAdapter component is a wrapper around the Next.js Link component.
 * It adds the ability to navigate programmatically using the useRouter hook.
 * The component is memoized to prevent unnecessary re-renders.
 */
function NavLinkAdapter(props: NavLinkAdapterPropsType) {
	const {
		children,
		activeClassName = 'active',
		activeStyle,
		role = 'button',
		to,
		href,
		exact,
		end,
		ref,
		..._props
	} = props;

	const navigate = useNavigate();
	const pathname = usePathname();

	const targetUrl = to || href;

	const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
		e.preventDefault();
		navigate(targetUrl);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLAnchorElement>) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			navigate(targetUrl);
		}
	};

	const matchExact = Boolean(exact || end);
	const isActive = (() => {
		if (!targetUrl) return false;
		if (matchExact) {
			return pathname === targetUrl || pathname === `${targetUrl}/`;
		}
		if (pathname === targetUrl || pathname === `${targetUrl}/`) return true;
		// Require a path boundary so `/tenants-directory` does not leave siblings half-matched oddly,
		// and `/foo` does not match `/foobar`.
		const prefix = targetUrl.endsWith('/') ? targetUrl : `${targetUrl}/`;
		return pathname.startsWith(prefix);
	})();

	return (
		<Link
			ref={ref}
			to={targetUrl}
			role={role}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			className={clsx(
				_props.className,
				isActive ? activeClassName : '',
				pathname === targetUrl && 'pointer-events-none'
			)}
			style={isActive ? { ..._props.style, ...activeStyle } : _props.style}
		>
			{children}
		</Link>
	);
}

export default NavLinkAdapter;
