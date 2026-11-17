'use client';

import { driver, type DriveStep, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import './tour.css';
import store from '@/store/store';
import {
	navbarOpen,
	navbarOpenFolded,
	navbarOpenMobile
} from 'src/components/theme-layouts/components/navbar/navbarSlice';
import type { TourDefinition, TourStepDef } from './tourDefinitions';
import type { TourId } from './tourIds';

export type StartTourOptions = {
	tourId: TourId;
	/** Permission-filtered definition; required so callers apply filterTours first. */
	definition: TourDefinition;
	navigate: (path: string) => void | Promise<void>;
	onComplete: () => void;
	onSkip: () => void;
};

let activeDriver: Driver | null = null;

function needsNavbar(selector?: string): boolean {
	return Boolean(selector && selector.includes('data-tour="nav-'));
}

/** Keep the side nav open so tour anchors stay in the DOM. */
function ensureNavbarOpen() {
	store.store.dispatch(navbarOpen());
	store.store.dispatch(navbarOpenFolded());
	// Temporary drawer uses a MUI Modal — only open it on small screens.
	if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1199.95px)').matches) {
		store.store.dispatch(navbarOpenMobile());
	}
}

async function waitForSelector(selector: string, timeoutMs: number): Promise<Element | null> {
	const existing = document.querySelector(selector);
	if (existing) return existing;

	return new Promise((resolve) => {
		const started = Date.now();
		const tick = () => {
			const el = document.querySelector(selector);
			if (el) {
				resolve(el);
				return;
			}
			if (Date.now() - started >= timeoutMs) {
				resolve(null);
				return;
			}
			window.setTimeout(tick, 50);
		};
		tick();
	});
}

async function ensureRoute(navigate: StartTourOptions['navigate'], route?: string) {
	if (!route) return;
	if (window.location.pathname === route) return;
	await navigate(route);
	await new Promise((r) => window.setTimeout(r, 280));
}

async function prepareStep(step: TourStepDef, navigate: StartTourOptions['navigate']) {
	if (needsNavbar(step.element)) {
		ensureNavbarOpen();
	}
	await ensureRoute(navigate, step.route);
	if (step.element) {
		if (needsNavbar(step.element)) {
			ensureNavbarOpen();
		}
		await waitForSelector(step.element, 2500);
	}
}

function buildSteps(raw: TourStepDef[], navigate: StartTourOptions['navigate']): DriveStep[] {
	return raw.map((step) => ({
		element: step.element,
		waitForElement: step.element ? 6000 : undefined,
		// Safety net for folded/hidden nav anchors that still disappear after permission filter.
		skipMissingElement: true,
		popover: {
			title: step.title,
			description: step.description,
			side: step.side ?? 'bottom',
			align: step.align ?? 'start',
			popoverClass: 'shopynn-tour-popover'
		},
		onHighlightStarted: async () => {
			await prepareStep(step, navigate);
		}
	}));
}

export async function startTour(options: StartTourOptions): Promise<void> {
	const def = options.definition;
	if (!def?.steps?.length) {
		options.onSkip();
		return;
	}

	if (activeDriver) {
		activeDriver.destroy();
		activeDriver = null;
	}

	ensureNavbarOpen();
	const firstWithRoute = def.steps.find((s) => s.route);
	const firstWithElement = def.steps.find((s) => s.element);
	await ensureRoute(options.navigate, firstWithRoute?.route);
	if (firstWithElement?.element && needsNavbar(firstWithElement.element)) {
		ensureNavbarOpen();
		await waitForSelector(firstWithElement.element, 2500);
	}

	const steps = buildSteps(def.steps, options.navigate);
	if (!steps.length) {
		options.onSkip();
		return;
	}

	let settled = false;
	const settle = (kind: 'complete' | 'skip') => {
		if (settled) return;
		settled = true;
		if (kind === 'complete') options.onComplete();
		else options.onSkip();
	};

	activeDriver = driver({
		showProgress: true,
		animate: true,
		allowClose: true,
		overlayOpacity: 0.55,
		stagePadding: 8,
		stageRadius: 10,
		skipMissingElement: true,
		popoverClass: 'shopynn-tour-popover',
		nextBtnText: 'Next',
		prevBtnText: 'Back',
		doneBtnText: 'Done',
		progressText: '{{current}} of {{total}}',
		steps,
		onNextClick: async (_el, _step, { driver: d }) => {
			const nextIndex = (d.getActiveIndex() ?? 0) + 1;
			const nextDef = def.steps[nextIndex];
			if (nextDef) {
				await prepareStep(nextDef, options.navigate);
			}
			if (!d.isActive()) return;
			d.moveNext();
		},
		onPrevClick: async (_el, _step, { driver: d }) => {
			const prevIndex = (d.getActiveIndex() ?? 0) - 1;
			const prevDef = def.steps[prevIndex];
			if (prevDef) {
				await prepareStep(prevDef, options.navigate);
			}
			if (!d.isActive()) return;
			d.movePrevious();
		},
		onDestroyStarted: (_el, _step, { driver: d }) => {
			const completed = d.isLastStep();
			d.destroy();
			activeDriver = null;
			settle(completed ? 'complete' : 'skip');
		},
		onDestroyed: () => {
			activeDriver = null;
		}
	});

	activeDriver.drive();
}

export function stopTour() {
	if (activeDriver) {
		activeDriver.destroy();
		activeDriver = null;
	}
}
