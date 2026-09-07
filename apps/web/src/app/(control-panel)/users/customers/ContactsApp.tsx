'use client';

import FusePageSimple from '@fuse/core/FusePageSimple';
import { useEffect, useRef, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { styled } from '@mui/material/styles';
import useThemeMediaQuery from '@fuse/hooks/useThemeMediaQuery';
import useNavigate from '@fuse/hooks/useNavigate';
import ContactsHeader from './ContactsHeader';
import ContactsList from './contact-list/ContactsList';
import { useGetContactsListQuery, useGetContactsCountriesQuery, useGetContactsTagsQuery } from './ContactsApi';
import ContactsSidebarContent from './ContactsSidebarContent';

const Root = styled(FusePageSimple)(({ theme }) => ({
	'& .container': {
		maxWidth: '100%!important'
	},
	'& .FusePageSimple-header': {
		backgroundColor: theme.palette.background.paper,
		boxShadow: `inset 0 -1px 0 0px ${theme.palette.divider}`
	}
}));

type ContactsAppProps = {
	children?: React.ReactNode;
};

/** Routes that render as full-page content instead of in the sidebar */
const FULL_PAGE_SUBROUTES = ['/transactions', '/payments'];

function isFullPageSubRoute(pathname: string | null): boolean {
	if (!pathname) return false;
	return FULL_PAGE_SUBROUTES.some((segment) => pathname.includes(segment));
}

/**
 * The ContactsApp page.
 */
function ContactsApp(props: ContactsAppProps) {
	const { children } = props;
	const navigate = useNavigate();
	const routeParams = useParams();
	const pathname = usePathname();

	const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
	const pageLayout = useRef(null);
	const isMobile = useThemeMediaQuery((theme) => theme.breakpoints.down('lg'));
	useGetContactsListQuery();
	useGetContactsCountriesQuery();
	useGetContactsTagsQuery();

	const isFullPage = isFullPageSubRoute(pathname);

	useEffect(() => {
		if (isFullPage) {
			setRightSidebarOpen(false);
		} else {
			setRightSidebarOpen(!!routeParams.contactId);
		}
	}, [routeParams.contactId, isFullPage]);

	const isIndexRoute = !routeParams.contactId;
	const useCustomPage = isIndexRoute && children != null;
	const useFullPageContent = !!routeParams.contactId && isFullPage && children != null;

	return (
		<Root
			header={useCustomPage ? null : useFullPageContent ? null : <ContactsHeader />}
			content={
				useCustomPage ? children : useFullPageContent ? children : <ContactsList />
			}
			ref={pageLayout}
			rightSidebarContent={<ContactsSidebarContent>{children}</ContactsSidebarContent>}
			rightSidebarOpen={rightSidebarOpen}
			rightSidebarOnClose={() => navigate('/users/customers')}
			rightSidebarWidth={540}
			rightSidebarVariant="temporary"
			scroll={isMobile ? 'normal' : 'content'}
		/>
	);
}

export default ContactsApp;
