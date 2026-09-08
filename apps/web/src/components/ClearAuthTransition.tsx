'use client';

import { useEffect } from 'react';
import { endAuthTransition } from 'src/utils/authTransition';

/** Clears the post-login overlay once a destination screen has mounted. */
function ClearAuthTransition({ delayMs = 300 }: { delayMs?: number }) {
	useEffect(() => {
		const timer = window.setTimeout(() => endAuthTransition(), delayMs);
		return () => {
			window.clearTimeout(timer);
			endAuthTransition();
		};
	}, [delayMs]);

	return null;
}

export default ClearAuthTransition;
