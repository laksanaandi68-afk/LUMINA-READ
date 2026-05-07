import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/['"]/g, '');
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim().replace(/['"]/g, '');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase Config Error: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing.');
} else {
  // Key Validation logic
  if (!supabaseUrl.startsWith('https://')) {
    console.warn('Supabase Alert: URL should start with https://');
  }
  if (supabaseAnonKey.length > 0 && supabaseAnonKey.length < 50) {
    console.error('Supabase CRITICAL: Anon Key terlalu pendek! Harusnya berupa string sangat panjang (JWT).');
  }
  if (supabaseUrl.includes('eyJ')) {
    console.error('Supabase CRITICAL: Terbalik! Anda memasukkan API KEY di kolom URL.');
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'lumina-read-auth-stable'
  },
  global: {
    headers: { 'x-application-name': 'lumina-read' }
  }
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, userId?: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: userId,
    },
    operationType,
    path
  };
  console.error('Database Error Context:', JSON.stringify(errInfo, null, 2));
  return errInfo;
}
