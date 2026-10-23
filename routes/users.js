var responses = require('./response'),
    allowBodyFields = require('./request').allowBodyFields,
    sanitizeUserBody = allowBodyFields(['name', 'email', 'pendingTasks']);

module.exports = function (router) {
    router.route('/users')
        .get(responses.notImplemented)
        .post(sanitizeUserBody, responses.notImplemented);

    router.route('/users/:id')
        .get(responses.notImplemented)
        .put(sanitizeUserBody, responses.notImplemented)
        .delete(responses.notImplemented);
};
