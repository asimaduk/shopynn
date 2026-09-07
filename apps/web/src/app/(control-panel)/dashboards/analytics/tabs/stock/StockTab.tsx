import { motion } from 'motion/react';
import StockMovementsWidget from '../home/widgets/StockMovementsWidget';
import CategoryDistributionWidget from '../home/widgets/CategoryDistributionWidget';
import LowStockWidget from '../home/widgets/LowStockWidget';
import TotalProductsWidget from '../home/widgets/TotalProductsWidget';

/**
 * Stock Tab - Stock management and movements
 */
function StockTab() {
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
			className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full min-w-0 py-6 px-6 md:px-8"
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
			<motion.div
				variants={item}
				className="sm:col-span-2 lg:col-span-1"
			>
				<CategoryDistributionWidget />
			</motion.div>
			<motion.div
				variants={item}
				className="sm:col-span-2 lg:col-span-3"
			>
				<StockMovementsWidget />
			</motion.div>
		</motion.div>
	);
}

export default StockTab;
