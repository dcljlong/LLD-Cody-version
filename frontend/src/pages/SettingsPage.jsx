import React, { useState, useEffect, useRef } from 'react';
import { settingsApi, smtpApi, remindersApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { toast } from 'sonner';
import {
  Settings,
  Upload,
  Sun,
  Moon,
  User,
  Building2,
  Save,
  X,
  Mail,
  Server,
  Bell,
  CheckCircle2,
  AlertCircle,
  Clock
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

const SettingsPage = () => {
  const { user } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const companyLogoRef = useRef(null);
  const devLogoRef = useRef(null);

  const [formData, setFormData] = useState({
    company_name: '',
    company_logo: null,
    dev_logo: null,
    default_location: '',
    smtp_host: '',
    smtp_port: '',
    smtp_username: '',
    smtp_password: '',
    smtp_from_email: '',
    smtp_from_name: '',
    delay_notice_method: 'both',
    default_reminder_days: 7
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await settingsApi.get();
      setSettings(res.data);
      setFormData({
        company_name: res.data.company_name || '',
        company_logo: res.data.company_logo,
        dev_logo: res.data.dev_logo,
        default_location: res.data.default_location || '',
        smtp_host: res.data.smtp_host || '',
        smtp_port: res.data.smtp_port || '',
        smtp_username: res.data.smtp_username || '',
        smtp_password: '',
        smtp_from_email: res.data.smtp_from_email || '',
        smtp_from_name: res.data.smtp_from_name || '',
        delay_notice_method: res.data.delay_notice_method || 'both',
        default_reminder_days: res.data.default_reminder_days || 7
      });
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be under 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormData(prev => ({
        ...prev,
        [type]: reader.result
      }));
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = (type) => {
    setFormData(prev => ({
      ...prev,
      [type]: null
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const dataToSave = { ...formData };
      // Don't send empty password
      if (!dataToSave.smtp_password) {
        delete dataToSave.smtp_password;
      }
      // Convert port to number
      if (dataToSave.smtp_port) {
        dataToSave.smtp_port = parseInt(dataToSave.smtp_port);
      } else {
        delete dataToSave.smtp_port;
      }
      
      await settingsApi.update({
        ...dataToSave,
        theme
      });
      toast.success('Settings saved');
      fetchSettings();
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const testSmtpConnection = async () => {
    if (!formData.smtp_host || !formData.smtp_port) {
      toast.error('Please configure SMTP host and port first');
      return;
    }
    
    setTestingSmtp(true);
    try {
      // Save first, then test
      await handleSave();
      const res = await smtpApi.test();
      if (res.data.success) {
        toast.success('SMTP connection successful');
      } else {
        toast.error(`SMTP test failed: ${res.data.message}`);
      }
    } catch (error) {
      toast.error('SMTP test failed');
    } finally {
      setTestingSmtp(false);
    }
  };

  const generateReminders = async () => {
    try {
      const res = await remindersApi.generate();
      toast.success(`Generated ${res.data.reminders_created} reminders`);
    } catch (error) {
      toast.error('Failed to generate reminders');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6" data-testid="settings-page">
      <div>
        <h2 className="font-heading text-2xl font-bold tracking-tight uppercase">Settings</h2>
        <p className="text-sm text-muted-foreground">Manage your account, email, and preferences</p>
      </div>

      {/* Profile Card */}
      <Card className="ops-card">
        <CardHeader className="ops-card-header">
          <CardTitle className="font-heading text-sm uppercase tracking-wide flex items-center gap-2">
            <User className="w-4 h-4" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="py-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-secondary rounded-sm flex items-center justify-center">
              <span className="text-2xl font-heading font-bold">{user?.name?.[0]?.toUpperCase()}</span>
            </div>
            <div>
              <p className="font-medium text-lg">{user?.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company Settings */}
      <Card className="ops-card">
        <CardHeader className="ops-card-header">
          <CardTitle className="font-heading text-sm uppercase tracking-wide flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Company
          </CardTitle>
        </CardHeader>
        <CardContent className="py-4 space-y-4">
          <div>
            <Label className="form-label">Company Name</Label>
            <Input
              value={formData.company_name}
              onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
              placeholder="Your company name"
              className="form-input"
              data-testid="company-name-input"
            />
          </div>

          <div>
            <Label className="form-label">Default Location (for weather)</Label>
            <Input
              value={formData.default_location}
              onChange={(e) => setFormData(prev => ({ ...prev, default_location: e.target.value }))}
              placeholder="Auckland, NZ"
              className="form-input"
              data-testid="default-location-input"
            />
          </div>
        </CardContent>
      </Card>

      {/* Logo Settings */}
      <Card className="ops-card">
        <CardHeader className="ops-card-header">
          <CardTitle className="font-heading text-sm uppercase tracking-wide flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Logos
          </CardTitle>
        </CardHeader>
        <CardContent className="py-4 space-y-6">
          {/* Company Logo */}
          <div>
            <Label className="form-label mb-3 block">Company Logo</Label>
            <input
              type="file"
              ref={companyLogoRef}
              onChange={(e) => handleLogoUpload(e, 'company_logo')}
              accept="image/*"
              className="hidden"
            />
            
            <div className="flex items-center gap-4">
              {formData.company_logo ? (
                <div className="relative group">
                  <img
                    src={formData.company_logo}
                    alt="Company logo"
                    className="w-24 h-24 object-contain bg-secondary rounded-sm p-2"
                  />
                  <button
                    onClick={() => removeLogo('company_logo')}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => companyLogoRef.current?.click()}
                  className="w-24 h-24 border-2 border-dashed border-border rounded-sm flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  data-testid="company-logo-upload"
                >
                  <Upload className="w-6 h-6" />
                  <span className="text-xs">Upload</span>
                </button>
              )}
              
              {formData.company_logo && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => companyLogoRef.current?.click()}
                >
                  Change
                </Button>
              )}
            </div>
          </div>

          {/* Dev Logo */}
          <div>
            <Label className="form-label mb-3 block">Developer Logo</Label>
            <input
              type="file"
              ref={devLogoRef}
              onChange={(e) => handleLogoUpload(e, 'dev_logo')}
              accept="image/*"
              className="hidden"
            />
            
            <div className="flex items-center gap-4">
              {formData.dev_logo ? (
                <div className="relative group">
                  <img
                    src={formData.dev_logo}
                    alt="Dev logo"
                    className="w-24 h-24 object-contain bg-secondary rounded-sm p-2"
                  />
                  <button
                    onClick={() => removeLogo('dev_logo')}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => devLogoRef.current?.click()}
                  className="w-24 h-24 border-2 border-dashed border-border rounded-sm flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  data-testid="dev-logo-upload"
                >
                  <Upload className="w-6 h-6" />
                  <span className="text-xs">Upload</span>
                </button>
              )}
              
              {formData.dev_logo && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => devLogoRef.current?.click()}
                >
                  Change
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email / SMTP Settings */}
      <Card className="ops-card">
        <CardHeader className="ops-card-header">
          <CardTitle className="font-heading text-sm uppercase tracking-wide flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Email Configuration
            {settings?.smtp_configured ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-500 ml-auto" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Configure your SMTP server to send delay notices directly from the app.
          </p>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="form-label">SMTP Host</Label>
              <Input
                value={formData.smtp_host}
                onChange={(e) => setFormData(prev => ({ ...prev, smtp_host: e.target.value }))}
                placeholder="smtp.gmail.com"
                className="form-input"
                data-testid="smtp-host-input"
              />
            </div>
            <div>
              <Label className="form-label">SMTP Port</Label>
              <Input
                value={formData.smtp_port}
                onChange={(e) => setFormData(prev => ({ ...prev, smtp_port: e.target.value }))}
                placeholder="587"
                className="form-input"
                data-testid="smtp-port-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="form-label">Username</Label>
              <Input
                value={formData.smtp_username}
                onChange={(e) => setFormData(prev => ({ ...prev, smtp_username: e.target.value }))}
                placeholder="your@email.com"
                className="form-input"
                data-testid="smtp-username-input"
              />
            </div>
            <div>
              <Label className="form-label">Password</Label>
              <Input
                type="password"
                value={formData.smtp_password}
                onChange={(e) => setFormData(prev => ({ ...prev, smtp_password: e.target.value }))}
                placeholder="••••••••"
                className="form-input"
                data-testid="smtp-password-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="form-label">From Email</Label>
              <Input
                value={formData.smtp_from_email}
                onChange={(e) => setFormData(prev => ({ ...prev, smtp_from_email: e.target.value }))}
                placeholder="noreply@company.co.nz"
                className="form-input"
              />
            </div>
            <div>
              <Label className="form-label">From Name</Label>
              <Input
                value={formData.smtp_from_name}
                onChange={(e) => setFormData(prev => ({ ...prev, smtp_from_name: e.target.value }))}
                placeholder="Site Command"
                className="form-input"
              />
            </div>
          </div>

          <Button
            variant="secondary"
            onClick={testSmtpConnection}
            disabled={testingSmtp}
            className="w-full"
            data-testid="test-smtp-btn"
          >
            <Server className="w-4 h-4 mr-2" />
            {testingSmtp ? 'Testing...' : 'Test Connection'}
          </Button>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card className="ops-card">
        <CardHeader className="ops-card-header">
          <CardTitle className="font-heading text-sm uppercase tracking-wide flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notifications & Reminders
          </CardTitle>
        </CardHeader>
        <CardContent className="py-4 space-y-4">
          <div>
            <Label className="form-label">Delay Notice Method</Label>
            <Select
              value={formData.delay_notice_method}
              onValueChange={(value) => setFormData(prev => ({ ...prev, delay_notice_method: value }))}
            >
              <SelectTrigger data-testid="delay-method-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email Only</SelectItem>
                <SelectItem value="clipboard">Copy to Clipboard Only</SelectItem>
                <SelectItem value="both">Both (Recommended)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              How delay notices are handled when you change task dates
            </p>
          </div>

          <div>
            <Label className="form-label">Reminder Lead Time (days)</Label>
            <Input
              type="number"
              min="1"
              max="30"
              value={formData.default_reminder_days}
              onChange={(e) => setFormData(prev => ({ ...prev, default_reminder_days: parseInt(e.target.value) || 7 }))}
              className="form-input w-32"
              data-testid="reminder-days-input"
            />
            <p className="text-xs text-muted-foreground mt-1">
              How many days before a due date to receive reminders
            </p>
          </div>

          <Button
            variant="secondary"
            onClick={generateReminders}
            className="w-full"
          >
            <Clock className="w-4 h-4 mr-2" />
            Generate Reminders Now
          </Button>
        </CardContent>
      </Card>

      {/* Theme Settings */}
      <Card className="ops-card">
        <CardHeader className="ops-card-header">
          <CardTitle className="font-heading text-sm uppercase tracking-wide flex items-center gap-2">
            {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Dark Mode</p>
              <p className="text-sm text-muted-foreground">Toggle dark/light theme</p>
            </div>
            <Switch
              checked={isDark}
              onCheckedChange={toggleTheme}
              data-testid="theme-switch"
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button
        className="w-full btn-primary"
        onClick={handleSave}
        disabled={saving}
        data-testid="save-settings-btn"
      >
        {saving ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></span>
            Saving...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Save className="w-4 h-4" />
            Save Settings
          </span>
        )}
      </Button>
    </div>
  );
};

export default SettingsPage;
