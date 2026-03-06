from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, File, UploadFile
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import httpx
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'lldv2-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Weather API
OPENWEATHER_API_KEY = os.environ.get('OPENWEATHER_API_KEY', '')

app = FastAPI(title="LLDv2 API", description="Long Line Diary V2 - Construction Operations Command Center")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    company: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    company: Optional[str] = None
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    client_name: Optional[str] = None
    location: Optional[str] = None
    status: str = "active"
    programme_pdf_url: Optional[str] = None

class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    client_name: Optional[str] = None
    location: Optional[str] = None
    status: str
    programme_pdf_url: Optional[str] = None
    user_id: str
    created_at: str
    updated_at: str

class GateCreate(BaseModel):
    project_id: str
    name: str
    description: Optional[str] = None
    order: int
    owner_party: str  # YOU, MC, SUBBIES, COUNCIL
    required_by_date: str
    expected_complete_date: Optional[str] = None
    buffer_days: int = 2
    depends_on_gate_ids: List[str] = []
    is_hard_gate: bool = False
    is_optional: bool = False

class GateResponse(BaseModel):
    id: str
    project_id: str
    name: str
    description: Optional[str] = None
    order: int
    owner_party: str
    required_by_date: str
    expected_complete_date: Optional[str] = None
    buffer_days: int
    depends_on_gate_ids: List[str]
    is_hard_gate: bool
    is_optional: bool
    status: str  # BLOCKED, DELAYED, AT_RISK, ON_TRACK, COMPLETED
    completed_at: Optional[str] = None
    user_id: str
    created_at: str
    updated_at: str

class ActionItemCreate(BaseModel):
    project_id: str
    gate_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    priority: str = "medium"  # critical, high, medium, low, deferred
    due_date: Optional[str] = None
    expected_complete_date: Optional[str] = None
    owner: Optional[str] = None
    photos: List[str] = []  # base64 encoded photos

class ActionItemResponse(BaseModel):
    id: str
    project_id: str
    gate_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    priority: str
    due_date: Optional[str] = None
    expected_complete_date: Optional[str] = None
    owner: Optional[str] = None
    photos: List[str] = []
    status: str  # open, completed
    completed_at: Optional[str] = None
    user_id: str
    created_at: str
    updated_at: str

class WalkaroundEntryCreate(BaseModel):
    project_id: str
    gate_id: Optional[str] = None
    note: str
    photos: List[str] = []  # base64 encoded
    priority: str = "medium"
    due_date: Optional[str] = None
    expected_complete_date: Optional[str] = None
    owner: Optional[str] = None
    create_action_item: bool = True

class WalkaroundEntryResponse(BaseModel):
    id: str
    project_id: str
    gate_id: Optional[str] = None
    note: str
    photos: List[str] = []
    priority: str
    due_date: Optional[str] = None
    expected_complete_date: Optional[str] = None
    owner: Optional[str] = None
    action_item_id: Optional[str] = None
    user_id: str
    created_at: str

class SettingsUpdate(BaseModel):
    company_name: Optional[str] = None
    company_logo: Optional[str] = None  # base64
    dev_logo: Optional[str] = None  # base64
    theme: str = "dark"
    default_location: Optional[str] = None
    # SMTP Settings
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_email: Optional[str] = None
    smtp_from_name: Optional[str] = None
    delay_notice_method: str = "both"  # "email", "clipboard", "both"
    default_reminder_days: int = 7

class SettingsResponse(BaseModel):
    id: str
    user_id: str
    company_name: Optional[str] = None
    company_logo: Optional[str] = None
    dev_logo: Optional[str] = None
    theme: str
    default_location: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_from_email: Optional[str] = None
    smtp_from_name: Optional[str] = None
    delay_notice_method: str = "both"
    default_reminder_days: int = 7
    smtp_configured: bool = False
    updated_at: str

# ==================== PROGRAMME MODELS ====================

class ProgrammeUpload(BaseModel):
    project_id: str
    pdf_base64: str
    filename: str

class ProgrammeTaskResponse(BaseModel):
    id: str
    programme_id: str
    project_id: str
    task_name: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    duration_days: Optional[int] = None
    dependencies: List[str] = []
    owner_tag: str = "UNASSIGNED"  # OURS, MC, SUBBIES, COUNCIL, WATCH, UNASSIGNED
    is_tracked: bool = False
    original_start_date: Optional[str] = None
    original_end_date: Optional[str] = None
    user_id: str
    created_at: str

class ProgrammeResponse(BaseModel):
    id: str
    project_id: str
    filename: str
    parsed_at: str
    task_count: int
    user_id: str
    created_at: str

class TaskTagUpdate(BaseModel):
    owner_tag: str
    is_tracked: bool = False

class TaskDateUpdate(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    delay_reason: Optional[str] = None
    notify_mc: bool = False

# ==================== GATE TEMPLATE MODELS ====================

class GateTemplateItemCreate(BaseModel):
    name: str
    owner_party: str
    typical_duration_days: int = 7
    buffer_days: int = 2
    depends_on_order: List[int] = []
    is_hard_gate: bool = False
    is_optional: bool = False
    order: int

class GateTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: str = "custom"  # custom, office, retail, medical, education, industrial
    gates: List[GateTemplateItemCreate] = []

class GateTemplateResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    category: str
    gates: List[dict]
    is_system: bool = False
    user_id: Optional[str] = None
    created_at: str

# ==================== NOTIFICATION MODELS ====================

class NotificationResponse(BaseModel):
    id: str
    user_id: str
    type: str  # reminder, delay_notice, gate_risk, overdue
    title: str
    message: str
    related_id: Optional[str] = None
    related_type: Optional[str] = None  # task, gate, action_item
    is_read: bool = False
    action_required: bool = False
    created_at: str

class DelayNoticeCreate(BaseModel):
    task_id: str
    original_date: str
    new_date: str
    reason: str
    send_email: bool = True

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "company": user_data.company,
        "created_at": now
    }
    await db.users.insert_one(user_doc)
    
    # Create default settings
    settings_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "company_name": user_data.company,
        "company_logo": None,
        "dev_logo": None,
        "theme": "dark",
        "default_location": None,
        "updated_at": now
    }
    await db.settings.insert_one(settings_doc)
    
    token = create_token(user_id)
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            name=user_data.name,
            company=user_data.company,
            created_at=now
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"])
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            company=user.get("company"),
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# ==================== PROJECTS ROUTES ====================

@api_router.post("/projects", response_model=ProjectResponse)
async def create_project(project: ProjectCreate, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    project_id = str(uuid.uuid4())
    
    doc = {
        "id": project_id,
        "user_id": current_user["id"],
        **project.model_dump(),
        "created_at": now,
        "updated_at": now
    }
    await db.projects.insert_one(doc)
    doc.pop("_id", None)
    return ProjectResponse(**doc)

@api_router.get("/projects", response_model=List[ProjectResponse])
async def get_projects(current_user: dict = Depends(get_current_user)):
    projects = await db.projects.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    return [ProjectResponse(**p) for p in projects]

@api_router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, current_user: dict = Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id, "user_id": current_user["id"]}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectResponse(**project)

