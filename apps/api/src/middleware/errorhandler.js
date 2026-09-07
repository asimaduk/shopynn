//Centralised error handling

const errorHandling = (err, req, res, next) => {
    // console.error('err.stack.handler',err.stack);
    res.status(500).json({
        status: 500,
        message: "Something failed.",
        error: err.message
    })
}

export default errorHandling;