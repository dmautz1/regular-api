import Activity from '../models/activity.js';
import Program from '../models/program.js';
import Subscription from '../models/subscription.js';
import User from '../models/user.js';
import Creator from '../models/creator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { saveFile, getFileUrl } from '../utils/fileUpload.js';
import { manageFutureTasks } from './tasks.js';

// Get file path for __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* CREATE */
export const createProgram = async (req, res) => {
    try {
        const { title, description, category, link, isPrivate } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ message: "Program image is required" });
        }
        
        // Define the path for remote storage
        const remotePath = `programs/${req.file.filename}`;
        
        // Save the file to the appropriate storage (local or remote)
        const filePath = await saveFile(req.file, '/public/assets/programs', remotePath);
        
        // Get the file URL
        const imagePath = getFileUrl(req.file.filename, remotePath);
        
        const newProgram = new Program({
            creator: req.user.id,
            title: title,
            description: description,
            category: category,
            image: {
                path: imagePath,
                filename: req.file.filename
            },
            link: link,
            isPrivate: isPrivate
        });
        await newProgram.save();

        res.status(201).json(newProgram);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.message });
    }
};

/* READ */
export const getProgram = async (req, res) => {
    try {
        const { programId } = req.params;
        const program = await Program.findById(programId)
            .populate({
                path: "creator",
                select: "_id email name bio avatarUrl"
            })
            .populate("activities")
            .lean();
            
        if (!program) {
            return res.status(404).json({ message: "Program not found" });
        }
        
        // Check if user is subscribed to this program
        await Subscription.findOne({ user: req.user.id, program: programId }).then((subscription) => {
            if (subscription) {
                program.isSubscribed = true;
            }
            else {
                program.isSubscribed = false;
            }
        });
        
        // Get subscription count
        const subscriberCount = await Subscription.countDocuments({ program: programId });
        program.subscriberCount = subscriberCount;
        
        res.status(200).json(program);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getFeedPrograms = async (req, res) => {
    try {
        const programs = await Program.find({ 
            isPersonal: { $ne: true } // Exclude personal programs
        })
            .populate({
                path: "creator",
                select: "_id email name bio avatarUrl"
            })
            .lean();
            
        // Add subscriber count to each program
        for (const program of programs) {
            const subscriberCount = await Subscription.countDocuments({ program: program._id });
            program.subscriberCount = subscriberCount;
        }
        
        res.status(200).json(programs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getUserPrograms = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId)
            .populate({
                path: 'subscriptions', 
                populate: { 
                    path: 'program', 
                    match: { isPersonal: { $ne: true } }, // Exclude personal programs
                    populate: { 
                        path: 'creator',
                        select: "_id email name bio avatarUrl"
                    } 
                } 
            });
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        // Filter out null programs (from the match condition)
        const filteredSubscriptions = user.subscriptions.filter(sub => sub.program);
        
        // Convert programs to plain JavaScript objects
        const programs = filteredSubscriptions.map(subscription => 
            subscription.program.toObject ? subscription.program.toObject() : subscription.program
        );
        
        // Add subscriber count to each program
        for (const program of programs) {
            const subscriberCount = await Subscription.countDocuments({ program: program._id });
            program.subscriberCount = subscriberCount;
        }
        
        res.status(200).json(programs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/* Get programs created by the logged-in user (as a creator) */
export const getCreatorPrograms = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get programs where the creator is the current user
        const programs = await Program.find({ creator: userId })
            .populate("activities")
            .lean();
            
        // Add subscriber count to each program
        for (const program of programs) {
            const subscriberCount = await Subscription.countDocuments({ program: program._id });
            program.subscriberCount = subscriberCount;
        }
        
        res.status(200).json(programs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/* Get personal program for the logged-in user */
export const getPersonalProgram = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get the personal program for this user
        const personalProgram = await Program.findOne({ 
            creator: userId,
            isPersonal: true 
        }).populate("activities");
        
        if (!personalProgram) {
            // If no personal program exists, create one
            const newPersonalProgram = new Program({
                creator: userId,
                title: "Personal Tasks",
                description: "Your personal recurring tasks",
                category: "Personal",
                image: {
                    path: '/public/assets/default-personal-program.jpg',
                    filename: 'default-personal-program.jpg'
                },
                link: "",
                isPrivate: true,
                isPersonal: true
            });
            
            await newPersonalProgram.save();
            
            // Create subscription to the personal program
            const personalSubscription = new Subscription({
                user: userId,
                program: newPersonalProgram._id
            });
            await personalSubscription.save();
            
            // Add subscription to user
            const user = await User.findById(userId);
            user.subscriptions.push(personalSubscription._id);
            await user.save();
            
            return res.status(200).json(newPersonalProgram);
        }
        
        res.status(200).json(personalProgram);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/* UPDATE */
export const editProgram = async (req, res) => {
    try {
        const { programId, title, description, category, link, isPrivate } = req.body;
        
        // Check if program exists
        const program = await Program.findById(programId);
        if (!program) {
            return res.status(404).json({ message: "Program not found" });
        }
        
        // Check if user is the creator of the program
        if (program.creator.toString() !== req.user.id) {
            return res.status(403).json({ message: "You can only edit your own programs" });
        }
        
        const file = req.file;
        const updateData = {
            title: title,
            description: description,
            category: category,
            link: link,
            isPrivate: isPrivate
        };
        
        // If a new image was uploaded
        if (file) {
            // Define the path for remote storage
            const remotePath = `programs/${file.filename}`;
            
            // Save the file to the appropriate storage (local or remote)
            const filePath = await saveFile(file, '/public/assets/programs', remotePath);
            
            // Get the file URL
            const imagePath = getFileUrl(file.filename, remotePath);
            
            updateData.image = {
                path: imagePath,
                filename: file.filename
            };
        }
        
        // Update the program
        const updatedProgram = await Program.findByIdAndUpdate(programId, updateData, { new: true });
        
        res.status(200).json(updatedProgram);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.message });
    }
};

// After the editProgram function, add the missing deleteProgram function
export const deleteProgram = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Find the program first to get the image path
        const program = await Program.findById(id);
        
        if (!program) {
            return res.status(404).json({ message: "Program not found" });
        }
        
        // Check if user is the creator of the program
        if (program.creator.toString() !== req.user.id) {
            return res.status(403).json({ message: "You can only delete your own programs" });
        }
        
        // Don't allow deleting personal programs
        if (program.isPersonal) {
            return res.status(403).json({ message: "Cannot delete personal program" });
        }
        
        // Delete the program
        const result = await Program.deleteOne({ _id: id });

        res.status(200).json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// Then add the subscribeProgram and unsubscribeProgram functions
export const subscribeProgram = async (req, res) => {
    try {
        const { programId } = req.params;
        const userId = req.user.id;

        // Check if already subscribed
        const existingSubscription = await Subscription.findOne({ user: userId, program: programId });
        if (existingSubscription) {
            return res.status(400).json({ message: "Already subscribed to this program" });
        }

        const newSubscription = new Subscription({
            user: userId,
            program: programId
        });
        
        await newSubscription.save().then(newSubscription => 
            newSubscription.populate({
                path: 'program', 
                populate: { 
                    path: 'creator',
                    select: "_id email name bio avatarUrl"
                }
            })
        );

        const user = await User.findById(userId);
        user.subscriptions.push(newSubscription._id);
        await user.save();
        
        // Populate future tasks for this program
        await manageFutureTasks(userId, programId, true);
        
        res.status(201).json(newSubscription.program);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.message });
    }
};

export const unsubscribeProgram = async (req, res) => {
    try {
        const { programId } = req.params;
        const userId = req.user.id;

        // Find the subscription
        const subscription = await Subscription.findOne({ user: userId, program: programId });
        if (!subscription) {
            return res.status(404).json({ message: "Subscription not found" });
        }

        // Find the user and remove the subscription from their list
        const user = await User.findById(userId);
        user.subscriptions = user.subscriptions.filter(s => !s.equals(subscription._id));
        await user.save();

        // Remove subscription
        await Subscription.findByIdAndDelete(subscription._id);
        
        // Handle tasks for this program - mark future tasks as deleted
        await manageFutureTasks(userId, programId, false);
        
        res.status(200).json({ message: "Unsubscribed successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};