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

const ProjectsPage = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
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
      console.error(error);
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
      console.error(error);
      toast.error(editingId ? 'Failed to update project' : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const handleArchiveProject = async (project) => {
    const label = project.name || 'this project';
    if (!window.confirm(`Archive ${label}? It will be hidden from active jobs but kept in the system.`)) {
      return;
    }

    try {
      setDeletingId(project.id);
      await projectsApi.update(project.id, {
        ...project,
        status: 'archived'
      });
      toast.success('Project archived');
      fetchProjects();
    } catch (error) {
      console.error(error);
      toast.error('Failed to archive project');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteProject = async (project) => {
    const label = project.name || 'this project';
    if (!window.confirm(`Delete ${label}? This will also delete related roadblocks / concerns, action items, and walkaround entries.`)) {
      return;
    }

    try {
      setDeletingId(project.id);
      await projectsApi.delete(project.id);
      toast.success('Project deleted');
      fetchProjects();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete project');
    } finally {
      setDeletingId(null);
    }
  };

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
    <div className="space-y-6" data-testid="projects-page">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-heading text-2xl font-bold tracking-tight uppercase">Projects</h2>
          <p className="text-sm text-muted-foreground">
            {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}
          </p>
        </div>

        <Button onClick={() => showCreate ? setShowCreate(false) : startCreateProject()}>
          {showCreate ? (editingId ? 'Hide Edit Project' : 'Hide Create Project') : 'Create Project'}
        </Button>
      </div>

      {showCreate && (
      <Card className="ops-card">
        <CardHeader className="ops-card-header py-3">
          <CardTitle className="font-heading text-lg tracking-tight">{editingId ? 'Edit Project' : 'New Project'}</CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <form onSubmit={handleCreateProject} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="Job number"
              value={form.job_number}
              onChange={(e) => setForm({ ...form, job_number: e.target.value })}
            />
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="Project name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="Client name"
              value={form.client_name}
              onChange={(e) => setForm({ ...form, client_name: e.target.value })}
            />
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="Location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="Main contractor"
              value={form.main_contractor}
              onChange={(e) => setForm({ ...form, main_contractor: e.target.value })}
            />
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="Site contact"
              value={form.site_contact}
              onChange={(e) => setForm({ ...form, site_contact: e.target.value })}
            />
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="Site phone"
              value={form.site_phone}
              onChange={(e) => setForm({ ...form, site_phone: e.target.value })}
            />
            <input
              type="number"
              min="1"
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="Display order"
              value={form.display_order}
              onChange={(e) => setForm({ ...form, display_order: e.target.value })}
            />            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Start date</label>
              <input
                type="date"
                className="w-full rounded-md border border-border bg-background px-3 py-2"
                value={form.programme_start_date}
                onChange={(e) => setForm({ ...form, programme_start_date: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Completed by</label>
              <input
                type="date"
                className="w-full rounded-md border border-border bg-background px-3 py-2"
                value={form.required_finish_date}
                onChange={(e) => setForm({ ...form, required_finish_date: e.target.value })}
              />
            </div>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2"
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="ops-card group" data-testid={`project-${project.id}`}>
              <CardHeader className="ops-card-header py-3">
                <CardTitle className="font-heading text-lg tracking-tight">
                  <div className="flex flex-col">
                    <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      {project.job_number || 'No job number'}
                    </span>
                    <span className="truncate">
                      {project.name || 'Untitled Project'}
                    </span>
                  </div>
                </CardTitle>
              </CardHeader>

              <CardContent className="py-4">
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
                    <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      Order {project.display_order}
                    </div>
                  )}
                </div>

                {project.description && (
                  <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                    {project.description}
                  </p>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                  <span className={`status-badge ${project.status === 'active' ? 'status-on-track' : project.status === 'archived' ? 'status-blocked' : 'status-completed'}`}>
                    {project.status || 'unknown'}
                  </span>

                  <div className="flex items-center gap-2">
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

































