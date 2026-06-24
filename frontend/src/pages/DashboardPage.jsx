import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dashboardApi, programmesApi } from '../lib/api';
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
    quickActions: false
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
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  deferred: 4
}; // dashboard-priority-normalise-v2

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
    const priorityDiff = (priorityRank[String(a.priority || '').toLowerCase()] ?? 99) - (priorityRank[String(b.priority || '').toLowerCase()] ?? 99);
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


const normaliseApiItems = (res) => {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.value)) return res.data.value;
  if (Array.isArray(res?.data?.items)) return res.data.items;
  if (Array.isArray(res?.data?.programmes)) return res.data.programmes;
  if (Array.isArray(res?.data?.tasks)) return res.data.tasks;
  return [];
};

const getTaskWindowDate = (task = {}) => {
  return task.programme_start_date || task.start_date || task.start || task.end_date || task.due_date || '';
};

const DashboardPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dashboardLayout, setDashboardLayout] = useState(readDashboardLayout);
  const [lookaheadWeeks, setLookaheadWeeks] = useState(3); // dashboard-control-board-certification-v2
  const [programmeLookaheadItems, setProgrammeLookaheadItems] = useState([]);
  const [programmeLookaheadLoading, setProgrammeLookaheadLoading] = useState(false);
  const [programmeLookaheadError, setProgrammeLookaheadError] = useState('');
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

  useEffect(() => {
    let cancelled = false;

    const loadProgrammeLookahead = async () => {
      const projectRows = Array.isArray(data?.site_reality_projects)
        ? data.site_reality_projects
        : Array.isArray(data?.resource_projects)
          ? data.resource_projects
          : Array.isArray(data?.resource_rollup?.resource_projects)
            ? data.resource_rollup.resource_projects
            : [];

      const projectsForLookahead = projectRows
        .map((project) => ({
          id: project.project_id || project.id,
          label: project.job_number
            ? `${project.job_number} - ${project.project_name || project.name || 'Project'}`
            : (project.project_name || project.name || 'Project')
        }))
        .filter((project) => !!project.id)
        .slice(0, 6);

      if (projectsForLookahead.length === 0) {
        setProgrammeLookaheadItems([]);
        setProgrammeLookaheadError('');
        return;
      }

      try {
        setProgrammeLookaheadLoading(true);
        setProgrammeLookaheadError('');

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const windowEnd = new Date(today);
        windowEnd.setDate(today.getDate() + (lookaheadWeeks * 7));

        const rows = [];

        for (const project of projectsForLookahead) {
          try {
            const programmeRes = await programmesApi.getAll(project.id);
            const programmes = normaliseApiItems(programmeRes).slice(0, 3);

            for (const programme of programmes) {
              if (!programme?.id) continue;

              const tasksRes = await programmesApi.getTasks(programme.id);
              const tasks = normaliseApiItems(tasksRes);

              tasks.forEach((task) => {
                const dateValue = getTaskWindowDate(task);
                if (!dateValue) return;

                const date = new Date(dateValue);
                if (Number.isNaN(date.getTime())) return;
                date.setHours(0, 0, 0, 0);

                if (date < today || date > windowEnd) return;

                rows.push({
                  id: task.id || `${programme.id}-${task.name || task.title || rows.length}`,
                  title: task.name || task.title || task.task_name || 'Programme task',
                  projectLabel: project.label,
                  programmeLabel: programme.filename || programme.name || 'Programme',
                  dateValue,
                  dateTime: date.getTime(),
                  status: task.is_tracked ? 'Tracked' : (task.status || task.owner_tag || 'Upcoming')
                });
              });
            }
          } catch (err) {
          }
        }

        rows.sort((a, b) => a.dateTime - b.dateTime || a.title.localeCompare(b.title));

        if (!cancelled) {
          setProgrammeLookaheadItems(rows.slice(0, 12));
        }
      } catch (err) {
        if (!cancelled) {
          setProgrammeLookaheadItems([]);
          setProgrammeLookaheadError('Programme lookahead unavailable');
        }
      } finally {
        if (!cancelled) {
          setProgrammeLookaheadLoading(false);
        }
      }
    };

    loadProgrammeLookahead();

    return () => {
      cancelled = true;
    };
  }, [data, lookaheadWeeks]);

  const fetchData = async () => {
    try {
      const dashRes = await dashboardApi.getSummary();
      setData(dashRes.data);
    } catch (error) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = (item, type) => {
    if (type === 'gate') {
      navigate('/gates');
      return;
    }

    const params = new URLSearchParams();
    if (item?.id) params.set('item', item.id);
    if (item?.project_id || item?.job_id) params.set('project', item.project_id || item.job_id);

    navigate(`/action-items?${params.toString()}`); // dashboard-action-clickthrough-v3
  };

  const handleStatClick = (route) => {
    navigate(route);
  };

  const formatResourceCategory = (category = '') => {
    if (category === 'plant_equipment') return 'Plant / Gear';
    if (category === 'materials') return 'Materials';
    return category || 'Resource';
  };

  const getResourceProjectLabel = (item = {}) => {
    const job = item.job_number ? `${item.job_number} - ` : '';
    return `${job}${item.project_name || 'Unknown project'}`;
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
        card: 'border-red-200 bg-red-50 shadow-sm dark:border-red-500/45 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-950 dark:to-red-950/25 dark:shadow-[0_20px_60px_rgba(127,29,29,0.20)]',
        header: 'border-red-200 bg-red-50 dark:border-red-500/25 dark:bg-red-500/10',
        title: 'text-red-700 dark:text-red-200',
        count: 'border-red-300 bg-red-100 text-red-700 dark:border-red-400/55 dark:bg-red-500/15 dark:text-red-100'
      },
      warning: {
        card: 'border-amber-200 bg-white shadow-sm dark:border-primary/40 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-950 dark:to-primary/10 dark:shadow-[0_20px_60px_rgba(245,190,80,0.14)]',
        header: 'border-amber-200 bg-amber-50 dark:border-primary/25 dark:bg-primary/10',
        title: 'text-amber-700 dark:text-primary',
        count: 'border-amber-300 bg-amber-100 text-amber-700 dark:border-primary/45 dark:bg-primary/15 dark:text-primary'
      },
      risk: {
        card: 'border-yellow-200 bg-yellow-50 shadow-sm dark:border-amber-400/40 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-950 dark:to-amber-950/20 dark:shadow-[0_20px_60px_rgba(120,53,15,0.15)]',
        header: 'border-yellow-200 bg-yellow-50 dark:border-amber-400/25 dark:bg-amber-400/10',
        title: 'text-yellow-700 dark:text-amber-200',
        count: 'border-yellow-300 bg-yellow-100 text-yellow-700 dark:border-amber-400/45 dark:bg-amber-400/15 dark:text-amber-100'
      },
      neutral: {
        card: 'border-slate-200 bg-white shadow-sm dark:border-primary/25 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:shadow-[0_18px_50px_rgba(0,0,0,0.18)]',
        header: 'border-slate-200 bg-white dark:border-primary/20 dark:bg-primary/8',
        title: 'text-slate-900 dark:text-primary',
        count: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-primary/35 dark:bg-primary/10 dark:text-primary'
      },
      success: {
        card: 'border-emerald-200 bg-emerald-50 shadow-sm dark:border-emerald-400/35 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-950 dark:to-emerald-950/20 dark:shadow-[0_18px_50px_rgba(6,78,59,0.14)]',
        header: 'border-emerald-200 bg-emerald-50 dark:border-emerald-400/25 dark:bg-emerald-400/10',
        title: 'text-emerald-700 dark:text-emerald-200',
        count: 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-400/45 dark:bg-emerald-400/15 dark:text-emerald-100'
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
        <CardContent className="bg-white px-5 py-5 dark:bg-slate-950/95">
          {count > 0 ? children : (
            <p className="py-4 text-center text-sm text-slate-600 dark:text-slate-300">{emptyText}</p>
          )}
        </CardContent>
      </Card>
    );
  };

  const StatCard = ({ label, value, icon, route, valueClassName = '', tone = 'default', testId }) => {
    const toneClass =
      tone === 'CRITICAL'
        ? 'border-red-200 bg-red-50 hover:border-red-300 dark:border-red-400/45 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-red-950/15 dark:hover:border-red-300'
        : tone === 'warning'
          ? 'border-amber-200 bg-white hover:border-amber-300 dark:border-primary/35 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-primary/10 dark:hover:border-primary'
          : 'border-slate-200 bg-white hover:border-slate-300 dark:border-primary/20 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 dark:hover:border-primary/70';

    const iconBoxClass =
      tone === 'CRITICAL'
        ? 'border-red-300 bg-red-100 text-red-600 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-500'
        : tone === 'warning'
          ? 'border-amber-300 bg-amber-100 text-amber-600 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-500'
          : 'border-amber-300 bg-amber-100 text-amber-600 dark:border-primary/30 dark:bg-primary/10 dark:text-primary';

    const supportTextClass =
      tone === 'CRITICAL'
        ? 'text-red-700 dark:text-red-500'
        : tone === 'warning'
          ? 'text-amber-700 dark:text-amber-500'
          : 'text-amber-700 dark:text-primary';

    return (
      <button
        type="button"
        onClick={() => handleStatClick(route)}
        className="w-full text-left"
        data-testid={testId}
      >
        <Card className={`ops-card overflow-hidden rounded-xl border shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:shadow-[0_18px_50px_rgba(0,0,0,0.14)] dark:hover:shadow-[0_24px_70px_rgba(0,0,0,0.22)] ${toneClass}`}>
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

            <div className="mt-4 flex items-center justify-between border-t border-slate-200 px-5 py-3 dark:border-white/10">
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
      String(item.priority || '').toLowerCase() === 'critical' ? 'bg-card border-red-500 shadow-[0_0_0_1px_rgba(220,38,38,0.12)]' :
      item.priority === 'high' ? 'bg-card border-orange-500 shadow-[0_0_0_1px_rgba(249,115,22,0.12)]' :
      item.priority === 'medium' ? 'bg-card border-amber-500' :
      'bg-card border-slate-700';

    const leftBorder =
      String(item.priority || '').toLowerCase() === 'critical' ? 'border-l-red-600' :
      item.priority === 'high' ? 'border-l-orange-500' :
      item.priority === 'medium' ? 'border-l-amber-500' :
      'border-l-blue-500';

    return (
      <button
        type="button"
        onClick={() => handleItemClick(item, type)}
        className={`action-card p-3 mb-0 border border-l-4 rounded-md w-full text-left transition-all hover:scale-[1.01] hover:shadow-xl ${cardTone} ${leftBorder}`}
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
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-black/20 dark:shadow-none">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-slate-700 dark:text-slate-400">
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
  const resourceRollup = data?.resource_rollup || {};
  const resourceIssues = Array.isArray(data?.resource_issues) ? data.resource_issues : [];
  const materialsTodayCount = resourceRollup.materials_today || data?.summary?.materials_today || 0;
  const plantGearTodayCount = resourceRollup.plant_equipment_today || data?.summary?.plant_equipment_today || 0;
  const resourceIssuesCount = resourceRollup.resource_issues_count || data?.summary?.resource_issues_count || 0;
  const jobsWithMaterialsCount = resourceRollup.jobs_with_materials || data?.summary?.jobs_with_materials || 0;
  const jobsWithPlantGearCount = resourceRollup.jobs_with_plant_equipment || data?.summary?.jobs_with_plant_equipment || 0;
  const siteRealityProjects = Array.isArray(data?.site_reality_projects)
    ? data.site_reality_projects
    : Array.isArray(data?.resource_projects)
      ? data.resource_projects
      : Array.isArray(resourceRollup.resource_projects)
        ? resourceRollup.resource_projects
        : [];

  const activeSiteRealityProjects = siteRealityProjects.slice(0, 8);
  const resourcesTodayCount = materialsTodayCount + plantGearTodayCount;
  const dueThisWeekCount = dueThisWeekItems.length;
  const programmeLookaheadCount = programmeLookaheadItems.length;
  const allClearToday = urgentTodayCount === 0 && roadblocksCount === 0 && resourceIssuesCount === 0;

  return (
    <div className="space-y-4 pt-5" data-testid="dashboard-page">
      <section className="rounded-2xl border border-primary/25 bg-card/95 p-4 shadow-sm dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-black" data-testid="dashboard-control-board-certification-v2">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-primary">Long Line Diary</p>
            <h1 className="mt-1 font-heading text-2xl font-black uppercase tracking-[0.08em] text-foreground sm:text-3xl">
              Today&apos;s Site Reality
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Critical roadblocks, due follow-ups, active jobs, and programme lookahead in one operations board.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link to="/diary">
              <Button className="btn-primary">
                Open Diary <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/walkaround">
              <Button variant="secondary">Quick Capture</Button>
            </Link>
            <Link to="/roadblocks">
              <Button variant="secondary">Roadblocks</Button>
            </Link>
            <Link to="/action-items">
              <Button variant="secondary">Action Items</Button>
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5" data-testid="dashboard-critical-control-strip-v2">
          <button type="button" onClick={() => navigate('/roadblocks')} className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-left transition hover:bg-red-500/15">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-500">Roadblocks</p>
            <p className="mt-1 text-2xl font-black">{roadblocksCount}</p>
            <p className="text-xs text-muted-foreground">Blocked, delayed, at risk</p>
          </button>
          <button type="button" onClick={() => navigate('/action-items')} className="rounded-xl border border-orange-400/40 bg-orange-500/10 p-3 text-left transition hover:bg-orange-500/15">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-500">Overdue</p>
            <p className="mt-1 text-2xl font-black">{overdueItems.length}</p>
            <p className="text-xs text-muted-foreground">Past due follow-ups</p>
          </button>
          <button type="button" onClick={() => navigate('/action-items')} className="rounded-xl border border-primary/35 bg-primary/10 p-3 text-left transition hover:bg-primary/15">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Due Today</p>
            <p className="mt-1 text-2xl font-black">{dueTodayItems.length}</p>
            <p className="text-xs text-muted-foreground">Must be dealt with today</p>
          </button>
          <button type="button" onClick={() => navigate('/action-items')} className="rounded-xl border border-slate-300 bg-white p-3 text-left transition hover:border-primary/45 hover:bg-primary/5 dark:border-slate-700 dark:bg-slate-900/70">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Due This Week</p>
            <p className="mt-1 text-2xl font-black">{dueThisWeekCount}</p>
            <p className="text-xs text-muted-foreground">Next short window</p>
          </button>
          <button type="button" onClick={() => navigate('/programme')} className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 p-3 text-left transition hover:bg-emerald-500/15">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600">Programme</p>
            <p className="mt-1 text-2xl font-black">{programmeLookaheadCount}</p>
            <p className="text-xs text-muted-foreground">{lookaheadWeeks} week lookahead</p>
          </button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]" data-testid="dashboard-certified-primary-grid-v2">
        <Card className="ops-card overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-primary/25 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-950 dark:to-slate-900" data-testid="dashboard-site-reality-jobs">
          <CardHeader className="ops-card-header flex flex-row items-start justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Active Jobs</p>
              <CardTitle className="font-heading text-base uppercase tracking-[0.12em]">Compact Site Summary</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Small job rows. Tap a row to open roadblocks, action items, or diary.</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${allClearToday ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-600' : 'border-amber-400/35 bg-amber-500/10 text-amber-600'}`}>
              {allClearToday ? 'All Clear' : 'Review'}
            </span>
          </CardHeader>
          <CardContent className="bg-white px-4 py-3 dark:bg-slate-950/95">
            {activeSiteRealityProjects.length > 0 ? (
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border" data-testid="dashboard-compact-job-summary-v2">
                {activeSiteRealityProjects.map((project) => {
                  const projectId = project.project_id || project.id;
                  const jobLabel = project.job_number ? `${project.job_number} - ${project.project_name || project.name || 'Project'}` : (project.project_name || project.name || 'Project');
                  const hasProjectActivity = project.has_activity || project.materials_today > 0 || project.plant_equipment_today > 0 || project.resource_issues_count > 0 || project.roadblocks_count > 0 || project.open_items_count > 0;

                  return (
                    <button
                      key={projectId}
                      type="button"
                      onClick={() => {
                        if (project.roadblocks_count > 0) {
                          navigate('/roadblocks');
                        } else if (project.open_items_count > 0) {
                          navigate(`/action-items?project=${projectId}`);
                        } else {
                          navigate('/diary');
                        }
                      }}
                      className="grid w-full gap-2 bg-white px-3 py-2 text-left transition hover:bg-primary/5 dark:bg-slate-950/60 dark:hover:bg-primary/10 md:grid-cols-[minmax(180px,1fr)_repeat(5,82px)_110px] md:items-center"
                      data-testid={`dashboard-compact-job-${projectId}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black uppercase tracking-[0.06em] text-foreground">{jobLabel}</p>
                        <p className="text-xs text-muted-foreground">{hasProjectActivity ? 'Activity recorded today' : 'No diary activity yet'}</p>
                      </div>

                      {[
                        ['Mat', project.materials_today || 0],
                        ['Plant', project.plant_equipment_today || 0],
                        ['Issues', project.resource_issues_count || 0],
                        ['Road', project.roadblocks_count || 0],
                        ['Actions', project.open_items_count || 0]
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between rounded-lg border border-border bg-secondary/25 px-2 py-1 md:block">
                          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
                          <p className={`text-sm font-black ${value > 0 && (label === 'Issues' || label === 'Road') ? 'text-red-600' : value > 0 ? 'text-amber-600' : ''}`}>{value}</p>
                        </div>
                      ))}

                      <span className={`w-fit rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${project.roadblocks_count > 0 ? 'border-red-400/40 bg-red-500/10 text-red-600' : project.resource_issues_count > 0 || project.open_items_count > 0 ? 'border-amber-400/35 bg-amber-500/10 text-amber-600' : 'border-emerald-400/35 bg-emerald-500/10 text-emerald-600'}`}>
                        {project.roadblocks_count > 0 ? 'Roadblock' : project.resource_issues_count > 0 || project.open_items_count > 0 ? 'Review' : 'OK'}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                No active jobs found for today.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="ops-card overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-primary/25 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-950 dark:to-slate-900" data-testid="dashboard-programme-lookahead-v2">
          <CardHeader className="ops-card-header flex flex-row items-start justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Programme Lookahead</p>
              <CardTitle className="font-heading text-base uppercase tracking-[0.12em]">Next Work Window</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Programme tasks from uploaded LLD programmes where available.</p>
            </div>
            <Link to="/programme">
              <Button variant="secondary" size="sm">Programme</Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3 bg-white px-4 py-3 dark:bg-slate-950/95">
            <div className="grid grid-cols-5 gap-1.5" data-testid="dashboard-lookahead-week-selector-v2">
              {[1, 2, 3, 4, 6].map((weeks) => (
                <button
                  key={weeks}
                  type="button"
                  onClick={() => setLookaheadWeeks(weeks)}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-black uppercase tracking-[0.08em] transition ${lookaheadWeeks === weeks ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50'}`}
                  data-testid={`dashboard-lookahead-${weeks}-weeks`}
                >
                  {weeks}w
                </button>
              ))}
            </div>

            {programmeLookaheadLoading ? (
              <div className="rounded-xl border border-border bg-secondary/30 p-3 text-sm text-muted-foreground">Loading programme lookahead...</div>
            ) : programmeLookaheadError ? (
              <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 p-3 text-sm text-amber-700">{programmeLookaheadError}</div>
            ) : programmeLookaheadItems.length > 0 ? (
              <div className="space-y-2">
                {programmeLookaheadItems.slice(0, 6).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate('/programme')}
                    className="w-full rounded-xl border border-border bg-secondary/25 px-3 py-2 text-left transition hover:bg-primary/5"
                    data-testid={`dashboard-programme-lookahead-item-${item.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{item.title}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.projectLabel}</p>
                      </div>
                      <span className="shrink-0 rounded border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-primary">
                        {new Date(item.dateValue).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-3 text-sm text-muted-foreground">
                No programme tasks found in the selected {lookaheadWeeks} week window.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="ops-card overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-primary/25 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-950 dark:to-slate-900" data-testid="dashboard-attention-board-v2">
        <CardHeader className="ops-card-header flex flex-row items-start justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Critical Attention Board</p>
            <CardTitle className="font-heading text-base uppercase tracking-[0.12em]">Roadblocks, Overdue, Due Now</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">One compact board. No dead gaps. Critical and overdue stay visible.</p>
          </div>
        </CardHeader>
        <CardContent className="bg-white px-4 py-3 dark:bg-slate-950/95">
          <div className="grid gap-3 xl:grid-cols-4" data-testid="dashboard-attention-lanes-v2">
            {[
              ['Blocked / Delayed', blockedDelayedItems, 'gate', 'No blocked roadblocks'],
              ['Overdue', overdueItems, 'action', 'No overdue follow-ups'],
              ['Due Today', dueTodayItems, 'action', 'Nothing due today'],
              ['Due This Week', dueThisWeekItems, 'action', 'Nothing due this week']
            ].map(([title, items, type, emptyText]) => (
              <div key={title} className="rounded-xl border border-border bg-secondary/20 p-2">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em]">{title}</p>
                  <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-black">{items.length}</span>
                </div>
                {items.length > 0 ? (
                  <div className="space-y-2">
                    {items.slice(0, 3).map((item) => (
                      <ItemCard key={item.id} item={item} type={type} />
                    ))}
                    {items.length > 3 && (
                      <button type="button" onClick={() => navigate(type === 'gate' ? '/roadblocks' : '/action-items')} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-primary/5">
                        View {items.length - 3} more
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-background/60 p-3 text-center text-sm text-muted-foreground">
                    {emptyText}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="ops-card overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-primary/25 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-950 dark:to-slate-900" data-testid="daily-operations-suite-card">
            <CardHeader className="ops-card-header flex flex-row items-start justify-between gap-3 px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Daily Operations</p>
                <CardTitle className="font-heading text-lg uppercase tracking-[0.12em]">Site support apps</CardTitle>
              </div>
              <span className="rounded-full border border-primary/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                Suite Links
              </span>
            </CardHeader>
            <CardContent className="bg-white px-5 py-5 dark:bg-slate-950/95">
              <p className="mb-4 text-sm text-muted-foreground">
                Open the specialist Long Line Suite apps that support today's diary. LLD stays as the daily site cockpit; timesheets, tools, and programme control stay in their own apps.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <a
                  href={process.env.REACT_APP_TIMESHEET_MANAGER_URL || 'https://timesheet-manager-two.vercel.app'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 transition hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-primary/50"
                  data-testid="daily-ops-timesheet-link"
                >
                  <p className="text-sm font-bold uppercase tracking-[0.12em]">Timesheets</p>
                  <p className="mt-1 text-xs text-muted-foreground">Labour entry, PM approval, admin approval, payroll/export.</p>
                </a>
                <a
                  href={process.env.REACT_APP_TOOL_TRACKER_URL || 'https://tool-tracker-enterprise.vercel.app'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 transition hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-primary/50"
                  data-testid="daily-ops-tooltracker-link"
                >
                  <p className="text-sm font-bold uppercase tracking-[0.12em]">Tool Tracker</p>
                  <p className="mt-1 text-xs text-muted-foreground">Tool allocation, expected returns, certificates, compliance.</p>
                </a>
                <a
                  href={process.env.REACT_APP_FITOUTOS_URL || 'https://fitout-os-project.vercel.app'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 transition hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-primary/50"
                  data-testid="daily-ops-fitoutos-link"
                >
                  <p className="text-sm font-bold uppercase tracking-[0.12em]">FitoutOS</p>
                  <p className="mt-1 text-xs text-muted-foreground">Programme control, actual labour visibility, risk and recovery.</p>
                </a>
                <a
                  href={process.env.REACT_APP_LONG_LINE_SUITE_LAUNCHER_URL || 'https://long-line-suite-launcher.vercel.app'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 transition hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-primary/50"
                  data-testid="daily-ops-launcher-link"
                >
                  <p className="text-sm font-bold uppercase tracking-[0.12em]">Launcher</p>
                  <p className="mt-1 text-xs text-muted-foreground">Open the Long Line Suite app hub.</p>
                </a>
              </div>
            </CardContent>
          </Card>

      {/* Bottom duplicate command strip removed - dashboard-control-board-certification-v2 */}
    </div>
  );
};

export default DashboardPage;
