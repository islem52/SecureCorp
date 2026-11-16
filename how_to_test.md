# How to Run and Test SecureCorp

Follow these precise steps to run and demonstrate the application flow manually.

## 1. Start the Environment
Everything is containerized using Docker. To ensure it is running properly, open a terminal (PowerShell) in this folder and run:
```powershell
docker-compose up -d --build
```
This starts 4 services:
- Auth Server (KDC): Port 3000
- PDP Engine: Port 3001
- HR Service: Port 3002
- Finance Service: Port 3003

---

## 2. Testing Flow using `curl` 
*(You can execute these directly in PowerShell!)*

### Test A: Successful Employee Access (Charlie accessing Finance)
Charlie is a Finance Employee (Clearance: Public). He wants to read the Public Earnings.

**Step 1: Login to get the TGT**
```powershell
# Get TGT for Charlie (Password for all users is "password123")
$loginRes = curl -s -X POST http://localhost:3000/login -H "Content-Type: application/json" -d '{\"username\":\"charlie\",\"password\":\"password123\"}'
$tgt = ($loginRes | ConvertFrom-Json).tgt
echo "Charlie's TGT: $tgt"
```

**Step 2: Exchange TGT for a Service Ticket for Finance**
```powershell
# Send TGT to auth-server asking for Finance Service Ticket
$stRes = curl -s -X POST http://localhost:3000/request-ticket -H "Authorization: Bearer $tgt" -H "Content-Type: application/json" -d '{\"service\":\"finance\"}'
$st = ($stRes | ConvertFrom-Json).serviceTicket
echo "Charlie's Service Ticket: $st"
```

**Step 3: Access the Resource Server (Public Resource)**
```powershell
# Attempt to read resource ID "1" (Public Earnings)
curl -s -X GET http://localhost:3003/resource/1 -H "Authorization: Bearer $st"
# Result: SUCCESS! {"message":"Resource accessed successfully", "data": "Q3 earnings were solid..."}
```

---

### Test B: ABAC Blocking - Cross Department Access (Alice in HR trying to access Finance)
Alice is in HR. Let's see how the PDP handles isolated departments.

**Step 1 & 2: Alice logs in and gets ticket**
```powershell
$tgtAlice = (curl -s -X POST http://localhost:3000/login -H "Content-Type: application/json" -d '{\"username\":\"alice\",\"password\":\"password123\"}' | ConvertFrom-Json).tgt
$stAlice = (curl -s -X POST http://localhost:3000/request-ticket -H "Authorization: Bearer $tgtAlice" -H "Content-Type: application/json" -d '{\"service\":\"finance\"}' | ConvertFrom-Json).serviceTicket
```

**Step 3: Alice attempts Access**
```powershell
curl -s -X GET http://localhost:3003/resource/1 -H "Authorization: Bearer $stAlice"
# Result: DENIED! {"error":"Access Denied by Policy Engine","rbac":"RBAC: Employee is allowed to read","abac":"ABAC: Cross-department access strictly prohibited"}
```
*(Point out to your teacher: The RBAC allowed it because Alice is an Employee and can "read", but the ABAC correctly blocked it because her department "hr" != "finance"!)*

---

### Test C: Privilege Escalation Attempt (Charlie trying to Write)
Charlie tries to perform a POST (write).
```powershell
curl -s -X POST http://localhost:3003/resource -H "Authorization: Bearer $st" -H "Content-Type: application/json" -d '{\"id\":\"99\", \"classification\":\"public\"}'
# Result: DENIED! {"error":"Access Denied by Policy Engine","rbac":"RBAC: Employee does not have privileges for 'write'","abac":"ABAC: All attribute restrictions passed"}
```
*(Point out: ABAC allowed it because he is in Finance, but RBAC blocked him because an Employee cannot "write".)*
