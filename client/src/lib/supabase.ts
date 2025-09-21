import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('Missing SUPABASE_URL environment variable')
}

if (!supabaseAnonKey) {
  throw new Error('Missing SUPABASE_ANON_KEY environment variable')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Storage helper functions for permanent public URLs
export const getPublicUrl = (path: string): string => {
  const { data } = supabase.storage.from('stickers').getPublicUrl(path)
  return data.publicUrl
}

export const getPublicUrlFromFilename = (filename: string): string => {
  // Extract path from filename if it includes folders
  const path = filename.includes('/') ? filename : `stickers/${filename}`
  return getPublicUrl(path)
}