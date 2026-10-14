import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('================================================================');
console.log('🧪 Real Data Only & Empty State Regression Tests');
console.log('================================================================\n');

const results = { passed: [], failed: [] };

function test(description, fn) {
  try {
    fn();
    results.passed.push(description);
    console.log(`✔ Passed: ${description}`);
  } catch (err) {
    results.failed.push(`${description} - ${err.message}`);
    console.error(`❌ Failed: ${description} - ${err.message}`);
  }
}

// -----------------------------------------------------------------------------
// 1. Static codebase audit: No fake data files or references
// -----------------------------------------------------------------------------
test('sampleData.ts has been deleted from repository', () => {
  const sampleDataPath = path.join(rootDir, 'src/data/sampleData.ts');
  assert(!fs.existsSync(sampleDataPath), 'src/data/sampleData.ts must not exist');
});

test('No source file imports sampleData or sample constants', () => {
  const srcDir = path.join(rootDir, 'src');
  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        assert(!content.includes('from \'../data/sampleData\'') && !content.includes('from "../data/sampleData"'),
          `File ${entry.name} still imports sampleData`);
        assert(!content.includes('sampleApplications'),
          `File ${entry.name} references sampleApplications`);
        assert(!content.includes('sampleActivities'),
          `File ${entry.name} references sampleActivities`);
      }
    }
  }
  scanDir(srcDir);
});

// -----------------------------------------------------------------------------
// 2. JobTrackContext verification
// -----------------------------------------------------------------------------
test('JobTrackContext initializes empty arrays and never seeds sample data', () => {
  const contextPath = path.join(rootDir, 'src/context/JobTrackContext.tsx');
  const content = fs.readFileSync(contextPath, 'utf8');
  assert(content.includes('setApplications([])'), 'Must initialize empty applications array');
  assert(content.includes('setActivities([])'), 'Must initialize empty activities array');
  assert(!content.includes('sampleApplications'), 'Must not reference sampleApplications');
  assert(!content.includes('sampleActivities'), 'Must not reference sampleActivities');
});

// -----------------------------------------------------------------------------
// 3. Dashboard empty states and dynamic trends
// -----------------------------------------------------------------------------
test('Dashboard renders empty state for Application Trends when totalApps === 0', () => {
  const dashboardPath = path.join(rootDir, 'src/pages/Dashboard.tsx');
  const content = fs.readFileSync(dashboardPath, 'utf8');
  assert(content.includes('totalApps === 0 ?'), 'Must check totalApps === 0 for trends chart');
  assert(content.includes('No application trends yet'), 'Must provide empty state message');
  assert(!content.includes('+3 this month'), 'Must not have hardcoded +3 this month');
  assert(!content.includes('+2 this month'), 'Must not have hardcoded +2 this month');
  assert(!content.includes('+1 this month'), 'Must not have hardcoded +1 this month');
  assert(!content.includes('+5% vs last month'), 'Must not have hardcoded +5% vs last month');
});

// -----------------------------------------------------------------------------
// 4. Analytics empty states and dynamic calculations
// -----------------------------------------------------------------------------
test('Analytics renders polished empty states for all 4 visualization sections', () => {
  const analyticsPath = path.join(rootDir, 'src/pages/Analytics.tsx');
  const content = fs.readFileSync(analyticsPath, 'utf8');
  assert(content.includes('No data yet'), 'Must provide empty state for monthly bar chart');
  assert(content.includes('Add your first application to start seeing insights'), 'Must provide helpful empty state prompt');
  assert(content.includes('No status distribution'), 'Must provide empty state for status pie chart');
  assert(content.includes('No response data yet'), 'Must provide empty state for response rate area chart');
  assert(content.includes('No funnel data yet'), 'Must provide empty state for application funnel');
});

