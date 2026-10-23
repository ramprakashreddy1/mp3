var mongoose = require('mongoose');

var UserSchema = new mongoose.Schema({
    name: {
        type: String,
        cast: false,
        required: true,
        trim: true
    },
    email: {
        type: String,
        cast: false,
        required: true,
        unique: true,
        trim: true
    },
    pendingTasks: {
        type: [{
            type: String,
            cast: false
        }],
        castNonArrays: false,
        default: [],
        validate: {
            validator: function (taskIds) {
                return Array.isArray(taskIds) && taskIds.every(function (taskId) {
                    return mongoose.isObjectIdOrHexString(taskId);
                });
            },
            message: 'pendingTasks must contain valid task IDs'
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
UserSchema.pre('validate', function () {
    if (this.isNew) {
        this.dateCreated = new Date();
    }
});

module.exports = mongoose.model('User', UserSchema);
