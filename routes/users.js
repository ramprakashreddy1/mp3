var mongoose = require('mongoose');
var User = require('../models/user');
var Task = require('../models/task');
var helpers = require('./helpers');
var sendResponse = require('./response').sendResponse;
var sendNoContent = require('./response').sendNoContent;
var allowBodyFields = require('./request').allowBodyFields;
var sanitizeUserBody = allowBodyFields(['name', 'email', 'pendingTasks']);

function getUsers(req, res) {
    var options = helpers.parseQuery(req);

    if (options.count) {
        return User.countDocuments(options.where).then(function (count) {
            return sendResponse(res, 200, 'OK', count);
        });
    }

    var query = User.find(options.where)
        .sort(options.sort)
        .select(options.select)
        .skip(options.skip);

    if (options.limit !== undefined) {
        query = query.limit(options.limit);
    }

    return query.exec().then(function (users) {
        return sendResponse(res, 200, 'OK', users);
    });
}

function getUser(req, res) {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw new helpers.ApiError(404, 'User not found');
    }

    var select = helpers.parseSelect(req);

    return User.findById(req.params.id).select(select).exec().then(function (user) {
        if (!user) {
            throw new helpers.ApiError(404, 'User not found');
        }

        return sendResponse(res, 200, 'OK', user);
    });
}

function createUser(req, res) {
    var input = helpers.validateUser(req.body);

    return mongoose.connection.transaction(async function (session) {
        var duplicate = await User.findOne({ email: input.email }).session(session);

        if (duplicate) {
            throw new helpers.ApiError(400, 'A user with that email already exists');
        }

        var tasks = await Task.find({ _id: { $in: input.pendingTasks } }).session(session);

        if (tasks.length !== input.pendingTasks.length) {
            throw new helpers.ApiError(404, 'One or more tasks were not found');
        }

        if (tasks.some(function (task) { return task.completed; })) {
            throw new helpers.ApiError(400, 'Completed tasks cannot be pending');
        }

        var created = await User.create([input], { session: session });
        var user = created[0];

        if (input.pendingTasks.length > 0) {
            await User.updateMany(
                { _id: { $ne: user._id } },
                { $pull: { pendingTasks: { $in: input.pendingTasks } } },
                { session: session }
            );

            await Task.updateMany(
                { _id: { $in: input.pendingTasks } },
                { $set: { assignedUser: String(user._id), assignedUserName: user.name } },
                { session: session }
            );
        }

        return user;
    }).then(function (user) {
        return sendResponse(res, 201, 'User created', user);
    });
}

function updateUser(req, res) {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw new helpers.ApiError(404, 'User not found');
    }

    return mongoose.connection.transaction(async function (session) {
        var user = await User.findById(req.params.id).session(session);

        if (!user) {
            throw new helpers.ApiError(404, 'User not found');
        }

        var input = helpers.validateUser(req.body);
        var duplicate = await User.findOne({
            _id: { $ne: user._id },
            email: input.email
        }).session(session);

        if (duplicate) {
            throw new helpers.ApiError(400, 'A user with that email already exists');
        }

        var tasks = await Task.find({ _id: { $in: input.pendingTasks } }).session(session);

        if (tasks.length !== input.pendingTasks.length) {
            throw new helpers.ApiError(404, 'One or more tasks were not found');
        }

        if (tasks.some(function (task) { return task.completed; })) {
            throw new helpers.ApiError(400, 'Completed tasks cannot be pending');
        }

        var newTaskIds = new Set(input.pendingTasks);
        var removedTaskIds = user.pendingTasks.filter(function (id) {
            return !newTaskIds.has(id);
        });

        if (removedTaskIds.length > 0) {
            await Task.updateMany(
                { _id: { $in: removedTaskIds }, assignedUser: String(user._id) },
                { $set: { assignedUser: '', assignedUserName: 'unassigned' } },
                { session: session }
            );
        }

        if (input.pendingTasks.length > 0) {
            await User.updateMany(
                { _id: { $ne: user._id } },
                { $pull: { pendingTasks: { $in: input.pendingTasks } } },
                { session: session }
            );

            await Task.updateMany(
                { _id: { $in: input.pendingTasks } },
                { $set: { assignedUser: String(user._id), assignedUserName: input.name } },
                { session: session }
            );
        }

        await Task.updateMany(
            { assignedUser: String(user._id) },
            { $set: { assignedUserName: input.name } },
            { session: session }
        );

        user.name = input.name;
        user.email = input.email;
        user.pendingTasks = input.pendingTasks;
        await user.save({ session: session });

        return user;
    }).then(function (user) {
        return sendResponse(res, 200, 'User updated', user);
    });
}

function deleteUser(req, res) {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw new helpers.ApiError(404, 'User not found');
    }

    return mongoose.connection.transaction(async function (session) {
        var user = await User.findById(req.params.id).session(session);

        if (!user) {
            throw new helpers.ApiError(404, 'User not found');
        }

        await Task.updateMany(
            { assignedUser: String(user._id) },
            { $set: { assignedUser: '', assignedUserName: 'unassigned' } },
            { session: session }
        );

        await User.deleteOne({ _id: user._id }, { session: session });
    }).then(function () {
        return sendNoContent(res);
    });
}

module.exports = function (router) {
    router.route('/users')
        .get(helpers.route(getUsers))
        .post(sanitizeUserBody, helpers.route(createUser));

    router.route('/users/:id')
        .get(helpers.route(getUser))
        .put(sanitizeUserBody, helpers.route(updateUser))
        .delete(helpers.route(deleteUser));
};
