//Centralised error handling

const errorHandling = (err, req, res, next) => {
    console.error(`[${req.method} ${req.originalUrl}]`, err?.stack || err);
    res.status(500).json({
        status: 500,
        message: "Something failed.",
        error: err.message
    })
}

export default errorHandling;
