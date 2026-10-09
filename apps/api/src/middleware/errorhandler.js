//Centralised error handling

const errorHandling = (err, req, res, next) => {
    console.error(`[${req.method} ${req.originalUrl}]`, err?.stack || err);
    const status = Number(err?.status || err?.statusCode);
    if (status >= 400 && status < 500) {
        return res.status(status).json({
            status,
            message: err.message || "Request failed.",
            ...(err.code ? { code: err.code } : {}),
        });
    }
    res.status(500).json({
        status: 500,
        message: "Something failed.",
        error: err.message
    })
}

export default errorHandling;
