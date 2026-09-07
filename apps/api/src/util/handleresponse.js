export const handleResponse = (res, status, message, data = {}) => {
    // res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    // res.setHeader('Pragma', 'no-cache');
    // res.setHeader('Expires', '0');
    res.status(status).json({
        status,
        message,
        data
    });
}