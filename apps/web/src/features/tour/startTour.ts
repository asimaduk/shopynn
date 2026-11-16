'use client';

import { driver, type DriveStep, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import './tour.css';
import { getTourDefinition, type TourStepDef } from './tourDefinitions';
import type { TourId } from './tourIds';

export type StartTourOptions = {
	tourId: TourId;
	navigate: (path: string) => void | Promise<void>;
	onComplete: () => void;
	onSkip: () => void;
};

let activeDriver: Driver | null = null;

async function ensureRoute(navigate: StartTourOptions['navigate'], route?: string) {
	if (!route) return;
	if (window.location.pathname === route) return;
	await navigate(route);
	await new Promise((r) => window.setTimeout(r, 150));
}

function buildSteps(raw: TourStepDef[], navigate: StartTourOptions['navigate']): DriveStep[] {
	return raw.map((step) => ({
		element: step.element,
		skipMissingElement: true,
		waitForElement: step.element ? 8000 : undefined,
		popover: {
			title: step.title,
			description: step.description,
			side: step.side ?? 'bottom',
			align: step.align ?? 'start',
			popoverClass: 'shopynn-tour-popover'
		},
		onHighlightStarted: async () => {
			await ensureRoute(navigate, step.route);
		}
	}));
}

export async function startTour(options: StartTourOptions): Promise<void> {
	const def = getTourDefinition(options.tourId);
	if (!def) return;

	if (activeDriver) {
		activeDriver.destroy();
		activeDriver = null;
	}

	const firstRoute = def.steps.find((s) => s.route)?.route;
	await ensureRoute(options.navigate, firstRoute);

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
			if (nextDef?.route) await ensureRoute(options.navigate, nextDef.route);
			d.moveNext();
		},
		onPrevClick: async (_el, _step, { driver: d }) => {
			const prevIndex = (d.getActiveIndex() ?? 0) - 1;
			const prevDef = def.steps[prevIndex];
			if (prevDef?.route) await ensureRoute(options.navigate, prevDef.route);
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
