-- Allow users to update their own messages (mark as read)
CREATE POLICY "Users can update own messages"
ON public.messages
FOR UPDATE
USING (auth.uid() = user_id);
