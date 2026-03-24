import React, { useEffect, useMemo, useState } from "react";
import { gatesApi, projectsApi } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

export default function GatesPage() {
  const [projects, setProjects] = useState([]);
  const [gates, setGates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedProject, setSelectedProject] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const [projectsRes, gatesRes] = await Promise.all([
          projectsApi.getAll(),
          gatesApi.getAll()
        ]);

        setProjects(Array.isArray(projectsRes?.data) ? projectsRes.data : []);
        setGates(Array.isArray(gatesRes?.data) ? gatesRes.data : []);
      } catch (e) {
        setError("Failed to load gates");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const projectMap = useMemo(() => {
    return Object.fromEntries(
      projects.map((p) => [p.id, `${p.job_number || "No job"} - ${p.name || "Untitled Project"}`])
    );
  }, [projects]);

  const filteredGates = useMemo(() => {
    const list = !selectedProject
      ? gates
      : gates.filter((g) => g.project_id === selectedProject);

    return [...list].sort((a, b) => {
      const projectA = projectMap[a.project_id] || "";
      const projectB = projectMap[b.project_id] || "";
      if (projectA !== projectB) return projectA.localeCompare(projectB, undefined, { numeric: true, sensitivity: "base" });
      return (a.order || 0) - (b.order || 0);
    });
  }, [gates, selectedProject, projectMap]);

  const summary = useMemo(() => {
    return {
      total: filteredGates.length,
      blocked: filteredGates.filter((g) => g.status === "BLOCKED").length,
      delayed: filteredGates.filter((g) => g.status === "DELAYED").length,
      atRisk: filteredGates.filter((g) => g.status === "AT_RISK").length,
      onTrack: filteredGates.filter((g) => g.status === "ON_TRACK").length,
      completed: filteredGates.filter((g) => g.status === "COMPLETED").length
    };
  }, [filteredGates]);

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-NZ", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function statusClass(status) {
    if (status === "BLOCKED") return "status-badge status-blocked";
    if (status === "DELAYED") return "status-badge status-blocked";
    if (status === "AT_RISK") return "status-badge status-at-risk";
    if (status === "COMPLETED") return "status-badge status-completed";
    return "status-badge status-on-track";
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

  return (
    <div className="space-y-6" data-testid="gates-page">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-heading text-2xl font-bold tracking-tight uppercase">Gates</h2>
          <p className="text-sm text-muted-foreground">
            {filteredGates.length} gate{filteredGates.length !== 1 ? "s" : ""}
          </p>
        </div>

        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.job_number || "No job"} - {p.name || "Untitled Project"}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Card className="ops-card"><CardContent className="py-4"><div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Total</div><div className="mt-1 text-2xl font-semibold">{summary.total}</div></CardContent></Card>
        <Card className="ops-card"><CardContent className="py-4"><div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Blocked</div><div className="mt-1 text-2xl font-semibold">{summary.blocked}</div></CardContent></Card>
        <Card className="ops-card"><CardContent className="py-4"><div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Delayed</div><div className="mt-1 text-2xl font-semibold">{summary.delayed}</div></CardContent></Card>
        <Card className="ops-card"><CardContent className="py-4"><div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">At Risk</div><div className="mt-1 text-2xl font-semibold">{summary.atRisk}</div></CardContent></Card>
        <Card className="ops-card"><CardContent className="py-4"><div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">On Track</div><div className="mt-1 text-2xl font-semibold">{summary.onTrack}</div></CardContent></Card>
        <Card className="ops-card"><CardContent className="py-4"><div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Completed</div><div className="mt-1 text-2xl font-semibold">{summary.completed}</div></CardContent></Card>
      </div>

      {filteredGates.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredGates.map((gate) => (
            <Card key={gate.id} className="ops-card">
              <CardHeader className="ops-card-header py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="font-heading text-lg tracking-tight">
                      {gate.order ? `${gate.order}. ` : ""}{gate.name || "Untitled Gate"}
                    </CardTitle>
                    <div className="mt-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      {projectMap[gate.project_id] || gate.project_id}
                    </div>
                  </div>
                  <span className={statusClass(gate.status)}>{gate.status || "UNKNOWN"}</span>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 py-4 text-sm">
                {gate.description ? (
                  <p className="text-muted-foreground">{gate.description}</p>
                ) : null}

                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Owner</div>
                    <div>{gate.owner_party || "—"}</div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Required By</div>
                    <div>{formatDate(gate.required_by_date)}</div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Expected Complete</div>
                    <div>{formatDate(gate.expected_complete_date)}</div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Buffer</div>
                    <div>{gate.buffer_days ?? 0} day{gate.buffer_days === 1 ? "" : "s"}</div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Dependencies</div>
                    <div>{Array.isArray(gate.depends_on_gate_ids) ? gate.depends_on_gate_ids.length : 0}</div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Flags</div>
                    <div>
                      {gate.is_hard_gate ? "Hard gate" : "Standard"}
                      {gate.is_optional ? " • Optional" : ""}
                    </div>
                  </div>
                </div>

                {Array.isArray(gate.depends_on_gate_ids) && gate.depends_on_gate_ids.length > 0 ? (
                  <div className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                    Depends on {gate.depends_on_gate_ids.length} gate{gate.depends_on_gate_ids.length !== 1 ? "s" : ""}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="empty-state py-20">
          <p className="empty-state-title">No Gates Found</p>
          <p className="empty-state-description">No gates match the current filter.</p>
        </div>
      )}
    </div>
  );
}
