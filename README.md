# JobTrack 💼

A modern, polished job application tracking web app inspired by Linear and Notion. Built with React, TypeScript, and Tailwind CSS.

![JobTrack Interface Preview](https://raw.githubusercontent.com/linry07/jobtrack/main/public/vite.svg) <!-- optional banner/screenshot placeholder -->

---

## ✨ Features

- **📊 Overview Dashboard:** Key application metrics (Total, Interviews, Offers, Response Rate), visual monthly trends via Recharts, and a real-time activity feed.
- **📋 Kanban Pipeline Board:** Interactive drag-and-drop board organized across 5 stages:
  - `Saved`
  - `Applied`
  - `Interviewing`
  - `Offer`
  - `Rejected`
- **📈 Comprehensive Analytics:**
  - Applications over time (bar chart)
  - Status distribution breakdown (donut chart)
  - Historical response rate trend (area chart)
  - 4-stage visual conversion funnel
- **⚡ Interactive Actions:** Add applications through a modal dialog, inspect cards with contact details, notes, and compensation, or delete entries.
- **💾 LocalStorage Persistence:** Automatically preserves all changes (additions, deletions, stage moves) across routes and page refreshes.
- **📱 Responsive UI/UX:** Clean typography (Inter), subtle borders, restrained indigo accents, and full desktop/mobile layout adaptability.

---

## 🛠️ Tech Stack

- **Framework:** [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Routing:** [React Router v7](https://reactrouter.com/)
- **Charts:** [Recharts](https://recharts.org/)
- **Icons:** [Lucide React](https://lucide.dev/)

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone git@github.com:linry07/jobtrack.git
cd jobtrack
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start local development server
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Build for production
```bash
npm run build
```

---

## 📁 Project Structure

```
src/
├── components/
│   └── layout/
│       ├── Layout.tsx         # Main responsive shell
│       └── Sidebar.tsx        # Linear-style sidebar & mobile menu
├── context/
│   └── JobTrackContext.tsx    # Central state & localStorage syncing
├── data/
│   └── sampleData.ts          # Realistic initial sample data
├── pages/
│   ├── Dashboard.tsx          # Key metrics, trends, recent activity
│   ├── Applications.tsx       # Drag-and-drop Kanban board & modals
│   └── Analytics.tsx          # Recharts visualizations & funnel
├── types/
│   └── index.ts               # Core TypeScript definitions
├── App.tsx                    # Route definitions
├── index.css                  # Global Tailwind & Inter font setup
└── main.tsx                   # App entrypoint
```

---

## 📄 License

MIT
