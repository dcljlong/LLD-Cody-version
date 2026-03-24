import React, { useEffect, useMemo, useState } from "react";
import { gatesApi, projectsApi } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { AlertTriangle, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

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

        setProjects(Array.isArray(projectsRes?.data) ? projectsRes.data : (projectsRes?.data?.value || []));
        setGates(Array.isArray(gatesRes?.data) ? gatesRes.data : (gatesRes?.data?.value || []));
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
      projects.map((p) => [p.id, { name: `${p.job_number || "No job"} - ${p.name || "Untitled Project"}`, shortName: p.job_number || p.name }])
    );
  }, [projects]);

  // Calculate days until required
  const getDaysUntil = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return Math.ceil((date - today) / (1000 * 60 * 60 * 24));
  };

  // Get risk level for gate
  const getGateRisk = (gate) => {
    if (gate.status === "COMPLETED") return "completed";
    if (gate.status === "BLOCKED") return "blocked";
    if (gate.status === "DELAYED") return "delayed";
    
    const daysUntil = getDaysUntil(gate.required_by_date);
    if (daysUntil === null) return "unknown";
    if (daysUntil < 0) return "overdue";
    if (daysUntil <= 2) return "critical";
    if (daysUntil <= 7) return "warning";
    return "ok";
  };

  const filteredGates = useMemo(() => {
    const list = !selectedProject
      ? gates
      : gates.filter((g) => g.project_id === selectedProject);

    return [...list].sort((a, b) => {
      // Sort by risk level first (blocked/overdue first)
      const riskOrder = { blocked: 0, delayed: 1, overdue: 2, critical: 3, warning: 4, ok: 5, completed: 6, unknown: 7 };
      const aRisk = riskOrder[getGateRisk(a)] ?? 99;
      const bRisk = riskOrder[getGateRisk(b)] ?? 99;
      if (aRisk !== bRisk) return aRisk - bRisk;
      
      // Then by project
      const projectA = projectMap[a.project_id]?.name || "";
      const projectB = projectMap[b.project_id]?.name || "";
      if (projectA !== projectB) return projectA.localeCompare(projectB, undefined, { numeric: true, sensitivity: "base" });
      
      // Then by order
      return (a.order || 0) - (b.order || 0);
    });
  }, [gates, selectedProject, projectMap]);

  const summary = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return {
      total: filteredGates.length,
      blocked: filteredGates.filter((g) => g.status === "BLOCKED").length,
      delayed: filteredGates.filter((g) => g.status === "DELAYED").length,
      atRisk: filteredGates.filter((g) => {
        if (g.status === "COMPLETED" || g.status === "BLOCKED" || g.status === "DELAYED") return false;
        const days = getDaysUntil(g.required_by_date);
        return days !== null && days <= 7 && days >= 0;
      }).length,
      overdue: filteredGates.filter((g) => {
        if (g.status === "COMPLETED") return false;
        const days = getDaysUntil(g.required_by_date);
        return days !== null && days < 0;
      }).length,
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

  function getStatusStyle(status, gate) {
    const risk = getGateRisk(gate);
    
    if (status === "BLOCKED") return "bg-red-600 text-white border-red-700";
    if (status === "DELAYED") return "bg-orange-600 text-white border-orange-700";
    if (status === "COMPLETED") return "bg-emerald-600 text-white border-emerald-700";
    if (risk === "overdue") return "bg-red-600 text-white border-red-700";
    if (risk === "critical") return "bg-amber-600 text-white border-amber-700";
    if (risk === "warning") return "bg-yellow-600 text-white border-yellow-700";
    if (status === "AT_RISK") return "bg-amber-600 text-white border-amber-700";
    return "bg-emerald-600/80 text-white border-emerald-700";
  }

  function getCardStyle(gate) {
    const risk = getGateRisk(gate);
    
    if (risk === "blocked" || risk === "overdue") {
      return "border-red-500/60 bg-gradient-to-br from-red-950/30 via-card to-card shadow-[0_14px_36px_rgba(127,29,29,0.18)]";
    }
    if (risk === "delayed") {
      return "border-orange-500/60 bg-gradient-to-br from-orange-950/25 via-card to-card shadow-[0_14px_36px_rgba(124,45,18,0.16)]";
    }
    if (risk === "critical") {
      return "border-amber-500/60 bg-gradient-to-br from-amber-950/25 via-card to-card shadow-[0_14px_36px_rgba(120,53,15,0.14)]";
    }
    if (risk === "warning") {
      return "border-yellow-500/50 bg-gradient-to-br from-yellow-950/20 via-card to-card shadow-xl";
    }
    if (risk === "completed") {
      return "border-emerald-500/40 bg-gradient-to-br from-emerald-950/15 via-card to-card opacity-75";
    }
    return "border-slate-700 bg-gradient-to-br from-slate-900/70 via-card to-card shadow-xl";
  }

  function getRiskWarning(gate) {
    const risk = getGateRisk(gate);
    const days = getDaysUntil(gate.required_by_date);
    
    if (risk === "overdue") {
      return { icon: XCircle, text: `${Math.abs(days)} days overdue`, color: "text-red-400" };
    }
    if (risk === "blocked") {
      return { icon: XCircle, text: "Blocked", color: "text-red-400" };
    }
    if (risk === "delayed") {
      return { icon: AlertTriangle, text: "Delayed", color: "text-orange-400" };
    }
    if (risk === "critical") {
      return { icon: AlertCircle, text: `Due in ${days} day${days !== 1 ? 's' : ''}`, color: "text-amber-400" };
    }
    if (risk === "warning") {
      return { icon: Clock, text: `Due in ${days} days`, color: "text-yellow-400" };
    }
    if (risk === "completed") {
      return { icon: CheckCircle2, text: "Complete", color: "text-emerald-400" };
    }
    return null;
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
          <h2 className="font-heading text-2xl font-bold tracking-tight uppercase">Gates & Risks</h2>
          <p className="text-sm text-muted-foreground">
            {filteredGates.length} gate{filteredGates.length !== 1 ? "s" : ""} • 
            {summary.blocked + summary.delayed + summary.overdue > 0 && (
              <span className="text-red-400 font-medium"> {summary.blocked + summary.delayed + summary.overdue} need attention</span>
            )}
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

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7">
        <Card className="ops-card">
          <CardContent className="py-3 px-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Total</div>
            <div className="mt-1 text-xl font-bold">{summary.total}</div>
          </CardContent>
        </Card>
        <Card className="ops-card border-red-500/40">
          <CardContent className="py-3 px-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-red-400">Blocked</div>
            <div className="mt-1 text-xl font-bold text-red-400">{summary.blocked}</div>
          </CardContent>
        </Card>
        <Card className="ops-card border-orange-500/40">
          <CardContent className="py-3 px-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-orange-400">Delayed</div>
            <div className="mt-1 text-xl font-bold text-orange-400">{summary.delayed}</div>
          </CardContent>
        </Card>
        <Card className="ops-card border-red-500/40">
          <CardContent className="py-3 px-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-red-400">Overdue</div>
            <div className="mt-1 text-xl font-bold text-red-400">{summary.overdue}</div>
          </CardContent>
        </Card>
        <Card className="ops-card border-amber-500/40">
          <CardContent className="py-3 px-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-amber-400">At Risk</div>
            <div className="mt-1 text-xl font-bold text-amber-400">{summary.atRisk}</div>
          </CardContent>
        </Card>
        <Card className="ops-card border-emerald-500/40">
          <CardContent className="py-3 px-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-emerald-400">On Track</div>
            <div className="mt-1 text-xl font-bold text-emerald-400">{summary.onTrack}</div>
          </CardContent>
        </Card>
        <Card className="ops-card border-slate-600/40">
          <CardContent className="py-3 px-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Done</div>
            <div className="mt-1 text-xl font-bold text-muted-foreground">{summary.completed}</div>
          </CardContent>
        </Card>
      </div>

      {filteredGates.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filteredGates.map((gate) => {
            const warning = getRiskWarning(gate);
            const WarningIcon = warning?.icon;
            
            return (
              <Card key={gate.id} className={`ops-card overflow-hidden ${getCardStyle(gate)}`}>
                <CardHeader className="ops-card-header py-3 px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="font-heading text-base tracking-tight truncate">
                        {gate.order ? `${gate.order}. ` : ""}{gate.name || "Untitled Gate"}
                      </CardTitle>
                      <div className="mt-1 text-xs text-muted-foreground truncate">
                        {projectMap[gate.project_id]?.shortName || gate.project_id}
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-bold uppercase border ${getStatusStyle(gate.status, gate)}`}>
                      {gate.status || "UNKNOWN"}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="py-3 px-4 space-y-3 text-sm">
                  {/* Risk Warning Banner */}
                  {warning && (
                    <div className={`flex items-center gap-2 ${warning.color}`}>
                      {WarningIcon && <WarningIcon className="w-4 h-4 flex-shrink-0" />}
                      <span className="text-sm font-medium">{warning.text}</span>
                    </div>
                  )}

                  {gate.description && (
                    <p className="text-muted-foreground text-xs line-clamp-2">{gate.description}</p>
                  )}

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Owner</div>
                      <div className="font-medium">{gate.owner_party || "—"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Required By</div>
                      <div className="font-medium">{formatDate(gate.required_by_date)}</div>
                    </div>
                    {gate.expected_complete_date && (
                      <div>
                        <div className="text-muted-foreground">Expected</div>
                        <div className="font-medium">{formatDate(gate.expected_complete_date)}</div>
                      </div>
                    )}
                    {gate.buffer_days > 0 && (
                      <div>
                        <div className="text-muted-foreground">Buffer</div>
                        <div className="font-medium">{gate.buffer_days} day{gate.buffer_days !== 1 ? "s" : ""}</div>
                      </div>
                    )}
                  </div>

                  {/* Flags */}
                  <div className="flex flex-wrap gap-1.5">
                    {gate.is_hard_gate && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/30">
                        Hard Gate
                      </span>
                    )}
                    {gate.is_optional && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-500/20 text-slate-400 border border-slate-500/30">
                        Optional
                      </span>
                    )}
                    {Array.isArray(gate.depends_on_gate_ids) && gate.depends_on_gate_ids.length > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        {gate.depends_on_gate_ids.length} Dependencies
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="empty-state py-20">
          <AlertTriangle className="empty-state-icon" />
          <p className="empty-state-title">No Gates Found</p>
          <p className="empty-state-description">No gates match the current filter.</p>
        </div>
      )}
    </div>
  );
}
