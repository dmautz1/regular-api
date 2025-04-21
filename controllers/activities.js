import { supabase } from '../utils/db.js';
import { formatErrorResponse } from '../utils/formatResponse.js';

/* CREATE */
export const createActivity = async (req, res) => {
    try {
        const { programId, activities } = req.body;
        const userId = req.user.id;
        
        if (!programId) {
            return res.status(400).json(formatErrorResponse('Program ID is required'));
        }
        
        if (!activities || !Array.isArray(activities) || activities.length === 0) {
            return res.status(400).json(formatErrorResponse('At least one activity is required'));
        }
        
        console.log(`Creating ${activities.length} activities for program ${programId}`);
        
        // First verify the user owns this program
        const { data: program, error: programError } = await supabase
            .from('programs')
            .select('*')
            .eq('id', programId)
            .eq('creator_id', userId)
            .single();
            
        if (programError) {
            console.error('Error fetching program:', programError);
            return res.status(404).json(formatErrorResponse('Program not found or you do not have permission'));
        }
        
        // Process all activities to create or update
        const activitiesWithData = [];
        
        for (const activity of activities) {
            if (!activity.title) {
                return res.status(400).json(formatErrorResponse('Activity title is required'));
            }
            
            if (!activity.cron) {
                return res.status(400).json(formatErrorResponse('Activity cron expression is required'));
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
        const { data: savedActivities, error: saveError } = await supabase
            .from('activities')
            .upsert(activitiesWithData, { 
                onConflict: 'id',
                returning: 'representation'
            });
            
        if (saveError) {
            console.error('Error saving activities:', saveError);
            return res.status(500).json(formatErrorResponse('Error saving activities'));
        }
        
        // Generate future tasks for this program (if it's a personal program)
        if (program.is_personal) {
            // This would call your task population logic
            // Using a separate endpoint for task population is recommended
        }
        
        // Get all activities for the program
        const { data: allActivities, error: fetchError } = await supabase
            .from('activities')
            .select('*')
            .eq('program_id', programId)
            .eq('is_deleted', false);
            
        if (fetchError) {
            console.error('Error fetching activities:', fetchError);
            // Don't fail the request, just return what we have
        }
        
        // Return the program with activities
        return res.status(201).json({
            ...program,
            activities: allActivities || []
        });
    } catch (error) {
        console.error('Error creating activities:', error);
        return res.status(500).json(formatErrorResponse('Internal server error'));
    }
};

/* READ */
export const getActivity = async (req, res) => {
    try {
        const { activityId } = req.params;
        const userId = req.user.id;
        
        // Get the activity
        const { data: activity, error } = await supabase
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
            const { data: subscription, error: subError } = await supabase
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
        
        // Check if user has access to this program
        const { data: program, error: programError } = await supabase
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
            const { data: subscription, error: subError } = await supabase
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
        const { data: activities, error } = await supabase
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
        
        // Get the activity with its program info
        const { data: activity, error: fetchError } = await supabase
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
        const { data: updatedActivity, error: updateError } = await supabase
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
        
        // Get the activity with its program info
        const { data: activity, error: fetchError } = await supabase
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
        const { data, error: deleteError } = await supabase
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