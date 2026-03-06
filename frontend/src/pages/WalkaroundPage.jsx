import React, { useState, useEffect, useRef } from 'react';
import { walkaroundApi, projectsApi, gatesApi } from '../lib/api';
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
  const [projects, setProjects] = useState([]);
  const [gates, setGates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [recentEntries, setRecentEntries] = useState([]);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    note: '',
    project_id: '',
    gate_id: '',
    priority: 'medium',
    due_date: '',
    expected_complete_date: '',
    owner: '',
    photos: [],
    create_action_item: true
  });

  useEffect(() => {
    fetchProjects();
    fetchRecentEntries();
  }, []);

  useEffect(() => {
    if (formData.project_id) {
      fetchGates(formData.project_id);
    } else {
      setGates([]);
    }
  }, [formData.project_id]);

  const fetchProjects = async () => {
    try {
      const res = await projectsApi.getAll();
      setProjects(res.data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const fetchGates = async (projectId) => {
    try {
      const res = await gatesApi.getAll(projectId);
      setGates(res.data);
    } catch (error) {
      console.error('Failed to fetch gates:', error);
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
      toast.success('Entry captured');
      
      // Reset form
      setFormData({
        note: '',
        project_id: formData.project_id, // Keep project selected
        gate_id: '',
        priority: 'medium',
        due_date: '',
        expected_complete_date: '',
        owner: '',
        photos: [],
        create_action_item: true
      });
      
      fetchRecentEntries();
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
              <Textarea
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
            </div>

            {/* Project & Gate Selection */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="form-label">Project *</Label>
                <Select
                  value={formData.project_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, project_id: value, gate_id: '' }))}
                >
                  <SelectTrigger data-testid="project-select">
                    <SelectValue placeholder="Select job" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="form-label">Linked Gate</Label>
                <Select
                  value={formData.gate_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, gate_id: value }))}
                  disabled={!formData.project_id || gates.length === 0}
                >
                  <SelectTrigger data-testid="gate-select">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    {gates.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Priority & Owner */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="form-label">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger data-testid="priority-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map(p => (
                      <SelectItem key={p.value} value={p.value}>
                        <span className={p.color}>{p.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="form-label">Owner</Label>
                <Input
                  placeholder="Who's responsible?"
                  value={formData.owner}
                  onChange={(e) => setFormData(prev => ({ ...prev, owner: e.target.value }))}
                  className="form-input"
                  data-testid="owner-input"
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
            </div>

            {/* Create Action Item Toggle */}
            <div className="flex items-center justify-between py-2 px-3 bg-secondary/50 rounded-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Create action item from this entry</span>
              </div>
              <Switch
                checked={formData.create_action_item}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, create_action_item: checked }))}
                data-testid="create-action-toggle"
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full btn-primary h-12"
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
          <h3 className="font-heading text-sm uppercase tracking-wide text-muted-foreground mb-3">
            Recent Captures
          </h3>
          <div className="space-y-2">
            {recentEntries.map(entry => (
              <Card key={entry.id} className="ops-card" data-testid={`recent-entry-${entry.id}`}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-3">
                    {entry.photos?.length > 0 ? (
                      <img src={entry.photos[0]} alt="" className="w-12 h-12 object-cover rounded-sm flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 bg-secondary rounded-sm flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-2">{entry.note}</p>
                      <p className="text-xs text-muted-foreground mt-1">
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
      {projects.length === 0 && (
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
