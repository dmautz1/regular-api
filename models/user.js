import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            max: 50,
            unique: true
        },
        password: {
            type: String,
            required: true,
            min: 6
        },
        name: {
            type: String,
            default: ""
        },
        bio: {
            type: String,
            default: ""
        },
        avatarUrl: {
            type: String,
            default: ""
        },
        subscriptions: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Subscription',
        }],
        tasks: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Task',
        }]
    },
    { timestamps: true }
)

const User = mongoose.model("User", UserSchema);
export default User;