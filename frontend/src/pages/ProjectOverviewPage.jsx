import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { actionItemsApi, diaryApi, gatesApi, projectsApi } from "../lib/api";

function normaliseList(response) {
  const data = response?.data ?? response;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.value)) return data.value;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function todayNzDate() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(new Date());
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isCompletedStatus(status) {
  return ["completed", "complete", "closed", "done"].includes(String(status || "").toLowerCase());
}

function getProjectName(project) {
  return project?.job_name || project?.name || project?.project_name || "Selected project";
}
function isCommercialProjectOption(project = {}) {
  const name = String(getProjectName(project) || "").trim().toLowerCase();
  const combined = [
    project?.job_name,
    project?.name,
    project?.project_name,
    project?.job_number,
    project?.description,
    project?.notes
  ].filter(Boolean).join(" ").toLowerCase();

  if (!combined.trim()) return true;
  if (name === "2 dev") return false;
  if (combined.includes("demo")) return false;
  if (combined.includes("sample")) return false;
  if (combined.includes("test project")) return false;
  if (combined.includes("site coordination note")) return false;

  return true;
}

function StatCard({ label, value, helper, tone = "default", testId }) {
  const toneClass = {
    danger: "border-red-500/40 bg-red-500/10",
    warning: "border-amber-500/40 bg-amber-500/10",
    success: "border-emerald-500/40 bg-emerald-500/10",
    default: "border-border bg-background/80"
  }[tone] || "border-border bg-background/80";

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass}`} data-testid={testId}>
      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-black tracking-tight">{value}</div>
      <p className="mt-1 text-xs font-semibold text-muted-foreground">{helper}</p>
    </div>
  );
}

export default function ProjectOverviewPage() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [gates, setGates] = useState([]);
  const [actions, setActions] = useState([]);
  const [labourSummary, setLabourSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [snapshotError, setSnapshotError] = useState("");

  const selectedProjectRecord = useMemo(
    () => projects.find((project) => String(project.id) === String(selectedProject)),
    [projects, selectedProject]
  );

  const today = useMemo(() => todayNzDate(), []);

  useEffect(() => {
    let cancelled = false;

    async function loadBaseData() {
      setLoading(true);
      setSnapshotError("");

      try {
        const [projectsRes, gatesRes, actionsRes] = await Promise.all([
          projectsApi.getAll(),
          gatesApi.getAll(),
          actionItemsApi.getAll({})
        ]);

        if (cancelled) return;

        const loadedProjects = normaliseList(projectsRes).filter(isCommercialProjectOption);
        const loadedGates = normaliseList(gatesRes);
        const loadedActions = normaliseList(actionsRes);

        setProjects(loadedProjects);
        setGates(loadedGates);
        setActions(loadedActions);

        const savedProject = window.localStorage.getItem("lld_last_project_id");
        const savedExists = loadedProjects.some((project) => String(project.id) === String(savedProject));
        const nextProject = savedExists ? savedProject : loadedProjects[0]?.id || "";

        setSelectedProject(nextProject);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load project overview snapshot:", error);
        setSnapshotError("Project overview could not load the live snapshot yet.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadBaseData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLabourSummary() {
      if (!selectedProject) {
        setLabourSummary(null);
        return;
      }

      try {
        const response = await diaryApi.getLabour(selectedProject, today);
        if (cancelled) return;
        setLabourSummary(response?.data?.summary || response?.summary || null);
      } catch (error) {
        if (cancelled) return;
        console.warn("Project overview labour summary unavailable:", error);
        setLabourSummary(null);
      }
    }

    loadLabourSummary();

    return () => {
      cancelled = true;
    };
  }, [selectedProject, today]);

  const scopedGates = useMemo(
    () => gates.filter((gate) => String(gate.project_id) === String(selectedProject)),
    [gates, selectedProject]
  );

  const openRoadblocks = useMemo(
    () => scopedGates.filter((gate) => String(gate.status || "").toUpperCase() !== "COMPLETED"),
    [scopedGates]
  );

  const scopedActions = useMemo(
    () => actions.filter((item) => String(item.project_id || item.job_id || "") === String(selectedProject)),
    [actions, selectedProject]
  );

  const openActions = useMemo(
    () => scopedActions.filter((item) => !isCompletedStatus(item.status)),
    [scopedActions]
  );

  const actionPressure = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const overdue = [];
    const dueToday = [];
    const dueThisWeek = [];

    openActions.forEach((item) => {
      const due = parseDate(item.due_date || item.expected_complete_date);
      if (!due) return;

      if (due < todayStart) {
        overdue.push(item);
      } else if (due >= todayStart && due < tomorrowStart) {
        dueToday.push(item);
      } else if (due >= tomorrowStart && due < weekEnd) {
        dueThisWeek.push(item);
      }
    });

    return { overdue, dueToday, dueThisWeek };
  }, [openActions]);

  const labourRowsCount = Number(labourSummary?.labour_rows_count || 0);
  const labourHours = Number(labourSummary?.labour_total_hours || 0);

  function handleProjectChange(event) {
    const nextProject = event.target.value;
    setSelectedProject(nextProject);
    if (nextProject) {
      window.localStorage.setItem("lld_last_project_id", nextProject);
    }
  }

  const quickLinks = [
    { label: "Open Diary", to: selectedProject ? `/diary?project=${selectedProject}` : "/diary" },
    { label: "Roadblocks", to: selectedProject ? `/gates?project=${selectedProject}` : "/gates" },
    { label: "Action Items", to: selectedProject ? `/action-items?project=${selectedProject}` : "/action-items" },
    { label: "Weather", to: "/weather" },
    { label: "Projects", to: "/projects" }
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-0 pb-8 lg:space-y-6" data-testid="project-overview-page" data-commercial-readiness="project-overview-v4-desktop-control-centre">
      <section className="ops-card overflow-hidden rounded-3xl border border-primary/30 bg-card shadow-md lg:grid lg:grid-cols-[minmax(0,1fr)_360px]" data-testid="project-overview-live-header">
        <div className="border-b border-border/70 bg-secondary/20 px-4 py-5 sm:px-6 lg:border-b-0 lg:border-r lg:py-6">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Project control</p>
          <h2 className="mt-1 font-heading text-2xl font-black uppercase tracking-[0.06em] sm:text-4xl sm:tracking-[0.08em]">
            Project Overview
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-muted-foreground">
            Live control snapshot for the selected job: blockers, due actions, staff hours, and close-out links before daily sign-off.
          </p>
          <div className="mt-4 grid gap-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground sm:grid-cols-3" data-testid="project-overview-desktop-proof-strip">
            <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-2">Live job context</span>
            <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-2">Daily close-out</span>
            <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-2">Site risk focus</span>
          </div>
        </div>

        <div className="grid gap-3 px-4 py-4 sm:px-6 lg:content-center lg:py-6" data-testid="project-overview-desktop-selector-panel">
          <label className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Selected project</span>
            <select
              value={selectedProject}
              onChange={handleProjectChange}
              className="input min-h-12 w-full min-w-0 rounded-xl border border-primary/40 bg-background px-3 py-2 text-base font-black shadow-sm"
              data-testid="project-overview-project-select"
            >
              {projects.length === 0 ? (
                <option value="">No projects found</option>
              ) : null}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {getProjectName(project)}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-2xl border border-primary/20 bg-background/90 px-4 py-4 shadow-sm" data-testid="project-overview-selected-job-card">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">Active job</div>
            <div className="mt-1 text-xl font-black leading-tight">{selectedProjectRecord ? getProjectName(selectedProjectRecord) : "No project selected"}</div>
            <div className="mt-2 inline-flex rounded-full border border-border bg-secondary/30 px-3 py-1 text-xs font-black text-muted-foreground">
              {selectedProjectRecord?.job_number ? `Job # ${selectedProjectRecord.job_number}` : "Job number not set"}
            </div>
          </div>
        </div>
      </section>

      {snapshotError ? (
        <section className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-semibold text-destructive" data-testid="project-overview-error">
          {snapshotError}
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="project-overview-live-stats" data-layout="desktop-balanced-stat-grid">
        <StatCard
          label="Open roadblocks"
          value={loading ? "..." : openRoadblocks.length}
          helper="Current blockers and concerns for this project."
          tone={openRoadblocks.length > 0 ? "danger" : "success"}
          testId="project-overview-open-roadblocks"
        />
        <StatCard
          label="Due / overdue actions"
          value={loading ? "..." : actionPressure.overdue.length + actionPressure.dueToday.length}
          helper={`${actionPressure.overdue.length} overdue, ${actionPressure.dueToday.length} due today.`}
          tone={actionPressure.overdue.length > 0 ? "danger" : actionPressure.dueToday.length > 0 ? "warning" : "success"}
          testId="project-overview-due-actions"
        />
        <StatCard
          label="This week actions"
          value={loading ? "..." : actionPressure.dueThisWeek.length}
          helper="Open items due in the next seven days."
          tone={actionPressure.dueThisWeek.length > 0 ? "warning" : "default"}
          testId="project-overview-week-actions"
        />
        <StatCard
          label="Today staff hours"
          value={loading ? "..." : labourHours.toFixed(2)}
          helper={`${labourRowsCount} staff diary row${labourRowsCount === 1 ? "" : "s"} for ${today}.`}
          tone={labourHours > 0 ? "success" : "default"}
          testId="project-overview-labour-hours"
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-[420px_minmax(0,1fr)]" data-testid="project-overview-priority-panels">
        <div className="rounded-2xl border border-border bg-background/80 p-4">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Priority close-out</div>
          <div className="mt-3 space-y-2 text-sm">
            <p className="font-bold">1. Check unresolved roadblocks before the diary is closed.</p>
            <p className="font-bold">2. Clear overdue and due-today actions, or record why they remain open.</p>
            <p className="font-bold">3. Confirm staff diary hours match site reality.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background/80 p-4">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Quick links</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3" data-testid="project-overview-quick-links">
            {quickLinks.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-black text-primary shadow-sm transition hover:bg-primary/15"
                data-testid={`project-overview-link-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-background/80 p-4" data-testid="project-overview-commercial-note">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Commercial use</div>
        <p className="mt-2 text-sm font-medium leading-6 text-muted-foreground">
          Use this page as the daily control snapshot before opening Diary, Roadblocks, Action Items, or Weather. It does not replace the detailed pages; it points the team to the live items that need attention.
        </p>
      </section>
    </div>
  );
}