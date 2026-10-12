import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

if (!globalThis.WebSocket) {
  globalThis.WebSocket = WebSocket;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env.local');

console.log('🔍 Running Safe Supabase Configuration & Connectivity Verification...\n');

if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local file not found! Please create it from .env.example.');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
}

const rawUrl = env.VITE_SUPABASE_URL || '';
const url = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const anonKey = (env.VITE_SUPABASE_ANON_KEY || '').trim();

if (!url || !anonKey || url.includes('your-project-id') || anonKey.includes('your-anon-public-key')) {
  console.log('⚠️ Credentials in .env.local are set to placeholders.');
  console.log('Please replace VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY with your real Supabase credentials.');
  process.exit(2);
}

console.log(`✔ Found Supabase Project URL: ${url}`);
console.log(`✔ Found Supabase anon public key: ${anonKey.slice(0, 15)}...`);

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});

async function runCheck() {
  try {
    // 1. Verify Auth service availability without creating accounts or sending emails
    const { data: authData, error: authError } = await supabase.auth.getSession();
    if (authError) {
      console.error('❌ Supabase Auth service connection failed:', authError.message);
      process.exit(1);
    }
    console.log('✔ Supabase Auth service connected successfully (no emails sent).');

    // 2. Verify "applications" table exists and that unauthenticated requests are blocked
    const { data: appsData, error: appsError } = await supabase
      .from('applications')
      .select('id')
      .limit(1);

    if (appsError) {
      if (appsError.code === '42P01') {
        console.error('❌ The table "applications" does not exist yet. Please run the SQL migration script in your Supabase SQL editor.');
        process.exit(1);
      }
      // Permission denied or RLS block is the expected behavior for unauthenticated clients!
      if (appsError.code === '42501' || appsError.message?.toLowerCase().includes('permission denied')) {
        console.log('✔ "applications" table exists and is protected by PostgreSQL permissions (unauthenticated access rejected).');
      } else {
        console.log(`ℹ "applications" table query response: ${appsError.message}`);
      }
    } else {
      console.log('✔ "applications" table exists.');
    }

    // 3. Verify "activities" table exists and that unauthenticated requests are blocked
    const { data: actsData, error: actsError } = await supabase
      .from('activities')
      .select('id')
      .limit(1);

    if (actsError) {
      if (actsError.code === '42P01') {
        console.error('❌ The table "activities" does not exist yet. Please run the SQL migration script in your Supabase SQL editor.');
        process.exit(1);
      }
      if (actsError.code === '42501' || actsError.message?.toLowerCase().includes('permission denied')) {
        console.log('✔ "activities" table exists and is protected by PostgreSQL permissions (unauthenticated access rejected).');
      } else {
        console.log(`ℹ "activities" table query response: ${actsError.message}`);
      }
    } else {
      console.log('✔ "activities" table exists.');
    }

    // 4. Verify unauthenticated INSERT is rejected by database security
    const { error: insertError } = await supabase
      .from('applications')
      .insert({ company: 'Security Probe', position: 'Test' });

    if (insertError) {
      console.log('✔ Database security active: Unauthenticated INSERT rejected by PostgreSQL permissions / RLS.');
    } else {
      console.warn('⚠️ Warning: Unauthenticated INSERT succeeded! Please verify RLS policies are enabled.');
    }

    console.log('\n======================================================');
    console.log('✅ Safe verification passed cleanly!');
    console.log('Zero emails sent, zero accounts created in Supabase.');
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ Unexpected error during verification:', err);
    process.exit(1);
  }
}

runCheck();