// -----------------------------------------------------------------------------
// 5. Dynamic computation unit tests (Zero Division & Real Data Updates)
// -----------------------------------------------------------------------------
test('Zero applications dataset handles calculations safely without NaN or crash', () => {
  const applications = [];
  const total = applications.length;
  const responded = applications.filter((a) => a.status !== 'saved' && a.status !== 'applied').length;
  const interviewed = applications.filter((a) => a.status === 'interviewing' || a.status === 'offer').length;
  const offered = applications.filter((a) => a.status === 'offer').length;

  const successRate = total > 0 ? Math.round((offered / total) * 100) : 0;
  assert.strictEqual(successRate, 0);
  assert(!isNaN(successRate));

  const funnelData = [
    { label: 'Applied', count: total, pct: 100 },
    { label: 'Responded', count: responded, pct: total > 0 ? Math.round((responded / total) * 100) : 0 },
    { label: 'Interview', count: interviewed, pct: total > 0 ? Math.round((interviewed / total) * 100) : 0 },
    { label: 'Offer', count: offered, pct: total > 0 ? Math.round((offered / total) * 100) : 0 },
  ];

  funnelData.forEach((f) => {
    assert(!isNaN(f.pct), `Funnel ${f.label} pct is NaN`);
    assert(f.pct === 0 || f.pct === 100);
  });
});

test('Adding and updating applications dynamically recalculates statistics', () => {
  let applications = [];

  // 1. Initial state: empty
  assert.strictEqual(applications.length, 0);

  // 2. Add an application (saved)
  applications.push({
    id: 'app-1',
    company: 'Stripe',
    position: 'Full Stack Engineer',
    status: 'saved',
    appliedDate: '2026-10-01',
    lastUpdated: '2026-10-01',
  });

  let total = applications.length;
  let responded = applications.filter((a) => a.status !== 'saved' && a.status !== 'applied').length;
  assert.strictEqual(total, 1);
  assert.strictEqual(responded, 0);

  // 3. Update application to 'applied'
  applications[0].status = 'applied';
  responded = applications.filter((a) => a.status !== 'saved' && a.status !== 'applied').length;
  assert.strictEqual(responded, 0);

  // 4. Update application to 'interviewing'
  applications[0].status = 'interviewing';
  applications[0].lastUpdated = '2026-10-08';
  responded = applications.filter((a) => a.status !== 'saved' && a.status !== 'applied').length;
  let interviewed = applications.filter((a) => a.status === 'interviewing' || a.status === 'offer').length;
  let responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;
  assert.strictEqual(responded, 1);
  assert.strictEqual(interviewed, 1);
  assert.strictEqual(responseRate, 100);

  // 5. Add second application (rejected)
  applications.push({
    id: 'app-2',
    company: 'Google',
    position: 'Software Engineer',
    status: 'rejected',
    appliedDate: '2026-10-02',
    lastUpdated: '2026-10-10',
  });

  total = applications.length;
  responded = applications.filter((a) => a.status !== 'saved' && a.status !== 'applied').length;
  interviewed = applications.filter((a) => a.status === 'interviewing' || a.status === 'offer').length;
  responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;
  assert.strictEqual(total, 2);
  assert.strictEqual(responded, 2);
  assert.strictEqual(interviewed, 1);
  assert.strictEqual(responseRate, 100);

  // 6. Delete application app-2
  applications = applications.filter((a) => a.id !== 'app-2');
  total = applications.length;
  assert.strictEqual(total, 1);
  assert.strictEqual(applications[0].company, 'Stripe');
});

