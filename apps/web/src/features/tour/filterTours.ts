import { hasPermissionCodes } from '@auth/permissions';
import type { User } from '@auth/user';
import { TOUR_CATALOG, type TourDefinition, type TourStepDef } from './tourDefinitions';
import type { TourId } from './tourIds';

/** True when the user has any of the required permission codes (or none required). */
export function userHasAnyPermission(
	user: User | null | undefined,
	requiredPermissions?: string[]
): boolean {
	if (!requiredPermissions?.length) return true;
	return hasPermissionCodes(user, requiredPermissions);
}

export function filterTourSteps(
	steps: TourStepDef[],
	user: User | null | undefined
): TourStepDef[] {
	return steps.filter((step) => userHasAnyPermission(user, step.requiredPermissions));
}

export function filterTourDefinition(
	tour: TourDefinition,
	user: User | null | undefined
): TourDefinition | null {
	if (!userHasAnyPermission(user, tour.requiredPermissions)) return null;
	const steps = filterTourSteps(tour.steps, user);
	if (!steps.length) return null;
	// Require at least one highlight/nav step (intro-only welcome is not useful alone).
	if (!steps.some((s) => s.element || s.route)) return null;
	return { ...tour, steps };
}

export function filterTourCatalog(user: User | null | undefined): TourDefinition[] {
	return TOUR_CATALOG.map((tour) => filterTourDefinition(tour, user)).filter(
		(t): t is TourDefinition => Boolean(t)
	);
}

export function getFilteredTourDefinition(
	id: TourId,
	user: User | null | undefined
): TourDefinition | null {
	const raw = TOUR_CATALOG.find((t) => t.id === id);
	if (!raw) return null;
	return filterTourDefinition(raw, user);
}

/** User can take at least one shop tour (not a customer-portal-only account). */
export function userHasShopTourAccess(user: User | null | undefined): boolean {
	return filterTourCatalog(user).length > 0;
}
