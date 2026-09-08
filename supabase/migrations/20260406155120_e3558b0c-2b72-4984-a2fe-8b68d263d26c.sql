
-- Create media metadata table
CREATE TABLE public.media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  year TEXT NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  title TEXT NOT NULL DEFAULT '',
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'video')),
  file_size BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own media" ON public.media FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own media" ON public.media FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own media" ON public.media FOR DELETE USING (auth.uid() = user_id);

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true);

-- Storage policies
CREATE POLICY "Users can view their own media files" ON storage.objects FOR SELECT USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can upload their own media files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own media files" ON storage.objects FOR DELETE USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);
