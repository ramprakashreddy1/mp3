var mongoose = require('mongoose');
var User = require('../models/user');
var Task = require('../models/task');
var helpers = require('./helpers');
var sendResponse = require('./response').sendResponse;
var sendNoContent = require('./response').sendNoContent;
var allowBodyFields = require('./request').allowBodyFields;
var sanitizeTaskBody = allowBodyFields([
    'name',
    'description',
    'deadline',
    'completed',
    'assignedUser',
    'assignedUserName'
]);

function getTasks(req, res) {
    var options = helpers.parseQuery(req, 100);

    if (options.count) {
        return Task.countDocuments(options.where).then(function (count) {
            return sendResponse(res, 200, 'OK', count);
        });
    }

    return Task.find(options.where)
        .sort(options.sort)
        .select(options.select)
        .skip(options.skip)
        .limit(options.limit)
        .exec()
        .then(function (tasks) {
            return sendResponse(res, 200, 'OK', tasks);
        });
}

function getTask(req, res) {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw new helpers.ApiError(404, 'Task not found');
    }

    var select = helpers.parseSelect(req);

    return Task.findById(req.params.id).select(select).exec().then(function (task) {
        if (!task) {
            throw new helpers.ApiError(404, 'Task not found');
        }

        return sendResponse(res, 200, 'OK', task);
    });
}

async function getAssignedUser(input, session) {
    if (input.assignedUser === '') {
        input.assignedUserName = 'unassigned';
        return null;
    }

    var user = await User.findById(input.assignedUser).session(session);

    if (!user) {
        throw new helpers.ApiError(404, 'Assigned user not found');
    }

    if (input.assignedUserName !== undefined && input.assignedUserName !== user.name) {
        throw new helpers.ApiError(400, 'assignedUserName does not match the assigned user');
    }

    input.assignedUserName = user.name;
    return user;
}

function createTask(req, res) {
    var input = helpers.validateTask(req.body);

    return mongoose.connection.transaction(async function (session) {
        var user = await getAssignedUser(input, session);
        var created = await Task.create([input], { session: session });
        var task = created[0];

        if (user && !task.completed) {
            await User.updateOne(
                { _id: user._id },
                { $addToSet: { pendingTasks: String(task._id) } },
                { session: session }
            );
        }

        return task;
    }).then(function (task) {
        return sendResponse(res, 201, 'Task created', task);
    });
}

function updateTask(req, res) {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw new helpers.ApiError(404, 'Task not found');
    }

    return mongoose.connection.transaction(async function (session) {
        var task = await Task.findById(req.params.id).session(session);

        if (!task) {
            throw new helpers.ApiError(404, 'Task not found');
        }

        var input = helpers.validateTask(req.body);
        var user = await getAssignedUser(input, session);

        if (task.assignedUser !== '') {
            await User.updateOne(
                { _id: task.assignedUser },
                { $pull: { pendingTasks: String(task._id) } },
                { session: session }
            );
        }

        if (user && !input.completed) {
            await User.updateOne(
                { _id: user._id },
                { $addToSet: { pendingTasks: String(task._id) } },
                { session: session }
            );
        }

        task.name = input.name;
        task.description = input.description;
        task.deadline = input.deadline;
        task.completed = input.completed;
        task.assignedUser = input.assignedUser;
        task.assignedUserName = input.assignedUserName;
        await task.save({ session: session });

        return task;
    }).then(function (task) {
        return sendResponse(res, 200, 'Task updated', task);
    });
}

function deleteTask(req, res) {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw new helpers.ApiError(404, 'Task not found');
    }

    return mongoose.connection.transaction(async function (session) {
        var task = await Task.findById(req.params.id).session(session);

        if (!task) {
            throw new helpers.ApiError(404, 'Task not found');
        }

        if (task.assignedUser !== '') {
            await User.updateOne(
                { _id: task.assignedUser },
                { $pull: { pendingTasks: String(task._id) } },
                { session: session }
            );
        }

        await Task.deleteOne({ _id: task._id }, { session: session });
    }).then(function () {
        return sendNoContent(res);
    });
}

module.exports = function (router) {
    router.route('/tasks')
        .get(helpers.route(getTasks))
        .post(sanitizeTaskBody, helpers.route(createTask));

    router.route('/tasks/:id')
        .get(helpers.route(getTask))
        .put(sanitizeTaskBody, helpers.route(updateTask))
        .delete(helpers.route(deleteTask));
};
