import { supabase, createAuthenticatedClient } from '../utils/db.js';
import { formatErrorResponse } from '../utils/formatResponse.js';
import { v4 as uuidv4 } from 'uuid';

/* GET PROFILE */
export const getProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get the user's JWT token from the Authorization header
        const token = req.header("Authorization").replace("Bearer ", "");
        const userSupabase = createAuthenticatedClient(token);
        
        // Get user profile from Supabase
        const { data: profile, error } = await userSupabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
            
        if (error) {
            console.error('Error fetching profile:', error);
            return res.status(404).json(formatErrorResponse('Profile not found'));
        }
        
        // Get subscription counts
        const { count: subscriberCount, error: subError } = await userSupabase
            .from('subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);
            
        if (subError) {
            console.error('Error counting subscriptions:', subError);
            return res.status(500).json(formatErrorResponse('Error fetching subscription count'));
        }
        
        // Get program count
        const { count: programCount, error: progError } = await userSupabase
            .from('programs')
            .select('*', { count: 'exact', head: true })
            .eq('creator_id', userId)
            .eq('is_personal', false)
            .eq('is_deleted', false);
            
        if (progError) {
            console.error('Error counting programs:', progError);
            return res.status(500).json(formatErrorResponse('Error fetching program count'));
        }
        
        // Format the response to match what the frontend expects
        return res.status(200).json({
            name: `${profile.first_name} ${profile.last_name}`.trim(),
            email: profile.email,
            bio: profile.bio || '',
            avatarUrl: profile.avatar_url || '',
            subscriptionCount: subscriberCount || 0,
            programCount: programCount || 0
        });
    } catch (error) {
        console.error('Error in getProfile:', error);
        return res.status(500).json(formatErrorResponse('Internal server error'));
    }
};

/* UPDATE PROFILE */
export const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, bio } = req.body;
        const file = req.file;
        
        // Get the user's JWT token from the Authorization header
        const token = req.header("Authorization").replace("Bearer ", "");
        const userSupabase = createAuthenticatedClient(token);
        
        const firstName = name.split(' ')[0] || '';
        const lastName = name.split(' ')[1] || '';
        
        // Update profile data
        const updateData = {
            first_name: firstName,
            last_name: lastName,
            bio: bio,
            updated_at: new Date().toISOString()
        };
        
        // If there's a new avatar, upload it
        if (file) {
            const fileExt = file.originalname.split('.').pop();
            const fileName = `${uuidv4()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;
            
            const { error: uploadError } = await userSupabase.storage
                .from('avatars')
                .upload(filePath, file.buffer, {
                    contentType: file.mimetype,
                    upsert: true
                });
                
            if (uploadError) {
                console.error('Error uploading avatar:', uploadError);
                return res.status(400).json(formatErrorResponse('Error uploading avatar'));
            }
            
            // Get the public URL
            const { data: { publicUrl } } = userSupabase.storage
                .from('avatars')
                .getPublicUrl(filePath);
                
            updateData.avatar_url = publicUrl;
        }
        
        // Update the profile
        const { data: profile, error } = await userSupabase
            .from('profiles')
            .update(updateData)
            .eq('id', userId)
            .select()
            .single();
            
        if (error) {
            console.error('Error updating profile:', error);
            return res.status(400).json(formatErrorResponse('Error updating profile'));
        }
        
        res.status(200).json({
            name: `${profile.first_name} ${profile.last_name}`.trim(),
            email: profile.email,
            bio: profile.bio || '',
            avatarUrl: profile.avatar_url || ''
        });
    } catch (error) {
        console.error('Error in updateProfile:', error);
        res.status(500).json(formatErrorResponse('Internal server error'));
    }
};

/* GET USER STATS */
export const getUserStats = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get the user's JWT token from the Authorization header
        const token = req.header("Authorization").replace("Bearer ", "");
        
        // Create a new Supabase client with the user's token
        const userSupabase = createAuthenticatedClient(token);
        
        // Get today's date and first/last day of week
        const today = new Date();
        const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay())).toISOString().split('T')[0];
        const lastDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6)).toISOString().split('T')[0];
        
        // Get completed tasks this week
        const { count: weeklyCompleted, error: weeklyError } = await userSupabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_completed', true)
            .gte('due_date', firstDayOfWeek)
            .lte('due_date', lastDayOfWeek)
            .is('is_deleted', false);
            
        // Get total tasks this week
        const { count: weeklyTotal, error: weeklyTotalError } = await userSupabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('due_date', firstDayOfWeek)
            .lte('due_date', lastDayOfWeek)
            .is('is_deleted', false);
        // Get program count
        const { count: programCount, error: programError } = await userSupabase
            .from('programs')
            .select('*', { count: 'exact', head: true })
            .eq('creator_id', userId)
            .eq('is_personal', false)
            .eq('is_deleted', false);
            
        // Calculate streak by finding the last day where no tasks were completed
        const { data: lastIncompleteDay, error: streakError } = await userSupabase
            .from('tasks')
            .select('due_date, is_completed')
            .eq('user_id', userId)
            .lte('due_date', req.query.today)
            .is('is_deleted', false)
            .order('due_date', { ascending: false });
            
        console.log(`Last incomplete day: ${lastIncompleteDay?.[0]?.due_date}`);
        
        let streak = 0;
        if (lastIncompleteDay && lastIncompleteDay.length > 0) {
            // Group tasks by date
            const tasksByDate = lastIncompleteDay.reduce((acc, task) => {
                const date = task.due_date.split('T')[0];
                if (!acc[date]) {
                    acc[date] = [];
                }
                acc[date].push(task);
                return acc;
            }, {});
            
            // Find the last date where no tasks were completed
            const dates = Object.keys(tasksByDate).sort().reverse();
            let lastIncompleteDate = null;
            
            for (const date of dates) {
                const tasks = tasksByDate[date];
                const hasCompletedTask = tasks.some(task => task.is_completed);
                if (!hasCompletedTask) {
                    lastIncompleteDate = new Date(date);
                    break;
                }
            }
            
            if (lastIncompleteDate) {
                streak = Math.floor((today - lastIncompleteDate) / (1000 * 60 * 60 * 24));
            }
        }
        
        return res.status(200).json({
            weeklyCompleted: weeklyCompleted || 0,
            completionRate: Math.round((weeklyCompleted / weeklyTotal) * 100) || 0,
            programCount: programCount || 0,
            streak: streak
        });
    } catch (error) {
        console.error('Error in getUserStats:', error);
        return res.status(500).json(formatErrorResponse('Internal server error'));
    }
};

export default {
    getProfile,
    updateProfile,
    getUserStats
};