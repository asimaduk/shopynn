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
import { TOUR_CATALOG } from './tourDefinitions';
import type { TourId } from './tourIds';
import type { TourPreferences } from './tourPreferences';

type Props = {
	open: boolean;
	onClose: () => void;
	tourPrefs: TourPreferences;
	onStart: (tourId: TourId) => void;
};

export default function TourCatalogDialog({ open, onClose, tourPrefs, onStart }: Props) {
	return (
		<Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
			<DialogTitle>Take a tour</DialogTitle>
			<DialogContent dividers>
				<Typography variant="body2" color="text.secondary" className="mb-4">
					Short walkthroughs of the main areas. Start with the overview if you are new.
				</Typography>
				<List disablePadding>
					{TOUR_CATALOG.map((tour) => {
						const doneAt = tourPrefs.completed?.[tour.id];
						const overviewDone =
							tour.id === 'overview' &&
							(tourPrefs.overviewStatus === 'completed' || tourPrefs.overviewStatus === 'skipped');
						const done = Boolean(doneAt) || overviewDone;
						return (
							<ListItem
								key={tour.id}
								disableGutters
								secondaryAction={
									<Button
										variant="contained"
										size="small"
										onClick={() => {
											onClose();
											onStart(tour.id);
										}}
									>
										{done ? 'Replay' : 'Start'}
									</Button>
								}
								sx={{ py: 1.5, pr: 14 }}
							>
								<ListItemText
									primary={tour.title}
									secondary={
										done
											? `${tour.description} · Done`
											: tour.description
									}
								/>
							</ListItem>
						);
					})}
				</List>
			</DialogContent>
			<DialogActions>
				<Button onClick={onClose}>Close</Button>
			</DialogActions>
		</Dialog>
	);
}
