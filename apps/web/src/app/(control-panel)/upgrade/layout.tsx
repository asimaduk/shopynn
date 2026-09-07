import { Suspense } from 'react';
import FuseLoading from '@fuse/core/FuseLoading';

export default function UpgradeLayout({ children }: { children: React.ReactNode }) {
	return <Suspense fallback={<FuseLoading />}>{children}</Suspense>;
}
