import { Outlet } from 'react-router-dom';
import { Sidebar, MobileHeader } from './Sidebar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <MobileHeader />

      {/* Main content */}
      <main className="lg:pl-64">
        <div className="p-5 lg:p-8 max-w-7xl mx-auto animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
