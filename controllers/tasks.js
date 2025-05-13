import { supabase, createAuthenticatedClient } from '../utils/db.js';
import { formatErrorResponse } from '../utils/formatResponse.js';
import { createClient } from '@supabase/supabase-js';
import config from '../config/config.js';

/* CREATE */
export const createTask = async (req, res) => {
    try {
        const { title, description, dueDate, priority = 'medium', isRecurring, recurringDays, isSticky } = req.body;
        
        if (!title) {
            return res.status(400).json(formatErrorResponse("Task title is required"));
        }
        
        console.log(`Creating task "${title}" for user ${req.user.id} due on ${dueDate}`);
        
        // Get the user's JWT token from the Authorization header
        const token = req.header("Authorization").replace("Bearer ", "");
        const userSupabase = createAuthenticatedClient(token);

        if (isRecurring && recurringDays && recurringDays.length > 0) {
            // For recurring tasks, we need to create an activity in the user's personal program
            // First, get the user's personal program
            const { data: personalProgram, error: programError } = await userSupabase
                .from('programs')
                .select('id')
                .eq('creator_id', req.user.id)
                .eq('is_personal', true)
                .single();

            if (programError) {
                console.error("Error fetching personal program:", programError);
                return res.status(400).json({ message: "Could not find personal program" });
            }

            // Create cron expression from selected days
            // Format: "0 12 * * 1,3,5" for noon on Monday, Wednesday, Friday
            const days = recurringDays.join(',');
            const cronExpression = `0 12 * * ${days}`;

            // Create the activity
            const { data: activity, error: activityError } = await userSupabase
                .from('activities')
                .insert({
                    program_id: personalProgram.id,
                    title: title,
                    description: description || 'Recurring personal task',
                    cron: cronExpression,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (activityError) {
                console.error("Error creating activity:", activityError);
                return res.status(400).json({ message: "Could not create recurring activity" });
            }

            console.log(`Created recurring task successfully`);
            res.status(201).json({ message: "Recurring task created successfully" });
        } else {
            // Handle regular non-recurring task
            const { error } = await userSupabase
                .from('tasks')
                .insert({
                    title,
                    description: description || '',
                    user_id: req.user.id,
                    due_date: dueDate,
                    is_completed: false,
                    is_sticky: isSticky || false,
                    priority: priority,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
            
            if (error) {
                console.error("Error inserting task:", error);
                return res.status(400).json({ message: error.message });
            }
            
            console.log(`Created task successfully`);
            res.status(201).json({ message: "Task created successfully" });
        }
    } catch (error) {
        console.error("Error creating task:", error);
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
        
        // Get the user's JWT token from the Authorization header
        const token = req.header("Authorization").replace("Bearer ", "");
        const userSupabase = createAuthenticatedClient(token);
        
        // Find tasks for this user on this day from Supabase
        const { data: tasks, error } = await userSupabase
            .from('tasks')
            .select(`
                *,
                activity:activity_id(*),
                program:program_id(
                    id,
                    title,
                    creator_id,
                    is_personal
                )
            `)
            .eq('user_id', userId)
            .eq('due_date', day)
            .is('is_deleted', false) // Exclude deleted tasks
            .order('created_at', { ascending: true });
        
        if (error) {
            console.error("Error fetching tasks:", error);
            return res.status(400).json({ message: error.message });
        }
        
        console.log(`Found ${tasks?.length || 0} tasks for day ${day}`);
        
        res.status(200).json(tasks || []);
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
        
        // Get the user's JWT token from the Authorization header
        const token = req.header("Authorization").replace("Bearer ", "");
        const userSupabase = createAuthenticatedClient(token);
        
        // Get tasks from Supabase
        const { data: tasks, error } = await userSupabase
            .from('tasks')
            .select('*')
            .eq('user_id', userId)
            .eq('due_date', day)
            .is('is_deleted', false); // Exclude deleted tasks
        
        if (error) {
            console.error("Error fetching tasks:", error);
            return res.status(400).json({ message: error.message });
        }
        
        res.status(200).json(tasks);
    } catch (error) {
        console.error("Error fetching tasks:", error);
        res.status(500).json({ message: error.message });
    }
};

/* UPDATE */
export const completeTask = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        if (!id) {
            return res.status(400).json({ message: "Task ID is required" });
        }
        
        console.log(`Completing task ${id} for user ${userId}`);
        
        // Get the user's JWT token from the Authorization header
        const token = req.header("Authorization").replace("Bearer ", "");
        const userSupabase = createAuthenticatedClient(token);
        
        // First check if the task exists and belongs to the user
        const { data: task, error: fetchError } = await userSupabase
            .from('tasks')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single();
            
        if (fetchError) {
            console.error("Error fetching task:", fetchError);
            return res.status(404).json({ message: "Task not found or not authorized" });
        }
        
        // Toggle the completion status
        const isComplete = task.is_completed;
        const completedAt = !isComplete ? new Date().toISOString() : null;
        
        // Update the task
        const { data: updatedTask, error: updateError } = await userSupabase
            .from('tasks')
            .update({ 
                is_completed: !isComplete,
                completed_at: completedAt,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();
            
        if (updateError) {
            console.error("Error updating task:", updateError);
            return res.status(400).json({ message: updateError.message });
        }
        
        res.status(200).json(updatedTask);
    } catch (error) {
        console.error("Error completing task:", error);
        res.status(500).json({ message: error.message });
    }
};

export const deleteTask = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        // Get the user's JWT token from the Authorization header
        const token = req.header("Authorization").replace("Bearer ", "");
        const userSupabase = createAuthenticatedClient(token);
        
        // First check if the task exists and belongs to the user
        const { data: task, error: fetchError } = await userSupabase
            .from('tasks')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single();
        
        if (fetchError) {
            console.error("Error fetching task:", fetchError);
            return res.status(fetchError.code === 'PGRST116' ? 404 : 400).json({ 
                message: fetchError.code === 'PGRST116' ? "Task not found or not authorized" : fetchError.message 
            });
        }
        
        if (task.activity_id) {
            // If the task is from a program activity, mark it as deleted instead of removing it
            const { data: updatedTask, error: updateError } = await userSupabase
                .from('tasks')
                .update({ 
                    is_deleted: true,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();
            
            if (updateError) {
                console.error("Error updating task:", updateError);
                return res.status(400).json({ message: updateError.message });
            }
            
            res.status(200).json({ deletedCount: 1, task: updatedTask });
        } else {
            // For regular tasks, actually delete them from the database
            const { error: deleteError } = await userSupabase
                .from('tasks')
                .delete()
                .eq('id', id);
            
            if (deleteError) {
                console.error("Error deleting task:", deleteError);
                return res.status(400).json({ message: deleteError.message });
            }
            
            res.status(200).json({ deletedCount: 1 });
        }
    } catch (error) {
        console.error("Error deleting task:", error);
        res.status(500).json({ message: error.message });
    }
};

export const populateUserTasks = async (req, res) => {
    try {
        const { day } = req.body;
        const userId = req.user.id;
        
        if (!day) {
            return res.status(400).json({ message: "Day parameter is required" });
        }
        
        console.log(`Populating tasks for user ${userId} on day ${day}`);
        
        // Get the user's JWT token from the Authorization header
        const token = req.header("Authorization").replace("Bearer ", "");
        
        // Create a new Supabase client with the user's token
        const userSupabase = createClient(
            config.supabase.url,
            config.supabase.anonKey,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                    detectSessionInUrl: false
                },
                global: {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            }
        );

        // Check if the target day is in the future
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const targetDate = new Date(day);
        targetDate.setHours(0, 0, 0, 0);
        const isFutureDay = targetDate > today;

        // Only move incomplete sticky tasks if the target day is not in the future
        if (!isFutureDay) {
            // First, move incomplete sticky tasks from previous days to the current day
            const { data: incompleteStickyTasks, error: stickyError } = await userSupabase
                .from('tasks')
                .select('*')
                .eq('user_id', userId)
                .eq('is_sticky', true)
                .eq('is_completed', false)
                .lt('due_date', day); // Only get tasks from previous days

            if (stickyError) {
                console.error("Error fetching sticky tasks:", stickyError);
                return res.status(400).json({ message: stickyError.message });
            }

            // Update due dates for incomplete sticky tasks
            for (const task of incompleteStickyTasks) {
                const { error: updateError } = await userSupabase
                    .from('tasks')
                    .update({ 
                        due_date: day,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', task.id);

                if (updateError) {
                    console.error("Error updating sticky task:", updateError);
                    continue;
                }
            }
        }

        // Get all user subscriptions and related programs
        const { data: subscriptions, error: subError } = await userSupabase
            .from('subscriptions')
            .select(`
                id,
                program:program_id (
                    id,
                    title,
                    creator_id,
                    activities:activities (
                        id,
                        program_id,
                        title,
                        description,
                        cron
                    )
                )
            `)
            .eq('user_id', userId);
        
        if (subError) {
            console.error("Error fetching subscriptions:", subError);
            return res.status(400).json({ message: subError.message });
        }
        
        // Collect all activities from subscribed programs
        const allActivities = [];
        for (const subscription of subscriptions) {
            if (subscription.program && subscription.program.activities) {
                allActivities.push(...subscription.program.activities);
            }
        }
        
        console.log(`Found ${allActivities.length} activities across all subscribed programs`);
        
        // Filter activities scheduled for the target date
        const scheduledActivities = allActivities.filter(activity => {
            if (!activity.cron) return false;
            
            try {
                // Parse the cron expression
                const cronParts = activity.cron.split(' ');
                if (cronParts.length !== 5) return false;
                
                // Get the day of week (0-6, Sunday is 0)
                const dayOfWeek = targetDate.getDay();
                
                // Check if the day matches the cron expression
                const dayPart = cronParts[4];
                if (dayPart === '*') return true;
                
                const days = dayPart.split(',').map(d => parseInt(d));
                return days.includes(dayOfWeek);
            } catch (error) {
                console.error(`Error parsing cron expression for activity ${activity.id}:`, error);
                return false;
            }
        });
        
        console.log(`Found ${scheduledActivities.length} activities scheduled for ${day}`);
        
        // Process each scheduled activity
        const createdTasks = [];
        for (const activity of scheduledActivities) {
            // Check if this activity's task already exists
            const { data: existingTasks, error: checkError } = await userSupabase
                .from('tasks')
                .select('*')
                .eq('user_id', userId)
                .eq('activity_id', activity.id)
                .eq('due_date', day)
                .limit(1);
                
            if (checkError) {
                console.error("Error checking existing task:", checkError);
                continue; // Skip to next activity
            }
            
            // Only create task if it doesn't exist or isn't deleted
            if (existingTasks.length === 0) {
                // Upsert task for this activity
                const { data: newTask, error: upsertError } = await userSupabase
                    .from('tasks')
                    .upsert({
                        id: existingTasks.length > 0 ? existingTasks[0].id : undefined,
                        user_id: userId,
                        activity_id: activity.id,
                        program_id: activity.program_id,
                        title: activity.title,
                        description: activity.description || '',
                        due_date: day,
                        is_completed: existingTasks.length > 0 ? existingTasks[0].is_completed : false,
                        is_deleted: false,
                        updated_at: new Date().toISOString()
                    })
                    .select()
                    .single();
                
                if (upsertError) {
                    console.error("Error upserting task:", upsertError);
                    continue;
                }
                
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

export const updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, dueDate, isSticky, isRecurring, recurringDays, isEditingRecurrence } = req.body;
        const userId = req.user.id;
        
        if (!id) {
            return res.status(400).json({ message: "Task ID is required" });
        }
        
        console.log(`Updating task ${id} for user ${userId}`);
        
        // Get the user's JWT token from the Authorization header
        const token = req.header("Authorization").replace("Bearer ", "");
        const userSupabase = createAuthenticatedClient(token);
        
        // First check if the task exists and belongs to the user
        const { data: task, error: fetchError } = await userSupabase
            .from('tasks')
            .select('*, activity:activity_id(*)')
            .eq('id', id)
            .eq('user_id', userId)
            .single();
            
        if (fetchError) {
            console.error("Error fetching task:", fetchError);
            return res.status(404).json({ message: "Task not found or not authorized" });
        }

        // If task is from a program activity and is recurring, don't allow changes to recurring settings
        if (task.activity_id && task.activity.program_id) {
            const { data: program } = await userSupabase
                .from('programs')
                .select('is_personal')
                .eq('id', task.activity.program_id)
                .single();

            if (!program.is_personal && (isRecurring !== undefined || recurringDays)) {
                return res.status(403).json({ 
                    message: "Cannot modify recurring settings for program tasks" 
                });
            }
        }

        // If it's a recurring task and we're editing the recurrence
        if (isEditingRecurrence && task.activity_id) {
            // Create cron expression from selected days
            const days = Object.entries(recurringDays)
                .filter(([_, isSelected]) => isSelected)
                .map(([day]) => day)
                .join(',');
            const cronExpression = `0 12 * * ${days}`;

            // Update the activity
            const { error: activityError } = await userSupabase
                .from('activities')
                .update({
                    cron: cronExpression,
                    updated_at: new Date().toISOString()
                })
                .eq('id', task.activity_id);

            if (activityError) {
                console.error("Error updating activity:", activityError);
                return res.status(400).json({ message: activityError.message });
            }

            // Get all future tasks for this activity
            const { data: futureTasks, error: fetchTasksError } = await userSupabase
                .from('tasks')
                .select('*')
                .eq('activity_id', task.activity_id)
                .gt('due_date', new Date().toISOString().split('T')[0]);

            if (fetchTasksError) {
                console.error("Error fetching future tasks:", fetchTasksError);
                return res.status(400).json({ message: fetchTasksError.message });
            }

            // Update tasks that match the new pattern
            const tasksToUpdate = [];
            const tasksToDelete = [];

            for (const futureTask of futureTasks) {
                const taskDate = new Date(futureTask.due_date);
                const dayOfWeek = taskDate.getDay();
                const dayMatches = days.split(',').includes(dayOfWeek.toString());

                if (dayMatches) {
                    tasksToUpdate.push(futureTask.id);
                } else {
                    tasksToDelete.push(futureTask.id);
                }
            }

            // Update matching tasks
            if (tasksToUpdate.length > 0) {
                const { error: updateError } = await userSupabase
                    .from('tasks')
                    .update({ 
                        title: title || task.title,
                        description: description || task.description,
                        is_sticky: isSticky !== undefined ? isSticky : task.is_sticky,
                        updated_at: new Date().toISOString()
                    })
                    .in('id', tasksToUpdate);

                if (updateError) {
                    console.error("Error updating future tasks:", updateError);
                    return res.status(400).json({ message: updateError.message });
                }
            }

            // Delete tasks that no longer match the pattern
            if (tasksToDelete.length > 0) {
                const { error: deleteError } = await userSupabase
                    .from('tasks')
                    .delete()
                    .in('id', tasksToDelete);

                if (deleteError) {
                    console.error("Error deleting future tasks:", deleteError);
                    return res.status(400).json({ message: deleteError.message });
                }
            }
        }
        
        // Update the current task
        const { data: updatedTask, error: updateError } = await userSupabase
            .from('tasks')
            .update({ 
                title: title || task.title,
                description: description || task.description,
                due_date: dueDate || task.due_date,
                is_sticky: isSticky !== undefined ? isSticky : task.is_sticky,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();
            
        if (updateError) {
            // If it's a "no rows returned" error and we're editing recurrence, that's okay
            if (updateError.code === 'PGRST116' && isEditingRecurrence) {
                // Return the original task data since we've already updated the activity and future tasks
                res.status(200).json(task);
                return;
            }
            console.error("Error updating task:", updateError);
            return res.status(400).json({ message: updateError.message });
        }
        
        res.status(200).json(updatedTask || task);
    } catch (error) {
        console.error("Error updating task:", error);
        res.status(500).json({ message: error.message });
    }
};

export default {
    createTask,
    getFeedTasks,
    getUserTasks,
    completeTask,
    deleteTask,
    populateUserTasks,
    updateTask
}; 