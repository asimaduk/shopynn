'use client';

import FuseLoading from '@fuse/core/FuseLoading';
import FusePageCarded from '@fuse/core/FusePageCarded';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { motion } from 'motion/react';
import { SyntheticEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from '@fuse/core/Link';
import _ from 'lodash';
import { FormProvider, useForm } from 'react-hook-form';
import useThemeMediaQuery from '@fuse/hooks/useThemeMediaQuery';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
// import FuseTabs from 'src/components/tabs/FuseTabs';
// import FuseTab from 'src/components/tabs/FuseTab';
import ExpenseHeader from './ExpenseHeader';
import BasicInfoTab from './tabs/BasicInfoTab';
import { useGetExpenseQuery } from '../../ExpenseApi';
import ExpenseModel from '../../models/ExpenseModel';
import NewExpenseView from './NewExpenseView';

/**
 * Form Validation Schema
 */
const schema = z.object({
	// amount: z.
	// string()
	// .nonempty('You must enter a expense amount')
	// .min(1, 'The expense amount should be greater than 1.00'),
	voucher: z.string({required_error: 'You must provide a voucher/code.'}),
	note: z.string({required_error: 'You must enter an expense description'}).min(5, 'The expense description must be at least 5 characters')
});

/**
 * The expense page.
 */
function Expense() {
	const isMobile = useThemeMediaQuery((theme) => theme.breakpoints.down('lg'));
	const [processing, setProcessing] = useState(false);

	const routeParams = useParams<{ expenseId: string }>();

	const { expenseId } = routeParams;

	const {
		data: expense,
		isLoading,
		isError
	} = useGetExpenseQuery(expenseId, {
		skip: !expenseId || expenseId === 'new'
	});

	const [tabValue, setTabValue] = useState('basic-info');

	const methods = useForm({
		mode: 'onChange',
		defaultValues: {},
		resolver: zodResolver(schema)
	});

	const { reset, watch } = methods;

	const form = watch();

	useEffect(() => {		
		if (expenseId === 'new') {
			reset(ExpenseModel({}));
		}
	}, [expenseId, reset]);

	useEffect(() => {
		if (expense) {
			reset({ ...expense });
		}
	}, [expense, reset]);

	/**
	 * Tab Change
	 */
	function handleTabChange(event: SyntheticEvent, value: string) {
		setTabValue(value);
	}

	function updateProcessing(val) {
		setProcessing(val)
	}
	
	if (isLoading) {
		return <FuseLoading />;
	}

	/**
	 * Show Message if the requested expense is not exists
	 */
	if (isError && expenseId !== 'new') {
		return (
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1, transition: { delay: 0.1 } }}
				className="flex flex-col flex-1 items-center justify-center h-full"
			>
				<Typography
					color="text.secondary"
					variant="h5"
				>
					There is no such expense!
				</Typography>
				<Button
					className="mt-6"
					component={Link}
					variant="outlined"
					to="/inventory/categories"
					color="inherit"
				>
					Go to Expenses Page
				</Button>
			</motion.div>
		);
	}

	/**
	 * Wait while expense data is loading and form is setted
	 */	
	
	if (_.isEmpty(form) || (expense && routeParams.expenseId != expense.id && routeParams.expenseId != 'new')) {		
		return <FuseLoading />;
	}

	return (
		<FormProvider {...methods}>
			{processing && (
				<div style={{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,.5)',zIndex:99}}>
					<FuseLoading />
				</div>
			)}
			<FusePageCarded
				header={<ExpenseHeader updateProcessing={updateProcessing} />}
				content={
					<div className="p-4 sm:p-6 space-y-6">
						<BasicInfoTab />
						{/* <NewExpenseView /> */}
						{/* <FuseTabs
							value={tabValue}
							onChange={handleTabChange}
						>
							<FuseTab
								value="basic-info"
								label="Provide Details"
							/>
			
						</FuseTabs>
						<div className="">
							<div className={tabValue !== 'basic-info' ? 'hidden' : ''}>
								<BasicInfoTab />
							</div>
						</div> */}
					</div>
				}
				scroll={isMobile ? 'normal' : 'content'}
			/>
		</FormProvider>
	);
}

export default Expense;
