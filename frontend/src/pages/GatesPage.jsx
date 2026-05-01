import React, { useEffect, useMemo, useState } from "react";
import { gatesApi, projectsApi } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

const EMPTY_FORM = {
  project_id: "",
  name: "",
  description: "",
  order: "",
  owner_party: "YOU",
  required_by_date: "",
  expected_complete_date: "",
  buffer_days: 2,
  depends_on_gate_ids: [],
  is_hard_gate: false,
  is_optional: false
};

const STATUS_CONFIG = {
  BLOCKED: {
    label: "Blocked",
    className: "status-badge status-blocked",
    helper: "Dependency not complete"
  },
  DELAYED: {
    label: "Delayed",
    className: "status-badge status-blocked",
    helper: "Required date has passed"
  },
  AT_RISK: {
    label: "At Risk",
    className: "status-badge status-at-risk",
    helper: "Inside buffer window"
  },
  ON_TRACK: {
    label: "On Track",
    className: "status-badge status-on-track",
    helper: "Tracking normally"
  },
  COMPLETED: {
    label: "Completed",
    className: "status-badge status-completed",
    helper: "Gate closed"
  }
};

const STATUS_SECTIONS = [
  {
    key: "blockedDelayed",
    title: "Blocked / Delayed",
    statuses: ["BLOCKED", "DELAYED"],
    description: "Needs immediate action or a dependency cleared."
  },
  {
    key: "atRisk",
    title: "At Risk",
    statuses: ["AT_RISK"],
    description: "Still recoverable, but now inside the risk window."
  },
  {
    key: "onTrack",
    title: "On Track",
    statuses: ["ON_TRACK"],
    description: "Currently tracking normally."
  },
  {
    key: "completed",
    title: "Completed",
    statuses: ["COMPLETED"],
    description: "Closed gates retained for audit trail."
  }
];

function normaliseList(response) {
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.projects)) return data.projects;
  if (Array.isArray(data?.gates)) return data.gates;
  return [];
}

function projectLabel(project) {
  if (!project) return "Unknown Project";
  const jobNumber = project.job_number || project.project_number || "No job";
  const name = project.name || project.project_name || "Untitled Project";
  return `${jobNumber} - ${name}`;
}

