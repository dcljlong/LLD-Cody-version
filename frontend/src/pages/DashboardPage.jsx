import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dashboardApi } from '../lib/api';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Target,
  ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

const DASHBOARD_LAYOUT_STORAGE_KEY = 'lld_dashboard_layout_v1';

const DEFAULT_DASHBOARD_LAYOUT = {
  preset: 'standard',
  widgets: {
    stats: true,
    blockedDelayed: true,
    concernsAtRisk: true,
    overdue: true,
    dueToday: true,
    dueThisWeek: true,
    recentlyCompleted: false,
    quickActions: true
  }
};

const readDashboardLayout = () => {
  try {
    const raw = localStorage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY);
    if (!raw) return DEFAULT_DASHBOARD_LAYOUT;

    const parsed = JSON.parse(raw);
    return {
      preset: parsed.preset || DEFAULT_DASHBOARD_LAYOUT.preset,
      widgets: {
        ...DEFAULT_DASHBOARD_LAYOUT.widgets,
        ...(parsed.widgets || {})
      }
    };
  } catch {
    return DEFAULT_DASHBOARD_LAYOUT;
  }
};

const StatusBadge = ({ status }) => {
  const styles = {
    BLOCKED: 'bg-red-600 text-white border-red-700',
    DELAYED: 'bg-orange-600 text-white border-orange-700',
    AT_RISK: 'bg-card text-black border-amber-600',
    ON_TRACK: 'bg-emerald-600 text-white border-emerald-700',
    COMPLETED: 'bg-zinc-600 text-white border-zinc-700'
  };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-bold uppercase tracking-wide border shadow-sm ${styles[status] || styles.ON_TRACK}`}>
      {status?.replace('_', ' ')}
    </span>
  );
};

const PriorityBadge = ({ priority }) => {
  const styles = {
    critical: 'inline-flex items-center px-3 py-1 rounded-md text-sm font-bold uppercase tracking-wide border border-red-500 bg-red-500/20 text-red-400',
    high: 'inline-flex items-center px-3 py-1 rounded-md text-sm font-bold uppercase tracking-wide border border-orange-500 bg-orange-500/20 text-orange-400',
    medium: 'inline-flex items-center px-3 py-1 rounded-md text-sm font-bold uppercase tracking-wide border border-amber-500 bg-amber-500/20 text-amber-400',
    low: 'inline-flex items-center px-3 py-1 rounded-md text-sm font-bold uppercase tracking-wide border border-blue-500 bg-blue-500/15 text-blue-300',
    deferred: 'inline-flex items-center px-3 py-1 rounded-md text-sm font-bold uppercase tracking-wide border border-slate-500 bg-slate-500/15 text-slate-300'
  };

  return (
    <span className={styles[priority] || styles.low}>
      {priority || 'low'}
    </span>
  );
};

const priorityRank = {
  CRITICAL: 0,
  high: 1,
  medium: 2,
  low: 3,
  deferred: 4
};

const gateStatusRank = {
  BLOCKED: 0,
  DELAYED: 1,
  AT_RISK: 2,
  ON_TRACK: 3,
  COMPLETED: 4
};

const getDateValue = (value) => {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
};

const sortActionItems = (items = []) => {
  return [...items].sort((a, b) => {
    const priorityDiff = (priorityRank[a.priority] ?? 99) - (priorityRank[b.priority] ?? 99);
    if (priorityDiff !== 0) return priorityDiff;

    const dueDiff = getDateValue(a.due_date) - getDateValue(b.due_date);
    if (dueDiff !== 0) return dueDiff;

    return getDateValue(b.created_at) - getDateValue(a.created_at);
  });
};

const sortGateItems = (items = []) => {
  return [...items].sort((a, b) => {
    const statusDiff = (gateStatusRank[a.status] ?? 99) - (gateStatusRank[b.status] ?? 99);
    if (statusDiff !== 0) return statusDiff;

    const requiredDiff = getDateValue(a.required_by_date) - getDateValue(b.required_by_date);
    if (requiredDiff !== 0) return requiredDiff;

    return getDateValue(b.created_at) - getDateValue(a.created_at);
  });
};

const DashboardPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dashboardLayout, setDashboardLayout] = useState(readDashboardLayout);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const refreshLayout = () => setDashboardLayout(readDashboardLayout());

    window.addEventListener('storage', refreshLayout);
    window.addEventListener('lld-dashboard-layout-updated', refreshLayout);

    return () => {
      window.removeEventListener('storage', refreshLayout);
      window.removeEventListener('lld-dashboard-layout-updated', refreshLayout);
    };
  }, []);

  const fetchData = async () => {
    try {
      const dashRes = await dashboardApi.getSummary();
      setData(dashRes.data);
    } catch (error) {
      toast.error('Failed to load dashboard');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = (item, type) => {
    if (type === 'gate') {
      navigate('/gates');
      return;
    }
    navigate('/action-items');
  };

  const handleStatClick = (route) => {
    navigate(route);
  };

  const SectionCard = ({
    title,
    count,
    icon,
    tone = 'default',
    emptyText,
    children,
    testId
  }) => {
    const toneClasses = {
      critical: {
        card: 'border-red-500/45 bg-gradient-to-br from-slate-950 via-slate-950 to-red-950/25 shadow-[0_20px_60px_rgba(127,29,29,0.20)]',
        header: 'border-red-500/25 bg-red-500/10',
        title: 'text-red-200',
        count: 'border-red-400/55 bg-red-500/15 text-red-100'
      },
      warning: {
        card: 'border-primary/40 bg-gradient-to-br from-slate-950 via-slate-950 to-primary/10 shadow-[0_20px_60px_rgba(245,190,80,0.14)]',
        header: 'border-primary/25 bg-primary/10',
        title: 'text-primary',
        count: 'border-primary/45 bg-primary/15 text-primary'
      },
      risk: {
        card: 'border-amber-400/40 bg-gradient-to-br from-slate-950 via-slate-950 to-amber-950/20 shadow-[0_20px_60px_rgba(120,53,15,0.15)]',
        header: 'border-amber-400/25 bg-amber-400/10',
        title: 'text-amber-200',
        count: 'border-amber-400/45 bg-amber-400/15 text-amber-100'
      },
      neutral: {
        card: 'border-primary/25 bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 shadow-[0_18px_50px_rgba(0,0,0,0.18)]',
        header: 'border-primary/20 bg-primary/8',
        title: 'text-primary',
        count: 'border-primary/35 bg-primary/10 text-primary'
      },
      success: {
        card: 'border-emerald-400/35 bg-gradient-to-br from-slate-950 via-slate-950 to-emerald-950/20 shadow-[0_18px_50px_rgba(6,78,59,0.14)]',
        header: 'border-emerald-400/25 bg-emerald-400/10',
        title: 'text-emerald-200',
        count: 'border-emerald-400/45 bg-emerald-400/15 text-emerald-100'
      }
    };

    const currentTone = toneClasses[tone] || toneClasses.neutral;

    return (
      <Card className={`ops-card overflow-hidden border rounded-2xl ${currentTone.card}`} data-testid={testId}>
        <CardHeader className={`ops-card-header flex flex-row items-center justify-between gap-3 px-5 py-4 ${currentTone.header}`}>
          <CardTitle className={`font-heading text-lg uppercase tracking-[0.12em] flex items-center gap-2 ${currentTone.title}`}>
            {icon}
            {title}
          </CardTitle>
          <span className={`inline-flex min-w-[2.25rem] items-center justify-center rounded-full border px-2.5 py-1 text-xs font-extrabold ${currentTone.count}`}>
            {count}
          </span>
        </CardHeader>
        <CardContent className="bg-slate-950/95 px-5 py-5">
          {count > 0 ? children : (
            <p className="py-4 text-center text-sm text-slate-300">{emptyText}</p>
          )}
        </CardContent>
      </Card>
    );
  };

  const StatCard = ({ label, value, icon, route, valueClassName = '', tone = 'default' }) => {
    const toneClass =
      tone === 'CRITICAL'
        ? 'border-red-400/45 bg-gradient-to-br from-slate-950 via-slate-900 to-red-950/15 hover:border-red-300'
        : tone === 'warning'
          ? 'border-primary/35 bg-gradient-to-br from-slate-950 via-slate-900 to-primary/10 hover:border-primary'
          : 'border-primary/20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 hover:border-primary/70';

    const iconBoxClass =
      tone === 'CRITICAL'
        ? 'border-red-500/40 bg-red-500/10 text-red-500'
        : tone === 'warning'
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-500'
          : 'border-primary/30 bg-primary/10 text-primary';

    const supportTextClass =
      tone === 'CRITICAL'
        ? 'text-red-500'
        : tone === 'warning'
          ? 'text-amber-500'
          : 'text-primary';

    return (
      <button
        type="button"
        onClick={() => handleStatClick(route)}
        className="w-full text-left"
      >
        <Card className={`ops-card overflow-hidden rounded-2xl border shadow-[0_18px_50px_rgba(0,0,0,0.14)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(0,0,0,0.22)] ${toneClass}`}>
          <CardContent className="p-0">
            <div className="flex items-start justify-between gap-3 px-5 pt-5">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
                <p className={`mt-2 text-4xl leading-none font-black font-heading text-foreground ${valueClassName}`.trim()}>{value}</p>
              </div>
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border shadow-sm ${iconBoxClass}`}>
                {icon}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-white/10 px-5 py-3">
              <span className={`text-[11px] font-bold uppercase tracking-[0.16em] ${supportTextClass}`}>
                Live overview
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                Open
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </CardContent>
        </Card>
      </button>
    );
  };

  const ItemCard = ({ item, type }) => {
    const cardTone =
      item.priority === 'CRITICAL' ? 'bg-card border-red-500 shadow-[0_0_0_1px_rgba(220,38,38,0.12)]' :
      item.priority === 'high' ? 'bg-card border-orange-500 shadow-[0_0_0_1px_rgba(249,115,22,0.12)]' :
      item.priority === 'medium' ? 'bg-card border-amber-500' :
      'bg-card border-slate-700';

    const leftBorder =
      item.priority === 'CRITICAL' ? 'border-l-red-600' :
      item.priority === 'high' ? 'border-l-orange-500' :
      item.priority === 'medium' ? 'border-l-amber-500' :
      'border-l-blue-500';

    return (
      <button
        type="button"
        onClick={() => handleItemClick(item, type)}
        className={`action-card p-4 mb-3 border border-l-4 rounded-md w-full text-left transition-all hover:scale-[1.01] hover:shadow-xl ${cardTone} ${leftBorder}`}
        data-testid={`item-${item.id}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-base leading-tight">{item.title || item.name}</p>
            <p className="text-xs text-slate-300 mt-1">{item.project_name}</p>
          </div>
          {type === 'gate' ? (
            <StatusBadge status={item.status} />
          ) : (
            <PriorityBadge priority={item.priority} />
          )}
        </div>
        {item.due_date && (
          <p className="text-xs text-slate-200 mt-1.5 flex items-center gap-1">
            <Clock className="w-4 h-4" />
            Due: {new Date(item.due_date).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short' })}
          </p>
        )}
        {item.required_by_date && (
          <p className="text-xs text-slate-200 mt-1.5 flex items-center gap-1">
            <Target className="w-4 h-4" />
            Required: {new Date(item.required_by_date).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short' })}
          </p>
        )}
      </button>
    );
  };

  const HeroMetric = ({ label, value, tone = 'default' }) => {
    const toneClass =
      tone === 'danger'
        ? 'text-red-400'
        : tone === 'warning'
          ? 'text-amber-300'
          : 'text-primary';

    return (
      <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-slate-400">
          {label}
        </p>
        <p className={`mt-1 font-heading text-3xl font-black leading-none ${toneClass}`}>
          {value}
        </p>
      </div>
    );
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const widgets = dashboardLayout.widgets || DEFAULT_DASHBOARD_LAYOUT.widgets;
  const visibleSectionCount = [
    widgets.blockedDelayed,
    widgets.concernsAtRisk,
    widgets.overdue,
    widgets.dueToday,
    widgets.dueThisWeek,
    widgets.recentlyCompleted
  ].filter(Boolean).length;

  const blockedDelayedItems = sortGateItems(data?.blocked_delayed || []);
  const atRiskItems = sortGateItems(data?.at_risk || []);
  const overdueItems = sortActionItems(data?.overdue || []);
  const dueTodayItems = sortActionItems(data?.due_today || []);
  const dueThisWeekItems = sortActionItems(data?.due_this_week || []);
  const completedItems = sortActionItems(data?.recently_completed || []);

  const openItemsCount = data?.summary?.open_items || 0;
  const criticalItemsCount = data?.summary?.CRITICAL_items || 0;
  const roadblocksCount = (data?.summary?.gates_blocked || 0) + (data?.summary?.gates_delayed || 0) + (data?.summary?.gates_at_risk || 0);
  const urgentTodayCount = overdueItems.length + dueTodayItems.length + blockedDelayedItems.length;

  return (
    <div className="space-y-5 pt-1" data-testid="dashboard-page">
      <section className="overflow-hidden rounded-[1.6rem] border border-primary/35 bg-gradient-to-br from-slate-950 via-slate-900 to-black shadow-[0_28px_90px_rgba(0,0,0,0.30)] relative z-0">
        <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-[1.4fr_0.9fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.26em] text-primary">
              Long Line Diary
            </p>
            <h1 className="mt-2 font-heading text-3xl font-black uppercase tracking-[0.08em] text-foreground sm:text-4xl">
              Today&apos;s Site Reality
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Capture the day, review roadblocks, and keep action items moving from one clear operations dashboard.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/diary">
                <Button className="btn-primary">
                  Open Diary <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/walkaround">
                <Button variant="secondary">
                  Quick Capture
                </Button>
              </Link>
              <Link to="/gates">
                <Button variant="secondary">
                  Roadblocks / Concerns
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <HeroMetric label="Urgent Today" value={urgentTodayCount} tone={urgentTodayCount > 0 ? 'danger' : 'default'} />
            <HeroMetric label="Open Items" value={openItemsCount} tone={openItemsCount > 0 ? 'warning' : 'default'} />
            <HeroMetric label="Critical" value={criticalItemsCount} tone={criticalItemsCount > 0 ? 'danger' : 'default'} />
            <HeroMetric label="Roadblocks" value={roadblocksCount} tone={roadblocksCount > 0 ? 'warning' : 'default'} />
          </div>
        </div>
      </section>

      {widgets.stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          <StatCard
            label="ACTIVE PROJECTS"
            value={data?.projects_count || 0}
            route="/projects"
            tone="default"
            icon={<Target className="w-9 h-9 text-primary" strokeWidth={1.75} />}
          />

          <StatCard
            label="OPEN ITEMS"
            value={data?.summary?.open_items || 0}
            route="/action-items"
            tone="warning"
            icon={<Clock className="w-9 h-9 text-amber-500" strokeWidth={1.75} />}
          />

          <StatCard
            label="CRITICAL"
            value={data?.summary?.CRITICAL_items || 0}
            route="/action-items"
            tone="CRITICAL"
            valueClassName="text-red-600"
            icon={<AlertTriangle className="w-9 h-9 text-red-600" strokeWidth={1.75} />}
          />

          <StatCard
            label="ROADBLOCKS / CONCERNS"
            value={(data?.summary?.gates_blocked || 0) + (data?.summary?.gates_delayed || 0) + (data?.summary?.gates_at_risk || 0)}
            route="/gates"
            tone="warning"
            valueClassName="text-amber-600"
            icon={<Target className="w-9 h-9 text-amber-500" strokeWidth={1.75} />}
          />
        </div>
      )}

      {visibleSectionCount > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {widgets.blockedDelayed && (
            <SectionCard
              title="Blocked / Delayed Roadblocks"
              count={blockedDelayedItems.length}
              icon={<AlertTriangle className="w-4 h-4" />}
              tone="critical"
              emptyText="No blocked roadblocks"
              testId="blocked-delayed-section"
            >
              {blockedDelayedItems.map(item => (
                <ItemCard key={item.id} item={item} type={item.type} />
              ))}
            </SectionCard>
          )}

          {widgets.concernsAtRisk && (
            <SectionCard
              title="Concerns / At Risk"
              count={atRiskItems.length}
              icon={<AlertTriangle className="w-4 h-4" />}
              tone="risk"
              emptyText="No concerns at risk"
              testId="at-risk-section"
            >
              {atRiskItems.map(item => (
                <ItemCard key={item.id} item={item} type={item.type} />
              ))}
            </SectionCard>
          )}

          {widgets.overdue && (
            <SectionCard
              title="Overdue"
              count={overdueItems.length}
              icon={<Clock className="w-4 h-4" />}
              tone="warning"
              emptyText="No overdue items"
              testId="overdue-section"
            >
              {overdueItems.map(item => (
                <ItemCard key={item.id} item={item} type="action" />
              ))}
            </SectionCard>
          )}

          {widgets.dueToday && (
            <SectionCard
              title="Due Today"
              count={dueTodayItems.length}
              icon={<Calendar className="w-4 h-4" />}
              tone="neutral"
              emptyText="Nothing due today"
              testId="due-today-section"
            >
              {dueTodayItems.map(item => (
                <ItemCard key={item.id} item={item} type="action" />
              ))}
            </SectionCard>
          )}

          {widgets.dueThisWeek && (
            <SectionCard
              title="Due This Week"
              count={dueThisWeekItems.length}
              icon={<Calendar className="w-4 h-4" />}
              tone="neutral"
              emptyText="Nothing due this week"
              testId="due-week-section"
            >
              {dueThisWeekItems.map(item => (
                <ItemCard key={item.id} item={item} type="action" />
              ))}
            </SectionCard>
          )}

          {widgets.recentlyCompleted && (
            <SectionCard
              title="Recently Completed"
              count={completedItems.length}
              icon={<CheckCircle2 className="w-4 h-4" />}
              tone="success"
              emptyText="No recent completions"
              testId="completed-section"
            >
              {completedItems.map(item => (
                <ItemCard key={item.id} item={item} type="action" />
              ))}
            </SectionCard>
          )}
        </div>
      )}

      {widgets.quickActions && (
        <section className="rounded-2xl border border-primary/30 bg-gradient-to-br from-slate-950 via-slate-900 to-primary/10 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-primary">
                Quick Actions
              </p>
              <p className="mt-1 text-sm text-slate-300">
                Jump straight into today&apos;s diary workflow.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/diary">
                <Button className="btn-primary">
                  Open Diary <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link to="/walkaround">
                <Button variant="secondary" data-testid="quick-walkaround">
                  Quick Capture
                </Button>
              </Link>
              <Link to="/projects">
                <Button variant="secondary" data-testid="view-projects">
                  View Projects
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default DashboardPage;