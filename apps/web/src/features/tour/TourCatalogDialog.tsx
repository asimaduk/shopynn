'use client';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import type { TourDefinition } from './tourDefinitions';
import TourMapGraphic from './TourMapGraphic';
import type { TourId } from './tourIds';
import type { TourPreferences } from './tourPreferences';

type Props = {
	open: boolean;
	onClose: () => void;
	tourPrefs: TourPreferences;
	/** Permission-filtered catalog. */
	catalog: TourDefinition[];
	onStart: (tourId: TourId) => void;
	onExited?: () => void;
};

export default function TourCatalogDialog({
	open,
	onClose,
	tourPrefs,
	catalog,
	onStart,
	onExited
}: Props) {
	return (
		<Dialog
			open={open}
			onClose={onClose}
			fullWidth
			maxWidth="sm"
			TransitionProps={{ onExited }}
		>
			<DialogTitle sx={{ pb: 1 }}>Take a tour</DialogTitle>
			<DialogContent dividers>
				<TourMapGraphic className="mb-4" compact pinLabel="Pick a guide" />
				<Typography variant="body2" color="text.secondary" className="mb-4">
					Short walkthroughs of the main areas. Start with the overview if you are new.
				</Typography>
				{catalog.length === 0 ? (
					<Typography variant="body2" color="text.secondary">
						No tours are available for your account permissions.
					</Typography>
				) : (
					<List disablePadding>
						{catalog.map((tour) => {
							const doneAt = tourPrefs.completed?.[tour.id];
							const overviewDone =
								tour.id === 'overview' &&
								(tourPrefs.overviewStatus === 'completed' ||
									tourPrefs.overviewStatus === 'skipped');
							const done = Boolean(doneAt) || overviewDone;
							return (
								<ListItem
									key={tour.id}
									disableGutters
									secondaryAction={
										<Button
											variant="contained"
											size="small"
											onClick={() => onStart(tour.id)}
										>
											{done ? 'Replay' : 'Start'}
										</Button>
									}
									sx={{ py: 1.5, pr: 14 }}
								>
									<ListItemText
										primary={tour.title}
										secondary={done ? `${tour.description} · Done` : tour.description}
									/>
								</ListItem>
							);
						})}
					</List>
				)}
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose}>Close</Button>
			</DialogActions>
		</Dialog>
	);
}
