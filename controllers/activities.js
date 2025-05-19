import { supabase, createAuthenticatedClient } from '../utils/db.js';
import { formatErrorResponse } from '../utils/formatResponse.js';

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
        
        // Get the user's JWT token from the Authorization header
        const token = req.header("Authorization").replace("Bearer ", "");
        const userSupabase = createAuthenticatedClient(token);
        
        // Check if program exists and user has access
        const { data: program, error: programError } = await userSupabase
            .from('programs')
            .select('*')
            .eq('id', programId)
            .single();
            
        if (programError) {
            console.error('Error fetching program:', programError);
            return res.status(404).json({ message: "Program not found" });
        }
        
        // Verify user has access to the program
        if (program.creator_id !== req.user.id) {
            return res.status(403).json({ message: "Not authorized to modify this program" });
        }
        
        const activitiesWithData = [];
        
        for (const activity of activities) {
            if (!activity.title) {
                return res.status(400).json({ message: "Activity title is required" });
            }
            
            if (!activity.cron) {
                return res.status(400).json({ message: "Activity cron expression is required" });
            }
            
            const activityData = {
                program_id: programId,
                title: activity.title,
                description: activity.description || '',
                cron: activity.cron,
                is_deleted: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            if (activity.id) {
                // Update existing activity
                activityData.id = activity.id;
            }
            
            activitiesWithData.push(activityData);
        }
        
        // Insert or update activities
        const { data: savedActivities, error: saveError } = await userSupabase
            .from('activities')
            .upsert(activitiesWithData, { 
                onConflict: 'id',
                returning: 'representation'
            })
            .select('*');
            
        if (saveError) {
            console.error('Error saving activities:', saveError);
            return res.status(500).json({ message: "Error saving activities" });
        }
        
        res.status(200).json({
            message: "Activities created successfully",
            activities: savedActivities
        });
    } catch (error) {
        console.error('Error in createActivity:', error);
        res.status(500).json({ message: "Internal server error" });
    }
};

/* READ */
export const getActivity = async (req, res) => {
    try {
        const { activityId } = req.params;
        const userId = req.user.id;
        
        // Get the user's JWT token from the Authorization header
        const token = req.header("Authorization").replace("Bearer ", "");
        const userSupabase = createAuthenticatedClient(token);
        
        // Get the activity
        const { data: activity, error } = await userSupabase
            .from('activities')
            .select(`
                *,
                program:program_id (*)
            `)
            .eq('id', activityId)
            .eq('is_deleted', false)
            .single();
            
        if (error) {
            console.error('Error fetching activity:', error);
            return res.status(404).json(formatErrorResponse('Activity not found'));
        }
        
        // Check if user has access to this activity's program
        if (activity.program.creator_id !== userId && activity.program.is_private) {
            // Check if user is subscribed to the program
            const { data: subscription, error: subError } = await userSupabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', userId)
                .eq('program_id', activity.program_id)
                .maybeSingle();
                
            if (subError || !subscription) {
                return res.status(403).json(formatErrorResponse('You do not have access to this activity'));
            }
        }
        
        return res.status(200).json(activity);
    } catch (error) {
        console.error('Error getting activity:', error);
        return res.status(500).json(formatErrorResponse('Internal server error'));
    }
};

export const getProgramActivities = async (req, res) => {
    try {
        const { programId } = req.params;
        const userId = req.user.id;
        
        if (!programId) {
            return res.status(400).json(formatErrorResponse('Program ID is required'));
        }
        
        // Get the user's JWT token from the Authorization header
        const token = req.header("Authorization").replace("Bearer ", "");
        const userSupabase = createAuthenticatedClient(token);
        
        // Check if user has access to this program
        const { data: program, error: programError } = await userSupabase
            .from('programs')
            .select('*')
            .eq('id', programId)
            .eq('is_deleted', false)
            .single();
            
        if (programError) {
            console.error('Error fetching program:', programError);
            return res.status(404).json(formatErrorResponse('Program not found'));
        }
        
        if (program.creator_id !== userId && program.is_private) {
            // Check if user is subscribed to the program
            const { data: subscription, error: subError } = await userSupabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', userId)
                .eq('program_id', programId)
                .maybeSingle();
                
            if (subError || !subscription) {
                return res.status(403).json(formatErrorResponse('You do not have access to this program'));
            }
        }
        
        // Get activities for this program
        const { data: activities, error } = await userSupabase
            .from('activities')
            .select('*')
            .eq('program_id', programId)
            .eq('is_deleted', false);
            
        if (error) {
            console.error('Error fetching activities:', error);
            return res.status(500).json(formatErrorResponse('Error fetching activities'));
        }
        
        return res.status(200).json(activities || []);
    } catch (error) {
        console.error('Error getting program activities:', error);
        return res.status(500).json(formatErrorResponse('Internal server error'));
    }
};

