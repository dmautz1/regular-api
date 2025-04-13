import mongoose from "mongoose";

const activitySchema = mongoose.Schema({
    program: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Program',
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        max: 500,
    },
    cron: {
        type: String,
        required: true,
    },
}, { timestamps: true });

const Activity = mongoose.model("Activity", activitySchema);

export default Activity;

