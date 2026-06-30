module.exports = {
    responseHandlerWithData: (res, success, code, message, data) => {
        res.status(code).json({success, message, data});
    },
    responseHandlerWithMessage: (res, success, code, message) => {
        res.status(code).json({success, message});
    },
    responseHandlerWithError: (res, success, code, message) => {
        res.status(code).json({success, message});
    },
}