function cleanDateForInput(value) {
  if (!value) return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "â€”";

  const raw = String(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T12:00:00`)
    : new Date(raw);

  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString("en-NZ", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatStatus(status) {
  return STATUS_CONFIG[status]?.label || status || "Unknown";
}

function statusClass(status) {
  return STATUS_CONFIG[status]?.className || "status-badge status-on-track";
}

function statusHelper(status) {
  return STATUS_CONFIG[status]?.helper || "Status calculated by backend";
}

function toNumber(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function GatesPage() {
  const [projects, setProjects] = useState([]);
  const [gates, setGates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyGateId, setBusyGateId] = useState("");
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("OPEN");
  const [formOpen, setFormOpen] = useState(false);
  const [editingGateId, setEditingGateId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      setActionError("");

      const [projectsRes, gatesRes] = await Promise.all([
        projectsApi.getAll(),
        gatesApi.getAll()
      ]);

      const nextProjects = normaliseList(projectsRes);
      const nextGates = normaliseList(gatesRes);

      setProjects(nextProjects);
      setGates(nextGates);

      setForm((current) => {
        if (current.project_id || nextProjects.length === 0) return current;
        return {
          ...current,
          project_id: selectedProject || nextProjects[0].id || ""
        };
      });
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to load gates.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const projectMap = useMemo(() => {
    return Object.fromEntries(projects.map((project) => [project.id, projectLabel(project)]));
  }, [projects]);

  const gatesById = useMemo(() => {
    return Object.fromEntries(gates.map((gate) => [gate.id, gate]));
  }, [gates]);

  const scopedGates = useMemo(() => {
    return selectedProject
      ? gates.filter((gate) => gate.project_id === selectedProject)
      : gates;
  }, [gates, selectedProject]);

  const visibleGates = useMemo(() => {
    let list = [...scopedGates];

    if (selectedStatus === "OPEN") {
      list = list.filter((gate) => gate.status !== "COMPLETED");
    } else if (selectedStatus !== "ALL") {
      list = list.filter((gate) => gate.status === selectedStatus);
    }

    return list.sort((a, b) => {
      const projectA = projectMap[a.project_id] || "";
      const projectB = projectMap[b.project_id] || "";
      if (projectA !== projectB) {
        return projectA.localeCompare(projectB, undefined, { numeric: true, sensitivity: "base" });
      }

      const statusOrder = {
        BLOCKED: 1,
        DELAYED: 2,
        AT_RISK: 3,
        ON_TRACK: 4,
        COMPLETED: 5
      };

      const statusDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
      if (statusDiff !== 0) return statusDiff;

      const requiredA = cleanDateForInput(a.required_by_date);
      const requiredB = cleanDateForInput(b.required_by_date);
      if (requiredA !== requiredB) return requiredA.localeCompare(requiredB);

      return (a.order || 0) - (b.order || 0);
    });
  }, [scopedGates, selectedStatus, projectMap]);

  const summary = useMemo(() => {
    return {
      all: scopedGates.length,
      open: scopedGates.filter((gate) => gate.status !== "COMPLETED").length,
      blocked: scopedGates.filter((gate) => gate.status === "BLOCKED").length,
      delayed: scopedGates.filter((gate) => gate.status === "DELAYED").length,
      atRisk: scopedGates.filter((gate) => gate.status === "AT_RISK").length,
      onTrack: scopedGates.filter((gate) => gate.status === "ON_TRACK").length,
      completed: scopedGates.filter((gate) => gate.status === "COMPLETED").length
    };
  }, [scopedGates]);

  const sectionedGates = useMemo(() => {
    return STATUS_SECTIONS.map((section) => ({
      ...section,
      gates: visibleGates.filter((gate) => section.statuses.includes(gate.status))
    }));
  }, [visibleGates]);

  const eligibleDependencies = useMemo(() => {
    if (!form.project_id) return [];

    return gates
      .filter((gate) => gate.project_id === form.project_id && gate.id !== editingGateId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [gates, form.project_id, editingGateId]);

  function setField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function nextOrderForProject(projectId) {
    const projectGates = gates.filter((gate) => gate.project_id === projectId);
    const maxOrder = projectGates.reduce((max, gate) => Math.max(max, gate.order || 0), 0);
    return maxOrder + 1;
  }

  function startCreate() {
    const projectId = selectedProject || projects[0]?.id || "";

    setEditingGateId(null);
    setActionError("");
    setMessage("");
    setForm({
      ...EMPTY_FORM,
      project_id: projectId,
      order: projectId ? String(nextOrderForProject(projectId)) : ""
    });
    setFormOpen(true);
  }

  function startEdit(gate) {
    setEditingGateId(gate.id);
    setActionError("");
    setMessage("");
    setForm({
      project_id: gate.project_id || "",
      name: gate.name || "",
      description: gate.description || "",
      order: gate.order === undefined || gate.order === null ? "" : String(gate.order),
      owner_party: gate.owner_party || "YOU",
      required_by_date: cleanDateForInput(gate.required_by_date),
      expected_complete_date: cleanDateForInput(gate.expected_complete_date),
      buffer_days: gate.buffer_days ?? 2,
      depends_on_gate_ids: Array.isArray(gate.depends_on_gate_ids) ? gate.depends_on_gate_ids : [],
      is_hard_gate: Boolean(gate.is_hard_gate),
      is_optional: Boolean(gate.is_optional)
    });
    setFormOpen(true);
  }

  function cancelForm() {
    setEditingGateId(null);
    setFormOpen(false);
    setActionError("");
    setForm(EMPTY_FORM);
  }

  function toggleDependency(gateId, checked) {
    setForm((current) => {
      const existing = Array.isArray(current.depends_on_gate_ids) ? current.depends_on_gate_ids : [];
      return {
        ...current,
        depends_on_gate_ids: checked
          ? Array.from(new Set([...existing, gateId]))
          : existing.filter((id) => id !== gateId)
      };
    });
  }

  function buildPayload() {
    return {
      project_id: form.project_id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      order: toNumber(form.order, 0),
      owner_party: form.owner_party || "YOU",
      required_by_date: form.required_by_date || null,
      expected_complete_date: form.expected_complete_date || null,
      buffer_days: toNumber(form.buffer_days, 2),
      depends_on_gate_ids: Array.isArray(form.depends_on_gate_ids) ? form.depends_on_gate_ids : [],
      is_hard_gate: Boolean(form.is_hard_gate),
      is_optional: Boolean(form.is_optional)
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.project_id) {
      setActionError("Choose a project before saving a gate.");
      return;
    }

    if (!form.name.trim()) {
      setActionError("Gate name is required.");
      return;
    }

    try {
      setSaving(true);
      setActionError("");
      setMessage("");

      const payload = buildPayload();

      if (editingGateId) {
        await gatesApi.update(editingGateId, payload);
        setMessage("Gate updated.");
      } else {
        await gatesApi.create(payload);
        setMessage("Gate created.");
      }

      cancelForm();
      await loadData();
    } catch (e) {
      setActionError(e?.response?.data?.detail || "Failed to save gate.");
    } finally {
      setSaving(false);
    }
  }

  async function runGateAction(gate, action) {
    try {
      setBusyGateId(gate.id);
      setActionError("");
      setMessage("");

      if (action === "complete") {
        await gatesApi.complete(gate.id);
        setMessage("Gate marked complete.");
      }

      if (action === "reopen") {
        await gatesApi.reopen(gate.id);
        setMessage("Gate reopened.");
      }

      if (action === "delete") {
        const ok = window.confirm(`Delete gate "${gate.name || "Untitled Gate"}"?`);
        if (!ok) return;

        await gatesApi.delete(gate.id);
        setMessage("Gate deleted.");
      }

      await loadData();
    } catch (e) {
      setActionError(e?.response?.data?.detail || "Gate action failed.");
    } finally {
      setBusyGateId("");
    }
  }

  function dependencyNames(gate) {
    const ids = Array.isArray(gate.depends_on_gate_ids) ? gate.depends_on_gate_ids : [];

    return ids
      .map((id) => gatesById[id]?.name || id)
      .filter(Boolean);
  }

  function renderGateCard(gate) {
    const dependencies = dependencyNames(gate);
    const isBusy = busyGateId === gate.id;

    return (
      <Card key={gate.id} className="ops-card">
        <CardHeader className="ops-card-header py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="font-heading text-lg tracking-tight">
                {gate.order ? `${gate.order}. ` : ""}{gate.name || "Untitled Gate"}
              </CardTitle>
              <div className="mt-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                {projectMap[gate.project_id] || gate.project_id || "No project"}
              </div>
            </div>

            <span className={statusClass(gate.status)}>{formatStatus(gate.status)}</span>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 py-4 text-sm">
          {gate.description ? (
            <p className="text-muted-foreground">{gate.description}</p>
          ) : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Owner</div>
              <div className="font-medium">{gate.owner_party || "â€”"}</div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Status reason</div>
              <div className="font-medium">{statusHelper(gate.status)}</div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Required by</div>
              <div className="font-medium">{formatDate(gate.required_by_date)}</div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Expected complete</div>
              <div className="font-medium">{formatDate(gate.expected_complete_date)}</div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Buffer</div>
              <div className="font-medium">{gate.buffer_days ?? 0} day{gate.buffer_days === 1 ? "" : "s"}</div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Flags</div>
              <div className="font-medium">
                {gate.is_hard_gate ? "Hard gate" : "Standard"}
                {gate.is_optional ? " â€¢ Optional" : ""}
              </div>
            </div>
          </div>

          {dependencies.length > 0 ? (
            <div className="rounded-md border border-border bg-background px-3 py-2">
              <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Depends on</div>
              <div className="mt-1 text-sm">{dependencies.join(", ")}</div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => startEdit(gate)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
              disabled={isBusy || saving}
            >
              Edit
            </button>

            {gate.status === "COMPLETED" ? (
              <button
                type="button"
                onClick={() => runGateAction(gate, "reopen")}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
                disabled={isBusy || saving}
              >
                {isBusy ? "Working..." : "Reopen"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => runGateAction(gate, "complete")}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                disabled={isBusy || saving}
              >
                {isBusy ? "Working..." : "Mark Complete"}
              </button>
            )}

            <button
              type="button"
              onClick={() => runGateAction(gate, "delete")}
              className="rounded-md border border-destructive px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
              disabled={isBusy || saving}
            >
              Delete
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-sm text-destructive">{error}</div>;
  }

  const summaryCards = [
    { key: "OPEN", label: "Open", value: summary.open },
    { key: "BLOCKED", label: "Blocked", value: summary.blocked },
    { key: "DELAYED", label: "Delayed", value: summary.delayed },
    { key: "AT_RISK", label: "At Risk", value: summary.atRisk },
    { key: "ON_TRACK", label: "On Track", value: summary.onTrack },
    { key: "COMPLETED", label: "Completed", value: summary.completed },
    { key: "ALL", label: "All", value: summary.all }
  ];

  return (
    <div className="space-y-6" data-testid="gates-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Site control
          </p>
          <h2 className="font-heading text-2xl font-bold tracking-tight uppercase">Gates / Risks</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track the job blockers, handover points, inspections, dependencies, and risk dates that need site attention.
          </p>
        </div>

        <button
          type="button"
          onClick={startCreate}
          disabled={projects.length === 0}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          New Gate
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={selectedProject}
          onChange={(event) => {
            setSelectedProject(event.target.value);
            setSelectedStatus("OPEN");
          }}
        >
          <option value="">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {projectLabel(project)}
            </option>
          ))}
        </select>

        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={selectedStatus}
          onChange={(event) => setSelectedStatus(event.target.value)}
        >
          <option value="OPEN">Open gates</option>
          <option value="BLOCKED">Blocked only</option>
          <option value="DELAYED">Delayed only</option>
          <option value="AT_RISK">At risk only</option>
          <option value="ON_TRACK">On track only</option>
          <option value="COMPLETED">Completed only</option>
          <option value="ALL">All gates</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {summaryCards.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => setSelectedStatus(card.key)}
            className={`text-left ${selectedStatus === card.key ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
          >
            <Card className="ops-card h-full">
              <CardContent className="py-4">
                <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  {card.label}
                </div>
                <div className="mt-1 text-2xl font-semibold">{card.value}</div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      {actionError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-md border border-border bg-muted px-4 py-3 text-sm">
          {message}
        </div>
      ) : null}

      {projects.length === 0 ? (
        <div className="empty-state py-16">
          <p className="empty-state-title">Create a Project First</p>
          <p className="empty-state-description">
            Gates need to belong to a project before they can be tracked.
          </p>
        </div>
      ) : null}

      {formOpen ? (
        <Card className="ops-card">
          <CardHeader className="ops-card-header">
            <CardTitle className="font-heading text-lg tracking-tight">
              {editingGateId ? "Edit Gate" : "Create Gate"}
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Project
                  </span>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={form.project_id}
                    onChange={(event) => {
                      const projectId = event.target.value;
                      setForm((current) => ({
                        ...current,
                        project_id: projectId,
                        order: String(nextOrderForProject(projectId)),
                        depends_on_gate_ids: []
                      }));
                    }}
                  >
                    <option value="">Choose project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {projectLabel(project)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Gate Name
                  </span>
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={form.name}
                    onChange={(event) => setField("name", event.target.value)}
                    placeholder="e.g. Council preline signed off"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Owner
                  </span>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={form.owner_party}
                    onChange={(event) => setField("owner_party", event.target.value)}
                  >
                    <option value="YOU">YOU</option>
                    <option value="MC">MC</option>
                    <option value="CLIENT">CLIENT</option>
                    <option value="SUBBIES">SUBBIES</option>
                    <option value="COUNCIL">COUNCIL</option>
                    <option value="SUPPLIER">SUPPLIER</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Order
                  </span>
                  <input
                    type="number"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={form.order}
                    onChange={(event) => setField("order", event.target.value)}
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Required By
                  </span>
                  <input
                    type="date"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={form.required_by_date}
                    onChange={(event) => setField("required_by_date", event.target.value)}
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Expected Complete
                  </span>
                  <input
                    type="date"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={form.expected_complete_date}
                    onChange={(event) => setField("expected_complete_date", event.target.value)}
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Buffer Days
                  </span>
                  <input
                    type="number"
                    min="0"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={form.buffer_days}
                    onChange={(event) => setField("buffer_days", event.target.value)}
                  />
                </label>

                <div className="space-y-2 rounded-md border border-border bg-background px-3 py-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Flags
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.is_hard_gate}
                      onChange={(event) => setField("is_hard_gate", event.target.checked)}
                    />
                    Hard gate
                  </label>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.is_optional}
                      onChange={(event) => setField("is_optional", event.target.checked)}
                    />
                    Optional
                  </label>
                </div>
              </div>

              <label className="space-y-1 block">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Description / Site Note
                </span>
                <textarea
                  className="min-h-[90px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={form.description}
                  onChange={(event) => setField("description", event.target.value)}
                  placeholder="What needs to be true before this gate can be closed?"
                />
              </label>

              <div className="space-y-2 rounded-md border border-border bg-background p-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Dependencies
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Select gates that must be complete before this gate is clear.
                  </p>
                </div>

                {eligibleDependencies.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {eligibleDependencies.map((gate) => (
                      <label key={gate.id} className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={form.depends_on_gate_ids.includes(gate.id)}
                          onChange={(event) => toggleDependency(gate.id, event.target.checked)}
                        />
                        <span>
                          <span className="font-medium">{gate.order ? `${gate.order}. ` : ""}{gate.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{formatStatus(gate.status)}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No other gates available for this project yet.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={cancelForm}
                  className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={saving}
                >
                  {saving ? "Saving..." : editingGateId ? "Save Gate" : "Create Gate"}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {visibleGates.length > 0 ? (
        <div className="space-y-5">
          {sectionedGates.map((section) => {
            if (section.gates.length === 0) return null;

            return (
              <section key={section.key} className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h3 className="font-heading text-lg font-semibold uppercase tracking-tight">
                      {section.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                  </div>

                  <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {section.gates.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {section.gates.map((gate) => renderGateCard(gate))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="empty-state py-20">
          <p className="empty-state-title">No Gates Found</p>
          <p className="empty-state-description">
            No gates match the current project/status filter.
          </p>
        </div>
      )}
    </div>
  );
}
