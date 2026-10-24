var mongoose = require('mongoose');
var sendResponse = require('./response').sendResponse;

function ApiError(status, message, data) {
    Error.call(this, message);
    this.name = 'ApiError';
    this.status = status;
    this.message = message;
    this.data = data || {};
}

ApiError.prototype = Object.create(Error.prototype);
ApiError.prototype.constructor = ApiError;

function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseObject(value, name) {
    if (value === undefined) {
        return {};
    }

    if (typeof value !== 'string') {
        throw new ApiError(400, name + ' must be a JSON object');
    }

    var parsed;

    try {
        parsed = JSON.parse(value);
    } catch (err) {
        throw new ApiError(400, name + ' must contain valid JSON');
    }

    if (!isObject(parsed)) {
        throw new ApiError(400, name + ' must be a JSON object');
    }

    return parsed;
}

function parseNumber(value, name) {
    if (value === undefined) {
        return undefined;
    }

    if (typeof value !== 'string' || !/^\d+$/.test(value)) {
        throw new ApiError(400, name + ' must be a nonnegative integer');
    }

    var number = Number(value);

    if (!Number.isSafeInteger(number)) {
        throw new ApiError(400, name + ' must be a nonnegative integer');
    }

    return number;
}

function parseBoolean(value, name) {
    if (value === undefined) {
        return false;
    }

    if (value !== 'true' && value !== 'false') {
        throw new ApiError(400, name + ' must be true or false');
    }

    return value === 'true';
}

function validateSelect(select) {
    var mode;

    Object.keys(select).forEach(function (field) {
        if (select[field] !== 1 && select[field] !== 0) {
            throw new ApiError(400, 'select values must be 1 or 0');
        }

        if (field !== '_id') {
            if (mode !== undefined && mode !== select[field]) {
                throw new ApiError(400, 'select cannot mix included and excluded fields');
            }

            mode = select[field];
        }
    });
}

function parseQuery(req, defaultLimit) {
    var where = parseObject(req.query.where, 'where');
    var sort = parseObject(req.query.sort, 'sort');
    var select = parseObject(req.query.select, 'select');
    var skip = parseNumber(req.query.skip, 'skip');
    var limit = parseNumber(req.query.limit, 'limit');
    var count = parseBoolean(req.query.count, 'count');

    if (limit === 0) {
        throw new ApiError(400, 'limit must be a positive integer');
    }

    Object.keys(sort).forEach(function (field) {
        if (sort[field] !== 1 && sort[field] !== -1) {
            throw new ApiError(400, 'sort values must be 1 or -1');
        }
    });

    validateSelect(select);

    return {
        where: where,
        sort: sort,
        select: select,
        skip: skip === undefined ? 0 : skip,
        limit: limit === undefined ? defaultLimit : limit,
        count: count
    };
}

function parseSelect(req) {
    var select = parseObject(req.query.select, 'select');
    validateSelect(select);
    return select;
}

function validateUser(body) {
    if (!isObject(body)) {
        throw new ApiError(400, 'Request body must be an object');
    }

    if (typeof body.name !== 'string' || body.name.trim() === '') {
        throw new ApiError(400, 'A valid name is required');
    }

    if (typeof body.email !== 'string' || body.email.trim() === '') {
        throw new ApiError(400, 'A valid email is required');
    }

    var pendingTasks = body.pendingTasks === undefined ? [] : body.pendingTasks;

    if (!Array.isArray(pendingTasks)) {
        throw new ApiError(400, 'pendingTasks must be an array');
    }

    pendingTasks.forEach(function (id) {
        if (typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, 'pendingTasks contains an invalid task ID');
        }
    });

    return {
        name: body.name.trim(),
        email: body.email.trim(),
        pendingTasks: Array.from(new Set(pendingTasks))
    };
}

function validateTask(body) {
    if (!isObject(body)) {
        throw new ApiError(400, 'Request body must be an object');
    }

    if (typeof body.name !== 'string' || body.name.trim() === '') {
        throw new ApiError(400, 'A valid name is required');
    }

    if (typeof body.deadline !== 'string' || body.deadline.trim() === '') {
        throw new ApiError(400, 'A valid deadline is required');
    }

    var deadline = new Date(body.deadline);

    if (Number.isNaN(deadline.getTime())) {
        throw new ApiError(400, 'A valid deadline is required');
    }

    if (body.description !== undefined && typeof body.description !== 'string') {
        throw new ApiError(400, 'description must be a string');
    }

    if (body.completed !== undefined && typeof body.completed !== 'boolean') {
        throw new ApiError(400, 'completed must be a boolean');
    }

    if (body.assignedUser !== undefined && typeof body.assignedUser !== 'string') {
        throw new ApiError(400, 'assignedUser must be a string');
    }

    if (body.assignedUserName !== undefined && typeof body.assignedUserName !== 'string') {
        throw new ApiError(400, 'assignedUserName must be a string');
    }

    var assignedUser = body.assignedUser === undefined ? '' : body.assignedUser;

    if (assignedUser !== '' && !mongoose.Types.ObjectId.isValid(assignedUser)) {
        throw new ApiError(400, 'assignedUser contains an invalid user ID');
    }

    if (assignedUser === '' && body.assignedUserName !== undefined && body.assignedUserName !== 'unassigned') {
        throw new ApiError(400, 'assignedUserName must be unassigned');
    }

    return {
        name: body.name.trim(),
        description: body.description === undefined ? '' : body.description,
        deadline: deadline,
        completed: body.completed === undefined ? false : body.completed,
        assignedUser: assignedUser,
        assignedUserName: body.assignedUserName
    };
}

function handleError(res, err) {
    if (err instanceof ApiError) {
        return sendResponse(res, err.status, err.message, err.data);
    }

    if (err && err.code === 11000) {
        return sendResponse(res, 400, 'A user with that email already exists', {});
    }

    if (err && (err.name === 'ValidationError' || err.name === 'CastError')) {
        return sendResponse(res, 400, 'Invalid request data', {});
    }

    return sendResponse(res, 500, 'Internal server error', {});
}

function route(handler) {
    return function (req, res) {
        Promise.resolve()
            .then(function () {
                return handler(req, res);
            })
            .catch(function (err) {
                handleError(res, err);
            });
    };
}

module.exports = {
    ApiError: ApiError,
    parseQuery: parseQuery,
    parseSelect: parseSelect,
    validateUser: validateUser,
    validateTask: validateTask,
    route: route
};
