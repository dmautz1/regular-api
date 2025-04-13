import mongoose from "mongoose";

const creatorSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    programs: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Program',
    }],
    name: {
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
    description: {
        type: String,
        max: 500,
    },
    link: {
        type: String
    }
}, { timestamps: true });

const Creator = mongoose.model("Creator", creatorSchema);

export default Creator;
