import { handleResponse } from "../util/handleresponse.js";
import { getAllTransactionsService, getTransactionByIdService} from "../models/transactions.js";

export const getTransacionById = async (req, res, next) => {
    try {
        const transaction = await getTransactionByIdService(req.params.id);
        if(!transaction) return handleResponse(res, 404, "Not found.")
        handleResponse(res, 200, "Transaction found.", transaction);
    } catch (error) {
        next(error);
    }
}

export const getAllTransactions = async (req, res, next) => {
    try {
        const transactions = await getAllTransactionsService(req.query.product, req.query.startDate, req.query.endDate, req.user.tenant_id, req.query);
        handleResponse(res, 200, "Transactions list.", transactions);
    } catch (error) {
        next(error);
    }
}