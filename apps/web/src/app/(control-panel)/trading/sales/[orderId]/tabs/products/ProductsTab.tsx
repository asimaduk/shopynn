import Typography from '@mui/material/Typography';

import { useParams } from 'next/navigation';
import { useGetSaleQuery } from '../../../../TradingApi';
import { URLS } from '@/configs/settingsConfig';
import { formatGhsCurrency } from '../../../../../dashboards/analytics/daily-sales/formatGhsCurrency';

/**
 * The products tab.
 */
function ProductsTab() {
	const routeParams = useParams<{ orderId: string }>();

	const { orderId } = routeParams;

	const { data: order } = useGetSaleQuery(orderId, {
		skip: !orderId
	});

	return (
		<div className="w-full max-w-5xl table-responsive border rounded-md">
			<table className="simple dense">
				<thead>
					<tr>
						<th>
							<Typography className="font-semibold">SKU</Typography>
						</th>
						<th>
							<Typography className="font-semibold">Image</Typography>
						</th>
						<th>
							<Typography className="font-semibold">Name</Typography>
						</th>
						<th>
							<Typography className="font-semibold">Unit price</Typography>
						</th>
						<th>
							<Typography className="font-semibold">Line total</Typography>
						</th>
						<th>
							<Typography className="font-semibold">Quantity</Typography>
						</th>
					</tr>
				</thead>
				<tbody>
					{order?.products?.map((product) => (
						<tr key={product.id}>
							<td className="w-16">{product.sku}</td>
							<td className="w-20">
								{product.thumbnail ? (
									<img
										className="w-full max-h-9 max-w-9 block rounded-sm"
										src={`${URLS.serverUrl}/images?id=${product.thumbnail}`}
										alt={'alt'}
									/>
								) : (
									<img
										className="w-full max-h-9 max-w-9 block rounded-sm"
										src="/assets/images/apps/ecommerce/product-image-placeholder.png"
										alt={'alt'}
									/>
								)}
							</td>
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
							<td className="w-28">
								<span className="truncate">
									{formatGhsCurrency(Number(product.unit_price ?? 0), 2, 2)}
								</span>
							</td>
							<td className="w-28">
								<span className="truncate">
									{formatGhsCurrency(
										Number(product.quantity ?? 0) * Number(product.unit_price ?? 0),
										2,
										2
									)}
								</span>
							</td>
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
