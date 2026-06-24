import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { projectsApi } from '../lib/api';
import { toast } from 'sonner';
import {
  FolderOpen,
  MapPin,
  Building2,
  Calendar,
  Trash2,
  ArrowRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

const ProjectsPage = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [projectConfirm, setProjectConfirm] = useState(null); // projects-archive-delete-app-confirm-v1-state
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('active');
const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    job_number: '',
    name: '',
    description: '',
    client_name: '',
    location: '',
    status: 'active',
    main_contractor: '',
    site_contact: '',
    site_phone: '',
    programme_start_date: '',
    required_finish_date: '',
    display_order: ''
  });

  useEffect(() => {
    fetchProjects();
  }, []);
  const startCreateProject = () => {
    setEditingId(null);
    setForm({
      job_number: '',
      name: '',
      description: '',
      client_name: '',
      location: '',
      status: 'active',
      main_contractor: '',
      site_contact: '',
      site_phone: '',
      programme_start_date: '',
      required_finish_date: '',
      display_order: ''
    });
    setShowCreate(true);
  };

  const startEditProject = (project) => {
    setEditingId(project.id);
    setForm({
      job_number: project.job_number || '',
      name: project.name || '',
      description: project.description || '',
      client_name: project.client_name || '',
      location: project.location || '',
      status: project.status || 'active',
      main_contractor: project.main_contractor || '',
      site_contact: project.site_contact || '',
      site_phone: project.site_phone || '',
      programme_start_date: project.programme_start_date || '',
      required_finish_date: project.required_finish_date || '',
      display_order: project.display_order ?? ''
    });
    setShowCreate(true);
  };


  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await projectsApi.getAll();
      const allProjects = Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.value) ? res.data.value : [];
      setProjects(allProjects);
    } catch (error) {
      toast.error('Failed to load projects');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error('Project name is required');
      return;
    }

    const payload = {
      job_number: form.job_number.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      client_name: form.client_name.trim() || null,
      location: form.location.trim() || null,
      status: form.status || 'active',
      main_contractor: form.main_contractor.trim() || null,
      site_contact: form.site_contact.trim() || null,
      site_phone: form.site_phone.trim() || null,
      programme_start_date: form.programme_start_date || null,
      required_finish_date: form.required_finish_date || null,
      display_order: form.display_order === '' ? null : Number(form.display_order)
    };

    try {
      setCreating(true);

      if (editingId) {
        await projectsApi.update(editingId, payload);
        toast.success('Project updated');
      } else {
        await projectsApi.create(payload);
        toast.success('Project created');
      }

      setEditingId(null);
      setForm({
        job_number: '',
        name: '',
        description: '',
        client_name: '',
        location: '',
        status: 'active',
        main_contractor: '',
        site_contact: '',
        site_phone: '',
        programme_start_date: '',
        required_finish_date: '',
        display_order: ''
      });

      fetchProjects();
    } catch (error) {
      toast.error(editingId ? 'Failed to update project' : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const requestProjectConfirm = (action, project) => {
    if (!project?.id) {
      return;
    }

    const label = project.name || project.job_number || 'this project';
    setProjectConfirm({ action, project, label });
  }; // projects-archive-delete-app-confirm-v1-request

  const handleArchiveProject = (project) => {
    requestProjectConfirm('archive', project);
  };

  const handleDeleteProject = (project) => {
    requestProjectConfirm('delete', project);
  };

  const executeProjectConfirm = async () => {
    if (!projectConfirm?.project?.id || deletingId) {
      return;
    }

    const { action, project } = projectConfirm;

    try {
      setDeletingId(project.id);

      if (action === 'archive') {
        await projectsApi.update(project.id, {
          ...project,
          status: 'archived'
        });
        toast.success('Project archived');
      } else {
        await projectsApi.delete(project.id);
        toast.success('Project deleted');
      }

      setProjectConfirm(null);
      fetchProjects();
    } catch (error) {
      toast.error(action === 'archive' ? 'Failed to archive project' : 'Failed to delete project');
    } finally {
      setDeletingId(null);
    }
  }; // projects-archive-delete-app-confirm-v1-execute

  const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-NZ', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };


  const filteredProjects = projects.filter((project) => {
    const status = project.status || 'active';
    if (statusFilter === 'all') return true;
    return status === statusFilter;
  });
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-7" data-testid="projects-page">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-4xl font-black uppercase tracking-[0.08em]" data-testid="projects-heading-polish-v2-marker">Projects</h2>
          <p className="mt-1 text-base font-medium text-muted-foreground">
            {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''} shown
          </p>
        </div>

        <Button className="h-11 px-5 font-bold uppercase tracking-[0.08em]" data-testid="projects-create-button-polish-v2" onClick={() => showCreate ? setShowCreate(false) : startCreateProject()}>
          {showCreate ? (editingId ? 'Hide Edit Project' : 'Hide Create Project') : 'Create Project'}
        </Button>
      </div>

      <Dialog open={Boolean(projectConfirm)} onOpenChange={(open) => {
        if (!open && !deletingId) {
          setProjectConfirm(null);
        }
      }}>
        <DialogContent className="sm:max-w-md" data-testid="projects-archive-delete-app-confirm-v1-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl uppercase tracking-tight">
              {projectConfirm?.action === 'delete' ? 'Delete project?' : 'Archive project?'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              {projectConfirm?.action === 'delete'
                ? 'This will delete the project and related roadblocks / concerns, action items, and walkaround entries.'
                : 'This will hide the project from active jobs while keeping it in the system.'}
            </p>
            <p className="rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 font-semibold text-foreground">
              {projectConfirm?.label || 'This project'}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setProjectConfirm(null)} disabled={Boolean(deletingId)}>
              Cancel
            </Button>
            <Button type="button" className={projectConfirm?.action === 'delete' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'btn-primary'} onClick={executeProjectConfirm} disabled={Boolean(deletingId)}>
              {deletingId
                ? 'Working...'
                : projectConfirm?.action === 'delete'
                  ? 'Delete Project'
                  : 'Archive Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {showCreate && (
      <Card className="ops-card border-primary/40" data-testid="projects-form-polish-v2">
        <CardHeader className="ops-card-header border-b border-border/70 bg-secondary/20 px-4 py-4 sm:px-5">
          <CardTitle className="font-heading text-xl font-black uppercase tracking-[0.14em]">{editingId ? 'Edit Project' : 'Create Project'}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 py-4 sm:px-5">
          <form onSubmit={handleCreateProject} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              className="h-10 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm"
              placeholder="Job number"
              value={form.job_number}
              onChange={(e) => setForm({ ...form, job_number: e.target.value })}
            />
            <input
              className="h-10 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm"
              placeholder="Project name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="h-10 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm"
              placeholder="Client name"
              value={form.client_name}
              onChange={(e) => setForm({ ...form, client_name: e.target.value })}
            />
            <input
              className="h-10 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm"
              placeholder="Location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
            <input
              className="h-10 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm"
              placeholder="Main contractor"
              value={form.main_contractor}
              onChange={(e) => setForm({ ...form, main_contractor: e.target.value })}
            />
            <input
              className="h-10 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm"
              placeholder="Site contact"
              value={form.site_contact}
              onChange={(e) => setForm({ ...form, site_contact: e.target.value })}
            />
            <input
              className="h-10 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm"
              placeholder="Site phone"
              value={form.site_phone}
              onChange={(e) => setForm({ ...form, site_phone: e.target.value })}
            />
            <input
              type="number"
              min="1"
              className="h-10 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm"
              placeholder="Display order"
              value={form.display_order}
              onChange={(e) => setForm({ ...form, display_order: e.target.value })}
            />            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Start date</label>
              <input
                type="date"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm"
                value={form.programme_start_date}
                onChange={(e) => setForm({ ...form, programme_start_date: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Completed by</label>
              <input
                type="date"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm"
                value={form.required_finish_date}
                onChange={(e) => setForm({ ...form, required_finish_date: e.target.value })}
              />
            </div>
            <select
              className="h-10 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium shadow-sm"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="active">active</option>
              <option value="complete">complete</option>
            </select>
            <textarea
              className="md:col-span-2 min-h-[96px] w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div className="md:col-span-2">
              <Button type="submit" disabled={creating}>
                {creating ? (editingId ? 'Updating...' : 'Creating...') : (editingId ? 'Update Project' : 'Create Project')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      )}

      {filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3" data-testid="projects-grid-polish-v2">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="ops-card group h-full overflow-hidden border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg" data-polish="projects-card-polish-v2" data-testid={`project-${project.id}`}>
              <CardHeader className="ops-card-header border-b border-border/70 bg-secondary/20 px-4 py-4 sm:px-5">
                <CardTitle className="font-heading text-xl font-black tracking-tight">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                      {project.job_number || 'No job number'}
                    </span>
                    <span className="truncate">
                      {project.name || 'Untitled Project'}
                    </span>
                  </div>
                </CardTitle>
              </CardHeader>

              <CardContent className="px-4 py-4 sm:px-5">
                <div className="space-y-2 text-sm">
                  {project.client_name && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="w-4 h-4" />
                      <span>{project.client_name}</span>
                    </div>
                  )}

                  {project.location && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>{project.location}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>{project.programme_start_date && project.required_finish_date ? `${formatDate(project.programme_start_date)} to ${formatDate(project.required_finish_date)}` : project.programme_start_date ? `Start ${formatDate(project.programme_start_date)}` : project.required_finish_date ? `Finish ${formatDate(project.required_finish_date)}` : "No key dates"}</span>
                  </div>

                  {project.display_order !== null && project.display_order !== undefined && (
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                      Order {project.display_order}
                    </div>
                  )}
                </div>

                {project.description && (
                  <p className="mt-3 line-clamp-3 text-sm leading-5 text-muted-foreground">
                    {project.description}
                  </p>
                )}

                <div className="mt-4 flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <span className={`status-badge ${project.status === 'active' ? 'status-on-track' : project.status === 'archived' ? 'status-blocked' : 'status-completed'}`}>
                    {project.status || 'unknown'}
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => startEditProject(project)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleArchiveProject(project)}
                      disabled={deletingId === project.id}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      {deletingId === project.id ? 'Archiving' : 'Archive'}
                    </Button>

                    <Link to={`/projects/${project.id}`}>
                      <Button variant="ghost" size="sm" className="text-primary">
                        View <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="empty-state py-20">
          <FolderOpen className="empty-state-icon" />
          <p className="empty-state-title">No Projects Found</p>
          <p className="empty-state-description mb-4">
            No projects are available yet.
          </p>
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;

































