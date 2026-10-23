function allowBodyFields(fields) {
    return function (req, res, next) {
        var sanitizedBody = {};

        // Leave non-object bodies untouched so the operation handler can reject
        // them as invalid input rather than turning them into an empty object.
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
            return next();
        }

        fields.forEach(function (field) {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                sanitizedBody[field] = req.body[field];
            }
        });

        req.body = sanitizedBody;
        return next();
    };
}

module.exports = {
    allowBodyFields: allowBodyFields
};
