# LLD Cody Live Deployment Handover

## Current stable checkpoint

Commit: b8e3242 add live deployment polish v1  
Tag: live-polish-v1  
Repo: dcljlong/LLD-Cody-version  
Local path: D:\LLD Cody version

## Live URLs

Frontend:
https://lld-cody.vercel.app

Backend:
https://lld-cody-version.onrender.com

Backend health:
https://lld-cody-version.onrender.com/api/health

## Deployment status

LLD Cody live deployment milestone is complete.

Confirmed live:
- Render backend healthy
- Vercel frontend live
- Mongo Atlas connected
- CORS working
- Login/register working
- Projects working
- Gates/Risks create/list working
- Action Items create/list working
- Walkaround create/list working
- Diary route working
- Diary NZ local date fixed
- Walkaround notes appear in Diary
- Opened action items appear in Diary
- Expected Complete fallback fixed to "-"
- Action Item unsaved form warning working
- Sidebar cleaned: Gates / Risks and Diary visible, Programme removed

## Render backend setup

Service: LLD-Cody-version  
Runtime: Python 3.11.10  
Instance: Free  
Start command:
python -m uvicorn server:app --host 0.0.0.0 --port $PORT

Required env vars:
- ENVIRONMENT=production
- MONGO_URL=<Mongo Atlas connection string>
- DB_NAME=lld_cody
- JWT_SECRET=<long random secret>
- CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://lld-cody.vercel.app,https://lld-cody-git-main-dcljlongs-projects.vercel.app
- PYTHON_VERSION=3.11.10
- OPENAI_API_KEY=temporary placeholder currently used to allow startup

## Vercel frontend setup

Project: lld-cody  
Root directory: frontend  
Install command:
npm install --legacy-peer-deps

Build command:
npm run build

Output directory:
build

Required env var:
REACT_APP_BACKEND_URL=https://lld-cody-version.onrender.com

## Known notes

Render Free will spin down after inactivity and may take 30-60 seconds to wake.

OPENAI_API_KEY is currently only present to prevent startup failure. Future patch should make OpenAI optional so the app can start cleanly without it.

Programme route/page still exists in code but is removed from visible Cody navigation.

## Recommended next steps

1. Final branding pass: replace LLDv2 / Site Command with final Cody branding.
2. Add production-safe OpenAI optional-client patch.
3. Add support/privacy wording if client-facing.
4. Add Mongo Atlas backup/export plan.
5. Consider upgrading Render before real client use.
6. Run final mobile browser proof on phone.
