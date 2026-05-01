import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  projectsApi,
  actionItemsApi,
  gatesApi,
  diaryApi,
  walkaroundApi
} from "../lib/api";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Building2,
  Calendar,
  Clock,
  FolderOpen,
  ListTodo,
  MapPin,
  Phone,
  ShieldAlert,
  Target,
  User,
  ClipboardList
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";

function normaliseList(response) {
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.value)) return data.value;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function getTodayNz() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Pacific/Auckland"
  });
}

function parseDate(value) {
  if (!value) return null;

  const raw = String(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T12:00:00`)
    : new Date(raw);

  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return "-";

  return date.toLocaleDateString("en-NZ", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function getDaysUntil(value) {
  const date = parseDate(value);
  if (!date) return null;

  const today = parseDate(getTodayNz());
  if (!today) return null;

  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  return Math.ceil((date - today) / (1000 * 60 * 60 * 24));
}

function dueText(value) {
  const days = getDaysUntil(value);

  if (days === null) return "No due date";
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `${days} days remaining`;
}

function statusBadgeClass(status) {
  if (status === "completed" || status === "COMPLETED") {
    return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
  }

  if (status === "BLOCKED" || status === "DELAYED" || status === "critical") {
    return "bg-red-500/20 text-red-400 border border-red-500/30";
  }

  if (status === "AT_RISK" || status === "high") {
    return "bg-amber-500/20 text-amber-400 border border-amber-500/30";
  }

  if (status === "active" || status === "ON_TRACK" || status === "open") {
    return "bg-primary/20 text-primary border border-primary/30";
  }

  return "bg-muted text-muted-foreground border border-border";
}

function priorityRank(priority) {
  const ranks = {
    critical: 1,
    high: 2,
    medium: 3,
    low: 4,
    deferred: 5
  };

  return ranks[priority] || 9;
}

function gateRank(status) {
  const ranks = {
    BLOCKED: 1,
    DELAYED: 2,
    AT_RISK: 3,
    ON_TRACK: 4,
    COMPLETED: 5
  };

  return ranks[status] || 9;
}

function projectTitle(project) {
  const number = project?.job_number || project?.project_number;
  const name = project?.name || project?.project_name || "Untitled Project";
  return number ? `${number} - ${name}` : name;
}

export default function ProjectDetailPage() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [actionItems, setActionItems] = useState([]);
  const [gates, setGates] = useState([]);
  const [walkaroundEntries, setWalkaroundEntries] = useState([]);
  const [diarySummary, setDiarySummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setLoadError("");

        const today = getTodayNz();

        const [projectRes, itemsRes, gatesRes, walkaroundRes, diaryRes] = await Promise.all([
          projectsApi.get(id),
          actionItemsApi.getAll({ project_id: id }).catch(() => ({ data: [] })),
          gatesApi.getAll({ project_id: id }).catch(() => ({ data: [] })),
          walkaroundApi.getAll({ project_id: id }).catch(() => ({ data: [] })),
          diaryApi.get(id, today).catch(() => ({ data: null }))
        ]);

        setProject(projectRes?.data || null);
        setActionItems(normaliseList(itemsRes));
        setGates(normaliseList(gatesRes));
        setWalkaroundEntries(normaliseList(walkaroundRes));
        setDiarySummary(diaryRes?.data || null);
      } catch (error) {
        console.error(error);
        setProject(null);
        setLoadError(error?.response?.data?.detail || "This project could not be loaded.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  const openItems = useMemo(() => {
    return actionItems.filter((item) => item.status !== "completed");
  }, [actionItems]);

  const completedItems = useMemo(() => {
    return actionItems.filter((item) => item.status === "completed");
  }, [actionItems]);

  const overdueItems = useMemo(() => {
    return openItems.filter((item) => {
      const days = getDaysUntil(item.due_date || item.expected_complete_date);
      return days !== null && days < 0;
    });
  }, [openItems]);

  const criticalItems = useMemo(() => {
    return openItems
      .filter((item) => item.priority === "critical" || item.priority === "high")
      .sort((a, b) => {
        const rankDiff = priorityRank(a.priority) - priorityRank(b.priority);
        if (rankDiff !== 0) return rankDiff;

        const aDays = getDaysUntil(a.due_date || a.expected_complete_date);
        const bDays = getDaysUntil(b.due_date || b.expected_complete_date);
        return (aDays ?? 9999) - (bDays ?? 9999);
      });
  }, [openItems]);

  const openGates = useMemo(() => {
    return gates.filter((gate) => gate.status !== "COMPLETED");
  }, [gates]);

  const completedGates = useMemo(() => {
    return gates.filter((gate) => gate.status === "COMPLETED");
  }, [gates]);

  const riskGates = useMemo(() => {
    return openGates
      .filter((gate) => {
        if (gate.status === "BLOCKED" || gate.status === "DELAYED" || gate.status === "AT_RISK") {
          return true;
        }

        const days = getDaysUntil(gate.required_by_date);
        return days !== null && days <= 7;
      })
      .sort((a, b) => {
        const rankDiff = gateRank(a.status) - gateRank(b.status);
        if (rankDiff !== 0) return rankDiff;

        const aDays = getDaysUntil(a.required_by_date);
        const bDays = getDaysUntil(b.required_by_date);
        return (aDays ?? 9999) - (bDays ?? 9999);
      });
  }, [openGates]);

  const recentWalkaroundEntries = useMemo(() => {
    return [...walkaroundEntries]
      .sort((a, b) => {
        const aTime = parseDate(a.created_at)?.getTime() || 0;
        const bTime = parseDate(b.created_at)?.getTime() || 0;
        return bTime - aTime;
      })
      .slice(0, 6);
  }, [walkaroundEntries]);

  const latestItems = useMemo(() => {
    return [...openItems]
      .sort((a, b) => {
        const rankDiff = priorityRank(a.priority) - priorityRank(b.priority);
        if (rankDiff !== 0) return rankDiff;

        const aDays = getDaysUntil(a.due_date || a.expected_complete_date);
        const bDays = getDaysUntil(b.due_date || b.expected_complete_date);
        return (aDays ?? 9999) - (bDays ?? 9999);
      })
      .slice(0, 6);
  }, [openItems]);

  const projectHealth = useMemo(() => {
    if (overdueItems.length > 0 || riskGates.some((gate) => gate.status === "BLOCKED" || gate.status === "DELAYED")) {
      return {
        label: "Needs Attention",
        className: "bg-red-500/20 text-red-400 border border-red-500/30",
        helper: "There are overdue items, blocked gates, or delayed gates."
      };
    }

    if (criticalItems.length > 0 || riskGates.length > 0) {
      return {
        label: "At Risk",
        className: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
        helper: "There are high-priority actions or gates inside the risk window."
      };
    }

    return {
      label: "On Track",
      className: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
      helper: "No immediate operational blockers are showing."
    };
  }, [overdueItems.length, criticalItems.length, riskGates]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <Link to="/projects">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        </Link>

        <div className="empty-state py-20">
          <FolderOpen className="empty-state-icon" />
          <p className="empty-state-title">Project not found</p>
          <p className="empty-state-description">{loadError || "This project could not be loaded."}</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: "Open Items",
      value: openItems.length,
      helper: overdueItems.length > 0 ? `${overdueItems.length} overdue` : `${completedItems.length} completed`,
      icon: ListTodo,
      border: overdueItems.length > 0 ? "border-red-500/50" : ""
    },
    {
      label: "Gates at Risk",
      value: riskGates.length,
      helper: `${completedGates.length} completed`,
      icon: ShieldAlert,
      border: riskGates.length > 0 ? "border-amber-500/50" : ""
    },
    {
      label: "Critical Items",
      value: criticalItems.length,
      helper: criticalItems.length > 0 ? "High priority" : "None showing",
      icon: Target,
      border: criticalItems.length > 0 ? "border-orange-500/50" : ""
    },
    {
      label: "Walkaround Notes",
      value: walkaroundEntries.length,
      helper: recentWalkaroundEntries.length > 0 ? "Latest notes below" : "No notes yet",
      icon: ClipboardList,
      border: ""
    }
  ];

  return (
    <div className="space-y-6" data-testid="project-detail-page">
      <div className="space-y-3">
        <Link to="/projects">
          <Button variant="ghost" size="sm" className="h-8 px-2">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Operational project overview
            </p>

            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h2 className="font-heading text-2xl font-bold uppercase tracking-tight">
                {projectTitle(project)}
              </h2>

              <span className={`rounded px-2.5 py-1 text-xs font-bold uppercase ${statusBadgeClass(project.status)}`}>
                {project.status || "active"}
              </span>

              <span className={`rounded px-2.5 py-1 text-xs font-bold uppercase ${projectHealth.className}`}>
                {projectHealth.label}
              </span>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">{projectHealth.helper}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link to="/walkaround">
              <Button variant="secondary" size="sm">
                <Target className="mr-2 h-4 w-4" />
                Walkaround
              </Button>
            </Link>

            <Link to="/action-items">
              <Button variant="secondary" size="sm">
                <ListTodo className="mr-2 h-4 w-4" />
                Actions
              </Button>
            </Link>

            <Link to="/gates">
              <Button variant="secondary" size="sm">
                <AlertTriangle className="mr-2 h-4 w-4" />
                Gates
              </Button>
            </Link>

            <Link to="/diary">
              <Button variant="secondary" size="sm">
                <BookOpen className="mr-2 h-4 w-4" />
                Diary
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;

          return (
            <Card key={card.label} className={`ops-card ${card.border}`}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{card.label}</p>
                    <p className="mt-1 text-2xl font-bold">{card.value}</p>
                  </div>
                  <Icon className="h-8 w-8 text-primary" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{card.helper}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="ops-card xl:col-span-2">
          <CardHeader className="ops-card-header py-3">
            <CardTitle className="font-heading text-lg uppercase tracking-[0.12em]">
              Project Details
            </CardTitle>
          </CardHeader>

          <CardContent className="py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoRow icon={Building2} label="Client" value={project.client_name} />
              <InfoRow icon={User} label="Main Contractor" value={project.main_contractor} />
              <InfoRow icon={MapPin} label="Location" value={project.location} />
              <InfoRow
                icon={Phone}
                label="Site Contact"
                value={project.site_contact}
                helper={project.site_phone}
              />
              <InfoRow icon={Calendar} label="Start Date" value={formatDate(project.programme_start_date)} />
              <InfoRow
                icon={Clock}
                label="Required Finish"
                value={formatDate(project.required_finish_date)}
                helper={dueText(project.required_finish_date)}
              />
            </div>

            {project.description ? (
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-sm leading-6 text-muted-foreground">{project.description}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="ops-card">
          <CardHeader className="ops-card-header py-3">
            <CardTitle className="font-heading text-lg uppercase tracking-[0.12em]">
              Today's Diary
            </CardTitle>
          </CardHeader>

          <CardContent className="py-4">
            {diarySummary ? (
              <div className="grid grid-cols-2 gap-4 text-center">
                <DiaryStat label="Walkaround" value={diarySummary.walkaround_entries || 0} />
                <DiaryStat label="Created" value={diarySummary.action_items_created || 0} />
                <DiaryStat label="Completed" value={diarySummary.action_items_completed || 0} />
                <DiaryStat label="Gates Closed" value={diarySummary.gates_completed || 0} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No diary summary has been created for today yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {riskGates.length > 0 ? (
        <Card className="ops-card border-amber-500/50">
          <CardHeader className="ops-card-header bg-amber-950/20 py-3">
            <CardTitle className="flex items-center gap-2 font-heading text-lg uppercase tracking-[0.12em] text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Gates Needing Attention
            </CardTitle>
          </CardHeader>

          <CardContent className="py-4">
            <div className="space-y-2">
              {riskGates.slice(0, 6).map((gate) => (
                <OperationalRow
                  key={gate.id}
                  title={`${gate.order ? `${gate.order}. ` : ""}${gate.name || "Untitled Gate"}`}
                  meta={`${gate.status || "ON_TRACK"} - required ${formatDate(gate.required_by_date)} - ${dueText(gate.required_by_date)}`}
                  badge={gate.status || "RISK"}
                  badgeClass={statusBadgeClass(gate.status)}
                />
              ))}
            </div>

            {riskGates.length > 6 ? (
              <Link to="/gates" className="mt-3 block">
                <Button variant="link" size="sm" className="p-0 text-amber-400">
                  View all {riskGates.length} risk gates
                </Button>
              </Link>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className={`ops-card ${criticalItems.length > 0 ? "border-orange-500/50" : ""}`}>
          <CardHeader className="ops-card-header py-3">
            <CardTitle className="flex items-center gap-2 font-heading text-lg uppercase tracking-[0.12em]">
              <Target className="h-5 w-5" />
              Priority Action Items
            </CardTitle>
          </CardHeader>

          <CardContent className="py-4">
            {latestItems.length > 0 ? (
              <div className="space-y-2">
                {latestItems.map((item) => (
                  <OperationalRow
                    key={item.id}
                    title={item.title || "Untitled Action Item"}
                    meta={`${item.owner ? `${item.owner} - ` : ""}${dueText(item.due_date || item.expected_complete_date)}`}
                    badge={(item.priority || "medium").toUpperCase()}
                    badgeClass={statusBadgeClass(item.priority)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No open action items for this project.</p>
            )}
          </CardContent>
        </Card>

        <Card className="ops-card">
          <CardHeader className="ops-card-header py-3">
            <CardTitle className="flex items-center gap-2 font-heading text-lg uppercase tracking-[0.12em]">
              <ClipboardList className="h-5 w-5" />
              Recent Walkaround Notes
            </CardTitle>
          </CardHeader>

          <CardContent className="py-4">
            {recentWalkaroundEntries.length > 0 ? (
              <div className="space-y-2">
                {recentWalkaroundEntries.map((entry) => (
                  <OperationalRow
                    key={entry.id}
                    title={entry.note || "Walkaround note"}
                    meta={`${formatDate(entry.created_at)}${entry.owner ? ` - ${entry.owner}` : ""}`}
                    badge={(entry.priority || "medium").toUpperCase()}
                    badgeClass={statusBadgeClass(entry.priority)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No walkaround notes have been recorded for this project yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, helper }) {
  if (!value || value === "-") return null;

  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
        {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
      </div>
    </div>
  );
}

function DiaryStat({ label, value }) {
  return (
    <div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function OperationalRow({ title, meta, badge, badgeClass }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-secondary/30 p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{meta}</p>
      </div>

      <span className={`rounded px-2 py-1 text-xs font-bold uppercase ${badgeClass}`}>
        {badge}
      </span>
    </div>
  );
}