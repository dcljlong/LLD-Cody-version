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
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
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
        card: 'border-red-500 bg-slate-950 shadow-[0_18px_50px_rgba(127,29,29,0.24)]',
        header: 'border-red-500/40 bg-red-950/55',
        title: 'text-red-300',
        count: 'border-red-500/60 bg-red-500/20 text-red-200'
      },
      warning: {
        card: 'border-primary/60 bg-slate-950 shadow-[0_18px_50px_rgba(249,115,22,0.18)]',
        header: 'border-primary/40 bg-primary/15',
        title: 'text-primary',
        count: 'border-primary/50 bg-primary/15 text-primary'
      },
      risk: {
        card: 'border-amber-500/70 bg-slate-950 shadow-[0_18px_50px_rgba(120,53,15,0.18)]',
        header: 'border-amber-500/35 bg-amber-500/10',
        title: 'text-amber-200',
        count: 'border-amber-500/60 bg-amber-500/20 text-amber-100'
      },
      neutral: {
        card: 'border-primary/30 bg-slate-950 shadow-xl',
        header: 'border-primary/20 bg-primary/10',
        title: 'text-primary',
        count: 'border-primary/40 bg-primary/10 text-primary'
      },
      success: {
        card: 'border-emerald-500/70 bg-slate-950 shadow-[0_18px_50px_rgba(6,78,59,0.18)]',
        header: 'border-emerald-500/35 bg-emerald-500/10',
        title: 'text-emerald-200',
        count: 'border-emerald-500/60 bg-emerald-500/20 text-emerald-100'
      }
    };

    const currentTone = toneClasses[tone] || toneClasses.neutral;

    return (
      <Card className={`ops-card overflow-hidden border ${currentTone.card}`} data-testid={testId}>
        <CardHeader className={`ops-card-header flex flex-row items-center justify-between gap-3 py-3 ${currentTone.header}`}>
          <CardTitle className={`font-heading text-lg uppercase tracking-[0.12em] flex items-center gap-2 ${currentTone.title}`}>
            {icon}
            {title}
          </CardTitle>
          <span className={`inline-flex min-w-[2.25rem] items-center justify-center rounded-full border px-2.5 py-1 text-xs font-extrabold ${currentTone.count}`}>
            {count}
          </span>
        </CardHeader>
        <CardContent className="py-3 bg-slate-950">
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
        ? 'border-red-500/80 bg-gradient-to-br from-red-950/40 via-card to-card hover:border-red-400'
        : tone === 'warning'
          ? 'border-amber-500/80 bg-gradient-to-br from-amber-950/30 via-card to-card hover:border-amber-400'
          : 'border-slate-700 bg-gradient-to-br from-slate-900/70 via-card to-card hover:border-primary';

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
        <Card className={`ops-card overflow-hidden border shadow-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl ${toneClass}`}>
          <CardContent className="p-0">
            <div className="flex items-start justify-between gap-3 px-4 pt-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
                <p className={`mt-2 text-4xl leading-none font-black font-heading text-foreground ${valueClassName}`.trim()}>{value}</p>
              </div>
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border shadow-sm ${iconBoxClass}`}>
                {icon}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-white/5 px-4 py-2.5">
              <span className={`text-[11px] font-bold uppercase tracking-[0.16em] ${supportTextClass}`}>
                Operational status
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const blockedDelayedItems = sortGateItems(data?.blocked_delayed || []);
  const atRiskItems = sortGateItems(data?.at_risk || []);
  const overdueItems = sortActionItems(data?.overdue || []);
  const dueTodayItems = sortActionItems(data?.due_today || []);
  const dueThisWeekItems = sortActionItems(data?.due_this_week || []);
  const completedItems = sortActionItems(data?.recently_completed || []);

  return (
    <div className="space-y-4" data-testid="dashboard-page">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 items-start lg:col-span-2 xl:col-span-3">
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
        </div>
      </div>
      <div className="flex gap-3">
        <Link to="/walkaround">
          <Button className="btn-primary" data-testid="quick-walkaround">
            Quick Capture <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
        <Link to="/projects">
          <Button variant="secondary" data-testid="view-projects">
            View Projects
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default DashboardPage;















































