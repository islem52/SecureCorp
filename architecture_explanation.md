# SecureCorp Distributed Architecture Explanation

This document is the guide for demonstrating the project to your teacher. It explains where each assignment requirement is implemented in the codebase.

## 1. Authentication Server (KDC)
**Implemented in:** `services/auth-server/server.js`

**How it works:**
This service acts as the Key Distribution Center (KDC) inspired by Kerberos. 
0. **Dynamic User Creation (Line 18):** We implemented a `POST /signup` endpoint. This allows you to dynamically inject new users into the system (with hashed passwords and designated roles/attributes). It writes directly to `users.json` simulating a dynamic active directory.
1. **Login -> TGT:** The user provides their credentials. The KDC heavily uses bcrypt (`sha256`) to securely store and match the hashed passwords against `users.json`. It then issues a **TGT (Ticket Granting Ticket)** locking in the user's role and clearance.
2. **Request Service Ticket:** The user must call `/request-ticket` using their TGT. The KDC issues a **Service Ticket (ST)** securely encrypted via AES-256 (`crypto.createCipheriv`).

## 2. Policy Decision Point (PDP)
**Implemented in:** `services/pdp/server.js` and `services/pdp/policies.json`

**How it works:**
The PDP is an external dynamic engine that evaluates access control. It has absolutely no hardcoded logic for who accesses what; everything relies on the JSON policy file!
1. **The Contextual Check:** The external Resource Server sends a context payload `{ user, resource, action }` to the PDP via a POST `/evaluate` request.
2. **RBAC Engine:** The PDP checks `policies.json`. It verifies if `Employee` has `allowed_actions` that contain the requested action (`read` vs `write`).
3. **ABAC Engine Engine Fix:** The original code had a severe logical flaw where rules evaluated sequentially as "OR" matches instead of strict "AND" checks, blocking everyone accidentally. We fully rewrote the `$not_equals` algorithmic evaluator loop to properly enforce logical `AND` checks.
   - *Location Validation:* Denies if `user.location` is `external`.
   - *Department Isolation:* Checks `$not_equals` dynamically between user department and resource department.
   - *Clearance Validation:* Ensures clearances map properly (e.g., a "public" user cannot access a "confidential" or "secret" resource).

## 3. Resource Servers (Finance & HR)
**Implemented in:** `services/finance-service/server.js` and `services/hr-service/server.js`

**How it works:**
1. **Ticket Extraction (Line 32 in Finance):** The service expects the encrypted **Service Ticket** in the `Authorization` header. It decrypts the ticket using AES-256 and validates the JWT signature to ensure it wasn't intercepted or modified (Tamper Resistance).
2. **Service Verification (Line 50 in Finance):** It ensures the token destination actually matches `SERVICE_NAME = 'finance'`.
3. **Policy Enforcement (Line 75 in Finance):** Rather than deciding access itself, it halts the request and queries the external **PDP**.
4. **Access Granted/Denied (Line 86 in Finance):** If the PDP returns `final_decision: "GRANTED"`, the API releases the data (like `Q3 Public Earnings`). If not, it blocks access and returns the exact ABAC/RBAC reason given by the PDP.

## Demonstrating to the Teacher (Talking Points)
- **Zero Trust Model:** Point out how the Resource Server *never* trusts the client and *never* makes its own security decisions. It delegates to the PDP.
- **Kerberos Concept:** Point out the 2-step Flow in `auth-server/server.js`. The client must get a TGT first, and exchange it for an ST. The ST is encrypted payload containing session data using AES.
- **ABAC Robustness:** Point out that in `policies.json`, rules use `"$not_equals"` and dynamic variable matching (e.g., comparing user department dynamically against resource department). This is much harder to implement than static RBAC!
