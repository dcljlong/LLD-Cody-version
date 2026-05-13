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
  ExternalLink,
  Wrench,
  Clock,
  FileText,
  Briefcase,
} from 'lucide-react';
import { Button } from './ui/button';

const Layout = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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


  const suiteNav = [
    {
      href: process.env.REACT_APP_TOOL_TRACKER_URL || 'http://localhost:3002',
      icon: Wrench,
      label: 'Tool Tracker',
      description: 'Tool control',
    },
    {
      href: process.env.REACT_APP_TIMESHEET_MANAGER_URL || 'http://localhost:3001',
      icon: Clock,
      label: 'Timesheet',
      description: 'Labour control',
    },
    {
      href: process.env.REACT_APP_FITOUTOS_URL || 'http://localhost:3004',
      icon: Briefcase,
      label: 'FitoutOS',
      description: 'Programme control',
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

  const displayName = user?.name || user?.full_name || user?.email || 'LLD User';
  const userInitial = (displayName.trim().charAt(0) || 'U').toUpperCase();

  const NavItem = ({ to, icon: Icon, label }) => (
    <NavLink
      to={to}
      onClick={() => setSidebarOpen(false)}
      className={({ isActive }) =>
        `sidebar-nav-item fo-rail-nav-link ${isActive ? 'active' : ''}`
      }
    >
      <Icon className="fo-rail-nav-icon lld-rail-nav-icon" strokeWidth={2} />
      <span className="fo-rail-nav-label lld-rail-nav-label">{label}</span>
    </NavLink>
  );

  const ExternalNavItem = ({ href, icon: Icon, label, description }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => setSidebarOpen(false)}
      className="sidebar-nav-item fo-rail-suite-link"
    >
      <span className="fo-suite-mini-mark lld-suite-mini-mark" aria-hidden="true">
        <Icon className="fo-suite-mini-mark-icon" strokeWidth={2.35} />
      </span>
      <span className="fo-rail-suite-label lld-suite-link-label">{label}</span>
    </a>
  );

  return (
    <div className="app-container">

      <aside className={`sidebar fo-desktop-brand-rail lld-fitoutos-rail ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>

        <div className="lld-sidebar-brand fo-rail-card">
          <div className="fo-rail-brand lld-rail-brand-lockup">
            <div className="lld-sidebar-logo">
              <img src={lldLogo} alt="LLD logo" className="w-full h-full object-contain" />
            </div>
            <div className="fo-rail-brand-text lld-rail-brand-text">
              <p className="fo-rail-kicker lld-rail-brand-eyebrow">Long Line</p>
              <h1 className="fo-rail-title lld-rail-brand-title">LLD</h1>
              <p className="fo-rail-subtitle lld-rail-brand-subtitle">Site Diary</p>
            </div>
          </div>
        </div>

        <nav className="fo-rail-nav lld-rail-nav">

          <div className="fo-rail-section lld-rail-section">
            <div className="sidebar-section-header fo-rail-section-title">Operations</div>
            {operationsNav.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </div>

          <div className="fo-rail-section lld-rail-section">
            <div className="sidebar-section-header fo-rail-suite-title">Long Line Suite</div>
            {suiteNav.map((item) => (
              <ExternalNavItem key={item.href} {...item} />
            ))}
          </div>

        </nav>

        <div className="lld-sidebar-footer fo-rail-account">
          <div className="sidebar-section-header fo-rail-section-title fo-rail-account-title">Account</div>
          <div className="lld-sidebar-user fo-rail-user-block">
            <div className="fo-rail-user-text lld-sidebar-user-text">
              <p className="fo-rail-user-name lld-sidebar-user-name">{displayName}</p>
              <p className="fo-rail-user-role lld-sidebar-user-role">Long Line Diary</p>
            </div>
          </div>

          <div className="lld-sidebar-action-grid fo-rail-account-actions">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={toggleTheme}
              className="fo-rail-theme-toggle"
              data-testid="theme-toggle"
            >
              {theme === 'dark'
                ? <Sun className="h-4 w-4" />
                : <Moon className="h-4 w-4" />}
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={logout}
              className="fo-rail-logout-button"
              data-testid="logout-btn"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>
          </div>
        </div>

      </aside>


      <main className="main-content fo-main-content lld-fitoutos-main">
        <header className="app-header">

          <div className="lld-compact-header-inner">

            <div className="lld-compact-brand-row">

              <div className="lld-compact-brand-left">
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => setSidebarOpen(true)}
                  className="lld-compact-menu-button"
                  aria-label="Open navigation"
                >
                  <Menu className="w-5 h-5" />
                </Button>

                <Link to="/dashboard" className="lld-compact-brand-link" data-testid="compact-logo-link">
                  <span className="lld-compact-logo">
                    <img src={lldLogo} alt="LLD logo" />
                  </span>
                  <span className="lld-compact-brand-copy">
                    <span className="lld-compact-kicker">Long Line</span>
                    <span className="lld-compact-title">LLD</span>
                    <span className="lld-compact-subtitle">Site Diary</span>
                  </span>
                </Link>
              </div>

              <div className="lld-compact-actions">
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={toggleTheme}
                  className="lld-compact-theme-button"
                  data-testid="theme-toggle"
                  aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                >
                  {theme === 'dark'
                    ? <Sun className="w-4 h-4" />
                    : <Moon className="w-4 h-4" />}
                </Button>

                <Button
                  variant="secondary"
                  onClick={logout}
                  data-testid="mobile-logout-btn"
                  className="lld-compact-logout-button"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </Button>
              </div>

            </div>

            <div className="lld-compact-nav-row">
              <nav className="lld-compact-nav" aria-label="LLD compact navigation">
                {operationsNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/dashboard'}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `lld-compact-nav-link ${isActive ? 'active' : ''}`
                      }
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}

                <div className="lld-compact-nav-divider" aria-hidden="true" />

                {suiteNav.map((item) => {
                  const SuiteIcon = item.icon;
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="lld-compact-suite-link"
                      title={item.description}
                    >
                      <span className="lld-suite-mini-mark" aria-hidden="true">
                        <SuiteIcon className="w-4 h-4" />
                      </span>
                      <span className="lld-suite-link-label">{item.label}</span>
                    </a>
                  );
                })}
              </nav>
            </div>

            {projects.length > 0 && (
              <div className="lld-compact-project-row">
                <div className="flex flex-wrap gap-1.5">
                  {projects.map(project => {
                    const isActive = currentJobId === project.id;
                    const tabLabel = [project.job_number, project.name || 'Project'].filter(Boolean).join(' - ');

                    return (
                      <Link
                        key={project.id}
                        to={`/projects/${project.id}`}
                        className={`
                          lld-compact-project-link
                          ${isActive ? 'active' : ''}
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

          </div>

        </header>


        <div className="p-4 sm:p-5 lg:p-6">
          <Outlet />
        </div>

      </main>

    </div>
  );
};

export default Layout;



