import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { motion } from 'motion/react';
import { useFormContext } from 'react-hook-form';
import { useParams } from 'next/navigation';
import _ from 'lodash';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import Link from '@fuse/core/Link';
import useNavigate from '@fuse/hooks/useNavigate';
import {
	Supplier,
	useCreateSupplierMutation,
	useUpdateSupplierMutation
} from '../../SupplierApi';

function initialsFromSupplierName(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length >= 2) {
		return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
	}
	if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
	if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
	return '?';
}

type SupplierHeaderProps = {
	updateProcessing: (val: boolean) => void;
};

function SupplierHeader({ updateProcessing }: SupplierHeaderProps) {
	const routeParams = useParams<{ supplierId: string }>();
	const { supplierId } = routeParams;
	const isNew = supplierId === 'new';

	const [createSupplier] = useCreateSupplierMutation();
	const [saveSupplier] = useUpdateSupplierMutation();

	const methods = useFormContext();
	const { formState, watch, getValues } = methods;
	const { isValid, dirtyFields } = formState;

	const navigate = useNavigate();

	const { name } = watch() as Supplier;
	const title = (name != null ? String(name) : '').trim();
	const displayTitle = title || (isNew ? 'New supplier' : 'Supplier');

	function handleSaveSupplier() {
		updateProcessing(true);
		saveSupplier(getValues())
			.then(() => navigate('/setups/suppliers'))
			.catch((err) => console.error(err))
			.finally(() => updateProcessing(false));
	}

	function handleCreateSupplier() {
		updateProcessing(true);
		createSupplier(getValues())
			.unwrap()
			.then(() => navigate('/setups/suppliers'))
			.finally(() => updateProcessing(false));
	}

	return (
		<Box
			className="relative px-5 py-7 sm:px-8 sm:py-8"
			sx={{
				background: (theme) =>
					`linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.06)} 100%)`
			}}
		>
			<Stack
				direction={{ xs: 'column', sm: 'row' }}
				spacing={3}
				alignItems={{ xs: 'flex-start', sm: 'center' }}
				justifyContent="space-between"
			>
				<motion.div
					className="flex flex-row items-center gap-3 min-w-0"
					initial={{ opacity: 0, x: -12 }}
					animate={{ opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } }}
				>
					<Avatar
						sx={{
							width: 64,
							height: 64,
							fontSize: '1.35rem',
							fontWeight: 800,
							bgcolor: 'primary.main',
							color: 'primary.contrastText',
							boxShadow: (theme) => `0 8px 24px ${alpha(theme.palette.primary.main, 0.35)}`
						}}
					>
						{initialsFromSupplierName(displayTitle)}
					</Avatar>
					<Box className="min-w-0">
						<Typography className="text-xl sm:text-2xl font-extrabold tracking-tight truncate" component="h1">
							{displayTitle}
						</Typography>
						<Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
							{isNew ? 'Create a supplier record' : 'Edit supplier details'}
						</Typography>
					</Box>
				</motion.div>

				<motion.div
					className="flex flex-wrap items-center gap-2 w-full sm:w-auto"
					initial={{ opacity: 0, x: 12 }}
					animate={{ opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } }}
				>
					<Button
						variant="outlined"
						component={Link}
						to="/setups/suppliers"
						size="medium"
						sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
						startIcon={<FuseSvgIcon size={18}>heroicons-outline:arrow-left</FuseSvgIcon>}
					>
						Suppliers
					</Button>
					{!isNew && supplierId && (
						<Button
							variant="outlined"
							component={Link}
							to={`/setups/suppliers/${supplierId}/view`}
							size="medium"
							sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
							startIcon={<FuseSvgIcon size={18}>heroicons-outline:eye</FuseSvgIcon>}
						>
							View
						</Button>
					)}
					{isNew ? (
						<Button
							variant="contained"
							color="secondary"
							size="medium"
							disabled={_.isEmpty(dirtyFields) || !isValid}
							onClick={handleCreateSupplier}
							sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
							startIcon={<FuseSvgIcon size={18}>heroicons-outline:plus</FuseSvgIcon>}
						>
							Create supplier
						</Button>
					) : (
						<Button
							variant="contained"
							color="secondary"
							size="medium"
							disabled={_.isEmpty(dirtyFields) || !isValid}
							onClick={handleSaveSupplier}
							sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
							startIcon={<FuseSvgIcon size={18}>heroicons-outline:check</FuseSvgIcon>}
						>
							Save changes
						</Button>
					)}
				</motion.div>
			</Stack>
		</Box>
	);
}

export default SupplierHeader;
