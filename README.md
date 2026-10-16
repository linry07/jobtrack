# JobTrack 💼

**A full-stack job application tracker with a Kanban board, job import, and real-data analytics.**

JobTrack helps you manage job applications from discovery through interviews and offers. Save opportunities, move them through a visual pipeline, import details from job postings, and track your progress—all in a cloud-synced workspace.

**[Live Demo](https://jobtrack-xi-indol.vercel.app/)**

## Features

- **Application pipeline:** Create, edit, delete, and drag applications between Saved, Applied, Interviewing, Offer, and Rejected.
- **Smart Job Import:** Paste a job-posting URL to extract available details, review the results, and correct any fields before saving. Extraction quality varies by website.
- **Google sign-in:** Authentication through Supabase Auth, with a one-time display-name onboarding step.
- **Cloud synchronization:** Store applications and activity records in Supabase PostgreSQL. Row Level Security (RLS) restricts access to each user's own records.
- **Dashboard:** Application totals, status metrics, monthly trends, and recent activity.
- **Analytics:** Application volume, status distribution, response-rate trends, a pipeline funnel, and response-time estimates based on recorded response events. Empty accounts show helpful empty states rather than sample figures.
- **Responsive design:** Usable across desktop and mobile screens.

## Tech Stack

| Area | Technologies |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Routing and charts | React Router, Recharts |
| Authentication | Supabase Auth, Google OAuth |
| Database | Supabase PostgreSQL, Row Level Security |
| Job import | Vercel API endpoints |
| Deployment | Vercel |

## How It Works

**Authentication:** Google OAuth establishes a Supabase session. First-time users choose a display name, saved to their Supabase user metadata.

**Data isolation:** Applications and activities are associated with an authenticated user ID. PostgreSQL RLS policies enforce ownership checks on reads and writes.

**Job import:** A server-side endpoint attempts to retrieve information from a job posting. Users review and edit the extracted result before adding the application.

**Analytics:** Charts are calculated from the current user's application and activity records, not hardcoded datasets. When there are no records, the app shows empty states. Average response time uses recorded response milestones where available and otherwise displays N/A.

## Getting Started

### Prerequisites

- Node.js and npm
- A Supabase project
- A Google OAuth client configured for Supabase Auth

### Install

```bash
git clone https://github.com/linry07/jobtrack.git
cd jobtrack
npm install
```

### Configure Supabase

Copy `.env.example` to `.env.local` and set:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-publishable-or-anon-key
```

Use a Supabase **publishable/anon** key, never a secret or `service_role` key in a `VITE_` variable. Do not commit `.env.local`.

Apply the schema and access policies in `supabase/migrations/` to your Supabase project. Then enable Google in Supabase Authentication and configure a Google Cloud OAuth client:

- Google's authorized redirect URI should match Supabase's OAuth callback, typically `https://<project-ref>.supabase.co/auth/v1/callback`.
- In Supabase Authentication's allowed Redirect URLs, include `http://localhost:5173/**` for local testing.

### Run locally

```bash
npm run dev
```

Open the URL shown by Vite (usually `http://localhost:5173`). For a deployed version, add the production URL to Supabase's allowed Redirect URLs and configure the environment variables in Vercel.

## Testing

```bash
npm test
npm run test:sample-data
node tests/display-name.test.mjs
node tests/login-auth-options.test.mjs
npm run build
```

The repository includes regression tests for job extraction, data-driven analytics and empty states, and authentication/onboarding UI. Supabase verification and multi-user isolation scripts are also available; those may require configured test accounts and environment variables.

## Project Structure

```text
api/                  Server-side job import endpoints
scripts/              Supabase verification utilities
src/
  components/         Shared UI and authentication components
  context/            Auth and application state
  lib/                Supabase client
  pages/              Dashboard, Applications, Analytics, Login
  types/              Shared TypeScript definitions
supabase/migrations/  PostgreSQL schema and RLS policies
tests/                Regression and integration tests
```

---

Created as a portfolio project to explore full-stack development, secure per-user data storage, API integration, and data visualization.
