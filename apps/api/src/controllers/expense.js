import { handleResponse } from "../util/handleresponse.js";
import { createExpenseService, getAllExpensesService, updateExpenseService, getExpenseByIdService } from "../models/expense.js";

export const createExpense = async (req, res, next) => {
    try {
        const newExpense = await createExpenseService(req.body);
        handleResponse(res, 201, "Expense creation success.", newExpense);
    } catch (error) {
        next(error);
    }
}

export const getExpenseById = async (req, res, next) => {
    try {
        const product = await getExpenseByIdService(req.params.id);
        if(!product) return handleResponse(res, 404, "Not found.")
        handleResponse(res, 200, "Cat found.", product);
    } catch (error) {
        next(error);
    }
}

export const getAllExpenses = async (req, res, next) => {
    try {
        const categories = await getAllExpensesService(req.user, req.query);
        handleResponse(res, 200, "Expenses list.", categories);
    } catch (error) {
        next(error);
    }
}

export const updateExpense = async (req, res, next) => {
    try {
        req.body.id = req.params.id;
        const updatedExpense = await updateExpenseService(req.body);
        if(!updatedExpense) return handleResponse(res, 404, "Not found.")
        handleResponse(res, 201, "Expense updated.", updatedExpense);
    } catch (error) {
        next(error);
    }
}