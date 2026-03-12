import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { notificationsApi } from '../lib/api';
import {
  LayoutDashboard,
  Route,
  Target,
  ListTodo,
  FolderOpen,
  BookOpen,
  Settings,
  Calendar,
  Users,
  FileText,
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  ChevronRight,
  Bell,
  FileUp
} from 'lucide-react';
import { Button } from './ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Badge } from './ui/badge';

const Layout = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    fetchNotificationCount();
    const interval = setInterval(fetchNotificationCount, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const fetchNotificationCount = async () => {
    try {
      const res = await notificationsApi.getCount();
      setNotificationCount(res.data.unread || 0);
    } catch (error) {
      console.error('Failed to fetch notification count');
    }
  };

  const operationsNav = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/walkaround', icon: Route, label: 'Walkaround' },
    { to: '/action-items', icon: ListTodo, label: 'Action Items' },
    { to: '/projects', icon: FolderOpen, label: 'Projects' },
    { to: '/gates', icon: Target, label: 'Scope / Gates' },
    { to: '/programme', icon: FileUp, label: 'Programme' },
  ];

  const adminNav = [
    { to: '/diary', icon: BookOpen, label: 'Diary' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  const NavItem = ({ to, icon: Icon, label }) => (
    <NavLink
      to={to}
      onClick={() => setSidebarOpen(false)}
      className={({ isActive }) =>
        `sidebar-nav-item ${isActive ? 'active' : ''}`
      }
      data-testid={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <Icon className="w-5 h-5" strokeWidth={1.5} />
      <span className="font-heading tracking-wide">{label}</span>
    </NavLink>
  );

  return (
    <div className="app-container">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`sidebar ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        data-testid="sidebar"
      >
        {/* Logo */}
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-sm flex items-center justify-center">
              <span className="text-primary-foreground font-heading font-bold text-lg">LL</span>
            </div>
            <div>
              <h1 className="font-heading font-bold text-lg tracking-tight">LLDv2</h1>
              <p className="text-xs text-muted-foreground">Site Command</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {/* Operations Section */}
          <div className="mb-4">
            <div className="sidebar-section-header">Operations</div>
            {operationsNav.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </div>

          {/* Admin Section */}
          <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
            <CollapsibleTrigger className="w-full">
              <div className="sidebar-section-header flex items-center justify-between cursor-pointer hover:text-foreground">
                <span>Admin</span>
                {adminOpen ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {adminNav.map((item) => (
                <NavItem key={item.to} {...item} />
              ))}
            </CollapsibleContent>
          </Collapsible>
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-secondary rounded-sm flex items-center justify-center">
              <span className="text-sm font-medium">{user?.name?.[0]?.toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={toggleTheme}
              data-testid="theme-toggle"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={logout}
              data-testid="logout-btn"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        {/* Header */}
        <header className="app-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="secondary"
                size="icon"
                className="md:hidden btn-icon"
                onClick={() => setSidebarOpen(true)}
                data-testid="menu-toggle"
              >
                <Menu className="w-5 h-5" />
              </Button>
              <div>
                <h2 className="font-heading font-semibold text-xl tracking-tight uppercase">
                  {location.pathname.split('/')[1]?.replace(/-/g, ' ') || 'Dashboard'}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {notificationCount > 0 && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="btn-icon relative"
                  data-testid="notification-bell"
                >
                  <Bell className="w-4 h-4" />
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </Badge>
                </Button>
              )}
              <Button
                variant="secondary"
                size="icon"
                className="btn-icon hidden md:flex"
                onClick={toggleTheme}
                data-testid="header-theme-toggle"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="mobile-nav md:hidden" data-testid="mobile-nav">
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
        >
          <LayoutDashboard className="w-5 h-5" strokeWidth={1.5} />
          <span>Dash</span>
        </NavLink>
        <NavLink
          to="/walkaround"
          className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
        >
          <Route className="w-5 h-5" strokeWidth={1.5} />
          <span>Walk</span>
        </NavLink>
        <NavLink
          to="/action-items"
          className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
        >
          <ListTodo className="w-5 h-5" strokeWidth={1.5} />
          <span>Actions</span>
        </NavLink>
        <NavLink
          to="/gates"
          className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
        >
          <Target className="w-5 h-5" strokeWidth={1.5} />
          <span>Gates</span>
        </NavLink>
        <NavLink
          to="/projects"
          className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
        >
          <FolderOpen className="w-5 h-5" strokeWidth={1.5} />
          <span>Jobs</span>
        </NavLink>
      </nav>
    </div>
  );
};

export default Layout;
