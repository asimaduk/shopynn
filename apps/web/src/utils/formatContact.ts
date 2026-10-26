/** Ghana numbers: 233XXXXXXXXX → +233 XX XXX XXXX, 0XXXXXXXXX → 0XX XXX XXXX. */
export function formatPhone(phone: unknown): string {
	const raw = String(phone || '').trim();
	const digits = raw.replace(/\D/g, '');
	if (digits.length === 12 && digits.startsWith('233')) {
		return `+233 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
	}
	if (digits.length === 10 && digits.startsWith('0')) {
		return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
	}
	return raw;
}

/** Ghana numbers in local form: 233XXXXXXXXX or 0XXXXXXXXX → 0XX XXX XXXX. */
export function formatPhoneLocal(phone: unknown): string {
	const raw = String(phone || '').trim();
	const digits = raw.replace(/\D/g, '');
	let local = '';
	if (digits.length === 12 && digits.startsWith('233')) local = `0${digits.slice(3)}`;
	else if (digits.length === 10 && digits.startsWith('0')) local = digits;
	else if (digits.length === 9 && !digits.startsWith('0')) local = `0${digits}`;
	return local ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}` : raw;
}

/** Phone-OTP signups get a synthetic `<phone>@otp.shopynn.local` email that should never be shown. */
export function displayEmail(email: unknown): string {
	const value = String(email || '').trim();
	return value.toLowerCase().endsWith('@otp.shopynn.local') ? '' : value;
}
