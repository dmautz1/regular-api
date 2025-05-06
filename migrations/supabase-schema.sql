-- Profiles table (users extension)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    role TEXT DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Enable RLS (Row Level Security) on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Programs table
CREATE TABLE IF NOT EXISTS programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    image_url TEXT,
    category TEXT,
    difficulty TEXT DEFAULT 'beginner',
    is_public BOOLEAN DEFAULT FALSE,
    is_personal BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on programs
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for programs
CREATE POLICY "Public programs are viewable by everyone" ON programs
    FOR SELECT USING (is_public = true AND is_deleted = false);

CREATE POLICY "Users can view their own programs" ON programs
    FOR SELECT USING (auth.uid() = creator_id AND is_deleted = false);

CREATE POLICY "Users can update their own programs" ON programs
    FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "Users can insert their own programs" ON programs
    FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can delete their own programs" ON programs
    FOR DELETE USING (auth.uid() = creator_id);

-- Activities table
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    cron TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on activities
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for activities
CREATE POLICY "Users can view activities of public programs" ON activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM programs 
            WHERE programs.id = activities.program_id 
            AND programs.is_public = true
        )
    );

CREATE POLICY "Users can view activities of their own programs" ON activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM programs 
            WHERE programs.id = activities.program_id 
            AND programs.creator_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage activities of their own programs" ON activities
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM programs 
            WHERE programs.id = activities.program_id 
            AND programs.creator_id = auth.uid()
        )
    );

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
    activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'medium',
    due_date DATE,
    is_completed BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_sticky BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks
CREATE POLICY "Users can view their own tasks" ON tasks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks" ON tasks
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tasks" ON tasks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks" ON tasks
    FOR DELETE USING (auth.uid() = user_id);

-- Subscriptions table (for program subscriptions)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, program_id)
);

-- Enable RLS on subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscriptions
CREATE POLICY "Users can view their own subscriptions" ON subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own subscriptions" ON subscriptions
    FOR ALL USING (auth.uid() = user_id);

-- Allow users to view programs they are subscribed to
CREATE POLICY "Users can view programs they are subscribed to" ON programs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM subscriptions 
            WHERE subscriptions.program_id = programs.id 
            AND subscriptions.user_id = auth.uid()
        )
    );

-- Activity tracking table (for user activity logging)
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    target_type TEXT,
    target_id UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on activity_logs
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for activity_logs
CREATE POLICY "Users can view their own activity logs" ON activity_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity logs" ON activity_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create functions and triggers for updating 'updated_at' timestamps
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updating timestamps
CREATE TRIGGER update_profiles_modtime
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_programs_modtime
    BEFORE UPDATE ON programs
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_tasks_modtime
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_activities_modtime
    BEFORE UPDATE ON activities
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Storage bucket policies
CREATE POLICY "Avatar images are publicly accessible."
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'avatars' );

CREATE POLICY "Anyone can upload an avatar."
  ON storage.objects FOR INSERT
  WITH CHECK ( bucket_id = 'avatars' );

CREATE POLICY "Users can update their own avatars."
  ON storage.objects FOR UPDATE
  USING ( bucket_id = 'avatars' AND auth.uid() = owner );

CREATE POLICY "Users can delete their own avatars."
  ON storage.objects FOR DELETE
  USING ( bucket_id = 'avatars' AND auth.uid() = owner );

CREATE POLICY "Program images are publicly accessible."
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'programs' );

CREATE POLICY "Users can upload program images."
  ON storage.objects FOR INSERT
  WITH CHECK ( bucket_id = 'programs' AND auth.uid() IS NOT NULL );

CREATE POLICY "Users can update their own program images."
  ON storage.objects FOR UPDATE
  USING ( bucket_id = 'programs' AND auth.uid() = owner );

CREATE POLICY "Users can delete their own program images."
  ON storage.objects FOR DELETE
  USING ( bucket_id = 'programs' AND auth.uid() = owner ); 