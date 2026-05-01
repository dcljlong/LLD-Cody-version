import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, NavLink, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { projectsApi } from '../lib/api';
import {
  LayoutDashboard,
  Route,
  Target,
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
    { to: '/walkaround', icon: Route, label: 'Walkaround' },
    { to: '/action-items', icon: ListTodo, label: 'Action Items' },
    { to: '/projects', icon: FolderOpen, label: 'Projects' },
    { to: '/gates', icon: Target, label: 'Gates / Risks' },
    { to: '/diary', icon: BookOpen, label: 'Diary' },
  ];

  const adminNav = [
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  const pageTitle = useMemo(() => {
    return location.pathname.split('/')[1]?.replace(/-/g, ' ') || 'Dashboard';
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

  return (
    <div className="app-container">

      <aside className={`sidebar ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>

        <div className="px-4 py-4 border-b-2-2 border-b-2-2order">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-sm flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">LL</span>
            </div>
            <div>
              <h1 className="font-bold text-lg">LLDv2</h1>
              <p className="text-xs text-muted-foreground">Site Command</p>
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

        <header className="app-header border-b-2-2-4 border-slate-500 shadow-sm shadow-sm">

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-4">

              <Button
                variant="secondary"
                size="icon"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>

              <h2 className="text-xl font-bold uppercase tracking-wide">
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
                <span>Logout</span>
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
