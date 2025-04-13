import mongoose from "mongoose";

const taskSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    activity: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Activity',
    },
    title: {
        type: String,
        required: true,
    },
    complete: {
        type: Boolean,
        required: false,
    },
    dueDate: {
        type: String,
        required: true,
    },
    // Flag to track if this task was manually deleted by the user
    isDeleted: {
        type: Boolean,
        default: false
    },
}, { timestamps: true });

const Task = mongoose.model("Task", taskSchema);

export default Task;

