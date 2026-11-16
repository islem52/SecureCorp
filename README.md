# 🔐 SecureCorp — Distributed Security Architecture

A secure distributed microservices system implementing **Kerberos-inspired authentication**, **RBAC**, **ABAC**, and a **Zero Trust** security model.

Built with Node.js, Express, and Docker Compose.

---

## 🏗️ Architecture

```
Client
  │
  ├── POST /login          → Auth Server (KDC) :3000  → Issues TGT
  ├── POST /request-ticket → Auth Server (KDC) :3000  → Issues Service Ticket (AES-256 encrypted)
  │
  ├── GET/POST/DELETE /resource → HR Service     :3002  ─┐
  │                             → Finance Service :3003  ─┤─→ PDP :3001 → RBAC + ABAC evaluation
  │
  └── POST /evaluate → Policy Decision Point (PDP) :3001
```

### Services
| Service | Port | Description |
|---|---|---|
| `auth-server` | 3000 | KDC — Issues TGTs and AES-encrypted Service Tickets |
| `pdp` | 3001 | Policy Decision Point — Evaluates RBAC + ABAC from external JSON policies |
| `hr-service` | 3002 | Resource Server — HR department resources |
| `finance-service` | 3003 | Resource Server — Finance department resources |

---

## 🚀 Quick Start

**Prerequisites:** Docker Desktop must be running.

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/SecureCorp.git
cd SecureCorp

# 2. Start all services
docker-compose up -d --build

# 3. Run the automated integration tests
node test_api.js
```

---

## 🔑 Authentication Flow (Kerberos-Inspired)

1. **Login → TGT**: Client sends credentials to the KDC (`POST /login`). The KDC verifies the SHA-256 hashed password and issues a JWT **Ticket Granting Ticket**.
2. **TGT → Service Ticket**: Client sends the TGT to request access to a specific service (`POST /request-ticket`). The KDC issues an **AES-256 encrypted** Service Ticket locked to the destination service.
3. **Service Ticket → Resource Access**: Client presents the Service Ticket to a Resource Server. The server decrypts it, validates the destination, then queries the PDP before granting access.

---

## 🛡️ Authorization Model

### RBAC (Role-Based)
| Role | Permissions |
|---|---|
| `Admin` | read, write, delete |
| `Manager` | read, write |
| `Employee` | read |

### ABAC (Attribute-Based)
Policies are externally defined in `services/pdp/policies.json`:
- **Location Isolation**: External users are blocked.
- **Department Isolation**: Users can only access resources from their own department.
- **Clearance Validation**: Users cannot access resources above their clearance level (public / confidential / secret).

---

## 👤 Test Users

| Username | Role | Department | Clearance | Location |
|---|---|---|---|---|
| `Kimiko` | Employee | finance | public | internal |
| `Mohamed` | Employee | hr | public | internal |
| `MM` | Manager | hr | confidential | internal |
| `eve` | Admin | it | secret | internal |
| `William` | Employee | hr | public | **external** |

> Password for all pre-seeded users: `password123`

---

## 🧪 API Endpoints

### Auth Server (`:3000`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/signup` | Create a new user dynamically |
| `POST` | `/login` | Authenticate and receive a TGT |
| `POST` | `/request-ticket` | Exchange TGT for a Service Ticket |

### Resource Servers (`:3002` / `:3003`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/resource/:id` | Read a resource (requires `read` permission) |
| `POST` | `/resource` | Create a resource (requires `write` permission) |
| `DELETE` | `/resource/:id` | Delete a resource (requires `delete` permission) |

---

## ⚔️ Attack Demonstrations

| Attack | How it's Mitigated |
|---|---|
| **Ticket Tampering** | JWT cryptographic signature validation rejects any modified token |
| **Privilege Escalation** | RBAC engine blocks actions not permitted for the user's role |
| **Cross-Department Access** | ABAC `$not_equals` rule enforces strict department isolation |
| **External Access** | ABAC location policy blocks all requests from `external` users |
| **Invalid Signup** | Input validation rejects malformed registration requests |

---

## 🐳 Docker

All services are containerized and networked in an isolated `securecorp-net` bridge network.

```bash
docker-compose up -d --build   # Start
docker-compose ps              # Check status
docker-compose down            # Stop
```
