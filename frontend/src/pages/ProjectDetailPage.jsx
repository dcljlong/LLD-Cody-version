import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { projectsApi, actionItemsApi, diaryApi } from '../lib/api';
import {
  FolderOpen,
  MapPin,
  Building2,
  Calendar,
  ListTodo,
  BookOpen,
  ArrowLeft
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [actionItems, setActionItems] = useState([]);
  const [diarySummary, setDiarySummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        const today = new Date().toLocaleDateString('en-CA', {
          timeZone: 'Pacific/Auckland'
        });

        const [projectRes, itemsRes, diaryRes] = await Promise.all([
          projectsApi.get(id),
          actionItemsApi.getAll({ project_id: id }),
          diaryApi.get(id, today).catch(() => ({ data: null }))
        ]);

        setProject(projectRes.data || null);
        setActionItems(Array.isArray(itemsRes?.data) ? itemsRes.data : []);
        setDiarySummary(diaryRes?.data?.summary || null);
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
  const completedItems = actionItems.filter((i) => i.status === 'completed');

  return (
    <div className="space-y-6" data-testid="project-detail-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <Link to="/projects">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Projects
            </Button>
          </Link>
          <div>
            <h2 className="font-heading text-2xl font-bold tracking-tight uppercase">
              {project.name || 'Untitled Project'}
            </h2>
            <p className="text-sm text-muted-foreground">
              Project overview
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="ops-card">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Client</p>
                <p className="text-sm font-medium">{project.client_name || '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="ops-card">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Location</p>
                <p className="text-sm font-medium">{project.location || '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="ops-card">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Created</p>
                <p className="text-sm font-medium">{formatDate(project.created_at)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {project.description && (
        <Card className="ops-card">
          <CardHeader className="ops-card-header py-3">
            <CardTitle className="font-heading text-lg uppercase tracking-[0.12em]">
              Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            <p className="text-sm leading-6 text-muted-foreground">{project.description}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="ops-card">
          <CardHeader className="ops-card-header py-3">
            <CardTitle className="flex items-center gap-2 font-heading text-lg uppercase tracking-[0.12em]">
              <ListTodo className="h-4 w-4" />
              Action Items
            </CardTitle>
          </CardHeader>
          <CardContent className="py-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Open</span>
              <span className="font-semibold">{openItems.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Completed</span>
              <span className="font-semibold">{completedItems.length}</span>
            </div>
            <div className="pt-3">
              <Link to="/action-items">
                <Button variant="secondary" size="sm">Open Action Items</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="ops-card">
          <CardHeader className="ops-card-header py-3">
            <CardTitle className="flex items-center gap-2 font-heading text-lg uppercase tracking-[0.12em]">
              <BookOpen className="h-4 w-4" />
              Diary Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="py-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Entries</span>
              <span className="font-semibold">{diarySummary?.entries_count ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Items Opened</span>
              <span className="font-semibold">{diarySummary?.items_opened ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Items Closed</span>
              <span className="font-semibold">{diarySummary?.items_closed ?? 0}</span>
            </div>
            <div className="pt-3">
              <Link to="/diary">
                <Button variant="secondary" size="sm">Open Diary</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
