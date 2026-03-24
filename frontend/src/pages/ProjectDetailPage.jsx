import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { projectsApi, actionItemsApi, gatesApi, diaryApi } from '../lib/api';
import {
  FolderOpen,
  MapPin,
  Building2,
  Calendar,
  ListTodo,
  BookOpen,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  Phone,
  Target
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [actionItems, setActionItems] = useState([]);
  const [gates, setGates] = useState([]);
  const [diarySummary, setDiarySummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        const today = new Date().toLocaleDateString('en-CA', {
          timeZone: 'Pacific/Auckland'
        });

        const [projectRes, itemsRes, gatesRes, diaryRes] = await Promise.all([
          projectsApi.get(id),
          actionItemsApi.getAll({ project_id: id }),
          gatesApi.getAll({ project_id: id }).catch(() => ({ data: [] })),
          diaryApi.get(id, today).catch(() => ({ data: null }))
        ]);

        setProject(projectRes.data || null);
        setActionItems(Array.isArray(itemsRes?.data) ? itemsRes.data : (itemsRes?.data?.value || []));
        setGates(Array.isArray(gatesRes?.data) ? gatesRes.data : (gatesRes?.data?.value || []));
        setDiarySummary(diaryRes?.data || null);
      } catch (error) {
        console.error(error);
        setProject(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const formatDate = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-NZ', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getDaysUntil = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return Math.ceil((date - today) / (1000 * 60 * 60 * 24));
  };

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
          <p className="empty-state-description">This project could not be loaded.</p>
        </div>
      </div>
    );
  }

  const openItems = actionItems.filter((i) => i.status === 'open');
  const criticalItems = openItems.filter((i) => i.priority === 'critical' || i.priority === 'high');
  const overdueItems = openItems.filter((i) => {
    const days = getDaysUntil(i.due_date);
    return days !== null && days < 0;
  });

  const openGates = gates.filter((g) => g.status !== 'COMPLETED');
  const riskGates = openGates.filter((g) => {
    if (g.status === 'BLOCKED' || g.status === 'DELAYED') return true;
    const days = getDaysUntil(g.required_by_date);
    return days !== null && days <= 7;
  });

  return (
    <div className="space-y-6" data-testid="project-detail-page">
      {/* Header */}
      <div className="space-y-3">
        <Link to="/projects">
          <Button variant="ghost" size="sm" className="h-8 px-2">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-heading text-2xl font-bold tracking-tight uppercase">
              {project.job_number && <span className="text-primary">{project.job_number}</span>}
              {project.job_number && ' - '}
              {project.name || 'Untitled Project'}
            </h2>
            <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-bold uppercase ${
              project.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
              project.status === 'completed' ? 'bg-slate-500/20 text-slate-400 border border-slate-500/30' :
              'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}>
              {project.status || 'active'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Project overview and status</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className={`ops-card ${overdueItems.length > 0 ? 'border-red-500/50' : ''}`}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Open Items</p>
                <p className={`text-2xl font-bold mt-1 ${overdueItems.length > 0 ? 'text-red-400' : ''}`}>{openItems.length}</p>
              </div>
              <ListTodo className={`w-8 h-8 ${overdueItems.length > 0 ? 'text-red-400' : 'text-primary'}`} />
            </div>
            {overdueItems.length > 0 && (
              <p className="text-xs text-red-400 mt-2">{overdueItems.length} overdue</p>
            )}
          </CardContent>
        </Card>

        <Card className={`ops-card ${riskGates.length > 0 ? 'border-amber-500/50' : ''}`}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Gates at Risk</p>
                <p className={`text-2xl font-bold mt-1 ${riskGates.length > 0 ? 'text-amber-400' : ''}`}>{riskGates.length}</p>
              </div>
              <AlertTriangle className={`w-8 h-8 ${riskGates.length > 0 ? 'text-amber-400' : 'text-muted-foreground'}`} />
            </div>
            {riskGates.length > 0 && (
              <p className="text-xs text-amber-400 mt-2">Need attention</p>
            )}
          </CardContent>
        </Card>

        <Card className="ops-card">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Critical Items</p>
                <p className={`text-2xl font-bold mt-1 ${criticalItems.length > 0 ? 'text-orange-400' : ''}`}>{criticalItems.length}</p>
              </div>
              <Target className={`w-8 h-8 ${criticalItems.length > 0 ? 'text-orange-400' : 'text-muted-foreground'}`} />
            </div>
          </CardContent>
        </Card>

        <Card className="ops-card">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Gates Total</p>
                <p className="text-2xl font-bold mt-1">{gates.length}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{gates.filter(g => g.status === 'COMPLETED').length} completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Project Info */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Details Card */}
        <Card className="ops-card lg:col-span-2">
          <CardHeader className="ops-card-header py-3">
            <CardTitle className="font-heading text-lg uppercase tracking-[0.12em]">
              Project Details
            </CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {project.client_name && (
                <div className="flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Client</p>
                    <p className="text-sm font-medium">{project.client_name}</p>
                  </div>
                </div>
              )}
              
              {project.main_contractor && (
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Main Contractor</p>
                    <p className="text-sm font-medium">{project.main_contractor}</p>
                  </div>
                </div>
              )}

              {project.location && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Location</p>
                    <p className="text-sm font-medium">{project.location}</p>
                  </div>
                </div>
              )}

              {project.site_contact && (
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Site Contact</p>
                    <p className="text-sm font-medium">{project.site_contact}</p>
                    {project.site_phone && <p className="text-xs text-muted-foreground">{project.site_phone}</p>}
                  </div>
                </div>
              )}

              {project.programme_start_date && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Programme Start</p>
                    <p className="text-sm font-medium">{formatDate(project.programme_start_date)}</p>
                  </div>
                </div>
              )}

              {project.required_finish_date && (
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Required Finish</p>
                    <p className="text-sm font-medium">{formatDate(project.required_finish_date)}</p>
                    {(() => {
                      const days = getDaysUntil(project.required_finish_date);
                      if (days !== null) {
                        return (
                          <p className={`text-xs ${days < 0 ? 'text-red-400' : days <= 14 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                            {days < 0 ? `${Math.abs(days)} days overdue` : `${days} days remaining`}
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              )}
            </div>

            {project.description && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm leading-6 text-muted-foreground">{project.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="ops-card">
          <CardHeader className="ops-card-header py-3">
            <CardTitle className="font-heading text-lg uppercase tracking-[0.12em]">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="py-4 space-y-2">
            <Link to="/walkaround" className="block">
              <Button variant="secondary" size="sm" className="w-full justify-start">
                <Target className="mr-2 h-4 w-4" />
                New Walkaround
              </Button>
            </Link>
            <Link to="/action-items" className="block">
              <Button variant="secondary" size="sm" className="w-full justify-start">
                <ListTodo className="mr-2 h-4 w-4" />
                View Action Items
              </Button>
            </Link>
            <Link to="/gates" className="block">
              <Button variant="secondary" size="sm" className="w-full justify-start">
                <AlertTriangle className="mr-2 h-4 w-4" />
                View Gates
              </Button>
            </Link>
            <Link to="/diary" className="block">
              <Button variant="secondary" size="sm" className="w-full justify-start">
                <BookOpen className="mr-2 h-4 w-4" />
                View Diary
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Risk Gates Section */}
      {riskGates.length > 0 && (
        <Card className="ops-card border-amber-500/50">
          <CardHeader className="ops-card-header py-3 bg-amber-950/20">
            <CardTitle className="font-heading text-lg uppercase tracking-[0.12em] text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Gates Needing Attention
            </CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            <div className="space-y-2">
              {riskGates.slice(0, 5).map((gate) => {
                const days = getDaysUntil(gate.required_by_date);
                return (
                  <div key={gate.id} className="flex items-center justify-between p-3 rounded-md bg-secondary/30">
                    <div>
                      <p className="text-sm font-medium">{gate.order ? `${gate.order}. ` : ''}{gate.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {gate.status === 'BLOCKED' ? 'Blocked' : gate.status === 'DELAYED' ? 'Delayed' : `Due ${formatDate(gate.required_by_date)}`}
                      </p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      gate.status === 'BLOCKED' ? 'bg-red-500/20 text-red-400' :
                      gate.status === 'DELAYED' ? 'bg-orange-500/20 text-orange-400' :
                      days !== null && days < 0 ? 'bg-red-500/20 text-red-400' :
                      'bg-amber-500/20 text-amber-400'
                    }`}>
                      {gate.status === 'BLOCKED' ? 'BLOCKED' : 
                       gate.status === 'DELAYED' ? 'DELAYED' :
                       days !== null && days < 0 ? 'OVERDUE' : 'AT RISK'}
                    </span>
                  </div>
                );
              })}
            </div>
            {riskGates.length > 5 && (
              <Link to="/gates" className="block mt-3">
                <Button variant="link" size="sm" className="text-amber-400 p-0">
                  View all {riskGates.length} risk gates →
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Critical Action Items */}
      {criticalItems.length > 0 && (
        <Card className="ops-card border-orange-500/50">
          <CardHeader className="ops-card-header py-3 bg-orange-950/20">
            <CardTitle className="font-heading text-lg uppercase tracking-[0.12em] text-orange-400 flex items-center gap-2">
              <Target className="w-5 h-5" />
              Critical Action Items
            </CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            <div className="space-y-2">
              {criticalItems.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-md bg-secondary/30">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.owner && `${item.owner} • `}
                      {item.due_date && `Due ${formatDate(item.due_date)}`}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${
                    item.priority === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'
                  }`}>
                    {item.priority?.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
            {criticalItems.length > 5 && (
              <Link to="/action-items" className="block mt-3">
                <Button variant="link" size="sm" className="text-orange-400 p-0">
                  View all {criticalItems.length} critical items →
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Today's Diary Summary */}
      {diarySummary && (
        <Card className="ops-card">
          <CardHeader className="ops-card-header py-3">
            <CardTitle className="font-heading text-lg uppercase tracking-[0.12em] flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Today's Diary
            </CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{diarySummary.walkaround_entries || 0}</p>
                <p className="text-xs text-muted-foreground">Walkaround Entries</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{diarySummary.action_items_created || 0}</p>
                <p className="text-xs text-muted-foreground">Items Created</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{diarySummary.action_items_completed || 0}</p>
                <p className="text-xs text-muted-foreground">Items Completed</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{diarySummary.gates_completed || 0}</p>
                <p className="text-xs text-muted-foreground">Gates Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
