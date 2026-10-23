function sendResponse(res, status, message, data) {
    if (typeof data === 'undefined') {
        data = {};
    }

    return res.status(status).json({
        message: message,
        data: data
    });
}

function notImplemented(req, res) {
    return sendResponse(res, 501, 'Not implemented', {});
}

function notFound(req, res) {
    return sendResponse(res, 404, 'Route not found', {});
}

function errorHandler(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }

    if (err && err.type === 'entity.parse.failed') {
        return sendResponse(res, 400, 'Request body contains invalid JSON', {});
    }

    console.error('Unexpected request error:', err);
    return sendResponse(res, 500, 'Internal server error', {});
}

module.exports = {
    sendResponse: sendResponse,
    notImplemented: notImplemented,
    notFound: notFound,
    errorHandler: errorHandler
};
