import { supabase, createAuthenticatedClient } from '../utils/db.js';
import { formatErrorResponse } from '../utils/formatResponse.js';

/**
 * Get user settings
 */
export const getUserSettings = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get the user's JWT token from the Authorization header
        const token = req.header("Authorization").replace("Bearer ", "");
        const userSupabase = createAuthenticatedClient(token);
        
        // Get user settings from Supabase
        const { data: settings, error } = await userSupabase
            .from('settings')
            .select('*')
            .eq('user_id', userId)
            .single();
            
        if (error) {
            console.error('Error fetching settings:', error);
            return res.status(404).json(formatErrorResponse('Settings not found'));
        }
        
        res.status(200).json(settings);
    } catch (error) {
        console.error('Error in getUserSettings:', error);
        res.status(500).json(formatErrorResponse('Internal server error'));
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
        const userSupabase = createAuthenticatedClient(token);
        
        // Update user settings in Supabase
        const { data: settings, error } = await userSupabase
            .from('settings')
            .update({
                timezone: timezone || 'UTC',
                default_page: default_page || 'dashboard',
                color_mode: color_mode || 'light',
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .select()
            .single();
            
        if (error) {
            console.error('Error updating settings:', error);
            return res.status(400).json(formatErrorResponse('Error updating settings'));
        }
        
        res.status(200).json(settings);
    } catch (error) {
        console.error('Error in updateUserSettings:', error);
        res.status(500).json(formatErrorResponse('Internal server error'));
    }
};

export default {
    getUserSettings,
    updateUserSettings
}; 