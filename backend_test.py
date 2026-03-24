#!/usr/bin/env python3
"""
Backend API Testing for LLD Cody Construction Management System
Tests all specified API endpoints for stability and functionality
"""

import requests
import json
import sys
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Get backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'https://lld-cody-preview.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

# Test credentials
TEST_EMAIL = "test2@lld.com"
TEST_PASSWORD = "password123"

class APITester:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.user_id = None
        self.project_id = None
        self.test_results = []
        
    def log_result(self, test_name, success, message, response_data=None):
        """Log test result"""
        result = {
            'test': test_name,
            'success': success,
            'message': message,
            'timestamp': datetime.now().isoformat()
        }
        if response_data:
            result['response_data'] = response_data
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        
    def test_login(self):
        """Test POST /api/auth/login"""
        print("\n=== Testing Authentication ===")
        
        try:
            response = self.session.post(
                f"{API_BASE}/auth/login",
                json={
                    "email": TEST_EMAIL,
                    "password": TEST_PASSWORD
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'access_token' in data and 'user' in data:
                    self.token = data['access_token']
                    self.user_id = data['user']['id']
                    self.session.headers.update({
                        'Authorization': f'Bearer {self.token}'
                    })
                    self.log_result(
                        "POST /api/auth/login", 
                        True, 
                        f"Login successful for {TEST_EMAIL}",
                        {'user_id': self.user_id, 'token_received': True}
                    )
                    return True
                else:
                    self.log_result("POST /api/auth/login", False, "Missing access_token or user in response")
                    return False
            else:
                self.log_result(
                    "POST /api/auth/login", 
                    False, 
                    f"Login failed with status {response.status_code}: {response.text}"
                )
                return False
                
        except Exception as e:
            self.log_result("POST /api/auth/login", False, f"Exception during login: {str(e)}")
            return False
    
    def test_projects(self):
        """Test GET /api/projects"""
        print("\n=== Testing Projects API ===")
        
        try:
            response = self.session.get(f"{API_BASE}/projects")
            
            if response.status_code == 200:
                projects = response.json()
                if isinstance(projects, list):
                    # Store first project ID for later tests
                    if projects:
                        self.project_id = projects[0]['id']
                        self.log_result(
                            "GET /api/projects", 
                            True, 
                            f"Retrieved {len(projects)} projects successfully",
                            {'project_count': len(projects), 'first_project_id': self.project_id}
                        )
                    else:
                        self.log_result(
                            "GET /api/projects", 
                            True, 
                            "No projects found (empty list returned)",
                            {'project_count': 0}
                        )
                    return True
                else:
                    self.log_result("GET /api/projects", False, "Response is not a list")
                    return False
            else:
                self.log_result(
                    "GET /api/projects", 
                    False, 
                    f"Request failed with status {response.status_code}: {response.text}"
                )
                return False
                
        except Exception as e:
            self.log_result("GET /api/projects", False, f"Exception: {str(e)}")
            return False
    
    def test_action_items(self):
        """Test GET /api/action-items"""
        print("\n=== Testing Action Items API ===")
        
        try:
            response = self.session.get(f"{API_BASE}/action-items")
            
            if response.status_code == 200:
                items = response.json()
                if isinstance(items, list):
                    self.log_result(
                        "GET /api/action-items", 
                        True, 
                        f"Retrieved {len(items)} action items successfully",
                        {'action_items_count': len(items)}
                    )
                    return True
                else:
                    self.log_result("GET /api/action-items", False, "Response is not a list")
                    return False
            else:
                self.log_result(
                    "GET /api/action-items", 
                    False, 
                    f"Request failed with status {response.status_code}: {response.text}"
                )
                return False
                
        except Exception as e:
            self.log_result("GET /api/action-items", False, f"Exception: {str(e)}")
            return False
    
    def test_gates(self):
        """Test GET /api/gates"""
        print("\n=== Testing Gates API ===")
        
        try:
            response = self.session.get(f"{API_BASE}/gates")
            
            if response.status_code == 200:
                gates = response.json()
                if isinstance(gates, list):
                    self.log_result(
                        "GET /api/gates", 
                        True, 
                        f"Retrieved {len(gates)} gates successfully",
                        {'gates_count': len(gates)}
                    )
                    return True
                else:
                    self.log_result("GET /api/gates", False, "Response is not a list")
                    return False
            else:
                self.log_result(
                    "GET /api/gates", 
                    False, 
                    f"Request failed with status {response.status_code}: {response.text}"
                )
                return False
                
        except Exception as e:
            self.log_result("GET /api/gates", False, f"Exception: {str(e)}")
            return False
    
    def test_walkaround_get(self):
        """Test GET /api/walkaround"""
        print("\n=== Testing Walkaround API (GET) ===")
        
        try:
            response = self.session.get(f"{API_BASE}/walkaround")
            
            if response.status_code == 200:
                entries = response.json()
                if isinstance(entries, list):
                    self.log_result(
                        "GET /api/walkaround", 
                        True, 
                        f"Retrieved {len(entries)} walkaround entries successfully",
                        {'walkaround_entries_count': len(entries)}
                    )
                    return True
                else:
                    self.log_result("GET /api/walkaround", False, "Response is not a list")
                    return False
            else:
                self.log_result(
                    "GET /api/walkaround", 
                    False, 
                    f"Request failed with status {response.status_code}: {response.text}"
                )
                return False
                
        except Exception as e:
            self.log_result("GET /api/walkaround", False, f"Exception: {str(e)}")
            return False
    
    def test_walkaround_post(self):
        """Test POST /api/walkaround"""
        print("\n=== Testing Walkaround API (POST) ===")
        
        if not self.project_id:
            self.log_result("POST /api/walkaround", False, "No project_id available for testing")
            return False
        
        try:
            # Create test walkaround entry
            test_entry = {
                "project_id": self.project_id,
                "note": "Backend test entry - API stability test",
                "priority": "high",
                "owner": "Test User",
                "due_date": "2026-03-25",
                "create_action_item": True
            }
            
            response = self.session.post(
                f"{API_BASE}/walkaround",
                json=test_entry,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                entry = response.json()
                if 'id' in entry and entry.get('note') == test_entry['note']:
                    self.log_result(
                        "POST /api/walkaround", 
                        True, 
                        f"Created walkaround entry successfully",
                        {'entry_id': entry['id'], 'note': entry['note']}
                    )
                    return True
                else:
                    self.log_result("POST /api/walkaround", False, "Invalid response structure")
                    return False
            else:
                self.log_result(
                    "POST /api/walkaround", 
                    False, 
                    f"Request failed with status {response.status_code}: {response.text}"
                )
                return False
                
        except Exception as e:
            self.log_result("POST /api/walkaround", False, f"Exception: {str(e)}")
            return False
    
    def test_diary(self):
        """Test GET /api/diary/{project_id}"""
        print("\n=== Testing Diary API ===")
        
        if not self.project_id:
            self.log_result("GET /api/diary/{project_id}", False, "No project_id available for testing")
            return False
        
        try:
            # Test with specific date
            test_date = "2026-03-24"
            response = self.session.get(f"{API_BASE}/diary/{self.project_id}?date={test_date}")
            
            if response.status_code == 200:
                diary = response.json()
                if isinstance(diary, dict):
                    self.log_result(
                        "GET /api/diary/{project_id}", 
                        True, 
                        f"Retrieved diary for project {self.project_id} on {test_date}",
                        {'project_id': self.project_id, 'date': test_date, 'diary_keys': list(diary.keys())}
                    )
                    return True
                else:
                    self.log_result("GET /api/diary/{project_id}", False, "Response is not a dictionary")
                    return False
            else:
                self.log_result(
                    "GET /api/diary/{project_id}", 
                    False, 
                    f"Request failed with status {response.status_code}: {response.text}"
                )
                return False
                
        except Exception as e:
            self.log_result("GET /api/diary/{project_id}", False, f"Exception: {str(e)}")
            return False
    
    def test_programmes(self):
        """Test GET /api/programmes/{project_id}"""
        print("\n=== Testing Programmes API ===")
        
        if not self.project_id:
            self.log_result("GET /api/programmes/{project_id}", False, "No project_id available for testing")
            return False
        
        try:
            response = self.session.get(f"{API_BASE}/programmes/{self.project_id}")
            
            if response.status_code == 200:
                programmes = response.json()
                if isinstance(programmes, list):
                    self.log_result(
                        "GET /api/programmes/{project_id}", 
                        True, 
                        f"Retrieved {len(programmes)} programmes for project {self.project_id}",
                        {'project_id': self.project_id, 'programmes_count': len(programmes)}
                    )
                    return True
                else:
                    self.log_result("GET /api/programmes/{project_id}", False, "Response is not a list")
                    return False
            else:
                self.log_result(
                    "GET /api/programmes/{project_id}", 
                    False, 
                    f"Request failed with status {response.status_code}: {response.text}"
                )
                return False
                
        except Exception as e:
            self.log_result("GET /api/programmes/{project_id}", False, f"Exception: {str(e)}")
            return False
    
    def check_cors_headers(self):
        """Check if CORS headers are present"""
        print("\n=== Testing CORS Headers ===")
        
        try:
            # Make an OPTIONS request to check CORS
            response = self.session.options(f"{API_BASE}/projects")
            
            cors_headers = {
                'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
                'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
                'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
            }
            
            has_cors = any(cors_headers.values())
            
            if has_cors:
                self.log_result(
                    "CORS Headers Check", 
                    True, 
                    "CORS headers are present",
                    cors_headers
                )
            else:
                self.log_result("CORS Headers Check", False, "No CORS headers found")
            
            return has_cors
            
        except Exception as e:
            self.log_result("CORS Headers Check", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all API tests"""
        print(f"Starting API tests for: {API_BASE}")
        print(f"Test credentials: {TEST_EMAIL}")
        print("=" * 60)
        
        # Test authentication first
        if not self.test_login():
            print("\n❌ Authentication failed - cannot proceed with other tests")
            return False
        
        # Run all other tests
        tests = [
            self.test_projects,
            self.test_action_items,
            self.test_gates,
            self.test_walkaround_get,
            self.test_walkaround_post,
            self.test_diary,
            self.test_programmes,
            self.check_cors_headers
        ]
        
        for test in tests:
            test()
        
        # Summary
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for r in self.test_results if r['success'])
        total = len(self.test_results)
        
        print(f"Total tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        
        if total - passed > 0:
            print("\nFailed tests:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['message']}")
        
        return passed == total

def main():
    """Main test execution"""
    tester = APITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump(tester.test_results, f, indent=2)
    
    print(f"\nDetailed results saved to: /app/backend_test_results.json")
    
    if success:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print("\n⚠️  Some tests failed - check results above")
        sys.exit(1)

if __name__ == "__main__":
    main()