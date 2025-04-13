import User from '../models/user.js';
import Creator from '../models/creator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { saveFile, getFileUrl } from '../utils/fileUpload.js';

// Get file path for __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* READ */
export const getUser = async (req, res) => {
    try {
        // Use authenticated user's ID if accessing through /profile endpoint
        const id = req.path === '/profile' ? req.user.id : req.params.id;
        const user = await User.findById(id);
        
        // Don't send password to client
        const userResponse = {
            _id: user._id,
            email: user.email,
            name: user.name || '',
            bio: user.bio || '',
            avatarUrl: user.avatarUrl || '',
            subscriptions: user.subscriptions,
            tasks: user.tasks,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };
        
        res.status(200).json(userResponse);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getUserFriends = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);

        const friends = await Promise.all(
            user.friends.map((id) => User.findById(id))
        );
        const formattedFriends = friends.map(
            ({ _id, firstName, lastName, occupation, picturePath }) => {
                return { _id, firstName, lastName, occupation, picturePath };
            }
        );
        res.status(200).json(formattedFriends);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/* UPDATE */
export const addRemoveFriend = async (req, res) => {
    try {
        const { id, friendId } = req.params;
        const user = await User.findById(id);
        const friend = await User.findById(friendId);

        if (user.friends.includes(friendId)) {
            user.friends = user.friends.filter((id) => id !== friendId);
            friend.friends = friend.friends.filter((id) => id !== id);
        } else {
            user.friends.push(friendId);
            friend.friends.push(id);
        }
        await user.save();
        await friend.save();

        const friends = await Promise.all(
            user.friends.map((id) => User.findById(id))
        );
        const formattedFriends = friends.map(
            ({ _id, firstName, lastName, occupation, picturePath }) => {
                return { _id, firstName, lastName, occupation, picturePath };
            }
        );
        res.status(200).json(formattedFriends);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/* CREATOR FUNCTIONS */
export const becomeCreator = async (req, res) => {
    try {
        const { name, description, link } = req.body;
        const userId = req.user.id;

        // Check if user already has a creator profile
        const existingCreator = await Creator.findOne({ user: userId });
        if (existingCreator) {
            return res.status(400).json({ message: "User already has a creator profile" });
        }

        let imagePath = 'public/assets/default-creator.jpg';
        let filename = 'default-creator.jpg';

        // If a file was uploaded
        if (req.file) {
            // Define the path for remote storage
            const remotePath = `creators/${req.file.filename}`;
            
            // Save the file to the appropriate storage (local or remote)
            await saveFile(req.file, '/public/assets/creators', remotePath);
            
            // Get the file URL
            imagePath = getFileUrl(req.file.filename, remotePath);
            filename = req.file.filename;
        }

        // Create new creator profile
        const newCreator = new Creator({
            user: userId,
            name: name,
            description: description,
            link: link,
            image: {
                path: imagePath,
                filename: filename
            },
            programs: []
        });

        await newCreator.save();
        res.status(201).json(newCreator);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

export const getCreatorProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const creator = await Creator.findOne({ user: userId }).populate("programs");
        
        if (!creator) {
            return res.status(404).json({ message: "Creator profile not found" });
        }
        
        res.status(200).json(creator);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateCreatorProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, description, link } = req.body;
        
        const creator = await Creator.findOne({ user: userId });
        if (!creator) {
            return res.status(404).json({ message: "Creator profile not found" });
        }
        
        // Update fields
        if (name) creator.name = name;
        if (description) creator.description = description;
        if (link) creator.link = link;
        
        // If a new image was uploaded
        if (req.file) {
            // Define the path for remote storage
            const remotePath = `creators/${req.file.filename}`;
            
            // Save the file to the appropriate storage (local or remote)
            await saveFile(req.file, '/public/assets/creators', remotePath);
            
            // Get the file URL
            const imagePath = getFileUrl(req.file.filename, remotePath);
            
            creator.image = {
                path: imagePath,
                filename: req.file.filename
            };
        }
        
        await creator.save();
        res.status(200).json(creator);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/* PROFILE UPDATES */
export const updateUserProfile = async (req, res) => {
    try {
        // Use authenticated user's ID if accessing through /profile endpoint
        const id = req.path === '/profile' ? req.user.id : req.params.id;
        const { name, bio } = req.body;
        
        // Check if user is updating their own profile
        if (id !== req.user.id) {
            return res.status(403).json({ message: "You can only update your own profile" });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Update fields if provided
        if (name !== undefined) user.name = name;
        if (bio !== undefined) user.bio = bio;
        
        await user.save();
        
        // Return updated user without password
        const userResponse = {
            _id: user._id,
            email: user.email,
            name: user.name,
            bio: user.bio,
            avatarUrl: user.avatarUrl,
            subscriptions: user.subscriptions,
            tasks: user.tasks,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };
        
        res.status(200).json(userResponse);
    } catch (error) {
        console.error("Error updating user profile:", error);
        res.status(500).json({ message: error.message });
    }
};

export const uploadUserAvatar = async (req, res) => {
    try {
        // Use authenticated user's ID if accessing through /avatar endpoint
        const id = req.path === '/avatar' ? req.user.id : req.params.id;
        
        // Check if user is updating their own avatar
        if (id !== req.user.id) {
            // Remove the uploaded file if it exists
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(403).json({ message: "You can only update your own avatar" });
        }

        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({ message: "No avatar file uploaded" });
        }

        // Get user
        const user = await User.findById(id);
        if (!user) {
            // Remove the uploaded file
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ message: "User not found" });
        }

        // If user already has an avatar, delete the old one
        if (user.avatarUrl) {
            try {
                // Extract the filename from the avatarUrl
                const oldAvatarPath = user.avatarUrl.replace('http://localhost:3001/', '');
                const fullPath = path.join(__dirname, '..', oldAvatarPath);
                
                // Only delete if it's in the avatars directory (safety check)
                if (oldAvatarPath.includes('avatars') && fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                }
            } catch (unlinkError) {
                console.error("Error deleting old avatar:", unlinkError);
                // Continue with the update even if old file deletion fails
            }
        }

        // Update user with new avatar
        const relativePath = req.file.path.replace(/\\/g, '/');
        user.avatarUrl = `http://localhost:3001/${relativePath}`;
        await user.save();

        res.status(200).json({ 
            message: "Avatar uploaded successfully",
            avatarUrl: user.avatarUrl
        });
    } catch (error) {
        // If there's an error, delete the uploaded file
        if (req.file) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (unlinkError) {
                console.error("Error deleting avatar file after error:", unlinkError);
            }
        }
        
        console.error("Error uploading avatar:", error);
        res.status(500).json({ message: error.message });
    }
};
