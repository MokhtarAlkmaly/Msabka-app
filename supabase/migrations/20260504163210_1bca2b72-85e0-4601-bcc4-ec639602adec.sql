CREATE POLICY "Users can update their own media"
ON public.media
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);