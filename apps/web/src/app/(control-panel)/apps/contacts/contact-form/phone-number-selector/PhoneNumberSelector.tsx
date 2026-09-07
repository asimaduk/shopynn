import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import Button from '@mui/material/Button';
import clsx from 'clsx';
import FormHelperText from '@mui/material/FormHelperText';
import PhoneNumberInput from './PhoneNumberInput';
import { ContactPhoneModel } from '../../models/ContactModel';
import { ContactPhoneNumber } from '../../ContactsApi';

type PhoneNumberSelectorProps = {
	value: ContactPhoneNumber[] | undefined;
	onChange: (T: ContactPhoneNumber[]) => void;
	className?: string;
	error?: boolean;
	helperText?: string;
	ref?: React.Ref<HTMLDivElement>;
};

/**
 * The phone number selector.
 */
function PhoneNumberSelector(props: PhoneNumberSelectorProps) {
	const { value, onChange, className, error, helperText, ref } = props;

	return (
		<div
			className={clsx('w-full', className)}
			ref={ref}
		>
			{error && helperText && <FormHelperText error={error}>{helperText}</FormHelperText>}

			{value.map((item, index) => (
				<PhoneNumberInput
					value={item}
					key={index}
					onChange={(val) => {
						onChange(value.map((_item, _index) => (index === _index ? val : _item)));
					}}
					onRemove={() => {
						onChange(value.filter((_item, _index) => index !== _index));
					}}
					hideRemove={value.length === 1}
				/>
			))}
			<Button
				className="group inline-flex items-center mt-0.5 -ml-1 py-0.5 px-1 rounded-sm cursor-pointer"
				onClick={() => onChange([...value, ContactPhoneModel({})])}
			>
				<FuseSvgIcon size={20}>heroicons-solid:plus-circle</FuseSvgIcon>

				<span className="ml-2 font-medium text-secondary group-hover:underline">Add a phone number</span>
			</Button>
		</div>
	);
}

export default PhoneNumberSelector;
