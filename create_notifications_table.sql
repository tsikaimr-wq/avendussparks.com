-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    title TEXT,
    message TEXT,
    tag TEXT DEFAULT 'NOTICE',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Policy to allow users to see their own notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Policy to allow admins to insert (if applicable, but usually service_role bypasses)
-- We need to ensure public/users can't insert if it's admin-only, but for now we follow existing patterns
