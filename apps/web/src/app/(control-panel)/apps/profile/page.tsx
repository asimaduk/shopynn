import { Suspense } from 'react';
import FuseLoading from '@fuse/core/FuseLoading';
import ProfileApp from './ProfileApp';

export default function ProfilePage() {
	return (
		<Suspense fallback={<FuseLoading />}>
			<ProfileApp />
		</Suspense>
	);
}
