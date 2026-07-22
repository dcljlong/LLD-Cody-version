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
  X,
  Sun,
  Moon,
  LogOut,
  MessageSquare,
  ExternalLink,
  Wrench,
  Clock,
  FileText,
  Briefcase,
  CloudSun,
} from 'lucide-react';
import { Button } from './ui/button';

const Layout = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [diaryOpeningVisible, setDiaryOpeningVisible] = useState(false);
  function closeMobileSidebar() {
    setSidebarOpen(false);
  }
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false);
      }
    };

    document.body.classList.add('lld-menu-is-open');
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.classList.remove('lld-menu-is-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [sidebarOpen]);

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
        setProjects([]);
      }
    };
    loadProjects();
  }, []);

  const operationsNav = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/diary', icon: BookOpen, label: 'Diary' },
    { to: '/projects/overview', icon: Briefcase, label: 'Project Overview' },
    { to: '/weather', icon: CloudSun, label: 'Weather' },
    { to: '/projects', icon: FolderOpen, label: 'Projects' },
    { to: '/action-items', icon: ListTodo, label: 'Action Items' },
    { to: '/walkaround', icon: Route, label: 'Walkaround' },
    { to: '/gates', icon: AlertTriangle, label: 'Roadblocks / Concerns' },
  ];


  const suiteNav = [
    {
    href: process.env.REACT_APP_LONG_LINE_SUITE_LAUNCHER_URL || 'https://long-line-suite-launcher.vercel.app',
    label: 'Launcher',
    description: 'Suite home',
  },
  {
      href: process.env.REACT_APP_TOOL_TRACKER_URL || 'https://tool-tracker-enterprise.vercel.app',
      icon: Wrench,
      label: 'Tool Tracker',
      description: 'Tool control',
    },
    {
      href: process.env.REACT_APP_TIMESHEET_MANAGER_URL || 'https://timesheet-manager-two.vercel.app',
      icon: Clock,
      label: 'Timesheet',
      description: 'Labour control',
    },
    {
      href: process.env.REACT_APP_FITOUTOS_URL || 'https://fitout-os-project.vercel.app',
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
  const diaryYear = new Date().getFullYear();
  const diaryVolumeNumber = Math.max(1, diaryYear - 2022);
  const diaryVolumeLabel = [
    '',
    'I',
    'II',
    'III',
    'IV',
    'V',
    'VI',
    'VII',
    'VIII',
    'IX',
    'X',
  ][diaryVolumeNumber] || String(diaryVolumeNumber);
  const diaryOpeningUserKey = String(user?.id || user?.email || displayName)
    .trim()
    .toLowerCase();
  const diaryOpeningKey = `lld-diary-opened-${diaryOpeningUserKey}-${diaryYear}`;

  useEffect(() => {
    if (!location.pathname.startsWith('/diary')) {
      setDiaryOpeningVisible(false);
      return;
    }

    try {
      setDiaryOpeningVisible(sessionStorage.getItem(diaryOpeningKey) !== 'true');
    } catch (error) {
      setDiaryOpeningVisible(true);
    }
  }, [diaryOpeningKey, location.pathname]);

  useEffect(() => {
    if (!diaryOpeningVisible) return undefined;

    const handleOpeningKeyDown = (event) => {
      if (event.key === 'Enter' || event.key === 'Escape') {
        event.preventDefault();

        try {
          sessionStorage.setItem(diaryOpeningKey, 'true');
        } catch (error) {
          // The diary still opens when browser storage is unavailable.
        }

        setDiaryOpeningVisible(false);
      }
    };

    document.body.classList.add('lld-diary-opening-active');
    window.addEventListener('keydown', handleOpeningKeyDown);

    return () => {
      document.body.classList.remove('lld-diary-opening-active');
      window.removeEventListener('keydown', handleOpeningKeyDown);
    };
  }, [diaryOpeningKey, diaryOpeningVisible]);

  const openDiaryForSession = () => {
    try {
      sessionStorage.setItem(diaryOpeningKey, 'true');
    } catch (error) {
      // The diary still opens when browser storage is unavailable.
    }

    setDiaryOpeningVisible(false);
  };

  const handleFeedbackClick = () => {
    const subject = encodeURIComponent('[LLD Feedback] Pilot feedback');
    const body = encodeURIComponent([
      'App: Long Line Diary',
      `Page: ${location.pathname}`,
      `User: ${user?.email || displayName || 'Unknown'}`,
      '',
      'Feedback type:',
      'What happened:',
      'What did you expect:',
      'How urgent:',
    ].join('\n'));

    window.location.href = `mailto:longlinesuite.feedback@gmail.com?subject=${subject}&body=${body}`;
  };

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

  const ExternalNavItem = ({ href, icon: Icon = FileText, label, description }) => (
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

      {diaryOpeningVisible && (
        <section
          className="lld-diary-opening"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lld-diary-opening-title"
          data-testid="lld-diary-opening-v1p"
        >
          <div className="lld-diary-opening-desk">
            <button
              type="button"
              className="lld-diary-opening-book"
              onClick={openDiaryForSession}
              autoFocus
              aria-label={`Open ${displayName}'s ${diaryYear} Long Line Diary`}
            >
              <span className="lld-diary-opening-spine" aria-hidden="true" />
              <span className="lld-diary-opening-stitch" aria-hidden="true" />

              <span className="lld-diary-opening-crest">
                <img src={lldLogo} alt="" />
              </span>

              <span className="lld-diary-opening-kicker">
                This diary belongs to
              </span>

              <strong id="lld-diary-opening-title">
                {displayName}
              </strong>

              <span className="lld-diary-opening-brand">
                Long Line Diary
              </span>

              <span className="lld-diary-opening-volume">
                Volume {diaryVolumeLabel} · {diaryYear}
              </span>

              <span className="lld-diary-opening-action">
                Open today’s diary
              </span>
            </button>

            <p>Press Enter or tap the diary to begin.</p>
          </div>
        </section>
      )}

      <aside
        id="lld-navigation-drawer"
        className={`sidebar fo-desktop-brand-rail lld-fitoutos-rail lld-navigation-drawer ${sidebarOpen ? 'lld-navigation-drawer-open' : ''}`}
        aria-hidden={!sidebarOpen}
      >

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

          <button
            type="button"
            className="lld-menu-close-button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <X aria-hidden="true" />
          </button>
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
              onClick={handleFeedbackClick}
              className="fo-rail-theme-toggle"
              data-testid="feedback-btn"
              aria-label="Send LLD feedback"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Feedback</span>
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

      <button
        type="button"
        className={`lld-navigation-backdrop ${sidebarOpen ? 'lld-navigation-backdrop-open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-label="Close navigation"
        tabIndex={sidebarOpen ? 0 : -1}
      />


      <main className={`main-content fo-main-content lld-fitoutos-main ${location.pathname.startsWith('/diary') ? 'lld-diary-experience' : ''}`}>
        <header className="app-header">

          <div className="lld-compact-header-inner">

            <div className="lld-compact-brand-row">

              <div className="lld-compact-brand-left">
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => setSidebarOpen((current) => !current)}
                  className="lld-compact-menu-button"
                  aria-label="Open navigation"
                  aria-controls="lld-navigation-drawer"
                  aria-expanded={sidebarOpen}
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
                  type="button"
                  variant="secondary"
                  onClick={handleFeedbackClick}
                  data-testid="mobile-feedback-btn"
                  className="lld-compact-theme-button"
                  aria-label="Send LLD feedback"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Feedback</span>
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

            <div className="lld-compact-nav-row lld-legacy-top-navigation">
              <nav className="lld-compact-nav" aria-label="LLD compact navigation">
                {operationsNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={closeMobileSidebar}
                      data-testid="lld-sidebar-nav-link"
                      end={item.to === '/dashboard'}
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
                  const SuiteIcon = item.icon || FileText;
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


          </div>

        </header>


        <div className={`lld-content-frame ${location.pathname.startsWith('/diary') ? 'lld-content-frame-diary' : ''}`}>
          <Outlet />
        </div>

      </main>

    </div>
  );
};

export default Layout;