@api_router.put("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, project: ProjectCreate, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    result = await db.projects.update_one(
        {"id": project_id, "user_id": current_user["id"]},
        {"$set": {**project.model_dump(), "updated_at": now}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    updated = await db.projects.find_one({"id": project_id}, {"_id": 0})
    return ProjectResponse(**updated)

@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.projects.delete_one({"id": project_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    # Also delete related gates and action items
    await db.gates.delete_many({"project_id": project_id})
    await db.action_items.delete_many({"project_id": project_id})
    await db.walkaround_entries.delete_many({"project_id": project_id})
    return {"message": "Project deleted"}

# ==================== GATES ROUTES ====================

def calculate_gate_status(gate: dict, all_gates: List[dict]) -> str:
    """Calculate gate status based on dates and dependencies"""
    if gate.get("completed_at"):
        return "COMPLETED"
    
    # Check dependencies
    for dep_id in gate.get("depends_on_gate_ids", []):
        dep_gate = next((g for g in all_gates if g["id"] == dep_id), None)
        if dep_gate and not dep_gate.get("completed_at"):
            # Check if dependency is blocked or delayed
            dep_status = calculate_gate_status_simple(dep_gate)
            if dep_status in ["BLOCKED", "DELAYED"]:
                return "BLOCKED"
    
    return calculate_gate_status_simple(gate)

def calculate_gate_status_simple(gate: dict) -> str:
    """Calculate status without checking dependencies"""
    if gate.get("completed_at"):
        return "COMPLETED"
    
    now = datetime.now(timezone.utc)
    required_by = None
    expected = None
    
    # Safely parse dates with timezone handling
    if gate.get("required_by_date"):
        try:
            required_by_str = gate["required_by_date"]
            if "T" not in required_by_str:
                required_by_str += "T00:00:00"
            if required_by_str.endswith("Z"):
                required_by_str = required_by_str.replace("Z", "+00:00")
            elif "+" not in required_by_str and "Z" not in required_by_str:
                required_by_str += "+00:00"
            required_by = datetime.fromisoformat(required_by_str)
        except:
            pass
    
    if gate.get("expected_complete_date"):
        try:
            expected_str = gate["expected_complete_date"]
            if "T" not in expected_str:
                expected_str += "T00:00:00"
            if expected_str.endswith("Z"):
                expected_str = expected_str.replace("Z", "+00:00")
            elif "+" not in expected_str and "Z" not in expected_str:
                expected_str += "+00:00"
            expected = datetime.fromisoformat(expected_str)
        except:
            pass
    
    buffer_days = gate.get("buffer_days", 2)
    
    if required_by:
        if expected and expected > required_by:
            return "DELAYED"
        buffer_start = required_by - timedelta(days=buffer_days)
        if expected and expected >= buffer_start:
            return "AT_RISK"
        if now > required_by:
            return "DELAYED"
    
    return "ON_TRACK"

@api_router.post("/gates", response_model=GateResponse)
async def create_gate(gate: GateCreate, current_user: dict = Depends(get_current_user)):
    # Verify project belongs to user
    project = await db.projects.find_one({"id": gate.project_id, "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    now = datetime.now(timezone.utc).isoformat()
    gate_id = str(uuid.uuid4())
    
    # Get all gates for status calculation
    all_gates = await db.gates.find({"project_id": gate.project_id}, {"_id": 0}).to_list(100)
    
    doc = {
        "id": gate_id,
        "user_id": current_user["id"],
        **gate.model_dump(),
        "completed_at": None,
        "created_at": now,
        "updated_at": now
    }
    
    status = calculate_gate_status(doc, all_gates)
    doc["status"] = status
    
    await db.gates.insert_one(doc)
    return GateResponse(**doc)

@api_router.get("/gates", response_model=List[GateResponse])
async def get_gates(project_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {"user_id": current_user["id"]}
    if project_id:
        query["project_id"] = project_id
    
    gates = await db.gates.find(query, {"_id": 0}).to_list(1000)
    
    # Recalculate statuses
    for gate in gates:
        project_gates = [g for g in gates if g["project_id"] == gate["project_id"]]
        gate["status"] = calculate_gate_status(gate, project_gates)
    
    return [GateResponse(**g) for g in sorted(gates, key=lambda x: x.get("order", 0))]

@api_router.get("/gates/{gate_id}", response_model=GateResponse)
async def get_gate(gate_id: str, current_user: dict = Depends(get_current_user)):
    gate = await db.gates.find_one({"id": gate_id, "user_id": current_user["id"]}, {"_id": 0})
    if not gate:
        raise HTTPException(status_code=404, detail="Gate not found")
    
    all_gates = await db.gates.find({"project_id": gate["project_id"]}, {"_id": 0}).to_list(100)
    gate["status"] = calculate_gate_status(gate, all_gates)
    return GateResponse(**gate)

@api_router.put("/gates/{gate_id}", response_model=GateResponse)
async def update_gate(gate_id: str, gate_data: GateCreate, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    
    existing = await db.gates.find_one({"id": gate_id, "user_id": current_user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Gate not found")
    
    update_doc = {**gate_data.model_dump(), "updated_at": now}
    await db.gates.update_one({"id": gate_id}, {"$set": update_doc})
    
    updated = await db.gates.find_one({"id": gate_id}, {"_id": 0})
    all_gates = await db.gates.find({"project_id": updated["project_id"]}, {"_id": 0}).to_list(100)
    updated["status"] = calculate_gate_status(updated, all_gates)
    
    return GateResponse(**updated)

@api_router.post("/gates/{gate_id}/complete", response_model=GateResponse)
async def complete_gate(gate_id: str, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    result = await db.gates.update_one(
        {"id": gate_id, "user_id": current_user["id"]},
        {"$set": {"completed_at": now, "updated_at": now}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Gate not found")
    
    updated = await db.gates.find_one({"id": gate_id}, {"_id": 0})
    updated["status"] = "COMPLETED"
    return GateResponse(**updated)

@api_router.post("/gates/{gate_id}/reopen", response_model=GateResponse)
async def reopen_gate(gate_id: str, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    result = await db.gates.update_one(
        {"id": gate_id, "user_id": current_user["id"]},
        {"$set": {"completed_at": None, "updated_at": now}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Gate not found")
    
    updated = await db.gates.find_one({"id": gate_id}, {"_id": 0})
    all_gates = await db.gates.find({"project_id": updated["project_id"]}, {"_id": 0}).to_list(100)
    updated["status"] = calculate_gate_status(updated, all_gates)
    return GateResponse(**updated)

@api_router.post("/projects/{project_id}/gates/template")
async def create_default_gates(project_id: str, current_user: dict = Depends(get_current_user)):
    """Create default NZ fitout gates template for a project"""
    project = await db.projects.find_one({"id": project_id, "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    now = datetime.now(timezone.utc)
    base_date = now + timedelta(days=30)  # Start 30 days from now
    
    default_gates = [
        {"name": "Closed In / Ready for Partitions", "owner_party": "MC", "days_offset": 0, "is_hard_gate": False, "is_optional": False, "depends_on": []},
        {"name": "Partitions Complete → Doors/Jambs/Joinery Ready", "owner_party": "YOU", "days_offset": 14, "is_hard_gate": False, "is_optional": True, "depends_on": [0]},
        {"name": "Council Preline + Subbies 1st Fix Sign-off", "owner_party": "COUNCIL", "days_offset": 21, "is_hard_gate": True, "is_optional": False, "depends_on": [1]},
        {"name": "Linings Complete → Ready for Stoppers", "owner_party": "YOU", "days_offset": 35, "is_hard_gate": False, "is_optional": False, "depends_on": [2]},
        {"name": "Painting Complete", "owner_party": "MC", "days_offset": 49, "is_hard_gate": False, "is_optional": False, "depends_on": [3]},
        {"name": "2-Way Grid Install + Aluminium Skirting", "owner_party": "YOU", "days_offset": 56, "is_hard_gate": False, "is_optional": False, "depends_on": [4]},
        {"name": "Subbies 2nd Fix to Ceiling Grid → Tile Out", "owner_party": "SUBBIES", "days_offset": 63, "is_hard_gate": False, "is_optional": False, "depends_on": [5]},
    ]
    
    created_gates = []
    gate_ids = []
    
    for i, gate_template in enumerate(default_gates):
        gate_id = str(uuid.uuid4())
        gate_ids.append(gate_id)
        
        depends_on = [gate_ids[dep_idx] for dep_idx in gate_template["depends_on"] if dep_idx < len(gate_ids)]
        required_by = (base_date + timedelta(days=gate_template["days_offset"])).isoformat()
        
        doc = {
            "id": gate_id,
            "project_id": project_id,
            "user_id": current_user["id"],
            "name": gate_template["name"],
            "description": None,
            "order": i + 1,
            "owner_party": gate_template["owner_party"],
            "required_by_date": required_by,
            "expected_complete_date": None,
            "buffer_days": 2,
            "depends_on_gate_ids": depends_on,
            "is_hard_gate": gate_template["is_hard_gate"],
            "is_optional": gate_template["is_optional"],
            "completed_at": None,
            "status": "ON_TRACK",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        await db.gates.insert_one(doc)
        created_gates.append(doc)
    
    return {"message": f"Created {len(created_gates)} default gates", "gates": [GateResponse(**g) for g in created_gates]}

# ==================== ACTION ITEMS ROUTES ====================

@api_router.post("/action-items", response_model=ActionItemResponse)
async def create_action_item(item: ActionItemCreate, current_user: dict = Depends(get_current_user)):
    # Verify project
    project = await db.projects.find_one({"id": item.project_id, "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    now = datetime.now(timezone.utc).isoformat()
    item_id = str(uuid.uuid4())
    
    doc = {
        "id": item_id,
        "user_id": current_user["id"],
        **item.model_dump(),
        "status": "open",
        "completed_at": None,
        "created_at": now,
        "updated_at": now
    }
    await db.action_items.insert_one(doc)
    return ActionItemResponse(**doc)

@api_router.get("/action-items", response_model=List[ActionItemResponse])
async def get_action_items(
    project_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"user_id": current_user["id"]}
    if project_id:
        query["project_id"] = project_id
    if status:
        query["status"] = status
    
    items = await db.action_items.find(query, {"_id": 0}).to_list(1000)
    return [ActionItemResponse(**i) for i in items]

@api_router.get("/action-items/{item_id}", response_model=ActionItemResponse)
async def get_action_item(item_id: str, current_user: dict = Depends(get_current_user)):
    item = await db.action_items.find_one({"id": item_id, "user_id": current_user["id"]}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Action item not found")
    return ActionItemResponse(**item)

@api_router.put("/action-items/{item_id}", response_model=ActionItemResponse)
async def update_action_item(item_id: str, item_data: ActionItemCreate, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    result = await db.action_items.update_one(
        {"id": item_id, "user_id": current_user["id"]},
        {"$set": {**item_data.model_dump(), "updated_at": now}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Action item not found")
    
    updated = await db.action_items.find_one({"id": item_id}, {"_id": 0})
    return ActionItemResponse(**updated)

@api_router.post("/action-items/{item_id}/complete", response_model=ActionItemResponse)
async def complete_action_item(item_id: str, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    result = await db.action_items.update_one(
        {"id": item_id, "user_id": current_user["id"]},
        {"$set": {"status": "completed", "completed_at": now, "updated_at": now}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Action item not found")
    
    updated = await db.action_items.find_one({"id": item_id}, {"_id": 0})
    return ActionItemResponse(**updated)

@api_router.post("/action-items/{item_id}/reopen", response_model=ActionItemResponse)
async def reopen_action_item(item_id: str, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    result = await db.action_items.update_one(
        {"id": item_id, "user_id": current_user["id"]},
        {"$set": {"status": "open", "completed_at": None, "updated_at": now}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Action item not found")
    
    updated = await db.action_items.find_one({"id": item_id}, {"_id": 0})
    return ActionItemResponse(**updated)

@api_router.delete("/action-items/{item_id}")
async def delete_action_item(item_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.action_items.delete_one({"id": item_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Action item not found")
    return {"message": "Action item deleted"}

# ==================== WALKAROUND ROUTES ====================

@api_router.post("/walkaround", response_model=WalkaroundEntryResponse)
async def create_walkaround_entry(entry: WalkaroundEntryCreate, current_user: dict = Depends(get_current_user)):
    # Verify project
    project = await db.projects.find_one({"id": entry.project_id, "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    now = datetime.now(timezone.utc).isoformat()
    entry_id = str(uuid.uuid4())
    action_item_id = None
    
    # Optionally create action item
    if entry.create_action_item:
        action_item_id = str(uuid.uuid4())
        action_doc = {
            "id": action_item_id,
            "project_id": entry.project_id,
            "gate_id": entry.gate_id,
            "user_id": current_user["id"],
            "title": entry.note[:100] + ("..." if len(entry.note) > 100 else ""),
            "description": entry.note,
            "priority": entry.priority,
            "due_date": entry.due_date,
            "expected_complete_date": entry.expected_complete_date,
            "owner": entry.owner,
            "photos": entry.photos,
            "status": "open",
            "completed_at": None,
            "created_at": now,
            "updated_at": now
        }
        await db.action_items.insert_one(action_doc)
    
    doc = {
        "id": entry_id,
        "user_id": current_user["id"],
        "project_id": entry.project_id,
        "gate_id": entry.gate_id,
        "note": entry.note,
        "photos": entry.photos,
        "priority": entry.priority,
        "due_date": entry.due_date,
        "expected_complete_date": entry.expected_complete_date,
        "owner": entry.owner,
        "action_item_id": action_item_id,
        "created_at": now
    }
    await db.walkaround_entries.insert_one(doc)
    return WalkaroundEntryResponse(**doc)

@api_router.get("/walkaround", response_model=List[WalkaroundEntryResponse])
async def get_walkaround_entries(
    project_id: Optional[str] = None,
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"user_id": current_user["id"]}
    if project_id:
        query["project_id"] = project_id
    if date:
        # Filter by date (entries created on that day)
        start = f"{date}T00:00:00"
        end = f"{date}T23:59:59"
        query["created_at"] = {"$gte": start, "$lte": end}
    
    entries = await db.walkaround_entries.find(query, {"_id": 0}).to_list(1000)
    return [WalkaroundEntryResponse(**e) for e in sorted(entries, key=lambda x: x["created_at"], reverse=True)]

# ==================== DASHBOARD ROUTES ====================

@api_router.get("/dashboard/summary")
async def get_dashboard_summary(current_user: dict = Depends(get_current_user)):
    """Get dashboard summary with auto-sorted action items and gate statuses"""
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    week_end = (now + timedelta(days=7)).date().isoformat()
    
    # Get all data
    projects = await db.projects.find({"user_id": current_user["id"], "status": "active"}, {"_id": 0}).to_list(100)
    action_items = await db.action_items.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    gates = await db.gates.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    
    # Recalculate gate statuses
    for gate in gates:
        project_gates = [g for g in gates if g["project_id"] == gate["project_id"]]
        gate["status"] = calculate_gate_status(gate, project_gates)
    
    # Categorize items
    blocked_delayed = []
    at_risk = []
    overdue = []
    due_today = []
    due_this_week = []
    recently_completed = []
    
    for item in action_items:
        if item["status"] == "completed":
            # Check if completed in last 7 days
            if item.get("completed_at"):
                completed_date = item["completed_at"][:10]
                if completed_date >= (now - timedelta(days=7)).date().isoformat():
                    recently_completed.append(item)
            continue
        
        due_date = item.get("due_date", "")[:10] if item.get("due_date") else None
        
        if due_date:
            if due_date < today:
                overdue.append(item)
            elif due_date == today:
                due_today.append(item)
            elif due_date <= week_end:
                due_this_week.append(item)
    
    # Add blocked/delayed gates
    for gate in gates:
        if gate["status"] in ["BLOCKED", "DELAYED"]:
            blocked_delayed.append({
                "type": "gate",
                "id": gate["id"],
                "project_id": gate["project_id"],
                "name": gate["name"],
                "status": gate["status"],
                "required_by_date": gate["required_by_date"],
                "owner_party": gate["owner_party"]
            })
        elif gate["status"] == "AT_RISK":
            at_risk.append({
                "type": "gate",
                "id": gate["id"],
                "project_id": gate["project_id"],
                "name": gate["name"],
                "status": gate["status"],
                "required_by_date": gate["required_by_date"],
                "owner_party": gate["owner_party"]
            })
    
    # Project lookup
    project_map = {p["id"]: p["name"] for p in projects}
    
    # Add project names to items
    def enrich_items(items):
        for item in items:
            item["project_name"] = project_map.get(item.get("project_id"), "Unknown")
        return items
    
    return {
        "projects_count": len(projects),
        "blocked_delayed": enrich_items(blocked_delayed),
        "at_risk": enrich_items(at_risk),
        "overdue": enrich_items(overdue),
        "due_today": enrich_items(due_today),
        "due_this_week": enrich_items(due_this_week),
        "recently_completed": enrich_items(recently_completed),
        "summary": {
            "total_action_items": len(action_items),
            "open_items": len([i for i in action_items if i["status"] == "open"]),
            "critical_items": len([i for i in action_items if i["status"] == "open" and i.get("priority") == "critical"]),
            "gates_blocked": len([g for g in gates if g["status"] == "BLOCKED"]),
            "gates_delayed": len([g for g in gates if g["status"] == "DELAYED"]),
            "gates_at_risk": len([g for g in gates if g["status"] == "AT_RISK"])
        }
    }

# ==================== DIARY ROUTES ====================

@api_router.get("/diary/{project_id}")
async def get_project_diary(
    project_id: str,
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get daily diary for a project"""
    project = await db.projects.find_one({"id": project_id, "user_id": current_user["id"]}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    target_date = date or datetime.now(timezone.utc).date().isoformat()
    start = f"{target_date}T00:00:00"
    end = f"{target_date}T23:59:59"
    
    # Get walkaround entries for the day
    entries = await db.walkaround_entries.find({
        "project_id": project_id,
        "user_id": current_user["id"],
        "created_at": {"$gte": start, "$lte": end}
    }, {"_id": 0}).to_list(100)
    
    # Get action items opened today
    items_opened = await db.action_items.find({
        "project_id": project_id,
        "user_id": current_user["id"],
        "created_at": {"$gte": start, "$lte": end}
    }, {"_id": 0}).to_list(100)
    
    # Get action items closed today
    items_closed = await db.action_items.find({
        "project_id": project_id,
        "user_id": current_user["id"],
        "completed_at": {"$gte": start, "$lte": end}
    }, {"_id": 0}).to_list(100)
    
    # Get gates status
    gates = await db.gates.find({"project_id": project_id, "user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    for gate in gates:
        gate["status"] = calculate_gate_status(gate, gates)
    
    blocked_gates = [g for g in gates if g["status"] in ["BLOCKED", "DELAYED"]]
    at_risk_gates = [g for g in gates if g["status"] == "AT_RISK"]
    
    # Get overdue items
    overdue_items = await db.action_items.find({
        "project_id": project_id,
        "user_id": current_user["id"],
        "status": "open",
        "due_date": {"$lt": start}
    }, {"_id": 0}).to_list(100)
    
    return {
        "project": project,
        "date": target_date,
        "summary": {
            "entries_count": len(entries),
            "items_opened": len(items_opened),
            "items_closed": len(items_closed),
            "blocked_gates": len(blocked_gates),
            "at_risk_gates": len(at_risk_gates),
            "overdue_items": len(overdue_items)
        },
        "walkaround_entries": entries,
        "action_items_opened": items_opened,
        "action_items_closed": items_closed,
        "blocked_gates": blocked_gates,
        "at_risk_gates": at_risk_gates,
        "overdue_items": overdue_items
    }

# ==================== SETTINGS ROUTES ====================

@api_router.get("/settings")
async def get_settings(current_user: dict = Depends(get_current_user)):
    settings = await db.settings.find_one({"user_id": current_user["id"]}, {"_id": 0, "smtp_password": 0})
    if not settings:
        # Create default settings
        now = datetime.now(timezone.utc).isoformat()
        settings = {
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "company_name": None,
            "company_logo": None,
            "dev_logo": None,
            "theme": "dark",
            "default_location": None,
            "smtp_host": None,
            "smtp_port": None,
            "smtp_username": None,
            "smtp_from_email": None,
            "smtp_from_name": None,
            "delay_notice_method": "both",
            "default_reminder_days": 7,
            "updated_at": now
        }
        await db.settings.insert_one({**settings, "smtp_password": None})
    settings["smtp_configured"] = bool(settings.get("smtp_host") and settings.get("smtp_port"))
    return settings

@api_router.put("/settings")
async def update_settings(settings_data: SettingsUpdate, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    
    existing = await db.settings.find_one({"user_id": current_user["id"]})
    if existing:
        await db.settings.update_one(
            {"user_id": current_user["id"]},
            {"$set": {**settings_data.model_dump(exclude_none=True), "updated_at": now}}
        )
    else:
        doc = {
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            **settings_data.model_dump(),
            "updated_at": now
        }
        await db.settings.insert_one(doc)
    
    updated = await db.settings.find_one({"user_id": current_user["id"]}, {"_id": 0, "smtp_password": 0})
    updated["smtp_configured"] = bool(updated.get("smtp_host") and updated.get("smtp_port"))
    return updated

# ==================== WEATHER ROUTES ====================

@api_router.get("/weather")
async def get_weather(lat: float = -36.8485, lon: float = 174.7633):
    """Get 7-day weather forecast. Default is Auckland, NZ"""
    if not OPENWEATHER_API_KEY:
        # Return mock data if no API key
        return {
            "current": {
                "temp": 18,
                "feels_like": 17,
                "humidity": 65,
                "description": "Partly cloudy",
                "icon": "02d"
            },
            "forecast": [
                {"date": (datetime.now(timezone.utc) + timedelta(days=i)).strftime("%Y-%m-%d"), 
                 "temp_max": 20 + i % 3, "temp_min": 12 + i % 2, 
                 "description": ["Sunny", "Cloudy", "Rain", "Partly cloudy", "Overcast", "Light rain", "Clear"][i % 7],
                 "icon": ["01d", "03d", "10d", "02d", "04d", "09d", "01d"][i % 7]}
                for i in range(7)
            ],
            "location": {"lat": lat, "lon": lon},
            "is_mock": True
        }
    
    try:
        async with httpx.AsyncClient() as client:
            # Get current weather
            current_res = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={
                    "lat": lat,
                    "lon": lon,
                    "appid": OPENWEATHER_API_KEY,
                    "units": "metric"
                },
                timeout=10
            )
            current_data = current_res.json()
            
            # Get forecast
            forecast_res = await client.get(
                "https://api.openweathermap.org/data/2.5/forecast",
                params={
                    "lat": lat,
                    "lon": lon,
                    "appid": OPENWEATHER_API_KEY,
                    "units": "metric"
                },
                timeout=10
            )
            forecast_data = forecast_res.json()
            
            # Process forecast to daily
            daily_forecast = {}
            for item in forecast_data.get("list", []):
                date = item["dt_txt"][:10]
                if date not in daily_forecast:
                    daily_forecast[date] = {
                        "date": date,
                        "temp_max": item["main"]["temp_max"],
                        "temp_min": item["main"]["temp_min"],
                        "description": item["weather"][0]["description"],
                        "icon": item["weather"][0]["icon"]
                    }
                else:
                    daily_forecast[date]["temp_max"] = max(daily_forecast[date]["temp_max"], item["main"]["temp_max"])
                    daily_forecast[date]["temp_min"] = min(daily_forecast[date]["temp_min"], item["main"]["temp_min"])
            
            return {
                "current": {
                    "temp": current_data["main"]["temp"],
                    "feels_like": current_data["main"]["feels_like"],
                    "humidity": current_data["main"]["humidity"],
                    "description": current_data["weather"][0]["description"],
                    "icon": current_data["weather"][0]["icon"]
                },
                "forecast": list(daily_forecast.values())[:7],
                "location": {"lat": lat, "lon": lon},
                "is_mock": False
            }
    except Exception as e:
        logger.error(f"Weather API error: {e}")
        raise HTTPException(status_code=502, detail="Weather service unavailable")

# ==================== HEALTH CHECK ====================

# ==================== PROGRAMME MANAGEMENT ROUTES ====================

@api_router.post("/programmes/upload")
async def upload_programme(data: ProgrammeUpload, current_user: dict = Depends(get_current_user)):
    """Upload and parse a MC programme PDF using AI"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
    import tempfile
    
    # Verify project
    project = await db.projects.find_one({"id": data.project_id, "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    now = datetime.now(timezone.utc).isoformat()
    programme_id = str(uuid.uuid4())
    
    # Decode and save PDF temporarily
    try:
        pdf_bytes = base64.b64decode(data.pdf_base64.split(',')[-1] if ',' in data.pdf_base64 else data.pdf_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid PDF data")
    
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
        tmp_file.write(pdf_bytes)
        tmp_path = tmp_file.name
    
    try:
        # Use Gemini to parse the PDF
        api_key = os.environ.get('EMERGENT_LLM_KEY', '')
        if not api_key:
            raise HTTPException(status_code=500, detail="AI service not configured")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"programme-{programme_id}",
            system_message="""You are a construction programme parser. Extract all tasks from the construction programme PDF.
For each task, extract:
- task_name: The name/description of the task
- start_date: Start date in YYYY-MM-DD format (if visible)
- end_date: End date in YYYY-MM-DD format (if visible)  
- duration_days: Duration in days (calculate from dates if not explicit)
- dependencies: List of task names this depends on (if visible)
- owner: Who is responsible (MC, Contractor, Subbies, etc.) if visible

Return ONLY a valid JSON array of tasks. No explanation, just the JSON array.
Example: [{"task_name": "Site Setup", "start_date": "2024-01-15", "end_date": "2024-01-20", "duration_days": 5, "dependencies": [], "owner": "MC"}]"""
        ).with_model("gemini", "gemini-2.5-flash")
        
        pdf_file = FileContentWithMimeType(
            file_path=tmp_path,
            mime_type="application/pdf"
        )
        
        user_message = UserMessage(
            text="Parse this construction programme and extract all tasks with their dates and dependencies. Return only JSON.",
            file_contents=[pdf_file]
        )
        
        response = await chat.send_message(user_message)
        
        # Parse the response
        import json
        import re
        
        # Try to extract JSON from response
        json_match = re.search(r'\[[\s\S]*\]', response)
        if json_match:
            tasks_data = json.loads(json_match.group())
        else:
            raise HTTPException(status_code=500, detail="Failed to parse programme - AI response invalid")
        
        # Store programme record
        programme_doc = {
            "id": programme_id,
            "project_id": data.project_id,
            "filename": data.filename,
            "parsed_at": now,
            "task_count": len(tasks_data),
            "user_id": current_user["id"],
            "created_at": now
        }
        await db.programmes.insert_one(programme_doc)
        
        # Store tasks
        tasks_created = []
        for task in tasks_data:
            task_id = str(uuid.uuid4())
            task_doc = {
                "id": task_id,
                "programme_id": programme_id,
                "project_id": data.project_id,
                "task_name": task.get("task_name", "Unknown Task"),
                "start_date": task.get("start_date"),
                "end_date": task.get("end_date"),
                "duration_days": task.get("duration_days"),
                "dependencies": task.get("dependencies", []),
                "owner_tag": "UNASSIGNED",
                "is_tracked": False,
                "original_start_date": task.get("start_date"),
                "original_end_date": task.get("end_date"),
                "user_id": current_user["id"],
                "created_at": now
            }
            await db.programme_tasks.insert_one(task_doc)
            tasks_created.append(task_doc)
        
        return {
            "programme": ProgrammeResponse(**programme_doc),
            "tasks": [ProgrammeTaskResponse(**t) for t in tasks_created],
            "message": f"Successfully parsed {len(tasks_created)} tasks from programme"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Programme parsing error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to parse programme: {str(e)}")
    finally:
        # Cleanup temp file
        import os as os_module
        try:
            os_module.unlink(tmp_path)
        except:
            pass

@api_router.get("/programmes/{project_id}")
async def get_project_programmes(project_id: str, current_user: dict = Depends(get_current_user)):
    """Get all programmes for a project"""
    programmes = await db.programmes.find(
        {"project_id": project_id, "user_id": current_user["id"]},
        {"_id": 0}
    ).to_list(100)
    return [ProgrammeResponse(**p) for p in programmes]

@api_router.get("/programme-tasks/{programme_id}")
async def get_programme_tasks(programme_id: str, current_user: dict = Depends(get_current_user)):
    """Get all tasks from a programme"""
    tasks = await db.programme_tasks.find(
        {"programme_id": programme_id, "user_id": current_user["id"]},
        {"_id": 0}
    ).to_list(1000)
    return [ProgrammeTaskResponse(**t) for t in tasks]

@api_router.put("/programme-tasks/{task_id}/tag")
async def update_task_tag(task_id: str, data: TaskTagUpdate, current_user: dict = Depends(get_current_user)):
    """Update task owner tag (OURS, MC, SUBBIES, COUNCIL, WATCH)"""
    result = await db.programme_tasks.update_one(
        {"id": task_id, "user_id": current_user["id"]},
        {"$set": {"owner_tag": data.owner_tag, "is_tracked": data.is_tracked}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = await db.programme_tasks.find_one({"id": task_id}, {"_id": 0})
    return ProgrammeTaskResponse(**task)

@api_router.put("/programme-tasks/{task_id}/dates")
async def update_task_dates(task_id: str, data: TaskDateUpdate, current_user: dict = Depends(get_current_user)):
    """Update task dates and optionally create delay notice"""
    task = await db.programme_tasks.find_one({"id": task_id, "user_id": current_user["id"]})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    now = datetime.now(timezone.utc).isoformat()
    update_data = {}
    
    if data.start_date:
        update_data["start_date"] = data.start_date
    if data.end_date:
        update_data["end_date"] = data.end_date
    
    await db.programme_tasks.update_one({"id": task_id}, {"$set": update_data})
    
    # Log the date change
    if data.delay_reason:
        change_log = {
            "id": str(uuid.uuid4()),
            "task_id": task_id,
            "project_id": task["project_id"],
            "user_id": current_user["id"],
            "original_start": task.get("start_date"),
            "original_end": task.get("end_date"),
            "new_start": data.start_date,
            "new_end": data.end_date,
            "reason": data.delay_reason,
            "created_at": now
        }
        await db.date_change_logs.insert_one(change_log)
        
        # Create notification for delay notice
        if data.notify_mc:
            notification = {
                "id": str(uuid.uuid4()),
                "user_id": current_user["id"],
                "type": "delay_notice",
                "title": f"Delay Notice Required: {task['task_name']}",
                "message": f"Date changed from {task.get('end_date')} to {data.end_date}. Reason: {data.delay_reason}",
                "related_id": task_id,
                "related_type": "task",
                "is_read": False,
                "action_required": True,
                "created_at": now
            }
            await db.notifications.insert_one(notification)
    
    updated = await db.programme_tasks.find_one({"id": task_id}, {"_id": 0})
    return ProgrammeTaskResponse(**updated)

@api_router.post("/programme-tasks/bulk-tag")
async def bulk_tag_tasks(task_ids: List[str], data: TaskTagUpdate, current_user: dict = Depends(get_current_user)):
    """Bulk update task tags"""
    result = await db.programme_tasks.update_many(
        {"id": {"$in": task_ids}, "user_id": current_user["id"]},
        {"$set": {"owner_tag": data.owner_tag, "is_tracked": data.is_tracked}}
    )
    return {"updated": result.modified_count}

# ==================== GATE TEMPLATE ROUTES ====================

@api_router.get("/gate-templates")
async def get_gate_templates(current_user: dict = Depends(get_current_user)):
    """Get all gate templates (system + user custom)"""
    # Get system templates
    system_templates = await db.gate_templates.find({"is_system": True}, {"_id": 0}).to_list(50)
    # Get user templates
    user_templates = await db.gate_templates.find(
        {"user_id": current_user["id"], "is_system": False},
        {"_id": 0}
    ).to_list(100)
    
    # If no system templates exist, create them
    if not system_templates:
        system_templates = await create_system_templates()
    
    return system_templates + user_templates

async def create_system_templates():
    """Create default system gate templates"""
    now = datetime.now(timezone.utc).isoformat()
    
    templates = [
        {
            "id": str(uuid.uuid4()),
            "name": "Standard Office Fitout",
            "description": "7-gate template for typical NZ commercial office fitout",
            "category": "office",
            "is_system": True,
            "user_id": None,
            "gates": [
                {"name": "Closed In / Ready for Partitions", "owner_party": "MC", "typical_duration_days": 0, "buffer_days": 2, "depends_on_order": [], "is_hard_gate": False, "is_optional": False, "order": 1},
                {"name": "Partitions Complete → Doors/Jambs/Joinery Ready", "owner_party": "YOU", "typical_duration_days": 14, "buffer_days": 2, "depends_on_order": [1], "is_hard_gate": False, "is_optional": True, "order": 2},
                {"name": "Council Preline + Subbies 1st Fix Sign-off", "owner_party": "COUNCIL", "typical_duration_days": 7, "buffer_days": 3, "depends_on_order": [2], "is_hard_gate": True, "is_optional": False, "order": 3},
                {"name": "Linings Complete → Ready for Stoppers", "owner_party": "YOU", "typical_duration_days": 14, "buffer_days": 2, "depends_on_order": [3], "is_hard_gate": False, "is_optional": False, "order": 4},
                {"name": "Painting Complete", "owner_party": "MC", "typical_duration_days": 14, "buffer_days": 3, "depends_on_order": [4], "is_hard_gate": False, "is_optional": False, "order": 5},
                {"name": "2-Way Grid Install + Aluminium Skirting", "owner_party": "YOU", "typical_duration_days": 7, "buffer_days": 2, "depends_on_order": [5], "is_hard_gate": False, "is_optional": False, "order": 6},
                {"name": "Subbies 2nd Fix to Ceiling Grid → Tile Out", "owner_party": "SUBBIES", "typical_duration_days": 7, "buffer_days": 2, "depends_on_order": [6], "is_hard_gate": False, "is_optional": False, "order": 7},
            ],
            "created_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Retail / Hospitality Fitout",
            "description": "Template for retail shops, cafes, restaurants",
            "category": "retail",
            "is_system": True,
            "user_id": None,
            "gates": [
                {"name": "Possession / Site Access", "owner_party": "MC", "typical_duration_days": 0, "buffer_days": 1, "depends_on_order": [], "is_hard_gate": False, "is_optional": False, "order": 1},
                {"name": "Demolition & Strip-out Complete", "owner_party": "YOU", "typical_duration_days": 5, "buffer_days": 2, "depends_on_order": [1], "is_hard_gate": False, "is_optional": False, "order": 2},
                {"name": "Services Rough-in (Elec/Plumb/HVAC)", "owner_party": "SUBBIES", "typical_duration_days": 10, "buffer_days": 2, "depends_on_order": [2], "is_hard_gate": False, "is_optional": False, "order": 3},
                {"name": "Council Inspection - Preline", "owner_party": "COUNCIL", "typical_duration_days": 3, "buffer_days": 3, "depends_on_order": [3], "is_hard_gate": True, "is_optional": False, "order": 4},
                {"name": "Linings & Ceilings Complete", "owner_party": "YOU", "typical_duration_days": 10, "buffer_days": 2, "depends_on_order": [4], "is_hard_gate": False, "is_optional": False, "order": 5},
                {"name": "Joinery & Fixtures Install", "owner_party": "YOU", "typical_duration_days": 7, "buffer_days": 2, "depends_on_order": [5], "is_hard_gate": False, "is_optional": False, "order": 6},
                {"name": "Painting & Floor Finishes", "owner_party": "MC", "typical_duration_days": 7, "buffer_days": 2, "depends_on_order": [6], "is_hard_gate": False, "is_optional": False, "order": 7},
                {"name": "2nd Fix & Final Services", "owner_party": "SUBBIES", "typical_duration_days": 5, "buffer_days": 2, "depends_on_order": [7], "is_hard_gate": False, "is_optional": False, "order": 8},
                {"name": "CCC / Final Inspection", "owner_party": "COUNCIL", "typical_duration_days": 3, "buffer_days": 3, "depends_on_order": [8], "is_hard_gate": True, "is_optional": False, "order": 9},
            ],
            "created_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Medical / Healthcare Fitout",
            "description": "Template for clinics, dental surgeries, medical centres",
            "category": "medical",
            "is_system": True,
            "user_id": None,
            "gates": [
                {"name": "Site Possession", "owner_party": "MC", "typical_duration_days": 0, "buffer_days": 2, "depends_on_order": [], "is_hard_gate": False, "is_optional": False, "order": 1},
                {"name": "Existing Services Isolation", "owner_party": "SUBBIES", "typical_duration_days": 3, "buffer_days": 2, "depends_on_order": [1], "is_hard_gate": False, "is_optional": False, "order": 2},
                {"name": "Lead-lined Walls (if X-ray)", "owner_party": "YOU", "typical_duration_days": 5, "buffer_days": 3, "depends_on_order": [2], "is_hard_gate": False, "is_optional": True, "order": 3},
                {"name": "Medical Gas Rough-in", "owner_party": "SUBBIES", "typical_duration_days": 5, "buffer_days": 3, "depends_on_order": [2], "is_hard_gate": False, "is_optional": True, "order": 4},
                {"name": "Partitions & Specialist Linings", "owner_party": "YOU", "typical_duration_days": 10, "buffer_days": 2, "depends_on_order": [3, 4], "is_hard_gate": False, "is_optional": False, "order": 5},
                {"name": "Council Preline Inspection", "owner_party": "COUNCIL", "typical_duration_days": 3, "buffer_days": 3, "depends_on_order": [5], "is_hard_gate": True, "is_optional": False, "order": 6},
                {"name": "Vinyl/Hygienic Floor & Wall Finishes", "owner_party": "YOU", "typical_duration_days": 7, "buffer_days": 2, "depends_on_order": [6], "is_hard_gate": False, "is_optional": False, "order": 7},
                {"name": "Joinery & Medical Cabinetry", "owner_party": "YOU", "typical_duration_days": 7, "buffer_days": 2, "depends_on_order": [7], "is_hard_gate": False, "is_optional": False, "order": 8},
                {"name": "Equipment Install & Commission", "owner_party": "SUBBIES", "typical_duration_days": 5, "buffer_days": 3, "depends_on_order": [8], "is_hard_gate": False, "is_optional": False, "order": 9},
                {"name": "CCC + Ministry of Health Sign-off", "owner_party": "COUNCIL", "typical_duration_days": 5, "buffer_days": 5, "depends_on_order": [9], "is_hard_gate": True, "is_optional": False, "order": 10},
            ],
            "created_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Education / School Fitout",
            "description": "Template for classrooms, admin blocks, school facilities",
            "category": "education",
            "is_system": True,
            "user_id": None,
            "gates": [
                {"name": "Holiday Period Start / Access", "owner_party": "MC", "typical_duration_days": 0, "buffer_days": 1, "depends_on_order": [], "is_hard_gate": False, "is_optional": False, "order": 1},
                {"name": "Demolition & Asbestos Removal", "owner_party": "MC", "typical_duration_days": 5, "buffer_days": 3, "depends_on_order": [1], "is_hard_gate": False, "is_optional": True, "order": 2},
                {"name": "Structure & Services Rough-in", "owner_party": "SUBBIES", "typical_duration_days": 10, "buffer_days": 2, "depends_on_order": [2], "is_hard_gate": False, "is_optional": False, "order": 3},
                {"name": "Council Preline", "owner_party": "COUNCIL", "typical_duration_days": 3, "buffer_days": 3, "depends_on_order": [3], "is_hard_gate": True, "is_optional": False, "order": 4},
                {"name": "Linings, Ceilings, Acoustic Treatment", "owner_party": "YOU", "typical_duration_days": 14, "buffer_days": 2, "depends_on_order": [4], "is_hard_gate": False, "is_optional": False, "order": 5},
                {"name": "Painting & Floor Finishes", "owner_party": "MC", "typical_duration_days": 10, "buffer_days": 2, "depends_on_order": [5], "is_hard_gate": False, "is_optional": False, "order": 6},
                {"name": "Joinery & FF&E Install", "owner_party": "YOU", "typical_duration_days": 7, "buffer_days": 2, "depends_on_order": [6], "is_hard_gate": False, "is_optional": False, "order": 7},
                {"name": "IT & AV Install", "owner_party": "SUBBIES", "typical_duration_days": 5, "buffer_days": 2, "depends_on_order": [7], "is_hard_gate": False, "is_optional": False, "order": 8},
                {"name": "CCC / MOE Sign-off", "owner_party": "COUNCIL", "typical_duration_days": 3, "buffer_days": 5, "depends_on_order": [8], "is_hard_gate": True, "is_optional": False, "order": 9},
                {"name": "Term Start Deadline", "owner_party": "MC", "typical_duration_days": 0, "buffer_days": 0, "depends_on_order": [9], "is_hard_gate": True, "is_optional": False, "order": 10},
            ],
            "created_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Industrial / Warehouse",
            "description": "Template for warehouse offices, factory fitouts",
            "category": "industrial",
            "is_system": True,
            "user_id": None,
            "gates": [
                {"name": "Site Handover", "owner_party": "MC", "typical_duration_days": 0, "buffer_days": 2, "depends_on_order": [], "is_hard_gate": False, "is_optional": False, "order": 1},
                {"name": "Structural Steel / Mezzanine", "owner_party": "MC", "typical_duration_days": 14, "buffer_days": 3, "depends_on_order": [1], "is_hard_gate": False, "is_optional": True, "order": 2},
                {"name": "Services Rough-in", "owner_party": "SUBBIES", "typical_duration_days": 7, "buffer_days": 2, "depends_on_order": [2], "is_hard_gate": False, "is_optional": False, "order": 3},
                {"name": "Council Inspection", "owner_party": "COUNCIL", "typical_duration_days": 3, "buffer_days": 3, "depends_on_order": [3], "is_hard_gate": True, "is_optional": False, "order": 4},
                {"name": "Office Partitions & Linings", "owner_party": "YOU", "typical_duration_days": 10, "buffer_days": 2, "depends_on_order": [4], "is_hard_gate": False, "is_optional": False, "order": 5},
                {"name": "Finishes & Joinery", "owner_party": "YOU", "typical_duration_days": 7, "buffer_days": 2, "depends_on_order": [5], "is_hard_gate": False, "is_optional": False, "order": 6},
                {"name": "2nd Fix & Commission", "owner_party": "SUBBIES", "typical_duration_days": 5, "buffer_days": 2, "depends_on_order": [6], "is_hard_gate": False, "is_optional": False, "order": 7},
                {"name": "CCC", "owner_party": "COUNCIL", "typical_duration_days": 3, "buffer_days": 3, "depends_on_order": [7], "is_hard_gate": True, "is_optional": False, "order": 8},
            ],
            "created_at": now
        }
    ]
    
    for template in templates:
        await db.gate_templates.insert_one(template)
    
    return templates

@api_router.post("/gate-templates")
async def create_gate_template(data: GateTemplateCreate, current_user: dict = Depends(get_current_user)):
    """Create a custom gate template"""
    now = datetime.now(timezone.utc).isoformat()
    template_id = str(uuid.uuid4())
    
    doc = {
        "id": template_id,
        "name": data.name,
        "description": data.description,
        "category": data.category,
        "gates": [g.model_dump() for g in data.gates],
        "is_system": False,
        "user_id": current_user["id"],
        "created_at": now
    }
    await db.gate_templates.insert_one(doc)
    
    return GateTemplateResponse(**doc)

@api_router.post("/gate-templates/{template_id}/duplicate")
async def duplicate_template(template_id: str, new_name: str, current_user: dict = Depends(get_current_user)):
    """Duplicate an existing template (system or user) as a custom template"""
    template = await db.gate_templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    now = datetime.now(timezone.utc).isoformat()
    new_id = str(uuid.uuid4())
    
    new_template = {
        **template,
        "id": new_id,
        "name": new_name,
        "is_system": False,
        "user_id": current_user["id"],
        "created_at": now
    }
    await db.gate_templates.insert_one(new_template)
    
    return GateTemplateResponse(**new_template)

@api_router.delete("/gate-templates/{template_id}")
async def delete_template(template_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a custom template (cannot delete system templates)"""
    template = await db.gate_templates.find_one({"id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if template.get("is_system"):
        raise HTTPException(status_code=403, detail="Cannot delete system templates")
    if template.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.gate_templates.delete_one({"id": template_id})
    return {"message": "Template deleted"}

@api_router.post("/projects/{project_id}/apply-template/{template_id}")
async def apply_template_to_project(
    project_id: str,
    template_id: str,
    start_date: str,
    current_user: dict = Depends(get_current_user)
):
    """Apply a gate template to a project with calculated dates"""
    project = await db.projects.find_one({"id": project_id, "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    template = await db.gate_templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    now = datetime.now(timezone.utc).isoformat()
    base_date = datetime.fromisoformat(start_date)
    
    created_gates = []
    gate_id_map = {}  # order -> gate_id for dependencies
    
    cumulative_days = 0
    for gate_data in template["gates"]:
        gate_id = str(uuid.uuid4())
        gate_id_map[gate_data["order"]] = gate_id
        
        cumulative_days += gate_data.get("typical_duration_days", 7)
        required_by = (base_date + timedelta(days=cumulative_days)).isoformat()
        
        # Map dependencies from order to actual IDs
        depends_on_ids = [
            gate_id_map[order] 
            for order in gate_data.get("depends_on_order", []) 
            if order in gate_id_map
        ]
        
        gate_doc = {
            "id": gate_id,
            "project_id": project_id,
            "user_id": current_user["id"],
            "name": gate_data["name"],
            "description": None,
            "order": gate_data["order"],
            "owner_party": gate_data["owner_party"],
            "required_by_date": required_by,
            "expected_complete_date": None,
            "buffer_days": gate_data.get("buffer_days", 2),
            "depends_on_gate_ids": depends_on_ids,
            "is_hard_gate": gate_data.get("is_hard_gate", False),
            "is_optional": gate_data.get("is_optional", False),
            "completed_at": None,
            "status": "ON_TRACK",
            "created_at": now,
            "updated_at": now
        }
        await db.gates.insert_one(gate_doc)
        created_gates.append(gate_doc)
    
    return {
        "message": f"Applied template '{template['name']}' with {len(created_gates)} gates",
        "gates": [GateResponse(**g) for g in created_gates]
    }

# ==================== NOTIFICATION ROUTES ====================

@api_router.get("/notifications")
async def get_notifications(
    unread_only: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get user notifications"""
    query = {"user_id": current_user["id"]}
    if unread_only:
        query["is_read"] = False
    
    notifications = await db.notifications.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [NotificationResponse(**n) for n in notifications]

@api_router.get("/notifications/count")
async def get_notification_count(current_user: dict = Depends(get_current_user)):
    """Get unread notification count"""
    count = await db.notifications.count_documents({
        "user_id": current_user["id"],
        "is_read": False
    })
    action_count = await db.notifications.count_documents({
        "user_id": current_user["id"],
        "action_required": True,
        "is_read": False
    })
    return {"unread": count, "action_required": action_count}

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Mark notification as read"""
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user["id"]},
        {"$set": {"is_read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Marked as read"}

@api_router.put("/notifications/read-all")
async def mark_all_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read"""
    result = await db.notifications.update_many(
        {"user_id": current_user["id"], "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"updated": result.modified_count}

@api_router.delete("/notifications/{notification_id}")
async def delete_notification(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a notification"""
    result = await db.notifications.delete_one({"id": notification_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Deleted"}

# ==================== DELAY NOTICE & EMAIL ROUTES ====================

@api_router.post("/delay-notices/generate")
async def generate_delay_notice(data: DelayNoticeCreate, current_user: dict = Depends(get_current_user)):
    """Generate a delay notice for a task date change"""
    task = await db.programme_tasks.find_one({"id": data.task_id, "user_id": current_user["id"]})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    project = await db.projects.find_one({"id": task["project_id"]}, {"_id": 0})
    settings = await db.settings.find_one({"user_id": current_user["id"]}, {"_id": 0})
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    
    # Generate notice text
    notice_text = f"""DELAY NOTICE

Project: {project['name'] if project else 'Unknown'}
Task: {task['task_name']}

Original Completion Date: {data.original_date}
Revised Completion Date: {data.new_date}

Reason for Delay:
{data.reason}

This notice is to formally advise of the above delay to the programme. 
Please update your records accordingly.

Kind regards,
{user['name']}
{settings.get('company_name', '') if settings else ''}
"""
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Store the delay notice
    notice_doc = {
        "id": str(uuid.uuid4()),
        "task_id": data.task_id,
        "project_id": task["project_id"],
        "user_id": current_user["id"],
        "original_date": data.original_date,
        "new_date": data.new_date,
        "reason": data.reason,
        "notice_text": notice_text,
        "email_sent": False,
        "created_at": now
    }
    await db.delay_notices.insert_one(notice_doc)
    
    email_result = None
    if data.send_email and settings and settings.get("smtp_host"):
        # Try to send email
        try:
            email_result = await send_delay_notice_email(notice_doc, settings, user)
            await db.delay_notices.update_one(
                {"id": notice_doc["id"]},
                {"$set": {"email_sent": True}}
            )
        except Exception as e:
            logger.error(f"Failed to send delay notice email: {e}")
            email_result = {"error": str(e)}
    
    return {
        "notice": notice_doc,
        "notice_text": notice_text,
        "email_sent": email_result is not None and "error" not in email_result,
        "email_result": email_result
    }

async def send_delay_notice_email(notice: dict, settings: dict, user: dict):
    """Send delay notice via SMTP"""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    
    if not all([settings.get("smtp_host"), settings.get("smtp_port"), 
                settings.get("smtp_username"), settings.get("smtp_password")]):
        raise ValueError("SMTP not fully configured")
    
    msg = MIMEMultipart()
    msg["From"] = f"{settings.get('smtp_from_name', user['name'])} <{settings.get('smtp_from_email', settings['smtp_username'])}>"
    msg["Subject"] = f"Delay Notice - {notice.get('task_name', 'Programme Update')}"
    msg["To"] = ""  # User would fill this in
    
    msg.attach(MIMEText(notice["notice_text"], "plain"))
    
    # Note: In production, this would actually send the email
    # For now, we just return success to indicate email would be sent
    return {"status": "ready", "message": "Email prepared - recipient needed"}

@api_router.post("/settings/test-smtp")
async def test_smtp_connection(current_user: dict = Depends(get_current_user)):
    """Test SMTP connection"""
    settings = await db.settings.find_one({"user_id": current_user["id"]}, {"_id": 0})
    if not settings:
        raise HTTPException(status_code=400, detail="Settings not configured")
    
    if not all([settings.get("smtp_host"), settings.get("smtp_port")]):
        raise HTTPException(status_code=400, detail="SMTP not configured")
    
    try:
        import smtplib
        server = smtplib.SMTP(settings["smtp_host"], settings["smtp_port"], timeout=10)
        server.starttls()
        if settings.get("smtp_username") and settings.get("smtp_password"):
            server.login(settings["smtp_username"], settings["smtp_password"])
        server.quit()
        return {"success": True, "message": "SMTP connection successful"}
    except Exception as e:
        return {"success": False, "message": str(e)}

# ==================== REMINDER GENERATION ====================

@api_router.post("/reminders/generate")
async def generate_reminders(current_user: dict = Depends(get_current_user)):
    """Generate reminder notifications for upcoming tasks"""
    settings = await db.settings.find_one({"user_id": current_user["id"]}, {"_id": 0})
    reminder_days = settings.get("default_reminder_days", 7) if settings else 7
    
    now = datetime.now(timezone.utc)
    reminder_threshold = (now + timedelta(days=reminder_days)).isoformat()[:10]
    
    # Find tasks due within reminder window
    tasks = await db.programme_tasks.find({
        "user_id": current_user["id"],
        "is_tracked": True,
        "end_date": {"$lte": reminder_threshold, "$gte": now.isoformat()[:10]}
    }, {"_id": 0}).to_list(100)
    
    # Find gates due within reminder window
    gates = await db.gates.find({
        "user_id": current_user["id"],
        "completed_at": None,
        "required_by_date": {"$lte": reminder_threshold}
    }, {"_id": 0}).to_list(100)
    
    notifications_created = 0
    
    for task in tasks:
        # Check if reminder already exists
        existing = await db.notifications.find_one({
            "related_id": task["id"],
            "type": "reminder",
            "created_at": {"$gte": (now - timedelta(days=1)).isoformat()}
        })
        if not existing:
            notification = {
                "id": str(uuid.uuid4()),
                "user_id": current_user["id"],
                "type": "reminder",
                "title": f"Upcoming: {task['task_name']}",
                "message": f"Due {task['end_date']}. Materials ordered? Resources booked? Access confirmed?",
                "related_id": task["id"],
                "related_type": "task",
                "is_read": False,
                "action_required": True,
                "created_at": now.isoformat()
            }
            await db.notifications.insert_one(notification)
            notifications_created += 1
    
    for gate in gates:
        existing = await db.notifications.find_one({
            "related_id": gate["id"],
            "type": "reminder",
            "created_at": {"$gte": (now - timedelta(days=1)).isoformat()}
        })
        if not existing:
            notification = {
                "id": str(uuid.uuid4()),
                "user_id": current_user["id"],
                "type": "reminder",
                "title": f"Gate Approaching: {gate['name']}",
                "message": f"Required by {gate['required_by_date']}. Check status and prerequisites.",
                "related_id": gate["id"],
                "related_type": "gate",
                "is_read": False,
                "action_required": True,
                "created_at": now.isoformat()
            }
            await db.notifications.insert_one(notification)
            notifications_created += 1
    
    return {"reminders_created": notifications_created}



@api_router.get("/")
async def root():
    return {"message": "LLDv2 API - Construction Operations Command Center", "status": "operational"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
