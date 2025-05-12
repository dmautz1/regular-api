import { supabase } from '../utils/db.js';
import { formatErrorResponse } from '../utils/formatResponse.js';
import { createClient } from '@supabase/supabase-js';
import config from '../config/config.js';

/**
 * Get user settings
 */
export const getUserSettings = async (req, res) => {
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

        // Get user settings
        const { data: settings, error } = await userSupabase
            .from('settings')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // Settings not found, create default settings
                const { data: newSettings, error: createError } = await userSupabase
                    .from('settings')
                    .insert([
                        {
                            user_id: userId,
                            timezone: 'UTC',
                            default_page: 'dashboard',
                            color_mode: 'light'
                        }
                    ])
                    .select()
                    .single();

                if (createError) {
                    throw createError;
                }

                return res.status(200).json(newSettings);
            }
            throw error;
        }

        res.status(200).json(settings);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json(formatErrorResponse('Failed to fetch settings'));
    }
};

/**
 * Update user settings
 */
export const updateUserSettings = async (req, res) => {
    try {
        const userId = req.user.id;
        const { timezone, default_page, color_mode } = req.body;
        
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

        // Update settings
        const { data: settings, error } = await userSupabase
            .from('settings')
            .update({
                timezone: timezone,
                default_page: default_page,
                color_mode: color_mode
            })
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            throw error;
        }

        res.status(200).json(settings);
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json(formatErrorResponse('Failed to update settings'));
    }
}; 