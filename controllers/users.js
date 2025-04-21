import { supabase } from '../utils/db.js';
import { formatErrorResponse } from '../utils/formatResponse.js';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import config from '../config/config.js';

/* GET PROFILE */
export const getProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        
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
            
        // Get program counts
        const { count: programCount, error: programError } = await userSupabase
            .from('programs')
            .select('*', { count: 'exact', head: true })
            .eq('creator_id', userId)
            .eq('is_personal', false)
            .eq('is_deleted', false);
            
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
        console.log('Updating profile for user:', userId);
        
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
        
        // First check if profile exists
        const { data: existingProfile, error: fetchError } = await userSupabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
            
        if (fetchError) {
            console.error('Error fetching profile:', fetchError);
            return res.status(404).json(formatErrorResponse('Profile not found'));
        }
        
        console.log('Existing profile:', existingProfile);
        
        const { name, bio } = req.body;
        
        // Prepare update data
        const updateData = {
            updated_at: new Date().toISOString()
        };
        
        // Split name into first and last name if provided
        if (name !== undefined) {
            const nameParts = name.trim().split(' ');
            updateData.first_name = nameParts[0] || '';
            updateData.last_name = nameParts.slice(1).join(' ') || '';
        }
        
        if (bio !== undefined) updateData.bio = bio;
        
        // Update avatar if provided
        if (req.file) {
            // Upload avatar to Supabase Storage
            const fileExt = req.file.originalname.split('.').pop();
            const fileName = `${uuidv4()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;
            
            const { error: uploadError } = await userSupabase.storage
                .from('avatars')
                .upload(filePath, req.file.buffer, {
                    contentType: req.file.mimetype,
                });
                
            if (uploadError) {
                console.error('Error uploading avatar:', uploadError);
                return res.status(500).json(formatErrorResponse('Error uploading avatar'));
            }
            
            // Get public URL for avatar
            const { data: { publicUrl } } = userSupabase.storage
                .from('avatars')
                .getPublicUrl(filePath);
                
            // Update profile with new avatar URL
            updateData.avatar_url = publicUrl;
        }
        
        console.log('Update data:', updateData);
        
        // First update the profile
        const { error: updateError } = await userSupabase
            .from('profiles')
            .update(updateData)
            .eq('id', userId);
            
        if (updateError) {
            console.error('Error updating profile:', updateError);
            return res.status(400).json(formatErrorResponse('Error updating profile'));
        }
        
        // Then fetch the updated profile
        const { data: updatedProfile, error: selectError } = await userSupabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
            
        if (selectError) {
            console.error('Error fetching updated profile:', selectError);
            return res.status(400).json(formatErrorResponse('Error fetching updated profile'));
        }
        
        // Format the response to match what the frontend expects
        return res.status(200).json({
            name: `${updatedProfile.first_name} ${updatedProfile.last_name}`.trim(),
            email: updatedProfile.email,
            bio: updatedProfile.bio || '',
            avatarUrl: updatedProfile.avatar_url || ''
        });
    } catch (error) {
        console.error('Error in updateProfile:', error);
        return res.status(500).json(formatErrorResponse('Internal server error'));
    }
};

/* GET USER STATS */
export const getUserStats = async (req, res) => {
    try {
        const userId = req.user.id;
        
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