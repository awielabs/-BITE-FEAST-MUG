import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://utabaevwryavresmdnek.supabase.co';
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const rawSecretKey = process.env.SUPABASE_SECRET_KEY || '';

// Clean secret key if user pasted masked placeholder with bullet points
const secretKey = (rawSecretKey && !rawSecretKey.includes('•') && rawSecretKey.length > 20)
  ? rawSecretKey
  : null;

/**
 * Public Supabase client using Publishable Key
 * Safe for querying public tables like menu_items, café info, etc.
 */
export const supabase = publishableKey
  ? createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false },
    })
  : null;

/**
 * Admin Supabase client using Secret Key (Service Role)
 * Used for backend-only privileged tasks (e.g. creating orders, managing store status)
 */
export const supabaseAdmin = secretKey
  ? createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : supabase; // Fallback to public client if secret key is not yet set

/**
 * Quick diagnostic check for Supabase connectivity
 * Used by /api/ping and /api/health to monitor database state
 */
export async function checkSupabaseConnection() {
  if (!supabaseUrl) {
    return {
      connected: false,
      configured: false,
      message: 'SUPABASE_URL is missing',
    };
  }

  if (!publishableKey && !secretKey) {
    return {
      connected: false,
      configured: false,
      url: supabaseUrl,
      message: 'Neither SUPABASE_PUBLISHABLE_KEY nor SUPABASE_SECRET_KEY is configured',
    };
  }

  try {
    const client = supabaseAdmin || supabase;
    // Attempt a lightweight fetch from Supabase to verify connectivity
    const startTime = Date.now();
    const { error } = await client
      .from('menu_items')
      .select('count', { count: 'exact', head: true });

    const latencyMs = Date.now() - startTime;

    if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
      // 42P01 is table does not exist yet, which still means connection succeeded
      return {
        connected: true,
        configured: true,
        url: supabaseUrl,
        latencyMs,
        hasSecretKey: Boolean(secretKey),
        hasPublishableKey: Boolean(publishableKey),
        note: error.message,
      };
    }

    return {
      connected: true,
      configured: true,
      url: supabaseUrl,
      latencyMs,
      hasSecretKey: Boolean(secretKey),
      hasPublishableKey: Boolean(publishableKey),
    };
  } catch (err) {
    return {
      connected: false,
      configured: true,
      url: supabaseUrl,
      error: err.message,
      hasSecretKey: Boolean(secretKey),
      hasPublishableKey: Boolean(publishableKey),
    };
  }
}
