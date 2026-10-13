import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

if (!globalThis.WebSocket) {
  globalThis.WebSocket = WebSocket;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env.local');

console.log('================================================================');
console.log('🧪 Onboarding & Display Name Logic Verification');
console.log('================================================================\n');

if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local file not found!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
  }
}

const rawUrl = env.VITE_SUPABASE_URL || '';
const url = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const anonKey = (env.VITE_SUPABASE_ANON_KEY || '').trim();

const supabase = createClient(url, anonKey, { auth: { persistSession: false } });

async function run() {
  const results = { passed: [], failed: [] };

  // 1. Static code check: Dashboard must not contain hardcoded "Alex" greeting
  try {
    const dashboardSrc = fs.readFileSync(path.resolve(__dirname, '../src/pages/Dashboard.tsx'), 'utf8');
    assert(!dashboardSrc.includes('Welcome back, Alex'), 'Dashboard.tsx must not contain hardcoded "Welcome back, Alex"');
    assert(dashboardSrc.includes('Welcome back, {displayName}'), 'Dashboard.tsx must use dynamic {displayName}');
    results.passed.push('Dashboard does not contain hardcoded "Alex" and uses dynamic {displayName}');
    console.log('✔ Passed: Dashboard.tsx uses dynamic {displayName} greeting.');
  } catch (err) {
    results.failed.push(`Dashboard greeting check failed: ${err.message}`);
    console.error('❌ Failed:', err.message);
  }

  // 2. Static code check: ProtectedRoute must gate on user_metadata.display_name
  try {
    const protectedRouteSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/auth/ProtectedRoute.tsx'), 'utf8');
    assert(protectedRouteSrc.includes('user_metadata?.display_name?.trim()'), 'ProtectedRoute must check user_metadata.display_name.trim()');
    assert(protectedRouteSrc.includes('<OnboardingScreen />') || protectedRouteSrc.includes('<OnboardingScreen'), 'ProtectedRoute must render OnboardingScreen when display_name is missing');
    results.passed.push('ProtectedRoute correctly checks display_name and gates onboarding');
    console.log('✔ Passed: ProtectedRoute gates on user_metadata.display_name.');
  } catch (err) {
    results.failed.push(`ProtectedRoute check failed: ${err.message}`);
    console.error('❌ Failed:', err.message);
  }

  // 3. Authenticated test for User A (who completed onboarding)
  const userA_email = process.env.TEST_USER_A_EMAIL || env.TEST_USER_A_EMAIL;
  const userA_pass = process.env.TEST_USER_A_PASSWORD || env.TEST_USER_A_PASSWORD;
  const userB_email = process.env.TEST_USER_B_EMAIL || env.TEST_USER_B_EMAIL;
  const userB_pass = process.env.TEST_USER_B_PASSWORD || env.TEST_USER_B_PASSWORD;

  if (userA_email && userA_pass) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: userA_email,
        password: userA_pass,
      });
      assert(!error, `Failed to sign in User A: ${error?.message}`);
      assert(data.user, 'User A object returned');

      const savedDisplayName = data.user.user_metadata?.display_name?.trim();
      assert(savedDisplayName === 'Ryan', `Expected display_name 'Ryan', got '${savedDisplayName}'`);

      const hasDisplayName = Boolean(savedDisplayName);
      assert(hasDisplayName === true, 'User A should bypass onboarding (hasDisplayName = true)');

      const greetingName = data.user.user_metadata?.display_name?.trim() || data.user.email?.split('@')[0] || 'there';
      assert(greetingName === 'Ryan', `Expected greeting 'Ryan', got '${greetingName}'`);

      results.passed.push(`User A (${userA_email}) metadata has display_name 'Ryan' and bypasses onboarding`);
      console.log(`✔ Passed: User A (${userA_email}) has display_name '${savedDisplayName}', greeting evaluates to '${greetingName}', and onboarding is bypassed.`);
    } catch (err) {
      results.failed.push(`User A verification failed: ${err.message}`);
      console.error('❌ Failed User A check:', err.message);
    }
  }

  // 4. Authenticated test for User B (who has not set a display name yet)
  if (userB_email && userB_pass) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: userB_email,
        password: userB_pass,
      });
      assert(!error, `Failed to sign in User B: ${error?.message}`);
      assert(data.user, 'User B object returned');

      const savedDisplayName = data.user.user_metadata?.display_name?.trim();
      assert(!savedDisplayName, `User B display_name should be empty/unset, got '${savedDisplayName}'`);

      const hasDisplayName = Boolean(savedDisplayName);
      assert(hasDisplayName === false, 'User B must require onboarding (hasDisplayName = false)');

      // Check fallback suggested name from Google metadata
      const suggestedName = data.user.user_metadata?.full_name || data.user.user_metadata?.name || '';
      assert(suggestedName === 'Ryan', `Expected suggestedName 'Ryan' from Google metadata, got '${suggestedName}'`);

      results.passed.push(`User B (${userB_email}) without display_name correctly triggers onboarding with suggested name '${suggestedName}'`);
      console.log(`✔ Passed: User B (${userB_email}) requires onboarding, suggested name '${suggestedName}'.`);
    } catch (err) {
      results.failed.push(`User B verification failed: ${err.message}`);
      console.error('❌ Failed User B check:', err.message);
    }
  }

  console.log('\n================================================================');
  console.log(`Verification: ${results.passed.length} passed, ${results.failed.length} failed`);
  console.log('================================================================\n');

  if (results.failed.length > 0) {
    process.exit(1);
  }
}

run().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
