import React, { useState, useEffect, useRef } from 'react';
import { walkaroundApi, projectsApi, jobsApi, tasksApi } from '../lib/api';
import { toast } from 'sonner';
import {
  Camera,
  Send,
  X,
  Target,
  Clock,
  User,
  AlertTriangle,
  Image as ImageIcon,
  CheckCircle2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Card, CardContent } from '../components/ui/card';

const WalkaroundPage = () => {
  const [jobs, setJobs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [gates, setGates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [recentEntries, setRecentEntries] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileInputRef = useRef(null);
  const noteInputRef = useRef(null);

  const [formData, setFormData] = useState({
    note: '',
    project_id: localStorage.getItem('lld_last_project_id') || '',
    gate_id: '',
    task_id: '',
    priority: 'medium',
    due_date: '',
    expected_complete_date: '',
    owner: 'Me',
    photos: [],
    create_action_item: true
  });

  useEffect(() => {
    fetchProjects();
    fetchRecentEntries(); setTimeout(() => noteInputRef.current?.focus(), 50);
    setTimeout(() => noteInputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    if (formData.project_id) {
      const selectedProject = jobs.find(p => p.id === formData.project_id);
      const projectName = selectedProject?.name || '';
      const match = projectName.match(/#\s*(\d+)/);
      const projectNumber = match ? match[1].trim() : '';

      const allJobs = window.__lldJobs || [];
      const matchedJob = allJobs.find(j => ((j.job_number || '').trim().replace(/^#/, '') === projectNumber));

      if (matchedJob?.id) {
        fetchTasks(matchedJob.id);
      } else {
        setTasks([]);
      }
    } else {
      setTasks([]);
      setGates([]);
    }
  }, [formData.project_id]);

  const fetchProjects = async () => {
    try {
      const [projectsRes, jobsRes] = await Promise.all([
        projectsApi.getAll(),
        jobsApi.getAll()
      ]);

      setJobs(projectsRes.data?.value || projectsRes.data || []);
      window.__lldJobs = jobsRes.data?.value || jobsRes.data || [];
    } catch (error) {
      console.error('Failed to fetch projects/jobs:', error);
      setJobs([]);
      window.__lldJobs = [];
    }
  };

  const fetchTasks = async (jobId) => {
    try {
      const res = await tasksApi.getAll({ job_id: jobId });
      const allTasks = res.data?.value || res.data || [];
      setTasks(allTasks.filter(t => t.task_type !== 'Scope'));
      setGates([]);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      setTasks([]);
      setGates([]);
    }
  };

  const fetchRecentEntries = async () => {
    try {
      const res = await walkaroundApi.getAll({});
      setRecentEntries(res.data.slice(0, 5));
    } catch (error) {
      console.error('Failed to fetch entries:', error);
    }
  };

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    
    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Photo must be under 5MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = () => {
        setFormData(prev => ({
          ...prev,
          photos: [...prev.photos, reader.result]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.note.trim()) {
      toast.error('Please enter a note');
      return;
    }
    
    if (!formData.project_id) {
      toast.error('Please select a project');
      return;
    }

    setSubmitting(true);
    try {
      await walkaroundApi.create(formData);
      localStorage.setItem('lld_last_project_id', formData.project_id);
      toast.success('Entry captured');
      
      // Reset form
      setFormData({
        note: '',
        project_id: formData.project_id, // Keep project selected
        gate_id: '',
    task_id: '',
        priority: 'medium',
        due_date: '',
        expected_complete_date: '',
        owner: 'Me',
        photos: [],
        create_action_item: true
      });
      
      fetchRecentEntries(); setTimeout(() => noteInputRef.current?.focus(), 50);
    } catch (error) {
      toast.error('Failed to save entry');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const priorityOptions = [
    { value: 'critical', label: 'Critical', color: 'text-red-500' },
    { value: 'high', label: 'High', color: 'text-orange-500' },
    { value: 'medium', label: 'Medium', color: 'text-amber-500' },
    { value: 'low', label: 'Low', color: 'text-blue-400' },
    { value: 'deferred', label: 'Deferred', color: 'text-zinc-400' }
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6" data-testid="walkaround-page">
      {/* Quick Capture Form */}
      <Card className="ops-card">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Note Input - Large and prominent */}
            <div>
              <Textarea ref={noteInputRef}
                placeholder="What did you observe? Tap and type..."
                value={formData.note}
                onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                className="min-h-[120px] text-lg bg-secondary/50 border-0 focus:ring-1 focus:ring-primary resize-none"
                data-testid="walkaround-note"
              />
            </div>

            {/* Photo Upload */}
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoUpload}
                accept="image/*"
                multiple
                className="hidden"
              />
              
              <div className="flex flex-wrap gap-2">
                {formData.photos.map((photo, i) => (
                  <div key={i} className="photo-preview relative group">
                    <img src={photo} alt={`Upload ${i + 1}`} className="w-20 h-20 object-cover rounded-sm" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 border-2 border-dashed border-border rounded-sm flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  data-testid="photo-upload-btn"
                >
                  <Camera className="w-5 h-5" />
                  <span className="text-xs">Photo</span>
                </button>
              </div>
            </div>            <div className="flex items-center justify-between rounded-sm bg-secondary/40 px-3 py-2">
              <div>
                <div className="text-sm font-medium">Advanced options</div>
                <div className="text-xs text-muted-foreground">Task, owner, dates, and action-item controls</div>
              </div>
              <Switch
                checked={showAdvanced}
                onCheckedChange={setShowAdvanced}
                data-testid="walkaround-advanced-toggle"
              />
            </div>

            {/* Project & Gate Selection */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label className="form-label">Project *</Label>
                <Select
                  value={formData.project_id}
                  onValueChange={(value) => { localStorage.setItem('lld_last_project_id', value); localStorage.setItem('lld_last_project', value); setFormData(prev => ({ ...prev, project_id: value, gate_id: '', task_id: '' })); }}
                >
                  <SelectTrigger data-testid="project-select">
                    <SelectValue placeholder="Select job" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.job_name || p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>            </div>

            {/* Priority */}
            <div>
              <Label className="form-label">Priority</Label>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {priorityOptions.map((p) => {
                  const active = formData.priority === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, priority: p.value }))}
                      className={`rounded-sm border px-2 py-2 text-xs font-semibold transition-colors ${
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-secondary/40 text-foreground hover:border-primary'
                      }`}
                      data-testid={`priority-btn-${p.value}`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {showAdvanced && (
              <>
                <div>
                  <Label className="form-label">Linked Task</Label>
                  <Select
                    value={formData.task_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, task_id: value }))}
                    disabled={!formData.project_id || tasks.length === 0}
                  >
                    <SelectTrigger data-testid="task-select">
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      {tasks.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.task_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="form-label">Owner</Label>
<div className="flex flex-wrap gap-2 mb-2">
  {["Me","Site","MC","Subbies","Client"].map(o => (
    <button
      key={o}
      type="button"
      onClick={() => setFormData(prev => ({ ...prev, owner: o }))}
      className="px-2 py-1 text-xs rounded-sm border border-border bg-secondary/40 hover:border-primary"
    >
      {o}
    </button>
  ))}
</div>
                    <Input
                      placeholder="Who's responsible?"
                      value={formData.owner}
                      onChange={(e) => setFormData(prev => ({ ...prev, owner: e.target.value }))}
                      className="form-input"
                      data-testid="owner-input"
                    />
                  </div>

                  <div className="flex items-center justify-between py-2 px-3 bg-secondary/50 rounded-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Create action item</span>
                    </div>
                    <Switch
                      checked={formData.create_action_item}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, create_action_item: checked }))}
                      data-testid="create-action-toggle"
                    />
                  </div>
                </div>

                {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="form-label">Due Date</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                  className="form-input"
                  data-testid="due-date-input"
                />
              </div>

              <div>
                <Label className="form-label">Expected Complete</Label>
                <Input
                  type="date"
                  value={formData.expected_complete_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, expected_complete_date: e.target.value }))}
                  className="form-input"
                  data-testid="expected-date-input"
                />
              </div>
            </div>                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="form-label">Due Date</Label>
                    <Input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                      className="form-input"
                      data-testid="due-date-input"
                    />
                  </div>

                  <div>
                    <Label className="form-label">Expected Complete</Label>
                    <Input
                      type="date"
                      value={formData.expected_complete_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, expected_complete_date: e.target.value }))}
                      className="form-input"
                      data-testid="expected-date-input"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-13 rounded-2xl btn-primary shadow-[0_16px_36px_rgba(124,58,237,0.18)]"
              disabled={submitting || !formData.note.trim() || !formData.project_id}
              data-testid="submit-walkaround"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></span>
                  Saving...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  Capture Entry
                </span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Recent Entries */}
      {recentEntries.length > 0 && (
        <div>
          <h3 className="mb-3 font-heading text-sm uppercase tracking-[0.16em] text-muted-foreground">
            Recent Captures
          </h3>
          <div className="space-y-3">
            {recentEntries.map(entry => (
              <Card key={entry.id} className="ops-card overflow-hidden border border-slate-700 bg-gradient-to-br from-slate-900/70 via-card to-card shadow-xl" data-testid={`recent-entry-${entry.id}`}>
                <CardContent className="px-4 py-4">
                  <div className="flex items-start gap-3">
                    {entry.photos?.length > 0 ? (
                      <img src={entry.photos[0]} alt="" className="w-12 h-12 object-cover rounded-xl flex-shrink-0" />
                    ) : (
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
                        <ImageIcon className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-6 text-foreground line-clamp-2">{entry.note}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {new Date(entry.created_at).toLocaleString('en-NZ', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <span className={`status-badge text-xs ${
                      entry.priority === 'critical' ? 'bg-red-950/50 text-red-500 border-red-900' :
                      entry.priority === 'high' ? 'bg-orange-950/50 text-orange-500 border-orange-900' :
                      entry.priority === 'medium' ? 'bg-amber-950/50 text-amber-500 border-amber-900' :
                      'bg-blue-950/50 text-blue-400 border-blue-900'
                    }`}>
                      {entry.priority}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {jobs.length === 0 && (
        <div className="empty-state">
          <Target className="empty-state-icon" />
          <p className="empty-state-title">No Projects Yet</p>
          <p className="empty-state-description">Create a project first to start capturing walkaround entries.</p>
        </div>
      )}
    </div>
  );
};

export default WalkaroundPage;




























