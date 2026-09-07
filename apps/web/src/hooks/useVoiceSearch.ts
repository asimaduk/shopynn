'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechRecognitionCtor = new () => SpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
	if (typeof window === 'undefined') return null;
	const w = window as Window & { webkitSpeechRecognition?: SpeechRecognitionCtor };
	return window.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type UseVoiceSearchOptions = {
	onResult: (text: string) => void;
	onError?: (message: string) => void;
	lang?: string;
};

export function useVoiceSearch({ onResult, onError, lang = 'en-US' }: UseVoiceSearchOptions) {
	const [listening, setListening] = useState(false);
	const [supported, setSupported] = useState(false);
	const recognitionRef = useRef<SpeechRecognition | null>(null);
	const onResultRef = useRef(onResult);
	const onErrorRef = useRef(onError);

	useEffect(() => {
		onResultRef.current = onResult;
	}, [onResult]);

	useEffect(() => {
		onErrorRef.current = onError;
	}, [onError]);

	useEffect(() => {
		setSupported(!!getSpeechRecognitionCtor());
	}, []);

	const stop = useCallback(() => {
		try {
			recognitionRef.current?.abort();
		} catch {
			recognitionRef.current?.stop();
		}
		recognitionRef.current = null;
		setListening(false);
	}, []);

	const toggle = useCallback(() => {
		const Ctor = getSpeechRecognitionCtor();
		if (!Ctor) {
			onErrorRef.current?.('Voice search is not supported in this browser. Try Chrome or Edge.');
			return;
		}

		if (listening) {
			stop();
			return;
		}

		const recognition = new Ctor();
		recognition.continuous = false;
		recognition.interimResults = false;
		recognition.lang = lang;
		recognition.maxAlternatives = 1;

		recognition.onstart = () => setListening(true);
		recognition.onend = () => {
			setListening(false);
			recognitionRef.current = null;
		};
		recognition.onresult = (event: SpeechRecognitionEvent) => {
			const transcript = Array.from(event.results)
				.map((r) => r[0]?.transcript ?? '')
				.join(' ')
				.trim();
			if (transcript) onResultRef.current(transcript);
		};
		recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
			if (event.error === 'aborted') return;
			const message =
				event.error === 'not-allowed'
					? 'Microphone permission denied.'
					: event.error === 'no-speech'
						? 'No speech detected. Try again.'
						: 'Voice input failed. Try again.';
			onErrorRef.current?.(message);
		};

		recognitionRef.current = recognition;
		try {
			recognition.start();
		} catch {
			onErrorRef.current?.('Could not start voice search.');
			setListening(false);
		}
	}, [lang, listening, stop]);

	useEffect(() => () => stop(), [stop]);

	return { listening, supported, toggle, stop };
}
