import requests
import sys
import json
from datetime import datetime, timedelta

class LLDv2APITester:
    def __init__(self, base_url="https://site-command-12.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.test_user_email = f"test_{datetime.now().strftime('%H%M%S')}@lldv2.com"
        self.test_password = "TestPass123!"
        self.test_name = "Test User LLDv2"
        self.test_company = "Test Construction Co"
        self.created_project_id = None
        self.created_gate_id = None
        self.created_action_item_id = None
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, auth_required=True):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   {method} {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ PASS - Status: {response.status_code}")
                try:
                    json_response = response.json()
                    if 'message' in json_response:
                        print(f"   Message: {json_response['message']}")
                    return True, json_response
                except:
                    return True, {}
            else:
                print(f"❌ FAIL - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json().get('detail', 'No error detail')
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text[:200]}")
                return False, {}

        except Exception as e:
            print(f"❌ FAIL - Network Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test basic API health"""
        return self.run_test("Health Check", "GET", "", 200, auth_required=False)

    def test_register(self):
        """Test user registration"""
        data = {
            "email": self.test_user_email,
            "password": self.test_password,
            "name": self.test_name,
            "company": self.test_company
        }
        success, response = self.run_test("User Registration", "POST", "auth/register", 200, data, auth_required=False)
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            print(f"   🔑 Token received: {self.token[:20]}...")
            return True
        return False

    def test_login(self):
        """Test user login"""
        data = {
            "email": self.test_user_email,
            "password": self.test_password
        }
        success, response = self.run_test("User Login", "POST", "auth/login", 200, data, auth_required=False)
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            print(f"   🔑 Login successful: {response['user']['name']}")
            return True
        return False

    def test_get_me(self):
        """Test get current user"""
        return self.run_test("Get Current User", "GET", "auth/me", 200)

    def test_create_project(self):
        """Test project creation"""
        data = {
            "name": "Test Fitout Project",
            "description": "Test commercial interior fitout",
            "client_name": "Test Client Ltd",
            "location": "Auckland CBD",
            "status": "active"
        }
        success, response = self.run_test("Create Project", "POST", "projects", 200, data)
        if success and 'id' in response:
            self.created_project_id = response['id']
            print(f"   📁 Project created: {response['name']} ({response['id']})")
            return True
        return False

    def test_get_projects(self):
        """Test get all projects"""
        return self.run_test("Get Projects", "GET", "projects", 200)

    def test_create_default_gates(self):
        """Test creating default gates template for project"""
        if not self.created_project_id:
            print("❌ SKIP - No project ID available for default gates")
            return False
        success, response = self.run_test("Create Default Gates", "POST", f"projects/{self.created_project_id}/gates/template", 200)
        return success

    def test_get_gates(self):
        """Test get gates"""
        return self.run_test("Get Gates", "GET", "gates", 200)

    def test_create_gate(self):
        """Test manual gate creation"""
        if not self.created_project_id:
            print("❌ SKIP - No project ID available for gate creation")
            return False
        
        future_date = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
        data = {
            "project_id": self.created_project_id,
            "name": "Test Custom Gate",
            "description": "Custom test gate",
            "order": 10,
            "owner_party": "YOU",
            "required_by_date": future_date,
            "buffer_days": 3,
            "is_hard_gate": False,
            "is_optional": False
        }
        success, response = self.run_test("Create Custom Gate", "POST", "gates", 200, data)
        if success and 'id' in response:
            self.created_gate_id = response['id']
            print(f"   🎯 Gate created: {response['name']} ({response['id']})")
            return True
        return False

    def test_complete_gate(self):
        """Test gate completion"""
        if not self.created_gate_id:
            print("❌ SKIP - No gate ID available for completion")
            return False
        return self.run_test("Complete Gate", "POST", f"gates/{self.created_gate_id}/complete", 200)

    def test_reopen_gate(self):
        """Test gate reopening"""
        if not self.created_gate_id:
            print("❌ SKIP - No gate ID available for reopening")
            return False
        return self.run_test("Reopen Gate", "POST", f"gates/{self.created_gate_id}/reopen", 200)

    def test_create_action_item(self):
        """Test action item creation"""
        if not self.created_project_id:
            print("❌ SKIP - No project ID available for action item")
            return False
        
        due_date = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
        data = {
            "project_id": self.created_project_id,
            "title": "Test Action Item",
            "description": "Test action item description",
            "priority": "high",
            "due_date": due_date,
            "owner": "Test Owner"
        }
        success, response = self.run_test("Create Action Item", "POST", "action-items", 200, data)
        if success and 'id' in response:
            self.created_action_item_id = response['id']
            print(f"   📋 Action item created: {response['title']} ({response['id']})")
            return True
        return False

    def test_get_action_items(self):
        """Test get action items"""
        return self.run_test("Get Action Items", "GET", "action-items", 200)

    def test_complete_action_item(self):
        """Test action item completion"""
        if not self.created_action_item_id:
            print("❌ SKIP - No action item ID available for completion")
            return False
        return self.run_test("Complete Action Item", "POST", f"action-items/{self.created_action_item_id}/complete", 200)

    def test_reopen_action_item(self):
        """Test action item reopening"""
        if not self.created_action_item_id:
            print("❌ SKIP - No action item ID available for reopening")
            return False
        return self.run_test("Reopen Action Item", "POST", f"action-items/{self.created_action_item_id}/reopen", 200)

    def test_create_walkaround_entry(self):
        """Test walkaround entry creation"""
        if not self.created_project_id:
            print("❌ SKIP - No project ID available for walkaround")
            return False
        
        data = {
            "project_id": self.created_project_id,
            "note": "Test walkaround observation - ceiling tiles need attention",
            "priority": "medium",
            "owner": "Site Manager",
            "create_action_item": True
        }
        success, response = self.run_test("Create Walkaround Entry", "POST", "walkaround", 200, data)
        return success

    def test_get_walkaround_entries(self):
        """Test get walkaround entries"""
        return self.run_test("Get Walkaround Entries", "GET", "walkaround", 200)

    def test_dashboard_summary(self):
        """Test dashboard summary API"""
        success, response = self.run_test("Dashboard Summary", "GET", "dashboard/summary", 200)
        if success:
            print(f"   📊 Dashboard loaded: {response.get('projects_count', 0)} projects")
        return success

    def test_diary_page(self):
        """Test diary API"""
        if not self.created_project_id:
            print("❌ SKIP - No project ID available for diary")
            return False
        
        today = datetime.now().strftime('%Y-%m-%d')
        return self.run_test("Project Diary", "GET", f"diary/{self.created_project_id}?date={today}", 200)

    def test_weather_api(self):
        """Test weather API (should return mock data)"""
        success, response = self.run_test("Weather API", "GET", "weather", 200, auth_required=False)
        if success and 'is_mock' in response:
            print(f"   🌤️  Weather API returned mock data: {response.get('is_mock', False)}")
        return success

    def test_settings_api(self):
        """Test settings API"""
        # Get settings
        success, response = self.run_test("Get Settings", "GET", "settings", 200)
        if not success:
            return False
        
        # Update settings including SMTP configuration
        data = {
            "company_name": "Updated Test Company",
            "theme": "dark",
            "default_location": "Auckland, NZ",
            "smtp_host": "smtp.test.com",
            "smtp_port": 587,
            "smtp_username": "test@test.com",
            "smtp_from_email": "noreply@test.com",
            "smtp_from_name": "Test LLDv2",
            "delay_notice_method": "both",
            "default_reminder_days": 5
        }
        return self.run_test("Update Settings", "PUT", "settings", 200, data)

    def test_gate_templates_api(self):
        """Test gate templates API"""
        # Get gate templates (should return system templates)
        success, response = self.run_test("Get Gate Templates", "GET", "gate-templates", 200)
        if success and isinstance(response, list):
            print(f"   🎯 Gate templates found: {len(response)} templates")
            # Look for system templates
            system_templates = [t for t in response if t.get('is_system', False)]
            print(f"   🏢 System templates: {len(system_templates)}")
            return len(response) > 0
        return success

    def test_apply_gate_template(self):
        """Test applying gate template to project"""
        if not self.created_project_id:
            print("❌ SKIP - No project ID available for gate template application")
            return False
            
        # First get available templates
        success, templates = self.run_test("Get Templates for Apply", "GET", "gate-templates", 200)
        if not success or not templates:
            print("❌ SKIP - No templates available")
            return False
            
        # Use first available template
        template_id = templates[0]['id']
        template_name = templates[0]['name']
        future_date = (datetime.now() + timedelta(days=14)).strftime('%Y-%m-%d')
        
        success, response = self.run_test(
            f"Apply Gate Template ({template_name})", 
            "POST", 
            f"projects/{self.created_project_id}/apply-template/{template_id}?start_date={future_date}", 
            200
        )
        if success:
            gates_created = response.get('gates_created', 0)
            print(f"   🎯 Applied template created {gates_created} gates")
        return success

    def test_notifications_api(self):
        """Test notifications API"""
        # Get notification count
        success, response = self.run_test("Get Notification Count", "GET", "notifications/count", 200)
        if success:
            unread_count = response.get('unread', 0)
            total_count = response.get('total', 0)
            print(f"   🔔 Notifications: {unread_count} unread, {total_count} total")
        
        # Get all notifications
        success2, response2 = self.run_test("Get All Notifications", "GET", "notifications", 200)
        return success and success2

    def test_reminders_api(self):
        """Test reminders generation API"""
        success, response = self.run_test("Generate Reminders", "POST", "reminders/generate", 200)
        if success:
            reminders_created = response.get('reminders_created', 0)
            print(f"   ⏰ Generated {reminders_created} reminders")
        return success

    def test_programme_api(self):
        """Test programme management API (without PDF upload)"""
        if not self.created_project_id:
            print("❌ SKIP - No project ID available for programme test")
            return False
        
        # Get programmes for project (should be empty initially)
        success, response = self.run_test("Get Project Programmes", "GET", f"programmes/{self.created_project_id}", 200)
        if success:
            programmes_count = len(response) if isinstance(response, list) else 0
            print(f"   📋 Project has {programmes_count} programmes")
        return success

def main():
    print("🚀 Starting LLDv2 Construction Site Diary API Tests")
    print("=" * 60)
    
    tester = LLDv2APITester()
    
    # Test sequence - following typical user flow
    tests = [
        # Basic connectivity
        ("Health Check", tester.test_health_check),
        
        # Authentication flow
        ("User Registration", tester.test_register),
        ("User Login", tester.test_login),
        ("Get Current User", tester.test_get_me),
        
        # Project management
        ("Create Project", tester.test_create_project),
        ("Get Projects", tester.test_get_projects),
        ("Create Default Gates Template", tester.test_create_default_gates),
        
        # NEW FEATURE: Gate Templates
        ("Get Gate Templates", tester.test_gate_templates_api),
        ("Apply Gate Template to Project", tester.test_apply_gate_template),
        
        # Gates management
        ("Get Gates", tester.test_get_gates),
        ("Create Custom Gate", tester.test_create_gate),
        ("Complete Gate", tester.test_complete_gate),
        ("Reopen Gate", tester.test_reopen_gate),
        
        # Action Items management
        ("Create Action Item", tester.test_create_action_item),
        ("Get Action Items", tester.test_get_action_items),
        ("Complete Action Item", tester.test_complete_action_item),
        ("Reopen Action Item", tester.test_reopen_action_item),
        
        # Walkaround functionality
        ("Create Walkaround Entry", tester.test_create_walkaround_entry),
        ("Get Walkaround Entries", tester.test_get_walkaround_entries),
        
        # Dashboard and reporting
        ("Dashboard Summary", tester.test_dashboard_summary),
        ("Project Diary", tester.test_diary_page),
        
        # NEW FEATURES: Programme Management
        ("Programme API", tester.test_programme_api),
        
        # NEW FEATURES: Notifications & Reminders
        ("Notifications API", tester.test_notifications_api),
        ("Reminders API", tester.test_reminders_api),
        
        # Additional APIs (including SMTP settings)
        ("Weather API", tester.test_weather_api),
        ("Settings API (including SMTP)", tester.test_settings_api),
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        try:
            success = test_func()
            if not success:
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ FAIL - {test_name}: {str(e)}")
            failed_tests.append(test_name)
            tester.tests_run += 1
    
    # Print results
    print("\n" + "=" * 60)
    print("🎯 API TEST RESULTS")
    print("=" * 60)
    print(f"📊 Tests Run: {tester.tests_run}")
    print(f"✅ Tests Passed: {tester.tests_passed}")
    print(f"❌ Tests Failed: {len(failed_tests)}")
    print(f"📈 Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if failed_tests:
        print(f"\n❌ Failed Tests:")
        for test in failed_tests:
            print(f"   • {test}")
    else:
        print(f"\n🎉 All API tests passed!")
    
    print(f"\n📝 Test Data Created:")
    print(f"   • User: {tester.test_user_email}")
    print(f"   • Project ID: {tester.created_project_id}")
    print(f"   • Gate ID: {tester.created_gate_id}")
    print(f"   • Action Item ID: {tester.created_action_item_id}")
    
    return 0 if len(failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())