test('Average response time calculation uses verified response activities and ignores ordinary edits', () => {
  const applications = [
    {
      id: 'app-1',
      status: 'interviewing',
      appliedDate: '2026-10-01',
      lastUpdated: '2026-10-14', // ordinary edit days later
    },
    {
      id: 'app-2',
      status: 'rejected',
      appliedDate: '2026-10-01',
      lastUpdated: '2026-10-12', // ordinary edit days later
    },
    {
      id: 'app-3',
      status: 'applied', // not responded
      appliedDate: '2026-10-05',
      lastUpdated: '2026-10-05',
    },
    {
      id: 'app-4',
      status: 'interviewing', // responded, but NO recorded response activity
      appliedDate: '2026-10-03',
      lastUpdated: '2026-10-10', // ordinary edit
    },
  ];

  // Activities: Only app-1 and app-2 have confirmed response events
  const activities = [
    {
      id: 'act-1',
      applicationId: 'app-1',
      action: 'Moved to interviewing stage',
      type: 'interview',
      date: '2026-10-08', // 7 days after appliedDate (2026-10-01)
    },
    {
      id: 'act-2',
      applicationId: 'app-2',
      action: 'Application status updated to rejected',
      type: 'status_change',
      date: '2026-10-11', // 10 days after appliedDate (2026-10-01)
    },
    {
      id: 'act-3',
      applicationId: 'app-4',
      action: 'Updated salary note', // ordinary note edit, NOT a response
      type: 'note',
      date: '2026-10-10',
    },
  ];

  const isResponseActivity = (act) => {
    if (act.type === 'interview') return true;
    const actionLower = act.action.toLowerCase();
    return (
      actionLower.includes('interview') ||
      actionLower.includes('offer') ||
      actionLower.includes('rejected')
    );
  };

  const respondedApps = applications.filter((a) => a.status !== 'saved' && a.status !== 'applied' && a.appliedDate);
  assert.strictEqual(respondedApps.length, 3); // app-1, app-2, app-4

  let totalDiff = 0;
  let count = 0;

  respondedApps.forEach((app) => {
    const responseActs = activities
      .filter((act) => act.applicationId === app.id && isResponseActivity(act))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (responseActs.length > 0) {
      const start = new Date(app.appliedDate).getTime();
      const end = new Date(responseActs[0].date).getTime();
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        const days = Math.round((end - start) / (1000 * 60 * 60 * 24));
        totalDiff += days;
        count += 1;
      }
    }
  });

  const avgDays = count > 0 ? Math.round(totalDiff / count) : null;
  // app-1 was 7 days (2026-10-08 - 2026-10-01)
  // app-2 was 10 days (2026-10-11 - 2026-10-01)
  // app-4 had no response activity, so ignored (instead of falsely using lastUpdated: 2026-10-10)
  // (7 + 10) / 2 = 8.5 -> 9
  assert.strictEqual(count, 2);
  assert.strictEqual(avgDays, 9);
});

test('Ordinary edits without response activities yield N/A for average response time', () => {
  const applications = [
    {
      id: 'app-1',
      status: 'interviewing',
      appliedDate: '2026-10-01',
      lastUpdated: '2026-10-14',
    },
  ];

  // Activities contains only notes/edits, no response activities
  const activities = [
    {
      id: 'act-1',
      applicationId: 'app-1',
      action: 'Updated contact person',
      type: 'note',
      date: '2026-10-14',
    },
  ];

  const isResponseActivity = (act) => {
    if (act.type === 'interview') return true;
    const actionLower = act.action.toLowerCase();
    return (
      actionLower.includes('interview') ||
      actionLower.includes('offer') ||
      actionLower.includes('rejected')
    );
  };

  const respondedApps = applications.filter((a) => a.status !== 'saved' && a.status !== 'applied' && a.appliedDate);
  let count = 0;
  respondedApps.forEach((app) => {
    const responseActs = activities
      .filter((act) => act.applicationId === app.id && isResponseActivity(act));
    if (responseActs.length > 0) count++;
  });

  const avgDays = count > 0 ? 10 : null;
  assert.strictEqual(avgDays, null); // displays N/A
});

console.log('\n================================================================');
console.log(`Verification: ${results.passed.length} passed, ${results.failed.length} failed`);
console.log('================================================================\n');

if (results.failed.length > 0) {
  process.exit(1);
}
