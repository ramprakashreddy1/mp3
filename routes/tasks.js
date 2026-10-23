var responses = require('./response'),
    allowBodyFields = require('./request').allowBodyFields,
    sanitizeTaskBody = allowBodyFields([
        'name',
        'description',
        'deadline',
        'completed',
        'assignedUser',
        'assignedUserName'
    ]);

module.exports = function (router) {
    router.route('/tasks')
        .get(responses.notImplemented)
        .post(sanitizeTaskBody, responses.notImplemented);

    router.route('/tasks/:id')
        .get(responses.notImplemented)
        .put(sanitizeTaskBody, responses.notImplemented)
        .delete(responses.notImplemented);
};
