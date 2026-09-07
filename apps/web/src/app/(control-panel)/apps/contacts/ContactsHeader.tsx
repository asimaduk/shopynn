import Input from '@mui/material/Input';
import Typography from '@mui/material/Typography';
import { motion } from 'motion/react';
import Button from '@mui/material/Button';
import NavLinkAdapter from '@fuse/core/NavLinkAdapter';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import Box from '@mui/material/Box';
import { useAppDispatch, useAppSelector } from 'src/store/hooks';
import { ChangeEvent, useEffect } from 'react';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import { setSearchText, resetSearchText, selectSearchText } from './contactsAppSlice';
import { selectFilteredContactList, useGetContactsListQuery } from './ContactsApi';

/**
 * The contacts header.
 */
function ContactsHeader() {
	const dispatch = useAppDispatch();
	const searchText = useAppSelector(selectSearchText);
	const { data, isLoading } = useGetContactsListQuery();

	const filteredData = useAppSelector(selectFilteredContactList(data));

	useEffect(() => {
		return () => {
			dispatch(resetSearchText());
		};
	}, [dispatch]);

	if (isLoading) {
		return null;
	}

	return (
		<div className="p-6 sm:p-8 w-full">
			<PageBreadcrumb className="mb-2" />

			<div className="flex flex-col space-y-1">
				<motion.span
					initial={{ x: -20 }}
					animate={{ x: 0, transition: { delay: 0.2 } }}
				>
					<Typography className="text-4xl font-extrabold leading-none tracking-tight">Contacts</Typography>
				</motion.span>
				<motion.span
					initial={{ y: -20, opacity: 0 }}
					animate={{ y: 0, opacity: 1, transition: { delay: 0.2 } }}
				>
					<Typography
						component={motion.span}
						className="text-base font-medium ml-0.5"
						color="text.secondary"
					>
						{`${filteredData?.length} contacts`}
					</Typography>
				</motion.span>
			</div>
			<div className="flex flex-1 items-center mt-4 space-x-2">
				<Box
					component={motion.div}
					initial={{ y: -20, opacity: 0 }}
					animate={{ y: 0, opacity: 1, transition: { delay: 0.2 } }}
					className="flex flex-1 w-full sm:w-auto items-center px-3 border-1 rounded-lg h-9"
				>
					<FuseSvgIcon color="action">heroicons-outline:magnifying-glass</FuseSvgIcon>

					<Input
						placeholder="Search contacts"
						className="flex flex-1"
						disableUnderline
						fullWidth
						value={searchText}
						inputProps={{
							'aria-label': 'Search'
						}}
						onChange={(ev: ChangeEvent<HTMLInputElement>) => dispatch(setSearchText(ev))}
					/>
				</Box>
				<Button
					className=""
					variant="contained"
					color="secondary"
					component={NavLinkAdapter}
					to="/apps/contacts/new"
				>
					<FuseSvgIcon size={20}>heroicons-outline:plus</FuseSvgIcon>
					<span className="hidden sm:flex mx-2">Add</span>
				</Button>
			</div>
		</div>
	);
}

export default ContactsHeader;
