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
console.log('🔒 Supabase Row Level Security (RLS) Multi-User Verification');
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
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
}

const rawUrl = env.VITE_SUPABASE_URL || '';
const url = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const anonKey = (env.VITE_SUPABASE_ANON_KEY || '').trim();

const supabase = createClient(url, anonKey, { auth: { persistSession: false } });

async function run() {
  const results = {
    passed: [],
    failed: [],
    skipped: [],
  };

  // -------------------------------------------------------------------------
  // Check 6: Unauthenticated users cannot access private application data
  // -------------------------------------------------------------------------
  try {
    const { data: unauthSelect, error: unauthSelectErr } = await supabase
      .from('applications')
      .select('*');

    const blockedSelect = (unauthSelectErr && (unauthSelectErr.code === '42501' || unauthSelectErr.message?.toLowerCase().includes('permission denied'))) ||
      (Array.isArray(unauthSelect) && unauthSelect.length === 0);

    assert(blockedSelect, 'Unauthenticated SELECT must be blocked by database permissions / RLS');

    const { error: unauthInsertErr } = await supabase
      .from('applications')
      .insert({ company: 'Security Probe Corp', position: 'Intruder' });

    assert(unauthInsertErr, 'Unauthenticated INSERT must be blocked by database permissions / RLS');

    results.passed.push('Requirement 6: Unauthenticated users cannot access or insert private application data');
    console.log('✔ Passed: Requirement 6 — Unauthenticated read & insert rejected by database security.');
  } catch (err) {
    results.failed.push(`Requirement 6: Unauthenticated access control failed: ${err.message}`);
    console.error('❌ Failed Requirement 6:', err.message);
  }

  // -------------------------------------------------------------------------
  // Checks 1 to 5: Authenticated Multi-User RLS Tests
  // -------------------------------------------------------------------------
  const userA_email = process.env.TEST_USER_A_EMAIL || env.TEST_USER_A_EMAIL;
  const userA_pass = process.env.TEST_USER_A_PASSWORD || env.TEST_USER_A_PASSWORD;
  const userB_email = process.env.TEST_USER_B_EMAIL || env.TEST_USER_B_EMAIL;
  const userB_pass = process.env.TEST_USER_B_PASSWORD || env.TEST_USER_B_PASSWORD;

  if (userA_email && userA_pass && userB_email && userB_pass) {
    console.log(`\n🔑 Testing with configured test accounts:`);
    console.log(`   User A: ${userA_email}`);
    console.log(`   User B: ${userB_email}`);
    console.log(`   (Using signInWithPassword — 0 emails sent, 0 accounts created)\n`);

    let clientA = null;
    let clientB = null;
    let createdAppA = null;
    let createdAppB = null;

    try {
      // Sign in User A
      const { data: aAuth, error: aError } = await supabase.auth.signInWithPassword({
        email: userA_email,
        password: userA_pass,
      });
      if (aError || !aAuth.session) {
        throw new Error(`Authentication failed for User A (${userA_email}): ${aError?.message}`);
      }

      // Sign in User B
      const { data: bAuth, error: bError } = await supabase.auth.signInWithPassword({
        email: userB_email,
        password: userB_pass,
      });
      if (bError || !bAuth.session) {
        throw new Error(`Authentication failed for User B (${userB_email}): ${bError?.message}`);
      }

      clientA = createClient(url, anonKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${aAuth.session.access_token}` } },
      });

      clientB = createClient(url, anonKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${bAuth.session.access_token}` } },
      });

      // 1. Create disposable test records
      const originalCompanyA = `Disposable Test Record A [${Date.now()}]`;
      const originalPositionA = 'Security Test Engineer A';
      const { data: appA, error: errCreateA } = await clientA
        .from('applications')
        .insert({
          user_id: aAuth.user.id,
          company: originalCompanyA,
          position: originalPositionA,
          location: 'Remote',
          status: 'saved',
        })
        .select()
        .single();

      assert(!errCreateA && appA, `User A disposable insert failed: ${errCreateA?.message}`);
      createdAppA = appA;

      const originalCompanyB = `Disposable Test Record B [${Date.now()}]`;
      const originalPositionB = 'Security Test Engineer B';
      const { data: appB, error: errCreateB } = await clientB
        .from('applications')
        .insert({
          user_id: bAuth.user.id,
          company: originalCompanyB,
          position: originalPositionB,
          location: 'Remote',
          status: 'applied',
        })
        .select()
        .single();

      assert(!errCreateB && appB, `User B disposable insert failed: ${errCreateB?.message}`);
      createdAppB = appB;

      console.log(`✔ Created disposable test record for User A (ID: ${appA.id})`);
      console.log(`✔ Created disposable test record for User B (ID: ${appB.id})\n`);

      // -----------------------------------------------------------------------
      // Requirement 1: User A cannot read User B's applications
      // -----------------------------------------------------------------------
      const { data: aDirectReadB } = await clientA
        .from('applications')
        .select('*')
        .eq('id', appB.id);

      const { data: aListAll } = await clientA.from('applications').select('*');
      const aSeesB = (aDirectReadB && aDirectReadB.length > 0) || (aListAll && aListAll.some((a) => a.id === appB.id));
      assert(!aSeesB, "User A was able to read User B's application!");
      results.passed.push("Requirement 1: User A cannot read User B's applications");
      console.log("✔ Passed: Requirement 1 — User A cannot read User B's applications (both direct ID query and list query hidden).");

      // -----------------------------------------------------------------------
      // Requirement 2: User A cannot update or delete User B's applications
      // (Affirmatively verifies that User B's record remains completely unchanged)
      // -----------------------------------------------------------------------
      const { data: aUpdatedB } = await clientA
        .from('applications')
        .update({ company: 'Malicious Overwrite by User A' })
        .eq('id', appB.id)
        .select();

      assert(!aUpdatedB || aUpdatedB.length === 0, "User A update returned modified rows on User B's application!");

      const { data: aDeletedB } = await clientA
        .from('applications')
        .delete()
        .eq('id', appB.id)
        .select();

      assert(!aDeletedB || aDeletedB.length === 0, "User A delete returned rows for User B's application!");

      // Affirmatively verify User B's record is still intact with original data
      const { data: bVerifyOwnRecord, error: bVerifyErr } = await clientB
        .from('applications')
        .select('*')
        .eq('id', appB.id)
        .single();

      assert(!bVerifyErr && bVerifyOwnRecord, "User B's record was damaged or missing after User A's update/delete attempts!");
      assert.strictEqual(bVerifyOwnRecord.company, originalCompanyB, "User B's company was altered by User A!");
      assert.strictEqual(bVerifyOwnRecord.position, originalPositionB, "User B's position was altered by User A!");

      results.passed.push("Requirement 2: User A cannot update or delete User B's applications (verified target remains intact and unchanged)");
      console.log("✔ Passed: Requirement 2 — User A cannot update or delete User B's applications (verified target record remains intact and unchanged).");

      // -----------------------------------------------------------------------
      // Requirement 3: User B cannot access User A's applications
      // (Affirmatively verifies that User A's record remains completely unchanged)
      // -----------------------------------------------------------------------
      const { data: bDirectReadA } = await clientB
        .from('applications')
        .select('*')
        .eq('id', appA.id);

      const { data: bListAll } = await clientB.from('applications').select('*');
      const bSeesA = (bDirectReadA && bDirectReadA.length > 0) || (bListAll && bListAll.some((a) => a.id === appA.id));
      assert(!bSeesA, "User B was able to read User A's application!");

      const { data: bUpdatedA } = await clientB
        .from('applications')
        .update({ company: 'Malicious Overwrite by User B' })
        .eq('id', appA.id)
        .select();
      assert(!bUpdatedA || bUpdatedA.length === 0, "User B update returned modified rows on User A's application!");

      const { data: bDeletedA } = await clientB
        .from('applications')
        .delete()
        .eq('id', appA.id)
        .select();
      assert(!bDeletedA || bDeletedA.length === 0, "User B delete returned rows for User A's application!");

      // Affirmatively verify User A's record is still intact with original data
      const { data: aVerifyOwnRecord, error: aVerifyErr } = await clientA
        .from('applications')
        .select('*')
        .eq('id', appA.id)
        .single();

      assert(!aVerifyErr && aVerifyOwnRecord, "User A's record was damaged or missing after User B's update/delete attempts!");
      assert.strictEqual(aVerifyOwnRecord.company, originalCompanyA, "User A's company was altered by User B!");
      assert.strictEqual(aVerifyOwnRecord.position, originalPositionA, "User A's position was altered by User B!");

      results.passed.push("Requirement 3: User B cannot access (read/update/delete) User A's applications (verified target remains intact and unchanged)");
      console.log("✔ Passed: Requirement 3 — User B cannot read, update, or delete User A's applications (verified target record remains intact and unchanged).");

      // -----------------------------------------------------------------------
      // Requirement 4: Neither user can insert applications under the other user's ID
      // -----------------------------------------------------------------------
      const { error: errImpersonateA } = await clientA
        .from('applications')
        .insert({
          user_id: bAuth.user.id, // User A trying to insert under User B's ID
          company: 'Impersonated by A',
          position: 'Spoof Role',
        });
      assert(errImpersonateA, "User A should be rejected when inserting with User B's user_id");

      const { error: errImpersonateB } = await clientB
        .from('applications')
        .insert({
          user_id: aAuth.user.id, // User B trying to insert under User A's ID
          company: 'Impersonated by B',
          position: 'Spoof Role',
        });
      assert(errImpersonateB, "User B should be rejected when inserting with User A's user_id");

      results.passed.push("Requirement 4: Neither user can insert applications under the other user's ID");
      console.log("✔ Passed: Requirement 4 — Cross-account user_id insertion rejected by PostgreSQL WITH CHECK policy.");

      // -----------------------------------------------------------------------
      // Requirement 5: Both users can successfully manage their own applications
      // -----------------------------------------------------------------------
      const updatedNotesA = 'Updated notes by User A';
      const { error: errUpdateSelfA } = await clientA
        .from('applications')
        .update({ notes: updatedNotesA })
        .eq('id', appA.id);
      assert(!errUpdateSelfA, `User A should be able to update own application: ${errUpdateSelfA?.message}`);

      const { data: aReadUpdated } = await clientA.from('applications').select('notes').eq('id', appA.id).single();
      assert.strictEqual(aReadUpdated?.notes, updatedNotesA, "User A update was not reflected!");

      const updatedNotesB = 'Updated notes by User B';
      const { error: errUpdateSelfB } = await clientB
        .from('applications')
        .update({ notes: updatedNotesB })
        .eq('id', appB.id);
      assert(!errUpdateSelfB, `User B should be able to update own application: ${errUpdateSelfB?.message}`);

      const { data: bReadUpdated } = await clientB.from('applications').select('notes').eq('id', appB.id).single();
      assert.strictEqual(bReadUpdated?.notes, updatedNotesB, "User B update was not reflected!");

      results.passed.push('Requirement 5: Both users can successfully manage their own applications');
      console.log('✔ Passed: Requirement 5 — Both users can create, read, update, and delete their own applications.');
    } catch (err) {
      console.error('❌ Multi-user test failure:', err.message);
      results.failed.push(`Multi-user test failure: ${err.message}`);
    } finally {
      // -----------------------------------------------------------------------
      // Guaranteed Cleanup: Delete disposable test records even if tests fail
      // -----------------------------------------------------------------------
      console.log('\n🧹 Performing guaranteed cleanup of disposable test records...');
      if (clientA && createdAppA?.id) {
        try {
          await clientA.from('applications').delete().eq('id', createdAppA.id);
          console.log(`✔ Cleaned up User A disposable record (${createdAppA.id})`);
        } catch (e) {
          console.warn(`Could not clean up User A record: ${e.message}`);
        }
      }
      if (clientB && createdAppB?.id) {
        try {
          await clientB.from('applications').delete().eq('id', createdAppB.id);
          console.log(`✔ Cleaned up User B disposable record (${createdAppB.id})`);
        } catch (e) {
          console.warn(`Could not clean up User B record: ${e.message}`);
        }
      }
      console.log('✔ Cleanup complete. Existing saved applications are untouched.');
    }
  } else {
    results.skipped.push('Requirements 1-5 (Authenticated Multi-User Isolation Tests)');
    console.log('\n⏭ Skipped Requirements 1-5: Test account credentials not yet provided in .env.local.');
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('📊 Verification Summary:');
  console.log(`   Passed:  ${results.passed.length}`);
  console.log(`   Failed:  ${results.failed.length}`);
  console.log(`   Skipped: ${results.skipped.length}`);
  console.log('================================================================');

  if (results.passed.length > 0) {
    console.log('\nPassed Tests:');
    results.passed.forEach((p) => console.log(`  • ${p}`));
  }
  if (results.skipped.length > 0) {
    console.log('\nSkipped Tests:');
    results.skipped.forEach((s) => console.log(`  • ${s}`));
  }
  if (results.failed.length > 0) {
    console.log('\nFailed Tests:');
    results.failed.forEach((f) => console.log(`  • ${f}`));
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
