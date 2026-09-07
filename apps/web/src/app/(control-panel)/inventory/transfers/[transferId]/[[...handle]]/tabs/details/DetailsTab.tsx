import Typography from '@mui/material/Typography';

/**
 * The order details tab.
 */
function DetailsTab({ transfer }) {
	return (
		<div className="w-full max-w-5xl space-y-12">
			<div className="space-y-4">
				{/* <div className="flex items-center border-b-1 space-x-2 pb-2">
					<FuseSvgIcon
						color="action"
						size={24}
					>
						heroicons-outline:user-circle
					</FuseSvgIcon>
					<Typography
						className="text-2xl"
						color="text.secondary"
					>
						Customer
					</Typography>
				</div> */}

				<div className="space-y-4">
					<div className="table-responsive border rounded-md">
						<table className="table dense simple">
							<thead>
								<tr>
									<th>
										<Typography className="font-semibold">From</Typography>
									</th>
									<th>
										<Typography className="font-semibold">To</Typography>
									</th>
									<th>
										<Typography className="font-semibold">Items</Typography>
									</th>
									<th>
										<Typography className="font-semibold">Date</Typography>
									</th>
									<th>
										<Typography className="font-semibold">Rep</Typography>
									</th>
								</tr>
							</thead>
							<tbody>
								<tr>
									<td>
										<div className="flex items-center">
											{/* <Avatar src={'order.customer.avatar'} /> */}
											<Typography className="truncate mx-2">
												{transfer.source}
											</Typography>
										</div>
									</td>
									<td>
										<Typography className="truncate">{transfer.destination}</Typography>
									</td>
									<td>
										<Typography className="truncate">{transfer.number_of_items}</Typography>
									</td>
									<td>
										<span className="truncate">{transfer.created_at}</span>
									</td>
									<td>
										<span className="truncate">{transfer.first_name} {transfer.last_name}</span>
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	);
}

export default DetailsTab;
