import Task from '../models/task.js';
import User from '../models/user.js';
import Program from '../models/program.js';
import cronParser from 'cron-parser';
import Activity from '../models/activity.js';

// Number of days to populate tasks in advance
const DAYS_TO_POPULATE = 30;

function checkDate(expression, date) {
    try {
      let data = cronParser.parseExpression(expression).fields;
      
      // Check month (always check month)
      if (!data.month.includes(date.getMonth() + 1)) {
        return false;
      }
      
      // Get the day of the week (0-6, Sunday is 0)
      const dayOfWeek = date.getDay();
      
      // If day of month or day of week is specified (not wildcard), 
      // at least one of them should match
      const isDayOfMonthWildcard = expression.split(' ')[2] === '*';
      const isDayOfWeekWildcard = expression.split(' ')[4] === '*';
      
      if (!isDayOfMonthWildcard) {
        // Day of month is specified, check if it matches
        if (data.dayOfMonth.includes(date.getDate())) {
          return true;
        }
      }
      
      if (!isDayOfWeekWildcard) {
        // Day of week is specified, check if it matches
        if (data.dayOfWeek.includes(dayOfWeek)) {
          return true;
        }
      }
      
      // If both day of month and day of week are wildcards, then any day matches
      if (isDayOfMonthWildcard && isDayOfWeekWildcard) {
        return true;
      }
      
      // If we got here, it means neither day of month nor day of week matched
      return false;
    } catch (e) {
      console.error("Error checking date with cron expression:", e);
      return false;
    }
}

/* Utility function to manage future tasks when a user subscribes/unsubscribes from a program */
export const manageFutureTasks = async (userId, programId, isSubscribing = true) => {
    try {
        // Get today's date and set to start of day
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayString = today.toISOString().split('T')[0];
        
        // Get the program with its activities
        const program = await Program.findById(programId).populate('activities');
        if (!program || !program.activities || program.activities.length === 0) {
            return;
        }
        
        if (isSubscribing) {
            // When subscribing, add tasks for the current day and next DAYS_TO_POPULATE days
            for (let i = 0; i < DAYS_TO_POPULATE; i++) {
                const targetDate = new Date(today);
                targetDate.setDate(today.getDate() + i);
                const targetDateString = targetDate.toISOString().split('T')[0];
                
                // Filter activities scheduled for this day
                const activitiesForDay = program.activities.filter(activity => 
                    checkDate(activity.cron, targetDate)
                );
                
                // Create tasks for each activity
                for (const activity of activitiesForDay) {
                    // Check if a task already exists (and wasn't deleted)
                    const existingTask = await Task.findOne({ 
                        user: userId, 
                        activity: activity._id, 
                        dueDate: targetDateString,
                        isDeleted: { $ne: true }
                    });
                    
                    // Only create if it doesn't exist
                    if (!existingTask) {
                        await Task.create({
                            user: userId,
                            activity: activity._id,
                            title: activity.title,
                            dueDate: targetDateString,
                            complete: false,
                            isDeleted: false
                        });
                    }
                }
            }
        } else {
            // When unsubscribing, mark all future tasks as deleted (don't touch past tasks)
            await Task.updateMany(
                { 
                    user: userId,
                    activity: { $in: program.activities.map(a => a._id) },
                    dueDate: { $gte: todayString },
                    isDeleted: { $ne: true }
                },
                { 
                    isDeleted: true 
                }
            );
        }
    } catch (error) {
        console.error('Error managing future tasks:', error);
        throw error;
    }
};

/* CREATE */
export const createTask = async (req, res) => {
    try {
        const { title, dueDate } = req.body;
        
        if (!title) {
            return res.status(400).json({ message: "Task title is required" });
        }
        
        console.log(`Creating task "${title}" for user ${req.user.id} due on ${dueDate}`);
        
        const newTask = new Task({
            user: req.user.id,
            title: title,
            dueDate: dueDate || new Date().toISOString().split('T')[0],
            complete: false,
            isDeleted: false
        });
        
        await newTask.save();
        console.log(`Created task with ID: ${newTask._id}`);
        
        res.status(201).json(newTask);
    } catch (error) {
        console.error("Error creating task:", error);
        res.status(500).json({ message: error.message });
    }
};

