'use client';

import GlobalStyles from '@mui/material/GlobalStyles';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import NewReturnHeader from './NewReturnHeader';

const SUPPLIER_OPTIONS = [
	'Tech Supplies Inc',
	'Office Depot',
	'Global Wholesale',
	'Tech Distributors',
	'Office Supplies Co',
	'Electronics Direct'
];

export default function NewReturn() {
	const router = useRouter();
	const [reference, setReference] = useState('');
	const [originalPurchaseRef, setOriginalPurchaseRef] = useState('');
	const [supplier, setSupplier] = useState<string | null>(null);
	const [reason, setReason] = useState('');
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setSubmitting(true);
		setTimeout(() => {
			setSubmitting(false);
			router.push('/trading/purchases/returns');
		}, 500);
	};

	return (
		<>
			<GlobalStyles styles={() => ({ '#root': { maxHeight: '100vh' } })} />
			<div className="w-full h-full flex flex-col px-4">
				<NewReturnHeader />
				<div className="w-full flex justify-center">
					<Paper className="p-6 shadow-sm rounded-xl max-w-xl w-full">
					<Typography variant="subtitle2" color="text.secondary" className="mb-4 font-medium">
						Return details
					</Typography>
					<form onSubmit={handleSubmit} className="flex flex-col gap-4">
						<TextField
							label="Original purchase reference"
							value={originalPurchaseRef}
							onChange={(e) => setOriginalPurchaseRef(e.target.value)}
							fullWidth
							variant="outlined"
							placeholder="e.g. PO-1882"
						/>
						<Autocomplete
							options={SUPPLIER_OPTIONS}
							value={supplier}
							onChange={(_, value) => setSupplier(value)}
							getOptionLabel={(option) => option}
							renderInput={(params) => (
								<TextField
									{...params}
									label="Supplier"
									variant="outlined"
									placeholder="Search or select supplier"
								/>
							)}
							freeSolo
							fullWidth
						/>
						<TextField
							label="Return reference (optional)"
							value={reference}
							onChange={(e) => setReference(e.target.value)}
							fullWidth
							variant="outlined"
							placeholder="Auto-generated if empty"
						/>
						<TextField
							label="Reason"
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							fullWidth
							variant="outlined"
							multiline
							rows={2}
						/>
						<div className="flex gap-2 justify-end pt-2">
							<Button type="button" variant="outlined" onClick={() => router.push('/trading/purchases/returns')}>
								Cancel
							</Button>
							<Button type="submit" variant="contained" color="primary" disabled={submitting}>
								{submitting ? 'Creating…' : 'Create return'}
							</Button>
						</div>
					</form>
				</Paper>
				</div>
			</div>
		</>
	);
}
