import React, { useState, useEffect, useRef } from 'react';
import { programmeApi, projectsApi, delayNoticesApi } from '../lib/api';
import { toast } from 'sonner';
import {
  FileUp,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  User,
  Calendar,
  Tag,
  Eye,
  EyeOff,
  Mail,
  Copy,
  ChevronDown,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Badge } from '../components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';

const ownerTags = [
  { value: 'OURS', label: 'OURS', color: 'bg-primary text-primary-foreground' },
  { value: 'MC', label: 'MC', color: 'bg-blue-600 text-white' },
  { value: 'SUBBIES', label: 'SUBBIES', color: 'bg-purple-600 text-white' },
  { value: 'COUNCIL', label: 'COUNCIL', color: 'bg-red-600 text-white' },
  { value: 'WATCH', label: 'WATCH', color: 'bg-amber-600 text-white' },
  { value: 'UNASSIGNED', label: 'UNASSIGNED', color: 'bg-zinc-600 text-white' }
];

const ProgrammePage = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [programmes, setProgrammes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedProgramme, setSelectedProgramme] = useState(null);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [dateChangeDialog, setDateChangeDialog] = useState(null);
  const [expandedTags, setExpandedTags] = useState({ OURS: true, MC: true, SUBBIES: true, COUNCIL: true, WATCH: true, UNASSIGNED: true });
  const fileInputRef = useRef(null);

  const [dateChangeForm, setDateChangeForm] = useState({
    start_date: '',
    end_date: '',
    delay_reason: '',
    notify_mc: false
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchProgrammes();
    }
  }, [selectedProject]);

  useEffect(() => {
    if (selectedProgramme) {
      fetchTasks();
    }
  }, [selectedProgramme]);

  const fetchProjects = async () => {
    try {
      const res = await projectsApi.getAll();
      setProjects(res.data);
      if (res.data.length > 0) {
        setSelectedProject(res.data[0].id);
      }
    } catch (error) {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const fetchProgrammes = async () => {
    try {
      const res = await programmeApi.getByProject(selectedProject);
      setProgrammes(res.data);
      if (res.data.length > 0) {
        setSelectedProgramme(res.data[0].id);
      } else {
        setSelectedProgramme(null);
        setTasks([]);
      }
    } catch (error) {
      console.error('Failed to load programmes:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await programmeApi.getTasks(selectedProgramme);
      setTasks(res.data);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.includes('pdf')) {
      toast.error('Please upload a PDF file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be under 10MB');
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await programmeApi.upload(selectedProject, reader.result, file.name);
          toast.success(res.data.message);
          fetchProgrammes();
        } catch (error) {
          toast.error(error.response?.data?.detail || 'Failed to parse programme');
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error('Failed to read file');
      setUploading(false);
    }
  };

  const handleTagChange = async (taskId, newTag) => {
    try {
      await programmeApi.updateTaskTag(taskId, newTag, newTag === 'OURS' || newTag === 'WATCH');
      fetchTasks();
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const handleTrackToggle = async (taskId, currentTracked) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    try {
      await programmeApi.updateTaskTag(taskId, task.owner_tag, !currentTracked);
      fetchTasks();
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const handleBulkTag = async (tag) => {
    if (selectedTasks.length === 0) {
      toast.error('Select tasks first');
      return;
    }
    try {
      // Update each task individually since bulk endpoint needs query params
      for (const taskId of selectedTasks) {
        await programmeApi.updateTaskTag(taskId, tag, tag === 'OURS' || tag === 'WATCH');
      }
      setSelectedTasks([]);
      fetchTasks();
      toast.success(`Updated ${selectedTasks.length} tasks`);
    } catch (error) {
      toast.error('Failed to update tasks');
    }
  };

  const openDateChangeDialog = (task) => {
    setDateChangeDialog(task);
    setDateChangeForm({
      start_date: task.start_date || '',
      end_date: task.end_date || '',
      delay_reason: '',
      notify_mc: false
    });
  };

  const handleDateChange = async () => {
    if (!dateChangeDialog) return;
    
    try {
      await programmeApi.updateTaskDates(dateChangeDialog.id, {
        start_date: dateChangeForm.start_date || null,
        end_date: dateChangeForm.end_date || null,
        delay_reason: dateChangeForm.delay_reason || null,
        notify_mc: dateChangeForm.notify_mc
      });
      
      if (dateChangeForm.notify_mc && dateChangeForm.delay_reason) {
        toast.success('Date updated - Delay notice created');
      } else {
        toast.success('Date updated');
      }
      
      setDateChangeDialog(null);
      fetchTasks();
    } catch (error) {
      toast.error('Failed to update dates');
    }
  };

  const copyDelayNotice = async (task) => {
    const noticeText = `DELAY NOTICE

Task: ${task.task_name}
Original Date: ${task.original_end_date || task.end_date || 'N/A'}
New Date: ${task.end_date || 'TBC'}

Please update your records accordingly.`;
    
    await navigator.clipboard.writeText(noticeText);
    toast.success('Delay notice copied to clipboard');
  };

  // Group tasks by owner tag
  const tasksByTag = {};
  ownerTags.forEach(tag => {
    tasksByTag[tag.value] = tasks.filter(t => t.owner_tag === tag.value);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="programme-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold tracking-tight uppercase">Programme Management</h2>
          <p className="text-sm text-muted-foreground">Upload MC programmes, tag tasks, track dates</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-[200px]" data-testid="project-select">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Upload Section */}
      <Card className="ops-card">
        <CardContent className="py-6">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf"
            className="hidden"
          />
          
          <div className="flex items-center gap-6">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !selectedProject}
              className="flex-shrink-0 w-32 h-32 border-2 border-dashed border-border rounded-sm flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
              data-testid="upload-programme-btn"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="text-xs">Parsing...</span>
                </>
              ) : (
                <>
                  <FileUp className="w-8 h-8" />
                  <span className="text-xs text-center">Upload<br/>Programme PDF</span>
                </>
              )}
            </button>
            
            <div className="flex-1">
              <h3 className="font-heading text-lg font-semibold mb-2">How it works</h3>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Upload MC's programme PDF</li>
                <li>AI extracts all tasks with dates</li>
                <li>Tag tasks as OURS, MC, SUBBIES, COUNCIL, or WATCH</li>
                <li>Track dates and generate delay notices when needed</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Programme Selection */}
      {programmes.length > 0 && (
        <div className="flex items-center gap-3">
          <Label className="text-sm text-muted-foreground">Programme:</Label>
          <Select value={selectedProgramme || ''} onValueChange={setSelectedProgramme}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select programme" />
            </SelectTrigger>
            <SelectContent>
              {programmes.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.filename} ({p.task_count} tasks)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedTasks.length > 0 && (
        <Card className="ops-card border-primary">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">{selectedTasks.length} tasks selected</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Tag as:</span>
                {ownerTags.slice(0, 5).map(tag => (
                  <Button
                    key={tag.value}
                    size="sm"
                    className={tag.color}
                    onClick={() => handleBulkTag(tag.value)}
                  >
                    {tag.label}
                  </Button>
                ))}
                <Button size="sm" variant="ghost" onClick={() => setSelectedTasks([])}>
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tasks by Tag */}
      {tasks.length > 0 ? (
        <div className="space-y-4">
          {ownerTags.map(tag => {
            const tagTasks = tasksByTag[tag.value];
            if (tagTasks.length === 0) return null;
            
            return (
              <Collapsible
                key={tag.value}
                open={expandedTags[tag.value]}
                onOpenChange={() => setExpandedTags(prev => ({ ...prev, [tag.value]: !prev[tag.value] }))}
              >
                <Card className="ops-card">
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="ops-card-header py-3 cursor-pointer hover:bg-secondary/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {expandedTags[tag.value] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          <Badge className={tag.color}>{tag.label}</Badge>
                          <span className="text-sm text-muted-foreground">({tagTasks.length} tasks)</span>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="py-2">
                      <div className="space-y-1">
                        {tagTasks.map(task => (
                          <div
                            key={task.id}
                            className={`flex items-center gap-3 p-2 rounded-sm hover:bg-secondary/30 ${
                              task.is_tracked ? 'border-l-4 border-l-primary' : ''
                            }`}
                            data-testid={`task-${task.id}`}
                          >
                            <Checkbox
                              checked={selectedTasks.includes(task.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedTasks(prev => [...prev, task.id]);
                                } else {
                                  setSelectedTasks(prev => prev.filter(id => id !== task.id));
                                }
                              }}
                            />
                            
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{task.task_name}</p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                {task.start_date && (
                                  <span>Start: {task.start_date}</span>
                                )}
                                {task.end_date && (
                                  <span className={task.end_date !== task.original_end_date ? 'text-amber-500' : ''}>
                                    End: {task.end_date}
                                    {task.end_date !== task.original_end_date && ' (changed)'}
                                  </span>
                                )}
                                {task.duration_days && (
                                  <span>{task.duration_days}d</span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant={task.is_tracked ? 'default' : 'ghost'}
                                className="h-7 px-2"
                                onClick={() => handleTrackToggle(task.id, task.is_tracked)}
                              >
                                {task.is_tracked ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                              </Button>
                              
                              <Select
                                value={task.owner_tag}
                                onValueChange={(value) => handleTagChange(task.id, value)}
                              >
                                <SelectTrigger className="w-[100px] h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ownerTags.map(t => (
                                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={() => openDateChangeDialog(task)}
                              >
                                <Calendar className="w-3 h-3" />
                              </Button>
                              
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={() => copyDelayNotice(task)}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      ) : programmes.length > 0 ? (
        <div className="empty-state py-12">
          <FileText className="empty-state-icon" />
          <p className="empty-state-title">No Tasks Found</p>
          <p className="empty-state-description">Select a programme to view its tasks.</p>
        </div>
      ) : (
        <div className="empty-state py-12">
          <FileUp className="empty-state-icon" />
          <p className="empty-state-title">No Programmes Yet</p>
          <p className="empty-state-description">Upload a MC programme PDF to get started.</p>
        </div>
      )}

      {/* Date Change Dialog */}
      <Dialog open={!!dateChangeDialog} onOpenChange={() => setDateChangeDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl uppercase tracking-tight">
              Update Task Dates
            </DialogTitle>
          </DialogHeader>
          
          {dateChangeDialog && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{dateChangeDialog.task_name}</p>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="form-label">Start Date</Label>
                  <Input
                    type="date"
                    value={dateChangeForm.start_date}
                    onChange={(e) => setDateChangeForm(prev => ({ ...prev, start_date: e.target.value }))}
                    className="form-input"
                  />
                </div>
                <div>
                  <Label className="form-label">End Date</Label>
                  <Input
                    type="date"
                    value={dateChangeForm.end_date}
                    onChange={(e) => setDateChangeForm(prev => ({ ...prev, end_date: e.target.value }))}
                    className="form-input"
                  />
                </div>
              </div>
              
              <div>
                <Label className="form-label">Reason for Change (optional)</Label>
                <Textarea
                  value={dateChangeForm.delay_reason}
                  onChange={(e) => setDateChangeForm(prev => ({ ...prev, delay_reason: e.target.value }))}
                  placeholder="e.g. MC delayed painting handover"
                  className="form-input min-h-[80px]"
                />
              </div>
              
              {dateChangeForm.delay_reason && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="notify-mc"
                    checked={dateChangeForm.notify_mc}
                    onCheckedChange={(checked) => setDateChangeForm(prev => ({ ...prev, notify_mc: checked }))}
                  />
                  <Label htmlFor="notify-mc" className="text-sm">
                    Create delay notice notification
                  </Label>
                </div>
              )}
              
              <DialogFooter>
                <Button variant="secondary" onClick={() => setDateChangeDialog(null)}>
                  Cancel
                </Button>
                <Button className="btn-primary" onClick={handleDateChange}>
                  Update Dates
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProgrammePage;
