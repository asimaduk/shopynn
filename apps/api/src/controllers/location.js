import { createLocationService, getAllLocationsService, getLocationByIdService, updateLocationService } from "../models/location.js";
import { handleResponse } from "../util/handleresponse.js";

export const createLocation = async (req, res, next) => {
    try {
        const body = { ...req.body, tenant_id: req.body.tenant_id ?? req.user?.tenant_id };
        const newLocation = await createLocationService(body);
        if (!newLocation?.id) {
            return handleResponse(res, 400, newLocation?.message || "Could not create location.", newLocation);
        }
        handleResponse(res, 201, "Location creation success.", newLocation);
    } catch (error) {
        next(error);
    }
}

export const getAllLocations = async (req, res, next) => {
    try {
        const locations = await getAllLocationsService(req.user);
        handleResponse(res, 200, "Locations list.", locations);
    } catch (error) {
        next(error);
    }
}

export const getLocationById = async (req, res, next) => {
    try {
        const location = await getLocationByIdService(req.params.id);
        if(!location) return handleResponse(res, 404, "Not found.")
        handleResponse(res, 200, "Location found.", location);
    } catch (error) {
        next(error);
    }
}

export const updateLocation = async (req, res, next) => {
    try {
        const updatedLocation = await updateLocationService(req.body);
        if(!updatedLocation) return handleResponse(res, 404, "Not found.")
        handleResponse(res, 201, "Location updated.", updatedLocation);
    } catch (error) {
        next(error);
    }
}

export const deleteLocation = async (req, res, next) => {
    try {
        const deletedLocation = await updateLocationService(req.body.id);
        if(!deletedLocation) return handleResponse(res, 404, "Not found.")
        handleResponse(res, 201, "Location deleted.", deletedLocation);
    } catch (error) {
        next(error);
    }
}
