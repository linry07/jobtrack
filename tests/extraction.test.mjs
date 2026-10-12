import assert from 'node:assert';
import {
  parseDissectedTitle,
  cleanCompanyName,
  getCompanyFromDomain,
  extractCompany,
  extractJobTitle,
  extractLocation,
  extractSalary,
  extractDescription,
} from '../api/extract-job.ts';

console.log('Running Comprehensive Smart Job Import Regression Tests...\n');

// ============================================================================
// Test 1: Jane Street Software Engineer Internship (The Primary Bug)
// ============================================================================
{
  const rawTitle = 'Software Engineer Internship, New York :: Jane Street';
  const dissected = parseDissectedTitle(rawTitle);

  // Position heading on the page is prioritized:
  const html = `
    <div class="job-header">
      <h4 class="page-heading">
        Software Engineer
        Internship, May-August
      </h4>
      <div class="subheadings">
        <div class="subheading">
          <p class="label">LOCATION</p>
          <p class="name city">NYC</p>
        </div>
      </div>
    </div>
    <div class="job-content">
      <p>About the Position: Work at Jane Street.</p>
    </div>
    <div class="footnotes">
      <p class="salary-range-disclosure">Base salary is $300,000.</p>
      <div class="eeo-footnote">
        <p>Jane Street is an Equal Opportunity Employer</p>
      </div>
    </div>
  `;

  const metaMap = {};
  const parsedUrl = new URL('https://www.janestreet.com/join-jane-street/position/8599644002/');

  const company = extractCompany(null, html, metaMap, parsedUrl, dissected);
  const position = extractJobTitle(null, html, metaMap, dissected);
  const location = extractLocation(null, html, dissected);
  const salary = extractSalary(null, html);
  const description = extractDescription(null, html, metaMap);

  assert.strictEqual(company, 'Jane Street', 'Company should be Jane Street');
  assert.strictEqual(
    position,
    'Software Engineer Internship, May-August',
    'Position should preserve the full seasonal internship title from page heading'
  );
  assert.strictEqual(location, 'NYC', 'Location should be extracted from labeled field');
  assert.strictEqual(salary, 'Base salary is $300,000', 'Salary should be extracted from disclosure text');
  assert(description && description.includes('About the Position'), 'Description should be extracted');

  console.log('✔ Test 1 passed: Jane Street extraction completely accurate (Company, Title, Location, Salary)');
}

// ============================================================================
// Test 2: Title dissection when no on-page heading exists
// ============================================================================
{
  const rawTitle = 'Software Engineer Internship, New York :: Jane Street';
  const dissected = parseDissectedTitle(rawTitle);

  assert.strictEqual(dissected.company, 'Jane Street', 'Dissected company should be Jane Street');
  assert.strictEqual(dissected.position, 'Software Engineer Internship', 'Dissected position should be Software Engineer Internship');
  assert.strictEqual(dissected.location, 'New York', 'Dissected location should be New York');

  console.log('✔ Test 2 passed: Title dissection separates Role, Location, and Company properly');
}

// ============================================================================
// Test 3: Amazon SDE Internship Regression Test
// ============================================================================
{
  const rawTitle = 'Software Development Engineer Intern - Summer 2027 (USA) - Job ID: 10552937 | Amazon.jobs';
  const dissected = parseDissectedTitle(rawTitle);

  const html = `
    <div class="details-line"><p class="meta">Job ID: 10552937 | Amazon.com Services LLC</p></div>
    <div aria-label="location"><ul class="association-content"><li>USA, WA, Seattle</li><li>USA, VA, Arlington</li></ul></div>
    <div class="section"><p>Arlington, VA, USA - 109,395.00 USD Annually<br/>Seattle, WA, USA - 109,395.00 USD Annually</p></div>
  `;

  const metaMap = { 'og:site_name': 'Amazon.jobs' };
  const parsedUrl = new URL('https://www.amazon.jobs/en/jobs/10552937/software-development-engineer-intern-summer-2027-usa');

  const company = extractCompany(null, html, metaMap, parsedUrl, dissected);
  const position = extractJobTitle(null, html, metaMap, dissected);
  const location = extractLocation(null, html, dissected);
  const salary = extractSalary(null, html);

  assert.strictEqual(company, 'Amazon', 'Company should be Amazon');
  assert.strictEqual(
    position,
    'Software Development Engineer Intern - Summer 2027 (USA)',
    'Should preserve hyphens in title without interpreting them as company'
  );
  assert.strictEqual(location, 'USA, WA, Seattle | USA, VA, Arlington', 'Dual locations extracted');
  assert(salary && salary.includes('109,395'), 'Salary extracted');

  console.log('✔ Test 3 passed: Amazon internship regression test passed cleanly');
}

