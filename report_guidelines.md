# SecureCorp Technical Report Outline

This outline is designed to easily hit your 5 - 15 page requirement. Expand on these bullet points, add the recommended code screenshots, and include terminal outputs to make the report look highly professional and technically deep.

---

## Section 1: Introduction & System Architecture
*Goal: Explain the big picture and the Zero Trust model.*
* **Concepts to explain**: What a microservice architecture is, and why Zero Trust is important (never trusting the user, verifying every single request).
* **Components Breakdown**: Briefly introduce the Authentication Server (KDC), the Policy Decision Point (PDP), and the Resource Servers (Finance/HR).
* **Screenshot to include**: Draw a simple flowchart (in draw.io or PowerPoint) showing a User -> KDC -> Resource Server -> PDP.

## Section 2: Kerberos-Inspired Authentication Design
*Goal: Prove you met the authentication criteria.*
* **Concepts to explain**: How a user first signs in to get a Ticket Granting Ticket (TGT), and then exchanges it later for a Service Ticket (ST) bound specifically to the service they want.
* **Code Screenshots**: 
  - `auth-server/server.js` around **Line 33** (Show the TGT payload and how it's signed).
  - `auth-server/server.js` around **Lines 75 - 94** (Show how the Service Ticket is dynamically constructed, packed with a session key, and tightly encrypted using AES-256 `crypto.createCipheriv`).

## Section 3: The Unified Policy Engine (PDP)
*Goal: Prove you met the external policy engine requirement and explain your algorithms.*
* **Concepts to explain**: Why it's safer to have an isolated Policy Engine instead of hardcoding rules into APIs. 
* **Code Screenshots**:
  - `pdp/policies.json` (Take a screenshot of the raw JSON to prove rules are externally managed, not hardcoded into Javascript).
  - `pdp/server.js` around **Lines 23 - 42** (The `evaluateCondition` function). Explain how this algorithm is dynamic and fully generic—it can match any attribute dynamically using `$not_equals` and `$in` without writing custom `If/Else` statements, making it extremely scalable.

## Section 4: Access Control Models (RBAC + ABAC)
*Goal: Break down the distinction between Role and Attribute checks.*
* **RBAC Explanation**: How roles map strictly to allowed actions (Admin = read/write/delete, Employee = read).
* **ABAC Explanation**: How you enforce logical isolation. Explain that even if an Employee has "Read" rights (RBAC), they will be blocked if their department attribute (`hr`) doesn't match the requested resource's department (`finance`).
* **Code Screenshot**: `finance-service/server.js` around **Lines 74 - 95** (Show the `checkAccess` middleware querying the PDP with `axios.post`). 

## Section 5: Security Analysis & Attack Mitigation
*Goal: Showcase the 4 required attack demonstrations.*
* **Ticket Tampering**: Explain that because your tickets use JWT signatures (`jsonwebtoken.verify`), if a user modifies their clearance in the payload, the crypto math fails and the token is rejected.
* **Privilege Escalation**: Explain that a standard Employee attempting to send a `POST` request is strictly blocked by the central PDP returning `rbac_allowed: false`. 
  - **Screenshot**: Run your `test_api.js` script and screenshot **Test 6** failing.
* **Unauthorized Access**: Explain that a cross-department attempt is blocked by pure ABAC logic dynamically rejecting the attributes. 
  - **Screenshot**: Run your `test_api.js` script and screenshot **Test 5** failing.
* **Replay Attack Mitigation**: Explain that tickets contain exact time-based expiration (`expiresIn: '1h'`) and strict destination pinning (`decodedToken.service !== SERVICE_NAME`), neutralizing stolen tickets.

## Section 6: Advanced & Bonus Implementations
*Goal: Secure your bonus points.*
* **Docker Deployment**: Explain how Docker-Compose networks microservices securely so they can talk to each other but remain isolated from the outside internet.
  - **Code Screenshot**: `docker-compose.yml`.
* **Dynamic User Provisioning**: Show off the custom feature I added for you.
  - **Code Screenshot**: `auth-server/server.js` around **Line 18** (The `POST /signup` logic showing hot-reloading into the static JSON database).
