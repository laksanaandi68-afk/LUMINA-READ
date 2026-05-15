-- =========================
-- LUMINA READ FINAL SCHEMA (FIXED)
-- =========================

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  username TEXT UNIQUE,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  avatar_url TEXT,
  phone_number TEXT,
  monthly_target INTEGER DEFAULT 5,
  daily_target INTEGER DEFAULT 20,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. BOOKS
CREATE TABLE IF NOT EXISTS public.books (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  genre TEXT,
  synopsis TEXT,
  content TEXT DEFAULT '',
  cover_url TEXT,
  total_pages INTEGER DEFAULT 100,
  current_page INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Belum Dimulai',
  rating DECIMAL DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. READING TRACKS
CREATE TABLE IF NOT EXISTS public.reading_tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_id UUID REFERENCES public.books(id) ON DELETE CASCADE,
  progress INTEGER DEFAULT 0,
  last_page INTEGER DEFAULT 1,
  total_pages INTEGER DEFAULT 100,
  daily_target INTEGER DEFAULT 10,
  is_finished BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- 4. POSTS
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TESTIMONIALS
CREATE TABLE IF NOT EXISTS public.testimonials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. EVENTS (Calendar)
CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  type TEXT DEFAULT 'reading',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. READING LOGS (For Streaks)
CREATE TABLE IF NOT EXISTS public.reading_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  reading_date DATE DEFAULT CURRENT_DATE,
  pages_read INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, reading_date)
);

-- 8. REVIEWS (Personal Reading Journal)
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_id UUID REFERENCES public.books(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  mood TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Strictly private: Users can only see and manage their own reviews
DROP POLICY IF EXISTS "Reviews private access" ON public.reviews;
CREATE POLICY "Reviews private access" 
ON public.reviews 
FOR ALL 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 9. MESSAGES (Chat Support)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- Fallback for legacy support
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  sender TEXT CHECK (sender IN ('user', 'admin')), -- Fallback for legacy support
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist before creating policies
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Messages select" ON public.messages;
CREATE POLICY "Messages select" 
ON public.messages FOR SELECT
TO authenticated
USING (
  sender_id = auth.uid() OR 
  receiver_id = auth.uid() OR
  user_id = auth.uid() OR 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "Messages insert" ON public.messages;
CREATE POLICY "Messages insert" 
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' OR
  (
    sender_id = auth.uid() AND (
      EXISTS (
        SELECT 1 FROM public.friends 
        WHERE ((user_id = auth.uid() AND friend_id = receiver_id) OR (user_id = receiver_id AND friend_id = auth.uid()))
        AND status = 'accepted'
      ) OR
      receiver_id IS NULL -- Support chat with admin
    )
  )
);

DROP POLICY IF EXISTS "Messages delete" ON public.messages;
CREATE POLICY "Messages delete"
ON public.messages FOR DELETE
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- 10. BOOKMARKS (Favorites)
CREATE TABLE IF NOT EXISTS public.bookmarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_id UUID REFERENCES public.books(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Bookmarks access" ON public.bookmarks;
CREATE POLICY "Bookmarks access" 
ON public.bookmarks 
FOR ALL 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 11. FRIENDS (Social Connection)
CREATE TABLE IF NOT EXISTS public.friends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Friends access" ON public.friends;
CREATE POLICY "Friends access" 
ON public.friends 
FOR ALL 
TO authenticated 
USING (auth.uid() = user_id OR auth.uid() = friend_id)
WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

-- 12. REMINDERS (Notification System)
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  is_notified BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'done')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reminders access" ON public.reminders;
CREATE POLICY "Reminders access" 
ON public.reminders 
FOR ALL 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 13. USER TICKETS (User to Admin Reports)
CREATE TABLE IF NOT EXISTS public.user_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'diproses', 'selesai', 'ditolak')),
  admin_response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own tickets or admin all" ON public.user_tickets;
CREATE POLICY "Users view own tickets or admin all" 
ON public.user_tickets FOR SELECT 
TO authenticated 
USING (
  auth.uid() = user_id OR 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "Users create own tickets" ON public.user_tickets;
CREATE POLICY "Users create own tickets" 
ON public.user_tickets FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins update tickets" ON public.user_tickets;
CREATE POLICY "Admins update tickets" 
ON public.user_tickets FOR UPDATE 
TO authenticated 
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Admins delete tickets" ON public.user_tickets;
CREATE POLICY "Admins delete tickets" 
ON public.user_tickets FOR DELETE 
TO authenticated 
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- 14. REPORTS (Moderation System)
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'ignored')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all reports" ON public.reports;
CREATE POLICY "Admins can view all reports" 
ON public.reports FOR SELECT 
TO authenticated 
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Users can create reports" ON public.reports;
CREATE POLICY "Users can create reports" 
ON public.reports FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
CREATE POLICY "Admins can update reports"
ON public.reports FOR UPDATE
TO authenticated
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- =========================
-- RLS ENABLE
-- =========================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'banned'));
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- =========================
-- PROFILES POLICY (FIXED 🔥)
-- =========================
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

-- =========================
-- BOOKS POLICY
-- =========================
DROP POLICY IF EXISTS "Books access" ON public.books;

CREATE POLICY "Books access"
ON public.books
FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- =========================
-- READING TRACK POLICY
-- =========================
DROP POLICY IF EXISTS "Tracks access" ON public.reading_tracks;

