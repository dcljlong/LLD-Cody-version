import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, NavLink, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { projectsApi } from '../lib/api';
import lldLogo from '../assets/lld-logo.png';
import {
  LayoutDashboard,
  Route,
  AlertTriangle,
  ListTodo,
  FolderOpen,
  BookOpen,
  Settings,
  Menu,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Wrench,
} from 'lucide-react';
import { Button } from './ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';

const Layout = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const res = await projectsApi.getAll();
        const items = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.data?.value)
            ? res.data.value
            : [];
        setProjects(items);
      } catch (error) {
        console.error('Failed to load layout projects:', error);
        setProjects([]);
      }
    };
    loadProjects();
  }, []);

  const operationsNav = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/diary', icon: BookOpen, label: 'Diary' },
    { to: '/projects', icon: FolderOpen, label: 'Projects' },
    { to: '/action-items', icon: ListTodo, label: 'Action Items' },
    { to: '/walkaround', icon: Route, label: 'Walkaround' },
    { to: '/gates', icon: AlertTriangle, label: 'Roadblocks / Concerns' },
  ];

  const adminNav = [
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  const suiteNav = [
    {
      href: 'http://localhost:3002/dashboard',
      icon: Wrench,
      label: 'Tool Tracker',
      description: 'Tool & asset control',
    },
  ];

  const pageTitle = useMemo(() => {
    const section = location.pathname.split('/')[1] || 'dashboard';
    const titles = {
      dashboard: 'Dashboard',
      diary: 'Diary',
      projects: 'Projects',
      'action-items': 'Action Items',
      walkaround: 'Walkaround',
      gates: 'Roadblocks / Concerns',
      settings: 'Settings'
    };

    return titles[section] || section.replace(/-/g, ' ');
  }, [location.pathname]);

  const currentJobId = useMemo(() => {
    const parts = location.pathname.split('/');
    return parts[1] === 'projects' && parts[2] ? parts[2] : '';
  }, [location.pathname]);

  const NavItem = ({ to, icon: Icon, label }) => (
    <NavLink
      to={to}
      onClick={() => setSidebarOpen(false)}
      className={({ isActive }) =>
        `sidebar-nav-item ${isActive ? 'active' : ''}`
      }
    >
      <Icon className="w-5 h-5" strokeWidth={1.5} />
      <span className="font-heading tracking-wide">{label}</span>
    </NavLink>
  );

  const ExternalNavItem = ({ href, icon: Icon, label, description }) => (
    <a
      href={href}
      onClick={() => setSidebarOpen(false)}
      className="sidebar-nav-item"
    >
      <Icon className="w-5 h-5" strokeWidth={1.5} />
      <span className="min-w-0 flex-1">
        <span className="block font-heading tracking-wide">{label}</span>
        {description && (
          <span className="block truncate text-[11px] font-normal normal-case tracking-normal text-muted-foreground">
            {description}
          </span>
        )}
      </span>
      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
    </a>
  );

  return (
    <div className="app-container">

      <aside className={`sidebar ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>

        <div className="lld-sidebar-brand">
          <div className="flex items-center gap-3">
            <div className="lld-sidebar-logo">
              <img src={lldLogo} alt="LLD logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-primary">Long Line</p>
              <h1 className="font-heading text-2xl font-black leading-none tracking-[0.08em]">LLD</h1>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Site Diary</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">

          <div className="mb-4">
            <div className="sidebar-section-header">Operations</div>
            {operationsNav.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </div>

          <div className="mb-4">
            <div className="sidebar-section-header">Long Line Suite</div>
            {suiteNav.map((item) => (
              <ExternalNavItem key={item.href} {...item} />
            ))}
          </div>

          <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
            <CollapsibleTrigger className="w-full">
              <div className="sidebar-section-header flex justify-between">
                <span>Admin</span>
                {adminOpen ? <ChevronDown /> : <ChevronRight />}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {adminNav.map((item) => (
                <NavItem key={item.to} {...item} />
              ))}
            </CollapsibleContent>
          </Collapsible>

        </nav>

      </aside>


      <main className="main-content">

        <header className="app-header">

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-4">

              <Button
                variant="secondary"
                size="icon"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>

              <h2 className="font-heading text-2xl font-black uppercase tracking-[0.08em]">
                {pageTitle}
              </h2>

            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={toggleTheme}
              >
                {theme === 'dark'
                  ? <Sun className="w-4 h-4" />
                  : <Moon className="w-4 h-4" />}
              </Button>

              <Button
                variant="secondary"
                onClick={logout}
                data-testid="logout-btn"
                className="flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Log out</span>
              </Button>
            </div>

          </div>


          {projects.length > 0 && (

            <div className="mt-2 border-t border-border pt-2 overflow-x-auto block">

              <div className="flex flex-wrap gap-1.5">

                {projects.map(project => {

                  const isActive = currentJobId === project.id;
                  const tabLabel = [project.job_number, project.name || 'Project'].filter(Boolean).join(' - ');

                  return (
                    <Link
                      key={project.id}
                      to={`/projects/${project.id}`}
                      className={`
                        max-w-full
                        px-3 py-1.5 text-xs
                        border
                        rounded-sm
                        transition-all
                        ${isActive
                          ? 'bg-primary text-primary-foreground border-primary shadow-lg'
                          : 'bg-card text-foreground border-border hover:border-primary hover:bg-accent'}
                      `}
                    >
                      <span className="font-semibold break-words">
                        {tabLabel}
                      </span>
                    </Link>
                  );

                })}

              </div>

            </div>

          )}

        </header>


        <div className="p-4 md:p-6">
          <Outlet />
        </div>

      </main>

    </div>
  );
};

export default Layout;
