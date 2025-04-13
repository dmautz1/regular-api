import Activity from '../models/activity.js';
import Program from '../models/program.js';
import mongoose from 'mongoose';
import { manageFutureTasks } from './tasks.js';

/* CREATE */
export const createActivity = async (req, res) => {
    try {
        const { programId, activities } = req.body;
        
        if (!programId) {
            return res.status(400).json({ message: "Program ID is required" });
        }
        
        if (!activities || !Array.isArray(activities) || activities.length === 0) {
            return res.status(400).json({ message: "At least one activity is required" });
        }
        
        console.log(`Creating ${activities.length} activities for program ${programId}`);
        
        // Check that activities have the required fields
        for (const activity of activities) {
            if (!activity.title) {
                return res.status(400).json({ message: "Activity title is required" });
            }
            if (!activity.cron) {
                return res.status(400).json({ message: "Activity cron expression is required" });
            }
        }
        
        const bulkOps = activities.map(activity => ({
            updateOne: {
                filter: { _id: activity._id ?? new mongoose.Types.ObjectId() },
                update: { 
                    $set: { 
                        program: programId, 
                        title: activity.title, 
                        description: activity.description || 'Recurring activity', 
                        cron: activity.cron 
                    } 
                },
                upsert: true,
                returnNewDocument: true
            }
        }));
        
        const result = await Activity.bulkWrite(bulkOps);
        console.log(`Created/updated ${Object.keys(result.upsertedIds || {}).length} activities`);

        // Get all activity IDs from this operation
        const activityIds = activities
            .filter(activity => activity._id)
            .map(activity => activity._id)
            .concat(Object.values(result.upsertedIds || {}));
            
        // Update the program with the activity IDs
        await Program.findByIdAndUpdate(
            programId, 
            { $addToSet: { activities: { $each: activityIds } } }
        );
        
        // Get the updated program
        const program = await Program.findById(programId).populate('activities');
        
        // If this is the user's personal program, update their future tasks
        if (program.isPersonal) {
            try {
                // Get the userId from the program's creator field
                const userId = program.creator.toString();
                console.log(`Updating future tasks for user ${userId} after creating recurring activities`);
                
                // Use manageFutureTasks to populate all future tasks for this program
                await manageFutureTasks(userId, programId, true);
                console.log('Future tasks updated successfully');
            } catch (error) {
                console.error('Error updating future tasks:', error);
                // Don't fail the request if task population fails
            }
        }
        
        res.status(201).json(program);
    } catch (error) {
        console.error("Error creating activities:", error);
        res.status(500).json({ message: error.message });
    }
};

/* READ */
export const getActivity = async (req, res) => {
    try {
        const { activityId } = req.params;
        const activity = await Activity.find({ activityId: activityId });
        res.status(200).json(activity);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getProgramActivities = async (req, res) => {
    try {
        const { programId } = req.params;
        
        if (!programId) {
            return res.status(400).json({ message: "Program ID is required" });
        }
        
        console.log(`Getting activities for program: ${programId}`);
        
        const activities = await Activity.find({ program: programId });
        console.log(`Found ${activities.length} activities for program ${programId}`);
        
        res.status(200).json(activities);
    } catch (error) {
        console.error("Error getting program activities:", error);
        res.status(500).json({ message: error.message });
    }
};

/* UPDATE */
export const editActivity = async (req, res) => {
    try {
        const { activityId, title, description, cron } = req.params;        
        const updatedActivity = await Activity.findByIdAndUpdate(
            activityId,
            { title: title, description: description, cron: cron },
            { new: true }
        );

        res.status(200).json(updatedActivity);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteActivity = async (req, res) => {
    try {
        const { activityId } = req.params;
        const result = await Activity.deleteOne({ _id: activityId });

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
