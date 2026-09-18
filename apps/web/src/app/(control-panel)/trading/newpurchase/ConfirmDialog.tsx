'use client';

import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';

function formatGhs(n: number) {
	return `₵ ${Number(n || 0)
		.toFixed(2)
		.replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
}

export type PurchaseSummaryItem = {
	id?: string | number;
	name?: string;
	order_quantity?: number;
	unit_price?: number;
};

export type PurchaseSummary = {
	supplier?: string | null;
	warehouse?: string | null;
	invoice?: string | null;
	items?: PurchaseSummaryItem[];
	subtotal?: number;
	discount?: number;
	totalItems?: number;
	note?: string | null;
	total?: number;
	paymentStatus?: string | null;
	paymentMethod?: string | null;
	amountPaid?: number;
	paymentReference?: string | null;
	dueDate?: string | null;
};

type ConfirmDialogProps = {
	open: boolean;
	title?: string;
	message?: string;
	handleClose: (confirmed: boolean) => void;
	leftText?: string;
	rightText?: string;
	summary?: PurchaseSummary | null;
};

export default function ConfirmDialog({
	open,
	title = 'Confirm Purchase',
	message,
	handleClose,
	leftText = 'Cancel',
	rightText = 'Confirm & save',
	summary
}: ConfirmDialogProps) {
	const items = Array.isArray(summary?.items) ? summary.items : [];

	return (
		<Dialog
			open={open}
			onClose={() => handleClose(false)}
			aria-labelledby="confirm-purchase-title"
			maxWidth="sm"
			fullWidth
		>
			<DialogTitle id="confirm-purchase-title">{title}</DialogTitle>
			<DialogContent className="flex flex-col gap-3 pt-1">
				{message ? (
					<Typography
						variant="body2"
						color="text.secondary"
					>
						{message}
					</Typography>
				) : null}

				{summary ? (
					<>
						<div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border border-divider p-3">
							<div>
								<Typography
									variant="caption"
									color="text.secondary"
								>
									Supplier
								</Typography>
								<Typography variant="body2">{summary.supplier || '—'}</Typography>
							</div>
							<div>
								<Typography
									variant="caption"
									color="text.secondary"
								>
									Warehouse
								</Typography>
								<Typography variant="body2">{summary.warehouse || '—'}</Typography>
							</div>
							<div>
								<Typography
									variant="caption"
									color="text.secondary"
								>
									Invoice #
								</Typography>
								<Typography variant="body2">{summary.invoice || '—'}</Typography>
							</div>
							<div>
								<Typography
									variant="caption"
									color="text.secondary"
								>
									Total items
								</Typography>
								<Typography variant="body2">{summary.totalItems ?? 0}</Typography>
							</div>
						</div>

						<div className="rounded-md border border-divider overflow-hidden">
							<div className="px-3 py-2 bg-gray-50 dark:bg-transparent border-b border-divider">
								<Typography
									variant="subtitle2"
									className="font-semibold"
								>
									Items ({items.length})
								</Typography>
							</div>
							<div className="max-h-56 overflow-y-auto divide-y divide-divider">
								{items.length === 0 ? (
									<div className="px-3 py-4">
										<Typography
											variant="body2"
											color="text.secondary"
										>
											No items
										</Typography>
									</div>
								) : (
									items.map((item, index) => {
										const qty = Number(item.order_quantity) || 0;
										const price = Number(item.unit_price) || 0;
										return (
											<div
												key={String(item.id ?? index)}
												className="flex items-start justify-between gap-3 px-3 py-2"
											>
												<div className="min-w-0 flex-1">
													<Typography
														variant="body2"
														className="line-clamp-2"
													>
														{item.name || 'Untitled product'}
													</Typography>
													<Typography
														variant="caption"
														color="text.secondary"
													>
														{qty} × {formatGhs(price)}
													</Typography>
												</div>
												<Typography
													variant="body2"
													className="shrink-0 font-medium"
												>
													{formatGhs(qty * price)}
												</Typography>
											</div>
										);
									})
								)}
							</div>
						</div>

						<div className="rounded-md border border-divider p-3 space-y-1.5">
							<div className="flex justify-between">
								<Typography
									variant="body2"
									color="text.secondary"
								>
									Subtotal
								</Typography>
								<Typography variant="body2">{formatGhs(summary.subtotal ?? 0)}</Typography>
							</div>
							<div className="flex justify-between">
								<Typography
									variant="body2"
									color="text.secondary"
								>
									Discount
								</Typography>
								<Typography variant="body2">{formatGhs(summary.discount ?? 0)}</Typography>
							</div>
							{summary.note ? (
								<div className="pt-1">
									<Typography
										variant="caption"
										color="text.secondary"
									>
										Note
									</Typography>
									<Typography
										variant="body2"
										className="whitespace-pre-wrap"
									>
										{summary.note}
									</Typography>
								</div>
							) : null}
							<Divider className="!my-2" />
							<div className="flex justify-between items-center">
								<Typography
									variant="subtitle1"
									className="font-semibold"
								>
									Total
								</Typography>
								<Typography
									variant="subtitle1"
									className="font-semibold"
								>
									{formatGhs(summary.total ?? 0)}
								</Typography>
							</div>
						</div>

						<div className="rounded-md border border-divider p-3 space-y-1.5">
							<Typography
								variant="subtitle2"
								className="font-semibold mb-1"
							>
								Payment
							</Typography>
							<div className="flex justify-between">
								<Typography
									variant="body2"
									color="text.secondary"
								>
									Status
								</Typography>
								<Typography variant="body2">{summary.paymentStatus || 'Unpaid'}</Typography>
							</div>
							{summary.paymentMethod ? (
								<div className="flex justify-between">
									<Typography
										variant="body2"
										color="text.secondary"
									>
										Method
									</Typography>
									<Typography variant="body2">{summary.paymentMethod}</Typography>
								</div>
							) : null}
							{(summary.paymentStatus === 'Paid' || summary.paymentStatus === 'Partial') && (
								<div className="flex justify-between">
									<Typography
										variant="body2"
										color="text.secondary"
									>
										Amount paid
									</Typography>
									<Typography variant="body2">{formatGhs(summary.amountPaid ?? 0)}</Typography>
								</div>
							)}
							{summary.paymentReference ? (
								<div className="flex justify-between gap-3">
									<Typography
										variant="body2"
										color="text.secondary"
										className="shrink-0"
									>
										Reference
									</Typography>
									<Typography
										variant="body2"
										className="text-right break-all"
									>
										{summary.paymentReference}
									</Typography>
								</div>
							) : null}
							{summary.dueDate ? (
								<div className="flex justify-between">
									<Typography
										variant="body2"
										color="text.secondary"
									>
										Due date
									</Typography>
									<Typography variant="body2">{summary.dueDate}</Typography>
								</div>
							) : null}
						</div>
					</>
				) : null}
			</DialogContent>
			<DialogActions className="px-4 pb-3">
				<Button onClick={() => handleClose(false)}>{leftText}</Button>
				<Button
					variant="contained"
					color="secondary"
					onClick={() => handleClose(true)}
					autoFocus
				>
					{rightText}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
