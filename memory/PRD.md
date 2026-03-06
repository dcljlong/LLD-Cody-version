# LLDv2 - Long Line Diary V2 - PRD

## Original Problem Statement
Build LLDv2: a professional construction site diary + operational command center for multi-job commercial interior fitout PMs in New Zealand. Core focus on Product A (Operations): walkaround quick capture, auto-sorting dashboard, action items, project awareness, scope gates/mini programme, risk radar, and daily diary output.

## User Personas
- **Primary**: Commercial interior fitout Project Managers in NZ running multiple jobs
- **Needs**: Speed, clarity, low click count, one-handed mobile use, fast end-of-day recall

## Architecture

### Backend (FastAPI + MongoDB)
- **Authentication**: JWT-based custom auth
- **Database**: MongoDB with collections for users, projects, gates, action_items, walkaround_entries, settings, programmes, programme_tasks, notifications, gate_templates, delay_notices, date_change_logs
- **AI Integration**: Emergent LLM key with Gemini for PDF programme parsing

### Frontend (React + Tailwind CSS)
- **Theme**: Dark mode default with light mode toggle
- **Design**: Barlow Condensed headings, Public Sans body, Orange (#f97316) accent
- **UI Library**: Shadcn components

## Core Requirements (Static)
1. JWT Authentication (register/login)
2. Walkaround Quick Capture (~10 second entry)
3. Auto-sorted Dashboard (Blocked/Delayed, At Risk, Overdue, Due Today, Due This Week, Recently Completed)
4. Scope Gates with Risk Radar (BLOCKED, DELAYED, AT_RISK, ON_TRACK, COMPLETED statuses)
5. Action Items Management
6. Projects CRUD
7. Daily Diary per Project
8. 7-Day Weather Display
9. Logo Upload (company + dev)

## What's Been Implemented (Jan 2026)

### Phase 1 - MVP Core
- ✅ JWT Authentication system
- ✅ Projects CRUD with status tracking
- ✅ Scope Gates with 7 default NZ fitout gates
- ✅ Gate status calculation (BLOCKED, DELAYED, AT_RISK, ON_TRACK, COMPLETED)
- ✅ Cascade risk detection (upstream delays affect downstream gates)
- ✅ Action Items CRUD with priority levels
- ✅ Walkaround Quick Capture with photo upload (base64)
- ✅ Auto-sorting Dashboard
- ✅ Daily Diary per project
- ✅ 7-Day Weather widget (mock data)
- ✅ Settings with logo upload and theme toggle
- ✅ Mobile-responsive design with bottom nav

### Phase 2 - Programme Management (Jan 2026)
- ✅ PDF Programme Upload with AI parsing (Gemini)
- ✅ Task extraction from MC programmes
- ✅ Task tagging system (OURS, MC, SUBBIES, COUNCIL, WATCH)
- ✅ Date change tracking with audit log
- ✅ Delay Notice generation

### Phase 3 - Gate Templates (Jan 2026)
- ✅ 5 Pre-built system templates:
  - Standard Office Fitout (7 gates)
  - Retail/Hospitality (9 gates)
  - Medical/Healthcare (10 gates)
  - Education/Schools (10 gates)
  - Industrial/Warehouse (8 gates)
- ✅ Custom template creation
- ✅ Template duplication
- ✅ Apply template to project with auto-calculated dates

### Phase 4 - Notifications & Email (Jan 2026)
- ✅ Notification system with bell icon
- ✅ SMTP email configuration in settings
- ✅ Delay notice email generation
- ✅ Reminder generation for upcoming tasks/gates

## Prioritized Backlog

### P0 - Critical (Next Sprint)
- [ ] Notification dropdown panel with mark as read
- [ ] Email sending via configured SMTP
- [ ] Programme task → Gate conversion

### P1 - Important
- [ ] Full calendar view for programme/gates
- [ ] Photo gallery view for walkaround entries
- [ ] Export diary to PDF
- [ ] Bulk date adjustment for gates

### P2 - Nice to Have
- [ ] Timesheets tracking
- [ ] Staff resourcing
- [ ] Advanced reporting
- [ ] Mobile app (PWA)

## Next Tasks
1. Implement notification dropdown panel
2. Add actual email sending functionality
3. Create programme task to gate conversion
4. Add bulk gate date adjustment
5. Implement PDF export for diary

## Technical Notes
- Weather API uses mock data - add OPENWEATHER_API_KEY for real data
- PDF parsing uses Gemini via Emergent LLM key
- All dates stored in ISO format with UTC timezone
- Photos stored as base64 in MongoDB (max 5MB per photo)
