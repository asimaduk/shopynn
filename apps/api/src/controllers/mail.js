import { sendEmailService } from "../models/mail.js";
import { handleResponse } from "../util/handleresponse.js";

export const sendEmail = async (req, res, next) => {
    try {
        const email = await sendEmailService(req.body);
        handleResponse(res, 200, "Email sent.", email);
    } catch (error) {
        next(error);
    }
}