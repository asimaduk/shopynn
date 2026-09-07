'use client';

import { useEffect } from 'react';
import GlobalStyles from '@mui/material/GlobalStyles';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Input from '@mui/material/Input';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import Divider from '@mui/material/Divider';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import NavLinkAdapter from '@fuse/core/NavLinkAdapter';
import FuseLoading from '@fuse/core/FuseLoading';
import { useAppDispatch, useAppSelector } from 'src/store/hooks';
import { ChangeEvent } from 'react';
import {
	Contact,
	GroupedContacts,
	selectFilteredContactList,
	selectGroupedFilteredContacts,
	useGetContactsListQuery
} from './ContactsApi';
import { setSearchText, resetSearchText, selectSearchText } from './contactsAppSlice';
import ContactListItem from './contact-list/ContactListItem';

export default function CustomersPage() {
	const dispatch = useAppDispatch();
	const searchText = useAppSelector(selectSearchText);
	const { data, isLoading } = useGetContactsListQuery();
	const filteredData = useAppSelector(selectFilteredContactList(data));
	const groupedContacts = useAppSelector(selectGroupedFilteredContacts(filteredData));

	useEffect(() => {
		return () => {
			dispatch(resetSearchText());
		};
	}, [dispatch]);

	if (isLoading) {
		return <FuseLoading />;
	}

	const count = filteredData?.length ?? 0;

	return (
		<>
			<GlobalStyles styles={() => ({ '#root': { maxHeight: '100vh' } })} />
			<div className="w-full min-h-full flex flex-col px-4 py-6">
				{/* Header */}
				<Box className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
					<Box className="flex items-center gap-3">
						<Box
							className="flex items-center justify-center rounded-xl shrink-0"
							sx={{
								width: 48,
								height: 48,
								bgcolor: 'primary.main',
								color: 'primary.contrastText'
							}}
						>
							<FuseSvgIcon size={26}>heroicons-outline:users</FuseSvgIcon>
						</Box>
						<div>
							<Typography variant="h5" fontWeight="bold">
								Customers
							</Typography>
							<Typography variant="body2" color="text.secondary">
								{count} {count === 1 ? 'customer' : 'customers'}
							</Typography>
						</div>
					</Box>
					<Box className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
						<Paper
							variant="outlined"
							className="flex flex-1 sm:min-w-[200px] md:min-w-[260px] rounded-xl overflow-hidden"
							sx={{ borderColor: 'divider' }}
						>
							<Input
								placeholder="Search customers"
								disableUnderline
								fullWidth
								value={searchText}
								onChange={(ev: ChangeEvent<HTMLInputElement>) => dispatch(setSearchText(ev))}
								inputProps={{ 'aria-label': 'Search customers' }}
								startAdornment={
									<InputAdornment position="start" sx={{ pl: 1.5 }}>
										<FuseSvgIcon size={20} color="action">heroicons-outline:magnifying-glass</FuseSvgIcon>
									</InputAdornment>
								}
								sx={{ py: 1.25, px: 0 }}
							/>
						</Paper>
						<Button
							component={NavLinkAdapter}
							to="/users/customers/new"
							variant="contained"
							color="primary"
							size="medium"
							startIcon={<FuseSvgIcon size={20}>heroicons-outline:plus</FuseSvgIcon>}
						>
							Add customer
						</Button>
					</Box>
				</Box>

				{/* List */}
				<Paper
					variant="outlined"
					className="flex flex-col flex-1 min-h-0 rounded-xl overflow-hidden"
					sx={{ borderColor: 'divider' }}
				>
					{count === 0 ? (
						<Box className="flex flex-1 items-center justify-center py-16">
							<Box className="text-center">
								<FuseSvgIcon
									size={64}
									color="action"
									sx={{ opacity: 0.4, display: 'block', mx: 'auto', mb: 2 }}
								>
									heroicons-outline:users
								</FuseSvgIcon>
								<Typography color="text.secondary" variant="h6">
									No customers found
								</Typography>
								<Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
									{searchText ? 'Try a different search.' : 'Add your first customer to get started.'}
								</Typography>
								{!searchText && (
									<Button
										component={NavLinkAdapter}
										to="/users/customers/new"
										variant="outlined"
										size="small"
										sx={{ mt: 2 }}
									>
										Add customer
									</Button>
								)}
							</Box>
						</Box>
					) : (
						<Box className="flex-1 overflow-auto">
							{Object.entries(groupedContacts).map(([key, group]: [string, GroupedContacts]) => (
								<Box key={key}>
									<Typography
										variant="subtitle2"
										color="text.secondary"
										fontWeight="600"
										sx={{ px: 3, py: 1.5, bgcolor: 'action.hover' }}
									>
										{key}
									</Typography>
									<List disablePadding>
										{group?.children?.map((item: Contact) => (
											<ContactListItem key={item.id} contact={item} />
										))}
									</List>
									<Divider />
								</Box>
							))}
						</Box>
					)}
				</Paper>
			</div>
		</>
	);
}
