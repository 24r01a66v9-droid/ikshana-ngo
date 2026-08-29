-- Supabase Database Schema Setup for Ikshana Foundation
-- Run this in the SQL Editor of your Supabase Dashboard
-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
-- Ensure specific admin email has admin role
-- (Alternatively, you can manually update the role or register first then update it)
CREATE OR REPLACE FUNCTION handle_new_user_role()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email = '24r01a66v9@cmrithyderabad.edu.in' THEN
        NEW.role := 'admin';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE TRIGGER on_user_register
    BEFORE INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user_role();
-- 2. Photos Table
CREATE TABLE IF NOT EXISTS photos (
    id SERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    title TEXT,
    category TEXT NOT NULL, -- 'gallery', 'event', 'about', 'hero'
    sub_category TEXT,      -- e.g., event title
    is_featured INTEGER DEFAULT 0,
    date TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
-- 3. Videos Table
CREATE TABLE IF NOT EXISTS videos (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    thumbnail TEXT,
    category TEXT,
    date TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
-- 4. Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    user_name TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
-- 5. Medical Requests Table
CREATE TABLE IF NOT EXISTS medical_requests (
    id SERIAL PRIMARY KEY,
    patient_name TEXT NOT NULL,
    contact_number TEXT NOT NULL,
    emergency_details TEXT NOT NULL,
    hospital_name TEXT,
    required_amount TEXT,
    documents TEXT, -- JSON string or array of URLs
    status TEXT DEFAULT 'pending',
    expiry_date TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
-- 6. RSVPs Table
CREATE TABLE IF NOT EXISTS rsvps (
    id SERIAL PRIMARY KEY,
    event_id INTEGER,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
-- Optional: Setup Storage Buckets
-- Note: Make sure to enable public access on 'photos' bucket in Supabase dashboard
-- or write appropriate RLS policies for uploads/deletes.
