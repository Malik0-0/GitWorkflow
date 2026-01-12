'use client';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

if (!process.env.PROJECT_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error('Missing PROJECT_URL or SUPABASE_ANON_KEY in environment');
}

export const supabase = createClient(
  process.env.PROJECT_URL,
  process.env.SUPABASE_ANON_KEY
) as SupabaseClient;