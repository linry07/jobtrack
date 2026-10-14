import { useMemo } from 'react';
import {
  FileText,
  Users,
  Trophy,
  TrendingUp,
  BarChart3,
  Clock,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useJobTrack } from '../context/JobTrackContext';
import { useAuth } from '../context/AuthContext';

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const activityDotColors: Record<string, string> = {
  status_change: 'bg-brand-500',
  interview: 'bg-amber-500',
  note: 'bg-emerald-500',
  follow_up: 'bg-blue-500',
};

export default function Dashboard() {
  const { applications, activities } = useJobTrack();
  const { user } = useAuth();
  const displayName = user?.user_metadata?.display_name?.trim() || user?.email?.split('@')[0] || 'there';

  const totalApps = applications.length;
  const interviews = applications.filter((a) => a.status === 'interviewing').length;
  const offers = applications.filter((a) => a.status === 'offer').length;
  const responseRate = totalApps > 0 ? Math.round(((interviews + offers) / totalApps) * 100) : 0;

  // Real current month stats
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const appsThisMonth = applications.filter((a) => a.appliedDate?.startsWith(currentMonthKey)).length;

  const stats = [
    {
      label: 'Total Applications',
      value: totalApps,
      change: totalApps === 0 ? 'No applications yet' : appsThisMonth > 0 ? `+${appsThisMonth} this month` : '0 added this month',
      icon: FileText,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Interviews',
      value: interviews,
      change: totalApps === 0 ? 'No interviews yet' : interviews > 0 ? `${interviews} in progress` : '0 in progress',
      icon: Users,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      label: 'Offers',
      value: offers,
      change: totalApps === 0 ? 'No offers yet' : offers > 0 ? `${offers} received` : '0 received',
      icon: Trophy,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'Response Rate',
      value: `${responseRate}%`,
      change: totalApps === 0 ? 'No responses yet' : `${interviews + offers} of ${totalApps} responded`,
      icon: TrendingUp,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
    },
  ];

  // Dynamic monthly application trends computed from authenticated user's real applications
  const monthlyTrends = useMemo(() => {
    if (applications.length === 0) return [];

    const months: { month: string; key: string; applied: number; interviews: number }[] = [];
    const currentDate = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const month = d.toLocaleString('en-US', { month: 'short' });
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ month, key, applied: 0, interviews: 0 });
    }

    applications.forEach((app) => {
      if (!app.appliedDate) return;
      const key = app.appliedDate.slice(0, 7);
      const match = months.find((m) => m.key === key);
      if (match) {
        match.applied += 1;
        if (app.status === 'interviewing' || app.status === 'offer') {
          match.interviews += 1;
        }
      }
    });

    return months;
  }, [applications]);

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Welcome back, {displayName} — here&rsquo;s your job search overview
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all duration-200 animate-slide-up"
            style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 ${stat.iconBg} rounded-lg flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
              </div>
            </div>
            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{stat.value}</p>
            <p className={`text-xs mt-1.5 font-medium ${totalApps === 0 ? 'text-slate-400' : 'text-emerald-600'}`}>
              {stat.change}
            </p>
          </div>
        ))}
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Application Trends Chart */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="w-4.5 h-4.5 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Application Trends</h2>
          </div>
          {totalApps === 0 ? (
            <div className="h-[280px] flex flex-col items-center justify-center text-center p-6">
              <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 mb-3">
                <BarChart3 className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">No application trends yet</p>
              <p className="text-xs text-slate-500 max-w-xs mt-1">
                Your application volume and interview trends over time will appear here once you track your applications.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyTrends} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorApplied" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                    padding: '10px 14px',
                    fontSize: '13px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="applied"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#colorApplied)"
                  name="Applied"
                />
                <Area
                  type="monotone"
                  dataKey="interviews"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fill="transparent"
                  strokeDasharray="5 5"
                  name="Interviews"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-5">
            <Clock className="w-4.5 h-4.5 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Recent Activity</h2>
          </div>
          <div className="space-y-0">
            {activities.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">No recent activity</p>
            ) : (
              activities.slice(0, 6).map((activity, index) => (
                <div
                  key={activity.id}
                  className={`flex items-start gap-3 py-3 ${
                    index !== Math.min(5, activities.length - 1)
                      ? 'border-b border-slate-100'
                      : ''
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${activityDotColors[activity.type] || 'bg-brand-500'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-900">
                      <span className="font-semibold">{activity.company}</span>
                      <span className="text-slate-500"> · {activity.position}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{activity.action}</p>
                    <p className="text-xs text-slate-400 mt-1">{formatDate(activity.date)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
