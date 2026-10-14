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
const loginSrcPath = path.resolve(__dirname, '../src/pages/Login.tsx');
const protectedRouteSrcPath = path.resolve(__dirname, '../src/components/auth/ProtectedRoute.tsx');
const envPath = path.resolve(__dirname, '../.env.local');

console.log('================================================================');
console.log('🧪 Login Page Auth Options & UI Regression Verification');
console.log('================================================================\n');

const results = { passed: [], failed: [] };

function runCheck(description, fn) {
  try {
    fn();
    results.passed.push(description);
    console.log(`✔ Passed: ${description}`);
  } catch (err) {
    results.failed.push(`${description}: ${err.message}`);
    console.error(`❌ Failed: ${description} - ${err.message}`);
  }
}

// 1. Static UI verification on Login.tsx
const loginSrc = fs.readFileSync(loginSrcPath, 'utf8');

runCheck('Login.tsx contains "New to JobTrack?" section header', () => {
  assert(loginSrc.includes('New to JobTrack?'), 'Must have "New to JobTrack?" section header');
});

runCheck('Login.tsx explains free account creation through Google and existing Google login', () => {
  assert(
    /create a free account.*google/i.test(loginSrc),
    'Must explain creating a free account with Google'
  );
  assert(
    /existing google users.*sign in/i.test(loginSrc) || /sign.*in.*google/i.test(loginSrc),
    'Must indicate Google sign-in works for existing Google users'
  );
});

runCheck('Login.tsx keeps "Continue with Google" button with GoogleIcon', () => {
  assert(loginSrc.includes('Continue with Google'), 'Must include "Continue with Google"');
  assert(loginSrc.includes('<GoogleIcon />'), 'Must render GoogleIcon');
  assert(loginSrc.includes('onClick={handleGoogleSignIn}'), 'Must trigger handleGoogleSignIn');
});

runCheck('Login.tsx labels email/password section "Already have an email/password account?"', () => {
  assert(
    loginSrc.includes('Already have an email/password account?'),
    'Must label section "Already have an email/password account?"'
  );
});

runCheck('Login.tsx maintains email/password form inputs, validation, and submit button', () => {
  assert(loginSrc.includes('type="email"'), 'Must have email input');
  assert(loginSrc.includes('type="password"'), 'Must have password input');
  assert(loginSrc.includes('type="submit"'), 'Must have submit button');
  assert(loginSrc.includes('Sign in'), 'Submit button text must be "Sign in"');
  assert(loginSrc.includes('Forgot password?'), 'Must retain Forgot password link');
  assert(loginSrc.includes('onSubmit={handleSubmit}'), 'Form must use handleSubmit');
  assert(loginSrc.includes('signIn(email.trim(), password)'), 'Must call signIn with email and password');
});

runCheck('Login.tsx does NOT advertise email/password registration or add email signup form', () => {
  assert(!loginSrc.includes('/signup'), 'Must not link to /signup');
  assert(!/create.*email account/i.test(loginSrc), 'Must not offer email account creation');
  assert(!/sign up with email/i.test(loginSrc), 'Must not offer email signup');
});

// 2. Verification of first-time Google user onboarding redirection
const protectedRouteSrc = fs.readFileSync(protectedRouteSrcPath, 'utf8');

runCheck('ProtectedRoute directs first-time Google users without display_name to OnboardingScreen', () => {
  assert(
    protectedRouteSrc.includes('user_metadata?.display_name?.trim()'),
    'Must check user_metadata.display_name'
  );
  assert(
    protectedRouteSrc.includes('<OnboardingScreen />') || protectedRouteSrc.includes('<OnboardingScreen'),
    'Must render OnboardingScreen when display_name is absent'
  );
});

// 3. Authenticated test with Supabase credentials if available
async function runAuthCheck() {
  if (!fs.existsSync(envPath)) return;

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
  const userA_email = process.env.TEST_USER_A_EMAIL || env.TEST_USER_A_EMAIL;
  const userA_pass = process.env.TEST_USER_A_PASSWORD || env.TEST_USER_A_PASSWORD;

  if (url && anonKey && userA_email && userA_pass) {
    try {
      const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
      const { data, error } = await supabase.auth.signInWithPassword({
        email: userA_email,
        password: userA_pass,
      });
      assert(!error, `Failed to sign in existing email user: ${error?.message}`);
      assert(data.user, 'User object returned for existing email/password account');
      results.passed.push(`Existing email/password user (${userA_email}) signs in successfully`);
      console.log(`✔ Passed: Existing email/password user (${userA_email}) signs in successfully.`);
    } catch (err) {
      results.failed.push(`Existing email login test failed: ${err.message}`);
      console.error(`❌ Failed: Existing email login check - ${err.message}`);
    }
  }
}

await runAuthCheck();

console.log('\n================================================================');
console.log(`Verification: ${results.passed.length} passed, ${results.failed.length} failed`);
console.log('================================================================\n');

if (results.failed.length > 0) {
  process.exit(1);
}
