import Typography from '@mui/material/Typography';

/**
 * The products tab.
 */
function ProductsTab({ transfer }) {
	return (
		<div className="w-full max-w-5xl table-responsive border rounded-md">
			<table className="simple dense">
				<thead>
					<tr>
						<th>
							<Typography className="font-semibold">Name</Typography>
						</th>
						<th>
							<Typography className="font-semibold">Sent</Typography>
						</th>
						<th>
							<Typography className="font-semibold">Received</Typography>
						</th>
					</tr>
				</thead>
				<tbody>
					{transfer?.products?.map((product) => (
						<tr key={product.detail_id || product.product_id || product.name}>
							<td>
								<Typography
									className="truncate"
									style={{
										color: 'inherit'
									}}
								>
									{product.name}
								</Typography>
							</td>
							<td>
								<span className="truncate">{product.quantity}</span>
							</td>
							<td>
								<span className="truncate">
									{product.quantity_received != null ? product.quantity_received : '—'}
								</span>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export default ProductsTab;
