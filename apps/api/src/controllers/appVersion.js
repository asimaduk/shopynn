import { handleResponse } from "../util/handleresponse.js";
import {
    createAppVersionService,
    getAppVersionsService,
    checkAppVersionStatusService,
} from "../models/appVersion.js";

export const createAppVersion = async (req, res, next) => {
    try {
        const created = await createAppVersionService(req.body);
        handleResponse(res, 201, "App version config created.", created);
    } catch (error) {
        if (error.message?.includes("required")) {
            return handleResponse(res, 400, error.message, null);
        }
        next(error);
    }
};

export const getAppVersions = async (req, res, next) => {
    try {
        const versions = await getAppVersionsService(req.query);
        handleResponse(res, 200, "App versions.", versions);
    } catch (error) {
        next(error);
    }
};

export const checkAppVersionStatus = async (req, res, next) => {
    try {
        const payload = {
            platform: req.query.platform ?? req.body?.platform,
            current_version: req.query.current_version ?? req.query.currentVersion ?? req.body?.current_version ?? req.body?.currentVersion,
        };
        const status = await checkAppVersionStatusService(payload);
        handleResponse(res, 200, "App version status.", status);
    } catch (error) {
        if (error.message?.includes("required")) {
            return handleResponse(res, 400, error.message, null);
        }
        next(error);
    }
};

