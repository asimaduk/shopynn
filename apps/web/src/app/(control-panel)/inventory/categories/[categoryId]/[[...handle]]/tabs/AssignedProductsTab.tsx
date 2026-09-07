import FuseLoading from '@fuse/core/FuseLoading';
import Link from '@fuse/core/Link';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { useGetProductsByCategoryQuery } from '../../../../ECommerceApi';
import { formatGhsCurrency } from 'src/app/(control-panel)/dashboards/analytics/daily-sales/formatGhsCurrency';

function AssignedProductsTab({ categoryId }: { categoryId: string }) {
	const { data: products = [], isLoading } = useGetProductsByCategoryQuery(
		{ categoryId, pageSize: 500, pageNumber: 1 },
		{ skip: !categoryId || categoryId === 'new' }
	);

	if (isLoading) return <FuseLoading />;

	if (!products.length) {
		return (
			<div className="py-16 text-center">
				<Typography color="text.secondary">No products assigned to this category.</Typography>
			</div>
		);
	}

	return (
		<div className="overflow-auto">
			<Table size="small">
				<TableHead>
					<TableRow>
						<TableCell>Name</TableCell>
						<TableCell>SKU</TableCell>
						<TableCell align="right">Price</TableCell>
						<TableCell align="right">Stock</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{products.map((p) => (
						<TableRow key={p.id} hover>
							<TableCell>
								<Typography
									component={Link}
									to={`/inventory/products/${p.slug}/view`}
									role="button"
									className="underline"
									sx={{
										color: 'primary.main',
										fontWeight: 600,
										'&:hover': { color: 'primary.dark' }
									}}
								>
									{p.name}
								</Typography>
							</TableCell>
							<TableCell>{p.sku || '—'}</TableCell>
							<TableCell align="right">{formatGhsCurrency(Number(p.unit_price ?? 0), 2, 2)}</TableCell>
							<TableCell align="right">{Number(p.inventory ?? 0)}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

export default AssignedProductsTab;
