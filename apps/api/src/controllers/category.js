import { handleResponse } from "../util/handleresponse.js";
import { createCategoryService, getAllCategoriesService, updateCategoryService, getCategoryByIdService, deleteCategoryService } from "../models/category.js";

export const createCategory = async (req, res, next) => {
    try {
        const newCategory = await createCategoryService(req.body);
        handleResponse(res, 201, "Category creation success.", newCategory);
    } catch (error) {
        next(error);
    }
}

export const getCategoryById = async (req, res, next) => {
    try {
        const product = await getCategoryByIdService(req.params.id);
        if(!product) return handleResponse(res, 404, "Not found.")
        handleResponse(res, 200, "Cat found.", product);
    } catch (error) {
        next(error);
    }
}

export const getAllCategories = async (req, res, next) => {
    try {
        const categories = await getAllCategoriesService(req.user, req.query);
        handleResponse(res, 200, "Categories list.", categories);
    } catch (error) {
        next(error);
    }
}

export const updateCategory = async (req, res, next) => {
    try {
        req.body.id = req.params.id;
        const updatedCategory = await updateCategoryService(req.body);
        if(!updatedCategory) return handleResponse(res, 404, "Not found.")
        handleResponse(res, 201, "Category updated.", updatedCategory);
    } catch (error) {
        next(error);
    }
}

export const deleteCategory = async (req, res, next) => {
    try {
        const updatedCategory = await deleteCategoryService(req.params.id);
        if(!updatedCategory) return handleResponse(res, 404, "Not found.");
        if(updatedCategory.has_products === true) return handleResponse(res, 400, "Category has products. Cannot delete.");
        handleResponse(res, 201, "Category deleted/updated.", updatedCategory);
    } catch (error) {
        next(error);
    }
}