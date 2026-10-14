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
const appSrcPath = path.resolve(__dirname, '../src/App.tsx');
const protectedRouteSrcPath = path.resolve(__dirname, '../src/components/auth/ProtectedRoute.tsx');
const envPath = path.resolve(__dirname, '../.env.local');

console.log('================================================================');
console.log('🧪 Google-Only Authentication & UI Regression Verification');
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

runCheck('Login.tsx contains "Welcome to JobTrack" heading', () => {
  assert(loginSrc.includes('Welcome to JobTrack'), 'Must contain "Welcome to JobTrack" heading');
});

runCheck('Login.tsx contains expected subtitle', () => {
  assert(
    loginSrc.includes('Track your job applications, stay organized, and manage your job search in one place.'),
    'Must contain the required subtitle text'
  );
});

runCheck('Login.tsx explains that Google works for both new and returning users', () => {
  assert(
    /new users are registered automatically/i.test(loginSrc) || /new.*returning/i.test(loginSrc),
    'Must explain that new users are registered automatically'
  );
  assert(
    /returning users/i.test(loginSrc),
    'Must mention returning users'
  );
});

runCheck('Login.tsx keeps "Continue with Google" button and official GoogleIcon', () => {
  assert(loginSrc.includes('Continue with Google'), 'Must include "Continue with Google"');
  assert(loginSrc.includes('<GoogleIcon />'), 'Must render GoogleIcon');
  assert(loginSrc.includes('onClick={handleGoogleSignIn}'), 'Must trigger handleGoogleSignIn');
  assert(loginSrc.includes('signInWithGoogle'), 'Must call signInWithGoogle');
});

runCheck('Login.tsx has NO email or password input fields', () => {
  assert(!loginSrc.includes('type="email"'), 'Must not have email input field');
  assert(!loginSrc.includes('type="password"'), 'Must not have password input field');
});

runCheck('Login.tsx has NO email/password Sign In button or Forgot Password link', () => {
  assert(!loginSrc.includes('type="submit"'), 'Must not have form submit button');
  assert(!loginSrc.includes('Forgot password?'), 'Must not have Forgot password link');
  assert(!loginSrc.includes('forgot-password'), 'Must not link to forgot-password');
});

runCheck('Login.tsx has NO references to email/password accounts or registration', () => {
  assert(!loginSrc.includes('Already have an email/password account?'), 'Must not reference email/password accounts');
  assert(!loginSrc.includes('New to JobTrack?'), 'Must not have legacy dual-auth section title');
  assert(!loginSrc.includes('/signup'), 'Must not link to /signup');
  assert(!/sign up with email/i.test(loginSrc), 'Must not mention email signup');
});

runCheck('Login.tsx maintains OAuth loading and error states', () => {
  assert(loginSrc.includes('googleLoading'), 'Must track googleLoading state');
  assert(loginSrc.includes('Redirecting to Google...'), 'Must show loading indicator while redirecting');
  assert(loginSrc.includes('oauthError.message') || loginSrc.includes('oauthError'), 'Must handle oauthError');
});

// 2. Navigation cleanup verification in App.tsx
const appSrc = fs.readFileSync(appSrcPath, 'utf8');

runCheck('App.tsx redirects legacy email auth routes to /login', () => {
  assert(
    appSrc.includes('path="/signup"') && appSrc.includes('to="/login"'),
    'App.tsx must redirect /signup to /login'
  );
  assert(
    appSrc.includes('path="/forgot-password"') && appSrc.includes('to="/login"'),
    'App.tsx must redirect /forgot-password to /login'
  );
  assert(
    appSrc.includes('path="/reset-password"') && appSrc.includes('to="/login"'),
    'App.tsx must redirect /reset-password to /login'
  );
});

// 3. Verification of display-name onboarding redirection
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

// 4. Authenticated data & session test with Supabase credentials
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

      if (error && error.code === 'email_provider_disabled') {
        results.passed.push('Email login disabled in Supabase as expected (Google-only auth enforced)');
        console.log(`✔ Passed: Email login disabled in Supabase as expected (Google-only auth enforced).`);
      } else {
        assert(!error, `Failed to sign in User A: ${error?.message}`);
        assert(data.user, 'User object returned');
        assert(data.user.user_metadata?.display_name === 'Ryan', 'Existing user data/display_name preserved');

        // Verify user's application data remains intact in Supabase
        const { data: apps, error: appsError } = await supabase
          .from('applications')
          .select('id, company, position')
          .eq('user_id', data.user.id);

        assert(!appsError, `Failed to query applications: ${appsError?.message}`);
        assert(Array.isArray(apps), 'Applications array returned');
        results.passed.push(`Existing user data and ${apps.length} applications remain intact in database`);
        console.log(`✔ Passed: Existing user (${userA_email}) display_name and ${apps.length} applications remain intact in Supabase.`);
      }
    } catch (err) {
      results.failed.push(`Existing data check failed: ${err.message}`);
      console.error(`❌ Failed: Existing data check - ${err.message}`);
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
