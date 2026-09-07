import { motion } from 'motion/react';
import SalesSummaryWidget from '../home/widgets/SalesSummaryWidget';
import TopProductsWidget from '../home/widgets/TopProductsWidget';
import RecentTransactionsWidget from '../home/widgets/RecentTransactionsWidget';

/**
 * Sales Tab - Sales analytics and performance
 */
function SalesTab() {
	const container = {
		show: {
			transition: {
				staggerChildren: 0.04
			}
		}
	};

	const item = {
		hidden: { opacity: 0, y: 20 },
		show: { opacity: 1, y: 0 }
	};

	return (
		<motion.div
			className="grid grid-cols-1 gap-6 w-full min-w-0 py-6 px-6 md:px-8"
			variants={container}
			initial="hidden"
			animate="show"
		>
			<motion.div
				variants={item}
				className="w-full"
			>
				<SalesSummaryWidget />
			</motion.div>
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<motion.div variants={item}>
					<TopProductsWidget />
				</motion.div>
				<motion.div variants={item}>
					<RecentTransactionsWidget />
				</motion.div>
			</div>
		</motion.div>
	);
}

export default SalesTab;
