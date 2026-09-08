import { Typography } from "@mui/material";

function ResetPasswordPageTitle() {
	return (
		<div className="w-full">
			<img
				className="w-14"
				src="/assets/images/logo/shopynn-icon.png"
				alt="Shopynn"
			/>

			<Typography className="mt-8 text-4xl leading-[1.25] font-extrabold tracking-tight">
				Reset password
			</Typography>
			<Typography color="text.secondary" className="mt-2">
				Enter your current (or temporary) password, then choose a new one. Minimum 8 characters.
			</Typography>
		</div>
	);
}

export default ResetPasswordPageTitle;