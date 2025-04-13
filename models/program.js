import mongoose from "mongoose";

const programSchema = mongoose.Schema({
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    activities: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Activity",
    }],
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        max: 500,
    },
    category: {
        type: String,
        required: true,
    },
    image: {
        path: {
            type: String,
            required: true,
        },
        filename: {
            type: String,
            required: true,
        }
    },
    link: {
        type: String
    },
    isPrivate: {
        type: Boolean,
        required: true,
        default: true,
    },
    isPersonal: {
        type: Boolean,
        default: false,
    },
}, { timestamps: true });

const Program = mongoose.model("Program", programSchema);

export default Program;