CREATE POLICY "Tracks access"
ON public.reading_tracks
FOR ALL
USING (auth.uid() = user_id);

-- =========================
-- POSTS POLICY
-- =========================
DROP POLICY IF EXISTS "Posts public read" ON public.posts;
DROP POLICY IF EXISTS "Posts manage own" ON public.posts;

CREATE POLICY "Posts public read"
ON public.posts
FOR SELECT
USING (true);

CREATE POLICY "Posts manage own"
ON public.posts
FOR ALL
USING (auth.uid() = user_id);

-- =========================
-- TESTIMONIALS POLICY
-- =========================
DROP POLICY IF EXISTS "Testimonials public" ON public.testimonials;
DROP POLICY IF EXISTS "Testimonials own" ON public.testimonials;

CREATE POLICY "Testimonials public"
ON public.testimonials
FOR SELECT
USING (status = 'approved');

CREATE POLICY "Testimonials own"
ON public.testimonials
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =========================
-- EVENTS & LOGS POLICY
-- =========================
DROP POLICY IF EXISTS "Events access" ON public.events;
CREATE POLICY "Events access"
ON public.events
FOR ALL
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Logs access" ON public.reading_logs;
CREATE POLICY "Logs access"
ON public.reading_logs
FOR ALL
USING (auth.uid() = user_id);

-- =========================
-- PUBLIC STATS POLICY (Add this if users see 0 members)
-- =========================
DROP POLICY IF EXISTS "Public profile access" ON public.profiles;
CREATE POLICY "Public profile access"
ON public.profiles
FOR SELECT
USING (true);

-- =========================
-- FIX MISSING COLUMNS (Jika tabel sudah ada sebelumnya)
-- =========================
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS total_pages INTEGER DEFAULT 100;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Belum Dimulai';
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS current_page INTEGER DEFAULT 0;
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS content TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_target INTEGER DEFAULT 5;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_target INTEGER DEFAULT 20;

-- Pastikan kolom content tidak null dan punya default
ALTER TABLE public.books ALTER COLUMN content SET DEFAULT '';
UPDATE public.books SET content = '' WHERE content IS NULL;
ALTER TABLE public.books ALTER COLUMN content SET NOT NULL;
ALTER TABLE public.testimonials DROP CONSTRAINT IF EXISTS testimonials_status_check;
ALTER TABLE public.testimonials ADD CONSTRAINT testimonials_status_check CHECK (status IN ('pending', 'approved', 'rejected'));
ALTER TABLE public.testimonials DROP CONSTRAINT IF EXISTS testimonials_rating_check;
ALTER TABLE public.testimonials ADD CONSTRAINT testimonials_rating_check CHECK (rating >= 1 AND rating <= 5);

-- =========================
-- ENABLE REALTIME
-- =========================
-- Enable realtime for the tables we need
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

ALTER PUBLICATION supabase_realtime SET TABLE public.messages, public.reminders, public.profiles, public.friends, public.reports, public.user_tickets;

-- =========================
-- AUTO UPDATE TIMESTAMP
-- =========================
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_modtime ON public.profiles;
CREATE TRIGGER update_profiles_modtime
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE PROCEDURE update_modified_column();

-- =========================
-- AUTO CREATE PROFILE (ULTRA ROBUST 🔥)
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, username, phone_number, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'username', LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-zA-Z0-9]', '', 'g')) || SUBSTR(CAST(NEW.id AS TEXT), 1, 5)),
        COALESCE(NEW.raw_user_meta_data->>'phone_number', ''),
        CASE 
            WHEN NEW.email = 'admin@gmail.com' THEN 'admin' 
            ELSE 'user' 
        END
    )
    ON CONFLICT (id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        username = EXCLUDED.username,
        phone_number = EXCLUDED.phone_number,
        email = EXCLUDED.email;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE PROCEDURE public.handle_new_user();

-- =========================
-- FIX USER LAMA (WAJIB JALANKAN 🔥)
-- =========================
UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@gmail.com';

INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'admin'
FROM auth.users
WHERE email = 'admin@gmail.com'
AND id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO UPDATE SET role = 'admin';

INSERT INTO public.profiles (id, email)
SELECT id, email
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- Create Storage Buckets if they don't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('avatars', 'avatars', true),
  ('book-covers', 'book-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for 'avatars'
DROP POLICY IF EXISTS "Avatar Public Access" ON storage.objects;
CREATE POLICY "Avatar Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "Avatar User Upload" ON storage.objects;
CREATE POLICY "Avatar User Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Avatar User Update" ON storage.objects;
CREATE POLICY "Avatar User Update" ON storage.objects FOR UPDATE WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Avatar User Delete" ON storage.objects;
CREATE POLICY "Avatar User Delete" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- Policies for 'book-covers'
DROP POLICY IF EXISTS "Book Covers Public Access" ON storage.objects;
CREATE POLICY "Book Covers Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'book-covers');
DROP POLICY IF EXISTS "Book Covers User Upload" ON storage.objects;
CREATE POLICY "Book Covers User Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'book-covers' AND auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Book Covers User Update" ON storage.objects;
CREATE POLICY "Book Covers User Update" ON storage.objects FOR UPDATE WITH CHECK (bucket_id = 'book-covers' AND auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Book Covers User Delete" ON storage.objects;
CREATE POLICY "Book Covers User Delete" ON storage.objects FOR DELETE USING (bucket_id = 'book-covers' AND auth.role() = 'authenticated');