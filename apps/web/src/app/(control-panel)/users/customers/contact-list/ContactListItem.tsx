import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import NavLinkAdapter from '@fuse/core/NavLinkAdapter';
import ListItemButton from '@mui/material/ListItemButton';
import { Contact } from '../ContactsApi';

type ContactListItemPropsType = {
	contact: Contact;
};

/**
 * The contact list item.
 */
function ContactListItem(props: ContactListItemPropsType) {
	const { contact } = props;

	return (
		<>
			<ListItemButton
				className="px-8 py-4"
				sx={{ bgcolor: 'background.paper' }}
				component={NavLinkAdapter}
				to={`/users/customers/${contact.id}`}
				// to={`/apps/contacts/${contact.id}`}
			>
				<ListItemAvatar>
					<Avatar
						alt={contact.name}
						src={contact.avatar}
					/>
				</ListItemAvatar>
				<ListItemText
					classes={{ root: 'm-0', primary: 'font-medium leading-5 truncate' }}
					primary={
						<span className="flex items-center gap-2 min-w-0">
							<span className="truncate">{contact.name}</span>
							{contact.source === 'account' ? (
								<Chip label="App account" size="small" variant="outlined" color="primary" className="shrink-0 h-6" />
							) : contact.source === 'pos' ? (
								<Chip label="POS / admin" size="small" variant="outlined" className="shrink-0 h-6" />
							) : null}
						</span>
					}
					secondary={
						<Typography
							className="inline"
							component="span"
							variant="body2"
							color="text.secondary"
						>
							{contact.phone} | {contact.address || contact.email || '—'}
						</Typography>
					}
				/>
			</ListItemButton>
			<Divider />
		</>
	);
}

export default ContactListItem;
