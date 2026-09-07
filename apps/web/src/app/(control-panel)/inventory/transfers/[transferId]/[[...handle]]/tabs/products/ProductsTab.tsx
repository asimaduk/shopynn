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
						{/* <th>
							<Typography className="font-semibold">Image</Typography>
						</th> */}
						<th>
							<Typography className="font-semibold">Name</Typography>
						</th>
						{/* <th>
							<Typography className="font-semibold">Price</Typography>
						</th> */}
						<th>
							<Typography className="font-semibold">Quantity</Typography>
						</th>
					</tr>
				</thead>
				<tbody>
					{transfer?.products?.map((product) => (
						<tr key={product.name}>
							<td>
								<Typography
									// component={Link}
									// to={`/inventory/products/${product.id}`}
									className="truncate"
									style={{
										color: 'inherit',
										// textDecoration: 'underline'
									}}
								>
									{product.name}
								</Typography>
							</td>
							{/* <td className="w-16 text-right">
								<span className="truncate">GHS {product.unit_price}</span>
							</td> */}
							<td className="w-16 text-right">
								<span className="truncate">{product.quantity}</span>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export default ProductsTab;
