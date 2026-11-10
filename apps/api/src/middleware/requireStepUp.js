import { isValidStepUpToken } from "../models/stepUp.js";

/** Money-moving routes: the caller must have confirmed a fresh one-time code (X-Step-Up-Token). */
const requireStepUp = (req, res, next) => {
    if (isValidStepUpToken(req.get("x-step-up-token"), req.user)) return next();
    return res.status(403).json({
        status: 403,
        code: "STEP_UP_REQUIRED",
        message: "Confirm it's you with the code we send to your phone or email.",
        data: {},
    });
};

export default requireStepUp;
