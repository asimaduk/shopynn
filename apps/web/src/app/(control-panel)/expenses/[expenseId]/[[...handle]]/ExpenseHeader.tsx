import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { motion } from 'motion/react';
import { useFormContext } from 'react-hook-form';
import { useParams } from 'next/navigation';
import _ from 'lodash';
// import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import useNavigate from '@fuse/hooks/useNavigate';
import {
	Expense,
	useCreateExpenseMutation,
	useUpdateExpenseMutation
} from '../../ExpenseApi';
import { useGetWarehousesQuery } from '@/app/(control-panel)/setups/warehouses/WarehouseApi';

/**
 * The expense header.
 */
function ExpenseHeader({ updateProcessing }) {
	const routeParams = useParams<{ expenseId: string }>();
	const { expenseId } = routeParams;

	const { data: warehouses } = useGetWarehousesQuery();

	const [createExpense] = useCreateExpenseMutation();
	const [saveExpense] = useUpdateExpenseMutation();

	const methods = useFormContext();
	const { formState, watch, getValues } = methods;
	const { isValid, dirtyFields } = formState;

	const navigate = useNavigate();

	const { voucher } = watch() as Expense;

	function handleSaveExpense() {
		updateProcessing(true);
		const pl = getValues();
		pl.warehouse_id = warehouses.find(w=> w.name = pl.warehouse)?.id || "";		
		saveExpense(pl)
			.then(()=> navigate('/expenses'))
			.catch(err=> console.error(err))
			.finally(()=> updateProcessing(false))
	}

	function handleCreateExpense() {
		updateProcessing(true);
		const pl = getValues();
		pl.warehouse_id = warehouses.find(w=> w.name == pl.warehouse)?.id || "";
		createExpense(pl)
			.unwrap()
			.then((data) => {
				navigate(`/expenses`);
			})
			.finally(()=> updateProcessing(false))
	}

	return (
		<div className="flex flex-col sm:flex-row flex-1 w-full items-center justify-between space-y-2 sm:space-y-0 py-6 sm:py-8">
			<div className="flex flex-col items-start space-y-2 sm:space-y-0 w-full sm:max-w-full min-w-0">
				<motion.div
					initial={{
						x: 20,
						opacity: 0
					}}
					animate={{
						x: 0,
						opacity: 1,
						transition: { delay: 0.3 }
					}}
				>
					<PageBreadcrumb className="mb-2" />
				</motion.div>

				<div className="flex items-center max-w-full space-x-3">
					{/* <motion.div
						className="hidden sm:flex"
						initial={{ scale: 0 }}
						animate={{ scale: 1, transition: { delay: 0.3 } }}
					>
						{thumbnail ? (
							<img
								className="w-8 sm:w-12 rounded-sm"
								// src={_.find(images, { id: featuredImageId })?.url}
								src={thumbnail}
								alt={name}
							/>
						) : (
							<img
								className="w-8 sm:w-12 rounded-sm"
								src="/assets/images/apps/ecommerce/product-image-placeholder.png"
								alt={name}
							/>
						)}
					</motion.div> */}
					<motion.div
						className="flex flex-col min-w-0"
						initial={{ x: -20 }}
						animate={{ x: 0, transition: { delay: 0.3 } }}
					>
						<Typography className="text-lg sm:text-2xl truncate font-semibold">
							{voucher || 'New Expense'}
						</Typography>
						<Typography
							variant="caption"
							className="font-medium"
						>
							Expense Detail
						</Typography>
					</motion.div>
				</div>
			</div>
			<motion.div
				className="flex flex-1 w-full"
				initial={{ opacity: 0, x: 20 }}
				animate={{ opacity: 1, x: 0, transition: { delay: 0.3 } }}
			>
				{expenseId !== 'new' ? (
					<>
						{/* <Button
							className="whitespace-nowrap mx-1"
							variant="contained"
							color="secondary"
							onClick={handleCategory}
							startIcon={<FuseSvgIcon className="hidden sm:flex">heroicons-outline:trash</FuseSvgIcon>}
						>
							Remove
						</Button> */}
						<Button
							className="whitespace-nowrap mx-1"
							variant="contained"
							color="secondary"
							disabled={_.isEmpty(dirtyFields) || !isValid}
							onClick={handleSaveExpense}
						>
							Save
						</Button>
					</>
				) : (
					<Button
						className="whitespace-nowrap mx-1"
						variant="contained"
						color="secondary"
						disabled={_.isEmpty(dirtyFields) || !isValid}
						onClick={handleCreateExpense}
					>
						Add
					</Button>
				)}
			</motion.div>
		</div>
	);
}

export default ExpenseHeader;
