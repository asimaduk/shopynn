const explicitApiBase =
	process.env.NEXT_PUBLIC_API_BASE_URL ||
	process.env.API_BASE_URL ||
	(process.env.NEXT_PUBLIC_PORT ? `http://127.0.0.1:${process.env.NEXT_PUBLIC_PORT}` : '');

export const API_BASE_URL =
	explicitApiBase ||
	(process.env.NODE_ENV === 'development'
		? 'http://127.0.0.1:4001'
		: process.env.NEXT_PUBLIC_BASE_URL || '/');

// Define the types for options and configuration
type FetchOptions = RequestInit;

export class FetchApiError extends Error {
	status: number;

	data: unknown;

	constructor(status: number, data: unknown) {
		super(`FetchApiError: ${status}`);
		this.status = status;
		this.data = data;
	}
}

// Global headers configuration
export const globalHeaders: Record<string, string> = {};

// Function to update global headers
export const setGlobalHeaders = (newHeaders: Record<string, string>) => {
	Object.assign(globalHeaders, newHeaders);
};

export const removeGlobalHeaders = (headerKeys: string[]) => {
	headerKeys.forEach((key) => {
		delete globalHeaders[key];
	});
};

// Main apiFetch function with interceptors and type safety
const apiFetch = async (endpoint: string, options: FetchOptions = {}) => {
	const { headers, ...restOptions } = options;
	const method = restOptions.method || 'GET';

	const config: FetchOptions = {
		headers: {
			...(method !== 'GET' && { 'Content-Type': 'application/json' }),
			...globalHeaders,
			...headers
		},
		...restOptions
	};

	try {
		const _url = `${API_BASE_URL}${endpoint}`;
		const response = await fetch(_url, config);
		return response;
	} catch (error) {
		throw error;
	}
};

export default apiFetch;
