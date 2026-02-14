import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Extremely strict check for valid URL to prevent Vercel build crashes
  const isValidUrl = (url: string | undefined): url is string => {
    if (!url) return false;
    return url.startsWith('http://') || url.startsWith('https://');
  }

  if (!isValidUrl(supabaseUrl) || !supabaseAnonKey) {
    // Return a dummy client during build time if env vars are missing or invalid
    return createBrowserClient(
      'https://placeholder.supabase.co',
      'placeholder'
    )
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
