import React, { useState, useEffect } from 'react';
import { gatesApi, projectsApi } from '../lib/api';
import { toast } from 'sonner';
import {
  Target,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  User,
  Calendar,
  ChevronDown,
  ChevronRight,
  Filter
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
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
import { Switch } from '../components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';

const StatusBadge = ({ status }) => {
  const styles = {
    BLOCKED: 'status-blocked',
    DELAYED: 'status-delayed',
    AT_RISK: 'status-at-risk',
    ON_TRACK: 'status-on-track',
    COMPLETED: 'status-completed'
  };
  return (
    <span className={`status-badge ${styles[status] || styles.ON_TRACK}`}>
      {status?.replace('_', ' ')}
    </span>
  );
};

const GatesPage = () => {
  const [gates, setGates] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterProject, setFilterProject] = useState('all');
  const [expandedProjects, setExpandedProjects] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    project_id: '',
    name: '',
    description: '',
    order: 1,
    owner_party: 'YOU',
    required_by_date: '',
    expected_complete_date: '',
    buffer_days: 2,
    depends_on_gate_ids: [],
    is_hard_gate: false,
    is_optional: false
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [gatesRes, projectsRes] = await Promise.all([
        gatesApi.getAll(),
        projectsApi.getAll()
      ]);
      setGates(gatesRes.data);
      setProjects(projectsRes.data);
      
      // Auto-expand all projects
      const expanded = {};
      projectsRes.data.forEach(p => {
        expanded[p.id] = true;
      });
      setExpandedProjects(expanded);
    } catch (error) {
      toast.error('Failed to load gates');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.project_id || !formData.required_by_date) {
      toast.error('Please fill in required fields');
      return;
    }

    setSubmitting(true);
    try {
      await gatesApi.create(formData);
      toast.success('Gate created');
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error('Failed to create gate');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteGate = async (gateId) => {
    try {
      await gatesApi.complete(gateId);
      toast.success('Gate completed');
      fetchData();
    } catch (error) {
      toast.error('Failed to complete gate');
    }
  };

  const handleReopenGate = async (gateId) => {
    try {
      await gatesApi.reopen(gateId);
      toast.success('Gate reopened');
      fetchData();
    } catch (error) {
      toast.error('Failed to reopen gate');
    }
  };

  const resetForm = () => {
    setFormData({
      project_id: '',
      name: '',
      description: '',
      order: 1,
      owner_party: 'YOU',
      required_by_date: '',
      expected_complete_date: '',
      buffer_days: 2,
      depends_on_gate_ids: [],
      is_hard_gate: false,
      is_optional: false
    });
  };

  const toggleProject = (projectId) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

  // Group gates by project
  const gatesByProject = {};
  gates.forEach(gate => {
    if (!gatesByProject[gate.project_id]) {
      gatesByProject[gate.project_id] = [];
    }
    gatesByProject[gate.project_id].push(gate);
  });

  // Filter projects
  const filteredProjects = filterProject === 'all' 
    ? projects 
    : projects.filter(p => p.id === filterProject);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const ownerOptions = ['YOU', 'MC', 'SUBBIES', 'COUNCIL'];

  return (
    <div className="space-y-6" data-testid="gates-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold tracking-tight uppercase">Scope Gates</h2>
          <p className="text-sm text-muted-foreground">{gates.length} gate{gates.length !== 1 ? 's' : ''} across {projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-[180px]" data-testid="project-filter">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="btn-primary" onClick={() => setDialogOpen(true)} data-testid="create-gate-btn">
            <Plus className="w-4 h-4 mr-2" />
            New Gate
          </Button>
        </div>
      </div>

      {/* Risk Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="ops-card">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-heading">Blocked</p>
            <p className="text-2xl font-heading font-bold text-red-500">
              {gates.filter(g => g.status === 'BLOCKED').length}
            </p>
          </CardContent>
        </Card>
        <Card className="ops-card">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-heading">Delayed</p>
            <p className="text-2xl font-heading font-bold text-red-400">
              {gates.filter(g => g.status === 'DELAYED').length}
            </p>
          </CardContent>
        </Card>
        <Card className="ops-card">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-heading">At Risk</p>
            <p className="text-2xl font-heading font-bold text-amber-500">
              {gates.filter(g => g.status === 'AT_RISK').length}
            </p>
          </CardContent>
        </Card>
        <Card className="ops-card">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-heading">On Track</p>
            <p className="text-2xl font-heading font-bold text-emerald-500">
              {gates.filter(g => g.status === 'ON_TRACK').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gates by Project */}
      {filteredProjects.length > 0 ? (
        <div className="space-y-4">
          {filteredProjects.map(project => {
            const projectGates = gatesByProject[project.id] || [];
            const blockedCount = projectGates.filter(g => g.status === 'BLOCKED' || g.status === 'DELAYED').length;
            const atRiskCount = projectGates.filter(g => g.status === 'AT_RISK').length;
            
            return (
              <Collapsible
                key={project.id}
                open={expandedProjects[project.id]}
                onOpenChange={() => toggleProject(project.id)}
              >
                <Card className="ops-card">
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="ops-card-header py-3 cursor-pointer hover:bg-secondary/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {expandedProjects[project.id] ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                          <CardTitle className="font-heading text-lg tracking-tight">{project.name}</CardTitle>
                          <span className="text-sm text-muted-foreground">({projectGates.length} gates)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {blockedCount > 0 && (
                            <span className="status-badge status-blocked">{blockedCount} Blocked</span>
                          )}
                          {atRiskCount > 0 && (
                            <span className="status-badge status-at-risk">{atRiskCount} At Risk</span>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="py-4">
                      {projectGates.length > 0 ? (
                        <div className="gate-timeline">
                          {projectGates.map((gate, index) => (
                            <div key={gate.id} className="gate-item" data-testid={`gate-${gate.id}`}>
                              <div className={`gate-marker ${
                                gate.status === 'COMPLETED' ? 'bg-emerald-500 border-emerald-500' :
                                gate.status === 'BLOCKED' || gate.status === 'DELAYED' ? 'bg-red-500 border-red-500' :
                                gate.status === 'AT_RISK' ? 'bg-amber-500 border-amber-500' :
                                'bg-background border-border'
                              }`}>
                                {gate.status === 'COMPLETED' && <CheckCircle2 className="w-3 h-3 text-white" />}
                              </div>
                              
                              <div className={`p-3 bg-secondary/30 rounded-sm ${
                                gate.status === 'BLOCKED' || gate.status === 'DELAYED' ? 'border-l-4 border-l-red-500' :
                                gate.status === 'AT_RISK' ? 'border-l-4 border-l-amber-500' :
                                gate.status === 'COMPLETED' ? 'border-l-4 border-l-emerald-500' :
                                ''
                              }`}>
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-xs text-muted-foreground font-heading uppercase">#{index + 1}</span>
                                      <StatusBadge status={gate.status} />
                                      {gate.is_hard_gate && <span className="text-xs text-red-500 font-bold">HARD</span>}
                                    </div>
                                    <h4 className="font-medium">{gate.name}</h4>
                                    
                                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <User className="w-3 h-3" />
                                        {gate.owner_party}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(gate.required_by_date).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short' })}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {gate.status !== 'COMPLETED' ? (
                                    <Button size="sm" variant="secondary" onClick={() => handleCompleteGate(gate.id)}>
                                      <CheckCircle2 className="w-4 h-4" />
                                    </Button>
                                  ) : (
                                    <Button size="sm" variant="ghost" onClick={() => handleReopenGate(gate.id)}>
                                      Reopen
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No gates for this project</p>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      ) : (
        <div className="empty-state py-20">
          <Target className="empty-state-icon" />
          <p className="empty-state-title">No Projects Yet</p>
          <p className="empty-state-description">Create a project first to add scope gates.</p>
        </div>
      )}

      {/* Create Gate Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl uppercase tracking-tight">New Scope Gate</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="form-label">Project *</Label>
              <Select
                value={formData.project_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, project_id: value }))}
              >
                <SelectTrigger data-testid="gate-project-select">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="form-label">Gate Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Linings Complete → Ready for Stoppers"
                className="form-input"
                data-testid="gate-name-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="form-label">Owner Party *</Label>
                <Select
                  value={formData.owner_party}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, owner_party: value }))}
                >
                  <SelectTrigger data-testid="gate-owner-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ownerOptions.map(o => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="form-label">Buffer Days</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.buffer_days}
                  onChange={(e) => setFormData(prev => ({ ...prev, buffer_days: parseInt(e.target.value) || 0 }))}
                  className="form-input"
                  data-testid="gate-buffer-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="form-label">Required By *</Label>
                <Input
                  type="date"
                  value={formData.required_by_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, required_by_date: e.target.value }))}
                  className="form-input"
                  data-testid="gate-required-date"
                />
              </div>
              <div>
                <Label className="form-label">Expected Complete</Label>
                <Input
                  type="date"
                  value={formData.expected_complete_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, expected_complete_date: e.target.value }))}
                  className="form-input"
                  data-testid="gate-expected-date"
                />
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-sm">Hard Gate (blocks everything)</span>
              </div>
              <Switch
                checked={formData.is_hard_gate}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_hard_gate: checked }))}
                data-testid="gate-hard-toggle"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="btn-primary" disabled={submitting} data-testid="save-gate-btn">
                {submitting ? 'Creating...' : 'Create Gate'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GatesPage;