/* UPDATE */
export const editActivity = async (req, res) => {
    try {
        const { activityId } = req.params;
        const { title, description, cron } = req.body;
        const userId = req.user.id;
        
        // Get the user's JWT token from the Authorization header
        const token = req.header("Authorization").replace("Bearer ", "");
        const userSupabase = createAuthenticatedClient(token);
        
        // Get the activity with its program info
        const { data: activity, error: fetchError } = await userSupabase
            .from('activities')
            .select(`
                *,
                program:program_id (creator_id)
            `)
            .eq('id', activityId)
            .eq('is_deleted', false)
            .single();
            
        if (fetchError) {
            console.error('Error fetching activity:', fetchError);
            return res.status(404).json(formatErrorResponse('Activity not found'));
        }
        
        // Check if user is the creator of the program
        if (activity.program.creator_id !== userId) {
            return res.status(403).json(formatErrorResponse('You do not have permission to edit this activity'));
        }
        
        // Update the activity
        const { data: updatedActivity, error: updateError } = await userSupabase
            .from('activities')
            .update({
                title: title || activity.title,
                description: description !== undefined ? description : activity.description,
                cron: cron || activity.cron,
                updated_at: new Date().toISOString()
            })
            .eq('id', activityId)
            .select()
            .single();
            
        if (updateError) {
            console.error('Error updating activity:', updateError);
            return res.status(500).json(formatErrorResponse('Error updating activity'));
        }

        // Mark all future tasks from this activity as deleted
        const { error: taskUpdateError } = await userSupabase
            .from('tasks')
            .update({ 
                is_deleted: true,
                updated_at: new Date().toISOString()
            })
            .eq('activity_id', activityId)
            .gte('due_date', new Date().toISOString().split('T')[0]);
            
        if (taskUpdateError) {
            console.error('Error updating tasks:', taskUpdateError);
            // Don't fail the request, just log the error
        }
        
        return res.status(200).json(updatedActivity);
    } catch (error) {
        console.error('Error editing activity:', error);
        return res.status(500).json(formatErrorResponse('Internal server error'));
    }
};

export const deleteActivity = async (req, res) => {
    try {
        const { activityId } = req.params;
        const userId = req.user.id;
        
        // Get the user's JWT token from the Authorization header
        const token = req.header("Authorization").replace("Bearer ", "");
        const userSupabase = createAuthenticatedClient(token);
        
        // Get the activity with its program info
        const { data: activity, error: fetchError } = await userSupabase
            .from('activities')
            .select(`
                *,
                program:program_id (creator_id)
            `)
            .eq('id', activityId)
            .eq('is_deleted', false)
            .single();
            
        if (fetchError) {
            console.error('Error fetching activity:', fetchError);
            return res.status(404).json(formatErrorResponse('Activity not found'));
        }
        
        // Check if user is the creator of the program
        if (activity.program.creator_id !== userId) {
            return res.status(403).json(formatErrorResponse('You do not have permission to delete this activity'));
        }
        
        // Soft delete the activity
        const { data, error: deleteError } = await userSupabase
            .from('activities')
            .update({
                is_deleted: true,
                updated_at: new Date().toISOString()
            })
            .eq('id', activityId);
            
        if (deleteError) {
            console.error('Error deleting activity:', deleteError);
            return res.status(500).json(formatErrorResponse('Error deleting activity'));
        }

        // Mark all future tasks from this activity as deleted
        const { error: taskUpdateError } = await userSupabase
            .from('tasks')
            .update({ 
                is_deleted: true,
                updated_at: new Date().toISOString()
            })
            .eq('activity_id', activityId)
            .gte('due_date', new Date().toISOString().split('T')[0]);
            
        if (taskUpdateError) {
            console.error('Error updating tasks:', taskUpdateError);
            // Don't fail the request, just log the error
        }
        
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error deleting activity:', error);
        return res.status(500).json(formatErrorResponse('Internal server error'));
    }
};

export default {
    createActivity,
    getActivity,
    getProgramActivities,
    editActivity,
    deleteActivity
}; 