import { createProductService, deleteProductService, getAllProductsService, getProductsByCategoryService, getProductByIdService, getProductBySlugService, updateProductImagesService, updateProductService, toggleProductStatusService, changeProductPriceService, getAllTransfersService, createTransferService, getTransferByIdService, getAllProductsCountService, getProductsForExportService, getCatalogService, getCatalogProductByIdService } from "../models/product.js";
import { handleResponse } from "../util/handleresponse.js";
import { createAuditLogService } from "../models/auditLog.js";

export const createProduct = async (req, res, next) => {
    try {
        const newProduct = await createProductService(req.body);
        handleResponse(res, 201, "Product creation success.", newProduct);
    } catch (error) {
        next(error);
    }
}

export const getAllProducts = async (req, res, next) => {
    try {
        const products = await getAllProductsService(req.user, req.query);
        handleResponse(res, 200, "Products list.", products);
    } catch (error) {
        next(error);
    }
}

export const getCatalog = async (req, res, next) => {
    try {
        const products = await getCatalogService(req.user, req.query);
        handleResponse(res, 200, "Catalog list.", products);
    } catch (error) {
        if (error.message?.includes("required")) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
}

export const getCatalogProductById = async (req, res, next) => {
    try {
        const product = await getCatalogProductByIdService(req.user, req.params.id, req.query);
        if (!product) return handleResponse(res, 404, "Not found.");
        handleResponse(res, 200, "Catalog product found.", product);
    } catch (error) {
        if (error.message?.includes("required")) {
            return handleResponse(res, 400, error.message);
        }
        next(error);
    }
}

export const getProductsByCategory = async (req, res, next) => {
    try {
        const products = await getProductsByCategoryService(req.user, req.params.categoryId, req.query);
        handleResponse(res, 200, "Products list by category.", products);
    } catch (error) {
        next(error);
    }
}

export const getAllProductsCount = async (req, res, next) => {
    try {
        const count = await getAllProductsCountService(req.user);
        handleResponse(res, 200, "Products count.", count);
    } catch (error) {
        next(error);
    }
}

export const getProductsForExport = async (req, res, next) => {
    try {
        const products = await getProductsForExportService(req.user, req.query);
        handleResponse(res, 200, "Products list.", products);
    } catch (error) {
        next(error);
    }
}

export const getAllTransfers = async (req, res, next) => {
    try {
        const transfers = await getAllTransfersService(req.user, req.query);
        handleResponse(res, 200, "Transfers list.", transfers);
    } catch (error) {
        next(error);
    }
}

export const createTransfer = async (req, res, next) => {
    try {
        const newPurchase = await createTransferService(req.body);
        handleResponse(res, 201, "Transfer creation success.", newPurchase);
    } catch (error) {
        // console.log('create err',typeof error);
        if(typeof error == 'object' && error.constraint === 'transfers_invoice_number_key') {
            // console.log('invoice number exists');
            handleResponse(res, 200, "Reference number already exists.", {status: 409})
        }
        else {
            next(error);
        }
    }
}

export const getProductById = async (req, res, next) => {
    try {
        const product = await getProductByIdService(req.params.id);
        if(!product) return handleResponse(res, 404, "Not found.")
        handleResponse(res, 200, "Product found.", product);
    } catch (error) {
        next(error);
    }
}

export const getProductBySlug = async (req, res, next) => {
    try {
        const product = await getProductBySlugService(req.params.slug);
        if(!product) return handleResponse(res, 404, "Not found.")
        handleResponse(res, 200, "Product found.", product);
    } catch (error) {
        next(error);
    }
}

export const getAllTransferById = async (req, res, next) => {
    try {
        const transfer = await getTransferByIdService(req.user, req.params.id);
        if(!transfer) return handleResponse(res, 404, "Not found.")
        handleResponse(res, 200, "Transfer found.", transfer);
    } catch (error) {
        next(error);
    }
}

export const updateProduct = async (req, res, next) => {
    try {
        const updatedProduct = await updateProductService({...req.body, id: req.params.id});
        if(!updatedProduct) return handleResponse(res, 404, "Not found.")
        handleResponse(res, 201, "Product updated.", updatedProduct);
    } catch (error) {
        next(error);
    }
}

export const changeProductStatus = async (req, res, next) => {
    try {
        const updatedProduct = await toggleProductStatusService(req.body);
        if(!updatedProduct) return handleResponse(res, 404, "Not found.")
        handleResponse(res, 201, "Product status updated.", updatedProduct);
    } catch (error) {
        next(error);
    }
}

export const updateProductImages = async (req, res, next) => {
    try {
        const updatedProduct = await updateProductImagesService(req.body);
        if(!updatedProduct) return handleResponse(res, 404, "Not found.")
        handleResponse(res, 201, "Product updated.", updatedProduct);
    } catch (error) {
        next(error);
    }
}

export const uploadProductImages = async (req, res, next) => {
    try {
        if (!req.files || !req.files.length) {
            return handleResponse(res, 400, "No files uploaded.", null);
        }
        const id = req.params.id;
        const findKey = (name) => {
            const f = req.files.find(f => f.fieldname === name);
            return f ? f.key : null;
        };
        const payload = {
            id,
            thumbnail: findKey("thumbnail"),
            picture1: findKey("picture1"),
            picture2: findKey("picture2"),
            picture3: findKey("picture3"),
            picture4: findKey("picture4"),
        };
        const updatedProduct = await updateProductImagesService(payload);
        if (!updatedProduct) return handleResponse(res, 404, "Not found.");
        handleResponse(res, 201, "Product images uploaded.", updatedProduct);
    } catch (error) {
        next(error);
    }
}

export const changeProductPrice = async (req, res, next) => {
    try {
        const { id, unit_price, alt_price } = req.body;
        if (!id) {
            return handleResponse(res, 400, "id is required.", null);
        }
        const change = await changeProductPriceService({ id, unit_price, alt_price });
        if (!change) {
            return handleResponse(res, 404, "Not found.", null);
        }

        const user = req.user;
        if (user) {
            await createAuditLogService({
                user_id: user.id,
                tenant_id: user.tenant_id,
                action: "PRODUCT_PRICE_CHANGE",
                entity_type: "product",
                entity_id: id,
                details: JSON.stringify({
                    before: {
                        unit_price: change.before.unit_price,
                        alt_price: change.before.alt_price,
                    },
                    after: {
                        unit_price: change.after.unit_price,
                        alt_price: change.after.alt_price,
                    },
                }),
                ip_address: req.ip,
            });
        }

        handleResponse(res, 200, "Product price updated.", change.after);
    } catch (error) {
        next(error);
    }
}

export const deleteProduct = async (req, res, next) => {
    try {
        const updatedProduct = await deleteProductService(req.params.id);
        if(!updatedProduct) return handleResponse(res, 404, "Not found.")
        handleResponse(res, 201, "Product deleted/updated.", updatedProduct);
    } catch (error) {
        next(error);
    }
}