import { supabase, createAuthenticatedClient } from '../utils/db.js';
import { v4 as uuidv4 } from 'uuid';
import { formatErrorResponse } from '../utils/formatResponse.js';

/* CREATE */
export const createProgram = async (req, res) => {
    try {
        const { title, description, isPrivate, isPersonal } = req.body;
        const userId = req.user.id;
        const file = req.file;
        
        // Get the user's JWT token from the Authorization header
        const token = req.header("Authorization").replace("Bearer ", "");
        const userSupabase = createAuthenticatedClient(token);

        if (!file) {
            return res.status(400).json(formatErrorResponse('Image is required'));
        }

        // Upload image to Supabase Storage
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${uuidv4()}.${fileExt}`;
        const filePath = `program-images/${fileName}`;

        const { error: uploadError } = await userSupabase.storage
            .from('media')
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
            });

        if (uploadError) {
            console.error('Error uploading file:', uploadError);
            return res.status(500).json(formatErrorResponse('Error uploading image'));
        }

        // Get the public URL for the uploaded image
        const { data: { publicUrl } } = userSupabase.storage
            .from('media')
            .getPublicUrl(filePath);

        // Create program record in the database
        const { data: program, error } = await userSupabase
            .from('programs')
            .insert({
                creator_id: userId,
                title,
                description,
                image_url: publicUrl,
                is_private: isPrivate === 'true',
                is_personal: isPersonal === 'true',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                is_deleted: false
            })
            .select('*')
            .single();

        if (error) {
            console.error('Error creating program:', error);
            return res.status(500).json(formatErrorResponse('Error creating program'));
        }

        return res.status(201).json({ program });
    } catch (error) {
        console.error('Error in createProgram:', error);
        return res.status(500).json(formatErrorResponse('Internal server error'));
    }
};

/* READ */
export const getProgram = async (req, res) => {
    try {
        const { programId } = req.params;
        const userId = req.user.id;
        
        // Get the user's JWT token from the Authorization header
        const token = req.header("Authorization").replace("Bearer ", "");
        const userSupabase = createAuthenticatedClient(token);

        // Get program with creator data
        const { data: program, error } = await userSupabase
            .from('programs')
            .select(`
                *,
                creator:creator_id (
                    id,
                    email,
                    first_name,
                    last_name,
                    avatar_url
                )
            `)
            .eq('id', programId)
            .eq('is_deleted', false)
            .single();

        if (error) {
            console.error('Error fetching program:', error);
            return res.status(404).json(formatErrorResponse('Program not found'));
        }

        // Check if user has access to this program
        if (program.is_private && program.creator_id !== userId) {
            const { data: subscription } = await userSupabase
                .from('subscriptions')
                .select('*')
                .eq('program_id', programId)
                .eq('user_id', userId)
                .single();

            if (!subscription) {
                return res.status(403).json(formatErrorResponse('You do not have access to this program'));
            }
        }

        // Get activities for this program
        const { data: activities, error: activitiesError } = await userSupabase
            .from('activities')
            .select('*')
            .eq('program_id', programId)
            .eq('is_deleted', false);

        if (activitiesError) {
            console.error('Error fetching activities:', activitiesError);
        } else {
            console.log('Fetched activities for program:', programId, activities);
        }

        // Check if user is subscribed to this program
        const { data: userSubscription } = await userSupabase
            .from('subscriptions')
            .select('*')
            .eq('program_id', programId)
            .eq('user_id', userId)
            .single();

        // Count subscribers
        const { count: subscriberCount } = await userSupabase
            .from('subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('program_id', programId);

        return res.status(200).json({
            program: {
                ...program,
                isSubscribed: !!userSubscription,
                subscriberCount: subscriberCount || 0,
                activities: activities || []
            }
        });
    } catch (error) {
        console.error('Error in getProgram:', error);
        return res.status(500).json(formatErrorResponse('Internal server error'));
    }
};

export const getFeedPrograms = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get the user's JWT token from the Authorization header
        const token = req.header("Authorization").replace("Bearer ", "");
        const userSupabase = createAuthenticatedClient(token);

        const { data: programs, error } = await userSupabase
            .from('programs')
            .select(`
                *,
                creator:creator_id (
                    id,
                    email,
                    first_name,
                    last_name,
                    avatar_url
                )
            `)
            .eq('is_deleted', false)
            .eq('is_personal', false)
            .eq('is_public', true)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching feed programs:', error);
            return res.status(500).json(formatErrorResponse('Error fetching programs'));
        }

        // Get subscription counts for each program
        for (const program of programs) {
            const { count, error: countError } = await userSupabase
                .from('subscriptions')
                .select('id', { count: 'exact', head: true })
                .eq('program_id', program.id);
                
            if (countError) {
                console.error(`Error counting subscribers for program ${program.id}:`, countError);
                program.subscriberCount = 0;
            } else {
                program.subscriberCount = count || 0;
            }
        }
        
        res.status(200).json(programs);
    } catch (error) {
        console.error("Error fetching programs:", error);
        res.status(500).json({ message: error.message });
    }
};

export const getUserPrograms = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get the user's JWT token from the Authorization header
        const token = req.header("Authorization").replace("Bearer ", "");
        const userSupabase = createAuthenticatedClient(token);
        
        // Get all subscriptions for the user, joining with programs and creators
        const { data: subscriptions, error } = await userSupabase
            .from('subscriptions')
            .select(`
                id,
                program:program_id (
                    *,
                    creator:creator_id (
                        id,
                        email,
                        username,
                        first_name,
                        last_name,
                        avatar_url,
                        bio
                    )
                )
            `)
            .eq('user_id', userId);
            
        if (error) {
            console.error("Error fetching subscriptions:", error);
            return res.status(400).json({ message: error.message });
        }
        
        // Filter out personal programs and extract program objects
        //    .filter(sub => sub.program && !sub.program.is_personal) 
        const programs = subscriptions
            .map(sub => ({
                ...sub.program,
                id: sub.program.id
            }));
            
        // Get subscription counts for each program
        for (const program of programs) {
            const { count, error: countError } = await userSupabase
                .from('subscriptions')
                .select('id', { count: 'exact', head: true })
                .eq('program_id', program.id);
                
            if (countError) {
                console.error(`Error counting subscribers for program ${program.id}:`, countError);
                program.subscriberCount = 0;
            } else {
                program.subscriberCount = count || 0;
            }
        }
        
        res.status(200).json(programs);
    } catch (error) {
        console.error("Error fetching user programs:", error);
        res.status(500).json({ message: error.message });
    }
};

/* Get programs created by the logged-in user (as a creator) */
export const getCreatorPrograms = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get the user's JWT token from the Authorization header
        const token = req.header("Authorization").replace("Bearer ", "");
        const userSupabase = createAuthenticatedClient(token);
        
        // Get all programs created by this user
        const { data: programs, error } = await userSupabase
            .from('programs')
            .select(`
                *,
                activities (*)
            `)
            .eq('creator_id', userId)
            .eq('is_deleted', false);
            
        if (error) {
            console.error("Error fetching creator programs:", error);
            return res.status(400).json({ message: error.message });
        }
        
        // Get subscription counts for each program
        for (const program of programs) {
            const { count, error: countError } = await userSupabase
                .from('subscriptions')
                .select('id', { count: 'exact', head: true })
                .eq('program_id', program.id);
                
            if (countError) {
                console.error(`Error counting subscribers for program ${program.id}:`, countError);
                program.subscriberCount = 0;
            } else {
                program.subscriberCount = count || 0;
            }
        }
        
        res.status(200).json(programs);
    } catch (error) {
        console.error("Error fetching creator programs:", error);
        res.status(500).json({ message: error.message });
    }
};

/* Get personal program for the logged-in user */
export const getPersonalProgram = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get the user's JWT token from the Authorization header
        const token = req.header("Authorization").replace("Bearer ", "");
        const userSupabase = createAuthenticatedClient(token);
        
        // Get the personal program for this user
        const { data: personalProgram, error } = await userSupabase
            .from('programs')
            .select(`
                *,
                activities (*)
            `)
            .eq('creator_id', userId)
            .eq('is_personal', true)
            .maybeSingle();
            
        if (error) {
            console.error("Error fetching personal program:", error);
            return res.status(400).json({ message: error.message });
        }
        
        // If no personal program exists, create one
        if (!personalProgram) {
            const { data: newProgram, error: createError } = await userSupabase
                .from('programs')
                .insert({
                    creator_id: userId,
                    title: "Personal Tasks",
                    description: "Your personal recurring tasks",
                    category: "Personal",
                    image_url: '/public/assets/default-personal-program.jpg',
                    is_public: false,
                    is_personal: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();
                
            if (createError) {
                console.error("Error creating personal program:", createError);
                return res.status(400).json({ message: createError.message });
            }
            
            // Create subscription to the personal program
            const { error: subError } = await userSupabase
                .from('subscriptions')
                .insert({
                    user_id: userId,
                    program_id: newProgram.id,
                    created_at: new Date().toISOString()
                });
                
            if (subError) {
                console.error("Error creating subscription to personal program:", subError);
            }
            
            return res.status(201).json(newProgram);
        }
        
        res.status(200).json(personalProgram);
    } catch (error) {
        console.error("Error fetching personal program:", error);
        res.status(500).json({ message: error.message });
    }
};

/* UPDATE */
export const editProgram = async (req, res) => {
    try {
        const { programId, title, description, category, link, isPrivate } = req.body;
        const userId = req.user.id;
        
        // Get the user's JWT token from the Authorization header
        const token = req.header("Authorization").replace("Bearer ", "");
        const userSupabase = createAuthenticatedClient(token);
        
        // Check if program exists and belongs to the current user
        const { data: program, error: fetchError } = await userSupabase
            .from('programs')
            .select('*')
            .eq('id', programId)
            .eq('creator_id', userId)
            .single();
            
        if (fetchError) {
            console.error("Error fetching program:", fetchError);
            if (fetchError.code === 'PGRST116') {
                return res.status(404).json({ message: "Program not found or not authorized" });
            }
            return res.status(400).json({ message: fetchError.message });
        }
        
        // Prepare update data
        const updateData = {
            title: title || program.title,
            description: description !== undefined ? description : program.description,
            category: category || program.category,
            is_public: isPrivate !== undefined ? !isPrivate : program.is_public,
            updated_at: new Date().toISOString()
        };
        
        // If a new image was uploaded, save it
        if (req.file) {
            const imageUrl = await uploadFile(req.file, 'programs');
            updateData.image_url = imageUrl;
        }
        
        // Update the program
        const { data: updatedProgram, error: updateError } = await userSupabase
            .from('programs')
            .update(updateData)
            .eq('id', programId)
            .select()
            .single();
            
        if (updateError) {
            console.error("Error updating program:", updateError);
            return res.status(400).json({ message: updateError.message });
        }
        
        res.status(200).json(updatedProgram);
    } catch (error) {
        console.error("Error updating program:", error);
        res.status(500).json({ message: error.message });
    }
};

export const deleteProgram = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        // Get the user's JWT token from the Authorization header
        const token = req.header("Authorization").replace("Bearer ", "");
        const userSupabase = createAuthenticatedClient(token);
        
        // Check if program exists and belongs to the current user
        const { data: program, error: fetchError } = await userSupabase
            .from('programs')
            .select('*')
            .eq('id', id)
            .eq('creator_id', userId)
            .single();
            
        if (fetchError) {
            console.error("Error fetching program:", fetchError);
            if (fetchError.code === 'PGRST116') {
                return res.status(404).json({ message: "Program not found or not authorized" });
            }
            return res.status(400).json({ message: fetchError.message });
        }
        
        // Don't allow deleting personal programs
        if (program.is_personal) {
            return res.status(403).json({ message: "Cannot delete personal program" });
        }
        
        // Delete the program (mark as deleted rather than actual deletion)
        const { data, error: deleteError } = await userSupabase
            .from('programs')
            .update({ 
                is_deleted: true,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);
            
        if (deleteError) {
            console.error("Error deleting program:", deleteError);
            return res.status(400).json({ message: deleteError.message });
        }
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error deleting program:", error);
        res.status(500).json({ message: error.message });
    }
};

export const subscribeProgram = async (req, res) => {
    try {
        const { programId } = req.params;
        const userId = req.user.id;
        
        // Get the user's JWT token from the Authorization header
        const token = req.header("Authorization").replace("Bearer ", "");
        const userSupabase = createAuthenticatedClient(token);
        
        // Check if already subscribed
        const { data: existingSub, error: checkError } = await userSupabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('program_id', programId)
            .single();
            
        if (checkError) {
            // If the error is not "not found", return the error
            if (checkError.code !== 'PGRST116') {
                console.error("Error checking subscription:", checkError);
                return res.status(400).json({ message: checkError.message });
            }
        } else if (existingSub) {
            return res.status(400).json({ message: "Already subscribed to this program" });
        }
        
        // Create new subscription
        const { data: newSubscription, error: createError } = await userSupabase
            .from('subscriptions')
            .insert({
                user_id: userId,
                program_id: programId,
                created_at: new Date().toISOString()
            })
            .select()
            .single();
            
        if (createError) {
            console.error("Error creating subscription:", createError);
            return res.status(400).json({ message: createError.message });
        }
        
        // Fetch program details
        const { data: program, error: programError } = await userSupabase
            .from('programs')
            .select(`
                *,
                creator:creator_id (
                    id,
                    email,
                    username,
                    first_name,
                    last_name,
                    avatar_url,
                    bio
                )
            `)
            .eq('id', programId)
            .single();
            
        if (programError) {
            console.error("Error fetching program:", programError);
            return res.status(400).json({ message: programError.message });
        }
        
        res.status(201).json(program);
    } catch (error) {
        console.error("Error subscribing to program:", error);
        res.status(500).json({ message: error.message });
    }
};

export const unsubscribeProgram = async (req, res) => {
    try {
        const { programId } = req.params;
        const userId = req.user.id;
        
        // Get the user's JWT token from the Authorization header
        const token = req.header("Authorization").replace("Bearer ", "");
        const userSupabase = createAuthenticatedClient(token);
        
        // Get the program to check if it's personal
        const { data: program, error: programError } = await userSupabase
            .from('programs')
            .select('is_personal')
            .eq('id', programId)
            .single();
            
        if (programError) {
            console.error("Error fetching program:", programError);
            return res.status(400).json({ message: programError.message });
        }
        
        // Prevent unsubscribing from personal programs
        if (program.is_personal) {
            return res.status(403).json({ message: "Cannot unsubscribe from personal program" });
        }
        
        // Find the subscription
        const { data: subscription, error: findError } = await userSupabase
            .from('subscriptions')
            .select('id')
            .eq('user_id', userId)
            .eq('program_id', programId)
            .maybeSingle();
            
        if (findError) {
            console.error("Error finding subscription:", findError);
            return res.status(400).json({ message: findError.message });
        }
        
        if (!subscription) {
            return res.status(404).json({ message: "Subscription not found" });
        }
        
        // Get all activities for this program
        const { data: activities, error: activitiesError } = await userSupabase
            .from('activities')
            .select('id')
            .eq('program_id', programId)
            .eq('is_deleted', false);
            
        if (activitiesError) {
            console.error("Error fetching program activities:", activitiesError);
            return res.status(400).json({ message: activitiesError.message });
        }
        
        // Delete all future tasks associated with these activities
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { error: deleteError } = await userSupabase
            .from('tasks')
            .delete()
            .eq('user_id', userId)
            .in('activity_id', activities.map(a => a.id))
            .gte('due_date', today.toISOString().split('T')[0]);
            
        if (deleteError) {
            console.error("Error deleting tasks:", deleteError);
            return res.status(400).json({ message: deleteError.message });
        }
        
        // Delete the subscription
        const { error: subDeleteError } = await userSupabase
            .from('subscriptions')
            .delete()
            .eq('id', subscription.id);
            
        if (subDeleteError) {
            console.error("Error deleting subscription:", subDeleteError);
            return res.status(400).json({ message: subDeleteError.message });
        }
        
        res.status(200).json({ message: "Unsubscribed successfully" });
    } catch (error) {
        console.error("Error unsubscribing from program:", error);
        res.status(500).json({ message: error.message });
    }
};

export default {
    createProgram,
    getProgram,
    getFeedPrograms,
    getUserPrograms,
    getCreatorPrograms,
    getPersonalProgram,
    editProgram,
    deleteProgram,
    subscribeProgram,
    unsubscribeProgram
}; 