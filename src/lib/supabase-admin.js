import './signal-env.js';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_SCHEMA = process.env.SUPABASE_SCHEMA || 'public';
const STORAGE_DRIVER = String(process.env.RADAR_STORAGE_DRIVER || '').toLowerCase();

let supabaseAdmin = null;

export function isSupabaseEnabled() {
  if (STORAGE_DRIVER === 'sqlite') {
    return false;
  }

  return Boolean(SUPABASE_URL) && Boolean(SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabaseAdmin() {
  if (!isSupabaseEnabled()) {
    return null;
  }

  if (!supabaseAdmin) {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      db: {
        schema: SUPABASE_SCHEMA,
      },
    });
  }

  return supabaseAdmin;
}