// ============================================================================
// Test 4: Structured JobPosting JSON-LD Takes Highest Priority
// ============================================================================
{
  const jobPosting = {
    '@type': 'JobPosting',
    title: 'Senior Distributed Systems Engineer',
    hiringOrganization: {
      name: 'Stripe, Inc.',
    },
    jobLocation: {
      address: {
        addressLocality: 'San Francisco',
        addressRegion: 'CA',
      },
    },
    baseSalary: {
      currency: 'USD',
      value: {
        minValue: 190000,
        maxValue: 240000,
        unitText: 'YEAR',
      },
    },
    description: '<p>Join our core payments team.</p>',
  };

  const html = '<h1>Some misleading title on page</h1>';
  const metaMap = { 'og:site_name': 'Stripe' };
  const parsedUrl = new URL('https://stripe.com/jobs/12345');
  const dissected = { position: 'Fallout title' };

  const company = extractCompany(jobPosting, html, metaMap, parsedUrl, dissected);
  const position = extractJobTitle(jobPosting, html, metaMap, dissected);
  const location = extractLocation(jobPosting, html, dissected);
  const salary = extractSalary(jobPosting, html);
  const description = extractDescription(jobPosting, html, metaMap);

  assert.strictEqual(company, 'Stripe, Inc.');
  assert.strictEqual(position, 'Senior Distributed Systems Engineer');
  assert.strictEqual(location, 'San Francisco, CA');
  assert.strictEqual(salary, '$190,000 - $240,000 / year');
  assert.strictEqual(description, 'Join our core payments team.');

  console.log('✔ Test 4 passed: Structured JSON-LD metadata prioritized over on-page HTML');
}

// ============================================================================
// Test 5: Third-party ATS / Job Boards (Greenhouse, Lever, Ashby, LinkedIn)
// ============================================================================
{
  const atsBoards = [
    'https://boards.greenhouse.io/stripe/jobs/12345',
    'https://jobs.lever.co/figma/12345',
    'https://jobs.ashbyhq.com/notion/12345',
    'https://www.linkedin.com/jobs/view/12345',
    'https://www.indeed.com/viewjob?jk=12345',
  ];

  for (const b of atsBoards) {
    const company = getCompanyFromDomain(new URL(b));
    assert.strictEqual(company, null, `ATS board ${b} should never be treated as the employer`);
  }

  console.log('✔ Test 5 passed: Third-party ATS domains never mistaken for employers');
}

// ============================================================================
// Test 6: Job Titles with Complex Separators (Commas, Hyphens, Slashes)
// ============================================================================
{
  const complexTitles = [
    'Software Engineer Internship, May-August',
    'Full Stack Engineer - React, Node.js & GraphQL',
    'Product Designer (UI/UX) - Design Systems & Mobile',
    'Research Scientist, AI / Deep Learning - 2026 Cohort',
  ];

  for (const t of complexTitles) {
    const dissected = parseDissectedTitle(t);
    // When no company separator like "::" or "|" is present, title is untouched
    assert.strictEqual(dissected.position, t, `Complex title should remain intact: ${t}`);
  }

  console.log('✔ Test 6 passed: Legitimate commas, hyphens, and slashes preserved in titles');
}

// ============================================================================
// Test 7: Jobs with No Compensation Listed (Never Invent Data)
// ============================================================================
{
  const htmlNoSalary = `
    <html>
      <head><title>Staff Engineer :: Figma</title></head>
      <body>
        <h1>Staff Engineer</h1>
        <p>We offer equity, 401(k), health insurance, and unlimited PTO.</p>
      </body>
    </html>
  `;

  const salary = extractSalary(null, htmlNoSalary);
  assert.strictEqual(salary, null, 'Jobs with no explicit salary MUST return null/empty');

  console.log('✔ Test 7 passed: Missing compensation correctly remains blank');
}

// ============================================================================
// Test 8: Employer Name Cleaning (No Generic Keywords or Domain Suffixes)
// ============================================================================
{
  assert.strictEqual(cleanCompanyName('Jane Street Group, LLC'), 'Jane Street Group, LLC');
  assert.strictEqual(cleanCompanyName('Amazon.jobs'), 'Amazon');
  assert.strictEqual(cleanCompanyName('Stripe.com'), 'Stripe');
  assert.strictEqual(cleanCompanyName('Jobs'), null);
  assert.strictEqual(cleanCompanyName('Careers'), null);
  assert.strictEqual(cleanCompanyName('Hiring'), null);
  assert.strictEqual(cleanCompanyName('Applicant Tracking'), null);

  console.log('✔ Test 8 passed: Employer name cleaning rejects generic labels');
}

console.log('\n======================================================');
console.log('All 8 regression test suites passed successfully! 🎉');
console.log('======================================================\n');
