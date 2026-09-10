import React, { useCallback, useEffect, useRef, useState } from 'react';
import NotificationPermissionSheet from './NotificationPermissionSheet';
import { setNotificationSoftPromptPresenter } from '../utils/pushNotifications';

/**
 * Mount once near the app root so util code can show the custom soft prompt.
 */
export default function NotificationPermissionHost() {
	const [visible, setVisible] = useState(false);
	const [copy, setCopy] = useState({});
	const onResultRef = useRef(null);

	const finish = useCallback((enabled) => {
		setVisible(false);
		const onResult = onResultRef.current;
		onResultRef.current = null;
		onResult?.(enabled);
	}, []);

	useEffect(() => {
		setNotificationSoftPromptPresenter((request) => {
			setCopy({
				title: request.title,
				message: request.message,
				confirmLabel: request.confirmLabel,
				cancelLabel: request.cancelLabel,
			});
			onResultRef.current = request.onResult;
			setVisible(true);
		});
		return () => setNotificationSoftPromptPresenter(null);
	}, []);

	return (
		<NotificationPermissionSheet
			visible={visible}
			title={copy.title}
			message={copy.message}
			confirmLabel={copy.confirmLabel}
			cancelLabel={copy.cancelLabel}
			onConfirm={() => finish(true)}
			onCancel={() => finish(false)}
		/>
	);
}
