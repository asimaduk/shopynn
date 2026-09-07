import { motion } from 'motion/react';
import TotalProductsWidget from './widgets/TotalProductsWidget';
import LowStockWidget from './widgets/LowStockWidget';
import InventoryValueWidget from './widgets/InventoryValueWidget';
import TopProductsWidget from './widgets/TopProductsWidget';
import RecentTransactionsWidget from './widgets/RecentTransactionsWidget';
import StockMovementsWidget from './widgets/StockMovementsWidget';
import CategoryDistributionWidget from './widgets/CategoryDistributionWidget';

/**
 * Overview Tab - Main inventory dashboard overview
 */
function HomeTab() {
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
			className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 w-full min-w-0 py-6 px-6 md:px-8"
			variants={container}
			initial="hidden"
			animate="show"
		>
			<motion.div variants={item}>
				<TotalProductsWidget />
			</motion.div>
			<motion.div variants={item}>
				<LowStockWidget />
			</motion.div>
			<motion.div variants={item}>
				<InventoryValueWidget />
			</motion.div>
			<motion.div
				variants={item}
				className="sm:col-span-2 md:col-span-4"
			>
				<TopProductsWidget />
			</motion.div>
			<motion.div
				variants={item}
				className="sm:col-span-2 md:col-span-4 lg:col-span-2"
			>
				<RecentTransactionsWidget />
			</motion.div>
			<motion.div
				variants={item}
				className="sm:col-span-2 md:col-span-4 lg:col-span-2"
			>
				<StockMovementsWidget />
			</motion.div>
			<motion.div
				variants={item}
				className="sm:col-span-2 md:col-span-4 lg:col-span-2"
			>
				<CategoryDistributionWidget />
			</motion.div>
		</motion.div>
	);
}

export default HomeTab;
