import { supabase, supabaseAdmin } from '../utils/db.js';
import { initializeStorageBuckets } from '../utils/storage.js';
import config from '../config/config.js';
import nodemailer from 'nodemailer';

// Setup nodemailer transporter
const transporter = nodemailer.createTransport({
    service: config.email.service || 'gmail',
    auth: {
        user: config.email.user,
        pass: config.email.password
    }
});

/**
 * Register a new user using Supabase Auth
 */
export const register = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Register user in Supabase Auth
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${config.client.url}/login`,
                data: {
                    role: 'user'
                }
            }
        });
        
        if (error) {
            return res.status(400).json({ 
                message: error.message || "Registration failed", 
                error: error 
            });
        }
        
        // User created successfully
        if (data?.user) {
            // Get user ID from Supabase
            const userId = data.user.id;
            
            // Create profile in profiles table using admin client
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .insert({
                    id: userId,
                    email: email,
                    first_name: '',
                    last_name: '',
                    bio: '',
                    role: 'user',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    is_active: true
                });
                
            if (profileError) {
                console.error("Error creating profile:", profileError);
                return res.status(500).json({ 
                    message: "Error creating user profile",
                    error: profileError 
                });
            }
            
            // Create default settings for the user
            const { error: settingsError } = await supabaseAdmin
                .from('settings')
                .insert({
                    user_id: userId,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    default_page: 'dashboard',
                    color_mode: 'light',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });

            if (settingsError) {
                console.error("Error creating user settings:", settingsError);
                return res.status(500).json({ 
                    message: "Error creating user settings",
                    error: settingsError 
                });
            }
            
            // Create default personal program for the user
            const { data: programData, error: programError } = await supabaseAdmin
                .from('programs')
                .insert({
                    title: "My Recurring Tasks",
                    description: "Your personal recurring tasks",
                    creator_id: userId,
                    category: "Personal",
                    image_url: '/public/assets/default-personal-program.jpg',
                    is_public: false,
                    is_personal: true
                })
                .select()
                .single();
            
            if (programError) {
                console.error("Error creating personal program:", programError);
                // Continue even if program creation fails - we can handle this later
            }
            
            // Create subscription to the personal program
            if (programData) {
                const { error: subscriptionError } = await supabaseAdmin
                    .from('subscriptions')
                    .insert({
                        user_id: userId,
                        program_id: programData.id,
                        created_at: new Date().toISOString()
                    });
                    
                if (subscriptionError) {
                    console.error("Error creating subscription:", subscriptionError);
                }
            }
            
            // Ensure storage buckets exist
            await initializeStorageBuckets();
            
            return res.status(201).json({ 
                message: "User registered successfully. Please check your email to confirm your account." 
            });
        }
        
        res.status(201).json({ message: "Registration successful" });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ message: "Something went wrong.", error: error.message });
    }
};

/**
 * Login user using Supabase Auth
 */
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Sign in with Supabase Auth
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) {
            // Handle specific error cases
            if (error.message.includes("Invalid login credentials")) {
                return res.status(400).json({ message: "Invalid credentials." });
            } else if (error.message.includes("Email not confirmed")) {
                return res.status(403).json({ message: "Please confirm your email before logging in." });
            }
            
            return res.status(400).json({ message: error.message });
        }
        
        if (!data?.user || !data?.session) {
            return res.status(400).json({ message: "Login failed." });
        }
        
        // Get user profile data
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();
            
        if (profileError && !profileError.message.includes('No rows found')) {
            console.error("Error fetching profile:", profileError);
        }
        
        // Format the response similar to the old API for compatibility
        const responseData = {
            token: data.session.access_token,
            user: {
                id: data.user.id,
                email: data.user.email,
                ...profileData
            }
        };
        
        res.status(200).json(responseData);
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Something went wrong." });
    }
};

/**
 * Request password reset using Supabase Auth
 */
export const requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;
        
        // Use Supabase's built-in password reset
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${config.client.url}/reset-password`,
        });
        
        if (error) {
            return res.status(400).json({ message: error.message });
        }
        
        res.status(200).json({ message: "Password reset link sent to your email." });
    } catch (error) {
        console.error("Password reset request error:", error);
        res.status(500).json({ message: "Failed to send reset email." });
    }
};

/**
 * Reset password using Supabase Auth
 */
export const resetPassword = async (req, res) => {
    try {
        const { password } = req.body;
        
        // Update password
        const { error } = await supabase.auth.updateUser({
            password
        });
        
        if (error) {
            return res.status(400).json({ message: error.message });
        }
        
        res.status(200).json({ message: "Password reset successful." });
    } catch (error) {
        console.error("Password reset error:", error);
        res.status(500).json({ message: "Failed to reset password." });
    }
};

/**
 * Logout user from all devices
 */
export const logout = async (req, res) => {
    try {
        // Get the auth token from the Authorization header
        let token = req.header("Authorization");
        
        if (!token) {
            return res.status(403).json({ message: "You need to login." });
        }
        
        if (token.startsWith("Bearer ")) {
            token = token.slice(7, token.length).trimLeft();
        }

        // Sign out from all devices
        const { error } = await supabase.auth.signOut({
            scope: 'global'
        });
        
        if (error) {
            return res.status(400).json({ message: error.message });
        }
        
        res.status(200).json({ message: "Logged out successfully." });
    } catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({ message: "Failed to logout." });
    }
};

export default {
    register,
    login,
    requestPasswordReset,
    resetPassword,
    logout
}; 