export const populateUserTasks = async (req, res) => {
    try {
        const { day } = req.body;
        const { userId } = req.params;
        
        if (!day) {
            return res.status(400).json({ message: "Day parameter is required" });
        }
        
        // Check if the requested day is in the past
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const targetDate = new Date(day);
        targetDate.setHours(0, 0, 0, 0);
        
        if (targetDate < today) {
            console.log(`Skipping task population for past date ${day}`);
            return res.status(200).json({ 
                message: "Cannot populate tasks for days in the past",
                count: 0
            });
        }
        
        console.log(`Populating tasks for user ${userId} on day ${day}`);
        
        // get all user subscription activities
        const user = await User.findById(userId).populate({
            path: 'subscriptions', 
            populate: { 
                path: 'program', 
                populate: { 
                    path: 'activities' 
                } 
            } 
        });
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        if (!user.subscriptions || user.subscriptions.length === 0) {
            console.log(`User ${userId} has no subscriptions`);
        } else {
            console.log(`User has ${user.subscriptions.length} subscriptions`);
        }
        
        // Log each program to debug
        user.subscriptions.forEach((sub, index) => {
            if (!sub.program) {
                console.log(`Subscription ${index} has no program`);
            } else {
                console.log(`Program ${sub.program._id}: ${sub.program.title} with ${sub.program.activities ? sub.program.activities.length : 0} activities`);
            }
        });
        
        const activities = user.subscriptions
            .filter(sub => sub.program) // Filter out null programs
            .map(subscription => subscription.program.activities)
            .flat()
            .filter(activity => activity); // Filter out any undefined activities
            
        console.log(`Found ${activities.length} activities across all subscribed programs`);
        
        // filter out only activities that are scheduled for the day
        const activity_list = [];
        targetDate.setHours(0, 0, 0, 0); // Ensure date is at start of day
        
        activities.forEach((activity) => {
            if (activity.cron) {
                const matches = checkDate(activity.cron, targetDate);
                console.log(`Activity ${activity._id}: "${activity.title}" with cron "${activity.cron}" - Matches: ${matches}`);
                if (matches) {
                    activity_list.push(activity);
                }
            } else {
                console.log(`Activity ${activity._id} has no cron expression`);
            }
        });
        
        console.log(`Found ${activity_list.length} activities scheduled for ${day}`);
        
        // Process each activity
        const createdTasks = [];
        for (const activity of activity_list) {
            // Check if this task was previously deleted by the user
            const existingTask = await Task.findOne({ 
                user: userId, 
                activity: activity._id, 
                dueDate: day
            });
            
            // Log the task status
            if (existingTask) {
                if (existingTask.isDeleted) {
                    console.log(`Task for activity ${activity._id} exists but was previously deleted`);
                } else {
                    console.log(`Task for activity ${activity._id} already exists`);
                }
            } else {
                console.log(`Creating new task for activity ${activity._id}`);
            }
            
            // Only create or update the task if it doesn't exist or isn't marked as deleted
            if (!existingTask || !existingTask.isDeleted) {
                const newTask = await Task.findOneAndUpdate(
                    { 
                        user: userId, 
                        activity: activity._id, 
                        dueDate: day,
                        isDeleted: { $ne: true } // Don't update tasks that were deleted
                    }, 
                    { 
                        user: userId, 
                        activity: activity._id, 
                        title: activity.title, 
                        dueDate: day,
                        isDeleted: false // Ensure it's not marked as deleted
                    }, 
                    { upsert: true, new: true }
                );
                createdTasks.push(newTask);
            }
        }
        
        console.log(`Successfully processed ${createdTasks.length} tasks for day ${day}`);
        
        res.status(200).json({ 
            message: "Tasks populated for day",
            count: createdTasks.length
        });
    } catch (error) {
        console.error("Error populating tasks:", error);
        res.status(500).json({ message: error.message });
    }
};


/* READ */
export const getFeedTasks = async (req, res) => {
    try {
        const userId = req.user.id;
        const { day } = req.query;
        
        if (!day) {
            return res.status(400).json({ message: "Day parameter is required" });
        }
        
        console.log(`Fetching tasks for user ${userId} on day ${day}`);
        
        // Find tasks for this user on this day
        const tasks = await Task.find({ 
            user: userId, 
            dueDate: day,
            isDeleted: { $ne: true } // Exclude deleted tasks
        });
        
        console.log(`Found ${tasks.length} tasks for day ${day}`);
        
        res.status(200).json(tasks);
    } catch (error) {
        console.error("Error fetching tasks:", error);
        res.status(500).json({ message: error.message });
    }
};

export const getUserTasks = async (req, res) => {
    try {
        const { userId, day } = req.params;
        const currentUserId = req.user.id;
        
        // Security check: only allow users to view their own tasks
        // (or admins, which could be added with additional role checking)
        if (userId !== currentUserId) {
            return res.status(403).json({ message: "Not authorized to view these tasks" });
        }
        
        const tasks = await Task.find({ 
            user: userId, 
            dueDate: day,
            isDeleted: { $ne: true } // Exclude deleted tasks
        });
        res.status(200).json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


/* UPDATE */
export const completeTask = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        // Find the task and ensure it belongs to the current user
        const task = await Task.findOne({
            _id: id,
            user: userId
        });
        
        if (!task) {
            return res.status(404).json({ message: "Task not found or not authorized" });
        }
        
        const isComplete = task.complete;
        
        const updatedTask = await Task.findByIdAndUpdate(
            id,
            { complete: !isComplete },
            { new: true }
        );

        res.status(200).json(updatedTask);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteTask = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        // Find the task and ensure it belongs to the current user
        const task = await Task.findOne({
            _id: id,
            user: userId
        });
        
        if (!task) {
            return res.status(404).json({ message: "Task not found or not authorized" });
        }
        
        if (task.activity) {
            // If the task is from a program activity, mark it as deleted instead of removing it
            const updatedTask = await Task.findByIdAndUpdate(
                id,
                { isDeleted: true },
                { new: true }
            );
            res.status(200).json({ deletedCount: 1, task: updatedTask });
        } else {
            // For regular tasks, actually delete them from the database
            const result = await Task.deleteOne({ _id: id });
            res.status(200).json(result);
        }
        
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
