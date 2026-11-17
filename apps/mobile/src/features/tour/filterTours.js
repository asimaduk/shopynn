import { hasPermission } from '../../utils/permissions';
import { TOUR_CATALOG } from './tourDefinitions';

export function userHasAnyPermission(user, requiredPermissions) {
    if (!requiredPermissions?.length) return true;
    return hasPermission(user, requiredPermissions);
}

export function filterTourSteps(steps, user) {
    return (steps || []).filter((step) => userHasAnyPermission(user, step.requiredPermissions));
}

export function filterTourDefinition(tour, user) {
    if (!userHasAnyPermission(user, tour.requiredPermissions)) return null;
    const steps = filterTourSteps(tour.steps, user);
    if (!steps.length) return null;
    // Require at least one highlight/nav step (intro-only welcome is not useful alone).
    if (!steps.some((s) => s.anchor || s.nav)) return null;
    return { ...tour, steps };
}

export function filterTourCatalog(user) {
    return TOUR_CATALOG.map((tour) => filterTourDefinition(tour, user)).filter(Boolean);
}

export function getFilteredTourDefinition(id, user) {
    const raw = TOUR_CATALOG.find((t) => t.id === id);
    if (!raw) return null;
    return filterTourDefinition(raw, user);
}

/** User can take at least one shop tour (not customer-portal-only). */
export function userHasShopTourAccess(user) {
    return filterTourCatalog(user).length > 0;
}
