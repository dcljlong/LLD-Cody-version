import React, { useState, useEffect, useRef } from 'react';
import { walkaroundApi, projectsApi, gatesApi } from '../lib/api';
import { toast } from 'sonner';
import {
  Camera,
  Send,
  X,
  Target,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp
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
  const [projects, setProjects] = useState([]);
  const [gates, setGates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [recentEntries, setRecentEntries] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileInputRef = useRef(null);
  const noteInputRef = useRef(null);

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    note: '',
    project_id: localStorage.getItem('lld_last_project_id') || '',
    gate_id: '',
    priority: 'medium',
    due_date: tomorrow,
    expected_complete_date: '',
    owner: 'Me',
    photos: [],
    create_action_item: true
  });

  useEffect(() => {
    fetchProjects();
    fetchRecentEntries();
    setTimeout(() => noteInputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    if (formData.project_id) {
      fetchGates(formData.project_id);
    }
  }, [formData.project_id]);

  // Auto-select first project if none selected
  useEffect(() => {
    if (projects.length > 0 && !formData.project_id) {
      const firstProjectId = projects[0].id;
      setFormData(prev => ({ ...prev, project_id: firstProjectId }));
      localStorage.setItem('lld_last_project_id', firstProjectId);
    }
  }, [projects, formData.project_id]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await projectsApi.getAll();
      const items = Array.isArray(res.data) ? res.data : (res.data?.value || []);
      setProjects(items);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchGates = async (projectId) => {
    try {
      const res = await gatesApi.getAll({ project_id: projectId });
      const items = Array.isArray(res.data) ? res.data : (res.data?.value || []);
      setGates(items.filter(g => g.status !== 'COMPLETED'));
    } catch (error) {
      console.error('Failed to fetch gates:', error);
      setGates([]);
    }
  };

  const fetchRecentEntries = async () => {
    try {
      const res = await walkaroundApi.getAll({});
      const items = Array.isArray(res.data) ? res.data : (res.data?.value || []);
      setRecentEntries(items.slice(0, 5));
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
      noteInputRef.current?.focus();
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
      
      // Reset form but keep project and settings
      setFormData(prev => ({
        note: '',
        project_id: prev.project_id,
        gate_id: '',
        priority: 'medium',
        due_date: tomorrow,
        expected_complete_date: '',
        owner: prev.owner,
        photos: [],
        create_action_item: true
      }));
      
      fetchRecentEntries();
      setTimeout(() => noteInputRef.current?.focus(), 50);
    } catch (error) {
      toast.error('Failed to save entry');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const priorityOptions = [
    { value: 'critical', label: 'CRIT', fullLabel: 'Critical', color: 'bg-red-600 border-red-500 text-white' },
    { value: 'high', label: 'HIGH', fullLabel: 'High', color: 'bg-orange-600 border-orange-500 text-white' },
    { value: 'medium', label: 'MED', fullLabel: 'Medium', color: 'bg-amber-600 border-amber-500 text-white' },
    { value: 'low', label: 'LOW', fullLabel: 'Low', color: 'bg-blue-600 border-blue-500 text-white' },
    { value: 'deferred', label: 'DEF', fullLabel: 'Deferred', color: 'bg-zinc-600 border-zinc-500 text-white' }
  ];

  const ownerOptions = ['Me', 'Site', 'MC', 'Subbies', 'Client'];

  const dueDateOptions = [
    { value: today, label: 'Today' },
    { value: tomorrow, label: 'Tomorrow' },
    { value: nextWeek, label: '+1 Week' },
  ];

  const getProjectName = (id) => {
    const project = projects.find(p => p.id === id);
    return project?.job_number ? `${project.job_number} - ${project.name}` : project?.name || 'Select project';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 px-2 sm:px-0" data-testid="walkaround-page">
      {/* Quick Capture Form */}
      <Card className="ops-card">
        <CardContent className="pt-4 pb-4 px-3 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Project Selection - Compact */}
            <div>
              <Select
                value={formData.project_id}
                onValueChange={(value) => {
                  localStorage.setItem('lld_last_project_id', value);
                  setFormData(prev => ({ ...prev, project_id: value, gate_id: '' }));
                }}
              >
                <SelectTrigger className="h-10 text-sm" data-testid="project-select">
                  <SelectValue placeholder="Select project">{getProjectName(formData.project_id)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.job_number ? `${p.job_number} - ` : ''}{p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Note Input - Large and prominent */}
            <div>
              <Textarea
                ref={noteInputRef}
                placeholder="What did you observe? Type here..."
                value={formData.note}
                onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                className="min-h-[100px] text-base bg-secondary/50 border-border focus:ring-1 focus:ring-primary resize-none"
                data-testid="walkaround-note"
              />
            </div>

            {/* Quick Priority Buttons - Always visible */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Priority</Label>
              <div className="grid grid-cols-5 gap-1.5">
                {priorityOptions.map((p) => {
                  const active = formData.priority === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, priority: p.value }))}
                      className={`rounded-md border px-2 py-2.5 text-xs font-bold transition-all ${
                        active
                          ? p.color
                          : 'border-border bg-secondary/40 text-foreground hover:border-primary'
                      }`}
                      data-testid={`priority-btn-${p.value}`}
                    >
                      <span className="hidden sm:inline">{p.fullLabel}</span>
                      <span className="sm:hidden">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Owner Selection - Always visible */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Owner</Label>
              <div className="flex flex-wrap gap-1.5">
                {ownerOptions.map(o => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, owner: o }))}
                    className={`px-3 py-2 text-xs font-medium rounded-md border transition-all ${
                      formData.owner === o
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-secondary/40 hover:border-primary'
                    }`}
                  >
                    {o}
                  </button>
                ))}
                <Input
                  placeholder="Other..."
                  value={!ownerOptions.includes(formData.owner) ? formData.owner : ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, owner: e.target.value }))}
                  className="flex-1 min-w-[80px] h-9 text-xs"
                />
              </div>
            </div>

            {/* Quick Due Date Buttons */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Due Date</Label>
              <div className="flex flex-wrap gap-1.5">
                {dueDateOptions.map(d => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, due_date: d.value }))}
                    className={`px-3 py-2 text-xs font-medium rounded-md border transition-all ${
                      formData.due_date === d.value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-secondary/40 hover:border-primary'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                  className="flex-1 min-w-[120px] h-9 text-xs"
                  data-testid="due-date-input"
                />
              </div>
            </div>

            {/* Photo Upload - Compact */}
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoUpload}
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
              />
              
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-12 w-12 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                data-testid="photo-upload-btn"
              >
                <Camera className="w-5 h-5" />
              </button>
              
              {formData.photos.map((photo, i) => (
                <div key={i} className="relative group">
                  <img src={photo} alt={`Upload ${i + 1}`} className="w-12 h-12 object-cover rounded-lg" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              
              {formData.photos.length === 0 && (
                <span className="text-xs text-muted-foreground">Add photo (optional)</span>
              )}
            </div>

            {/* Advanced Options Toggle */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full rounded-md bg-secondary/30 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary/50 transition-colors"
            >
              <span>More options (gate link, expected date)</span>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <div className="space-y-3 pt-2 border-t border-border">
                {/* Gate Link */}
                {gates.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Link to Gate (optional)</Label>
                    <Select
                      value={formData.gate_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, gate_id: value }))}
                    >
                      <SelectTrigger className="h-9 text-sm" data-testid="gate-select">
                        <SelectValue placeholder="No gate linked" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No gate linked</SelectItem>
                        {gates.map(g => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.order ? `${g.order}. ` : ''}{g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Expected Complete Date */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Expected Complete Date</Label>
                  <Input
                    type="date"
                    value={formData.expected_complete_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, expected_complete_date: e.target.value }))}
                    className="h-9 text-sm"
                    data-testid="expected-date-input"
                  />
                </div>

                {/* Create Action Item Toggle */}
                <div className="flex items-center justify-between py-2 px-3 bg-secondary/30 rounded-md">
                  <span className="text-sm">Auto-create action item</span>
                  <Switch
                    checked={formData.create_action_item}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, create_action_item: checked }))}
                    data-testid="create-action-toggle"
                  />
                </div>
              </div>
            )}

            {/* Submit Button - Large and prominent */}
            <Button
              type="submit"
              className="w-full h-14 rounded-xl text-base font-bold"
              disabled={submitting || !formData.note.trim() || !formData.project_id}
              data-testid="submit-walkaround"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></span>
                  Saving...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Send className="w-5 h-5" />
                  CAPTURE ENTRY
                </span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Recent Entries */}
      {recentEntries.length > 0 && (
        <div>
          <h3 className="mb-2 font-heading text-xs uppercase tracking-[0.16em] text-muted-foreground px-1">
            Recent Captures
          </h3>
          <div className="space-y-2">
            {recentEntries.map(entry => (
              <Card key={entry.id} className="ops-card" data-testid={`recent-entry-${entry.id}`}>
                <CardContent className="px-3 py-3">
                  <div className="flex items-start gap-3">
                    {entry.photos?.length > 0 ? (
                      <img src={entry.photos[0]} alt="" className="w-10 h-10 object-cover rounded-md flex-shrink-0" />
                    ) : (
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-border bg-secondary/30">
                        <ImageIcon className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-5 text-foreground line-clamp-2">{entry.note}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {new Date(entry.created_at).toLocaleString('en-NZ', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        {entry.owner && <span>• {entry.owner}</span>}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded font-medium ${
                      entry.priority === 'critical' ? 'bg-red-600 text-white' :
                      entry.priority === 'high' ? 'bg-orange-600 text-white' :
                      entry.priority === 'medium' ? 'bg-amber-600 text-white' :
                      entry.priority === 'low' ? 'bg-blue-600 text-white' :
                      'bg-zinc-600 text-white'
                    }`}>
                      {entry.priority?.toUpperCase()?.slice(0, 3) || 'MED'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {projects.length === 0 && (
        <div className="empty-state py-12">
          <Target className="empty-state-icon" />
          <p className="empty-state-title">No Projects Yet</p>
          <p className="empty-state-description">Create a project first to start capturing walkaround entries.</p>
        </div>
      )}
    </div>
  );
};

export default WalkaroundPage;
