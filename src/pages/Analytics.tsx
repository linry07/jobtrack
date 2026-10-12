import { useEffect, useState } from 'react';
import {
  Clock,
  Target,
  CalendarDays,
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts';
import { monthlyStats } from '../data/sampleData';
import { useJobTrack } from '../context/JobTrackContext';

const responseRateData = [
  { month: 'May', rate: 35 },
  { month: 'Jun', rate: 42 },
  { month: 'Jul', rate: 38 },
  { month: 'Aug', rate: 55 },
  { month: 'Sep', rate: 48 },
  { month: 'Oct', rate: 62 },
];

const mostActiveMonth = monthlyStats.reduce((max, m) => (m.applied > max.applied ? m : max), monthlyStats[0]);

export default function Analytics() {
  const { applications } = useJobTrack();
  const [animateFunnel, setAnimateFunnel] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimateFunnel(true), 300);
    return () => clearTimeout(timer);
  }, []);

  // Dynamic status distribution
  const statusCounts = [
    { name: 'Saved', value: applications.filter((a) => a.status === 'saved').length, color: '#94a3b8' },
    { name: 'Applied', value: applications.filter((a) => a.status === 'applied').length, color: '#3b82f6' },
    { name: 'Interviewing', value: applications.filter((a) => a.status === 'interviewing').length, color: '#f59e0b' },
    { name: 'Offer', value: applications.filter((a) => a.status === 'offer').length, color: '#10b981' },
    { name: 'Rejected', value: applications.filter((a) => a.status === 'rejected').length, color: '#ef4444' },
  ];

  // Dynamic funnel and rates
  const total = applications.length;
  const responded = applications.filter((a) => a.status !== 'saved' && a.status !== 'applied').length;
  const interviewed = applications.filter((a) => a.status === 'interviewing' || a.status === 'offer').length;
  const offered = applications.filter((a) => a.status === 'offer').length;

  const funnelData = [
    { label: 'Applied', count: total, color: 'bg-brand-500', pct: 100 },
    { label: 'Responded', count: responded, color: 'bg-blue-500', pct: total > 0 ? Math.round((responded / total) * 100) : 0 },
    { label: 'Interview', count: interviewed, color: 'bg-amber-500', pct: total > 0 ? Math.round((interviewed / total) * 100) : 0 },
    { label: 'Offer', count: offered, color: 'bg-emerald-500', pct: total > 0 ? Math.round((offered / total) * 100) : 0 },
  ];

  const successRate = total > 0 ? Math.round((offered / total) * 100) : 0;

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">Insights into your job search</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          {
            label: 'Avg. Response Time',
            value: '~8 days',
            icon: Clock,
            iconBg: 'bg-blue-50',
            iconColor: 'text-blue-600',
            sub: 'Based on recent applications',
          },
          {
            label: 'Success Rate',
            value: `${successRate}%`,
            icon: Target,
            iconBg: 'bg-emerald-50',
            iconColor: 'text-emerald-600',
            sub: `${offered} offers from ${total} applications`,
          },
          {
            label: 'Most Active Month',
            value: mostActiveMonth.month,
            icon: CalendarDays,
            iconBg: 'bg-purple-50',
            iconColor: 'text-purple-600',
            sub: `${mostActiveMonth.applied} applications submitted`,
          },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition-all duration-200 animate-slide-up"
            style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
          >
            <div className={`w-10 h-10 ${stat.iconBg} rounded-lg flex items-center justify-center mb-3`}>
              <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
            </div>
            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{stat.value}</p>
            <p className="text-xs text-slate-400 mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Applications Over Time */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="w-[18px] h-[18px] text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Applications Over Time</h2>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyStats} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
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
              <Bar dataKey="applied" fill="#6366f1" radius={[4, 4, 0, 0]} name="Applied" />
              <Bar dataKey="interviews" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Interviews" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-5">
            <PieChartIcon className="w-[18px] h-[18px] text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Status Distribution</h2>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={statusCounts}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
              >
                {statusCounts.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
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
            </PieChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-4 mt-2">
            {statusCounts.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-slate-600">{item.name}</span>
                <span className="text-xs text-slate-400 font-medium">({item.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Response Rate Trend */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-[18px] h-[18px] text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Response Rate Trend</h2>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={responseRateData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
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
                unit="%"
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
                formatter={(value: any) => [`${value}%`, 'Response Rate']}
              />
              <Area
                type="monotone"
                dataKey="rate"
                stroke="#6366f1"
                strokeWidth={2.5}
                fill="url(#colorRate)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Application Funnel */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-5">
            <ArrowRight className="w-[18px] h-[18px] text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Application Funnel</h2>
          </div>
          <div className="space-y-4 mt-6">
            {funnelData.map((stage, index) => (
              <div key={stage.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-slate-700">{stage.label}</span>
                  <span className="text-sm text-slate-500">{stage.count}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-lg h-10 overflow-hidden">
                  <div
                    className={`h-full ${stage.color} rounded-lg flex items-center px-3 transition-all duration-700 ease-out`}
                    style={{
                      width: animateFunnel ? `${stage.pct}%` : '0%',
                      transitionDelay: `${index * 100}ms`,
                    }}
                  >
                    {stage.pct > 15 && (
                      <span className="text-xs font-semibold text-white">{stage.pct}%</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
