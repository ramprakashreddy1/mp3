var mongoose = require('mongoose');

function castDeadline(value) {
    var date;

    if (value instanceof Date) {
        date = value;
    } else if (typeof value === 'string' && value.trim() !== '') {
        date = new Date(value);
    } else {
        throw new TypeError('deadline must be a date string');
    }

    if (Number.isNaN(date.getTime())) {
        throw new TypeError('deadline must be a valid date');
    }

    return date;
}

var TaskSchema = new mongoose.Schema({
    name: {
        type: String,
        cast: false,
        required: true,
        trim: true
    },
    description: {
        type: String,
        cast: false,
        default: '',
        validate: {
            validator: function (description) {
                return typeof description === 'string';
            },
            message: 'description must be a string'
        }
    },
    deadline: {
        type: Date,
        cast: castDeadline,
        required: true
    },
    completed: {
        type: Boolean,
        cast: false,
        default: false,
        validate: {
            validator: function (completed) {
                return typeof completed === 'boolean';
            },
            message: 'completed must be a boolean'
        }
    },
    assignedUser: {
        type: String,
        cast: false,
        default: '',
        validate: {
            validator: function (userId) {
                return userId === '' || mongoose.isObjectIdOrHexString(userId);
            },
            message: 'assignedUser must be empty or a valid user ID'
        }
    },
    assignedUserName: {
        type: String,
        cast: false,
        default: 'unassigned',
        validate: {
            validator: function (userName) {
                return typeof userName === 'string';
            },
            message: 'assignedUserName must be a string'
        }
    }
}, {
    timestamps: {
        createdAt: 'dateCreated',
        updatedAt: false
    },
    versionKey: false
});

// Ignore a client-supplied creation date. Mongoose also marks this timestamp
// immutable, so normal document updates cannot change it later.
TaskSchema.pre('validate', function () {
    if (this.isNew) {
        this.dateCreated = new Date();
    }
});

module.exports = mongoose.model('Task', TaskSchema);
