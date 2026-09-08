import Link from 'next/link';

export default function OfflinePage() {
	return (
		<main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
			<div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
				<h1 className="mb-3 text-3xl font-bold text-slate-900">You’re offline</h1>
				<p className="mb-6 text-slate-600">
					Shopynn can’t reach the network right now. Reconnect to continue, or reopen a page you
					already visited — POS can still use the last saved catalog when available.
				</p>
				<Link
					href="/"
					className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
				>
					Back to home
				</Link>
			</div>
		</main>
	);
}
