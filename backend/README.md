# Developer Sandbox Bootstrapper - Backend API

Modular FastAPI backend service for validating developer environment manifests, generating safe workflow execution plans, and tracking simulated sandbox bootstrapping pipelines.

---

## Architecture & Technology Stack

- **Framework**: Python 3.11+ / FastAPI
- **Data Validation & Schemas**: Pydantic v2 & Pydantic Settings
- **ASGI Server**: Uvicorn
- **Testing**: pytest & HTTPX (`TestClient`)
- **State Store**: Thread-safe in-memory registry (no external database required)
- **Security**: Strict POSIX environment variable name enforcement (no values or secrets accepted or logged)
- **Future Integration**: Designed for orchestration with LangGraph agents

---

## Directory Structure

```
backend/
├── .env.example              # Environment variables template
├── .gitignore                # Python build and cache artifacts exclusion
├── README.md                 # System documentation and API reference
├── requirements.txt          # Python dependencies
├── app/
│   ├── __init__.py           # Application package marker
│   ├── main.py               # FastAPI application entry point and CORS configuration
│   ├── schemas.py            # Typed Pydantic v2 schemas for manifests and workflows
│   ├── core/
│   │   ├── __init__.py
│   │   └── config.py         # App configuration and environment variable parsing
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── health.py         # System health check route
│   │   └── sandbox.py        # Sandbox validation, setup, and status routes
│   └── services/
│       ├── __init__.py
│       ├── manifest_service.py # Manifest parsing, normalization, and error reporting
│       └── workflow_service.py # In-memory workflow state and deterministic simulation
└── tests/
    ├── __init__.py
    ├── test_health.py        # Health probe tests
    └── test_sandbox.py       # Validation, setup, security, and status tests
```

---

## Setup & Installation

### 1. Prerequisites
- Python 3.11 or higher
- `pip` and `virtualenv`

### 2. Create Virtual Environment & Activate

```bash
cd backend
python3 -m venv .venv

# On Linux / macOS:
source .venv/bin/activate

# On Windows:
.venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Configure Environment Variables

```bash
cp .env.example .env
```

---

## Running the Server

Start the Uvicorn development server:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive API documentation will be available at:
- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## Running the Test Suite

Execute pytest with verbose output:

```bash
pytest -v
```

---

## Supported Manifest Configurations

### Supported Archetypes (`project_type`)
- `fastapi_service`: Python asynchronous REST microservice
- `python_app`: General Python application
- `django_app`: Python Django REST / MVC service
- `nextjs_app`: Node.js Next.js React full-stack application
- `express_api`: Node.js Express REST API
- `node_app`: General Node.js application

### Supported Runtimes & Package Managers

| Runtime | Compatible Package Managers | Default Port |
| :--- | :--- | :--- |
| `python` | `poetry`, `pip`, `uv` | `8000` |
| `node` | `pnpm`, `npm`, `yarn`, `bun` | `3000` |

### Security Note on Environment Variables
The `env_var_names` list accepts **variable names only** (e.g. `["PORT", "DATABASE_URL"]`).
Any entry containing `=` or resembling a secret assignment (e.g. `KEY=secret` or `ghp_token`) will be rejected with HTTP 422. Values must be provided via local `.env` files or secure runtime secrets vaults, never transmitted in the manifest payload.

---

## API Endpoints & Example Requests

### 1. Health Probe
- **Endpoint**: `GET /health`
- **Description**: Returns operational status, service name, and version.

```bash
curl -X GET http://localhost:8000/health
```

**Response (200 OK)**:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "service": "Developer Sandbox Bootstrapper API",
  "timestamp": "2026-10-27T17:00:00.000000"
}
```

---

### 2. Validate Manifest
- **Endpoint**: `POST /api/v1/sandbox/validate`
- **Description**: Inspects a manifest, enforces runtime compatibility, checks security rules, and returns field errors or normalized model.

```bash
curl -X POST http://localhost:8000/api/v1/sandbox/validate \
  -H "Content-Type: application/json" \
  -d '{
    "project_name": "fastapi-microservice",
    "project_type": "fastapi_service",
    "runtime": "python",
    "runtime_version": "3.11.9",
    "package_manager": "poetry",
    "dependencies": [
      "fastapi>=0.111.0",
      "uvicorn[standard]>=0.29.0"
    ],
    "env_var_names": [
      "PORT",
      "DATABASE_URL"
    ],
    "port": 8000,
    "start_command": "poetry run uvicorn main:app --port 8000",
    "test_command": "poetry run pytest"
  }'
```

**Response (200 OK - Valid)**:
```json
{
  "is_valid": true,
  "errors": [],
  "warnings": [],
  "normalized_manifest": {
    "project_name": "fastapi-microservice",
    "project_type": "fastapi_service",
    "runtime": "python",
    "runtime_version": "3.11.9",
    "package_manager": "poetry",
    "dependencies": ["fastapi>=0.111.0", "uvicorn[standard]>=0.29.0"],
    "env_var_names": ["PORT", "DATABASE_URL"],
    "setup_steps": [
      "validate_manifest",
      "prepare_environment",
      "resolve_dependencies",
      "run_health_checks"
    ],
    "port": 8000,
    "start_command": "poetry run uvicorn main:app --port 8000",
    "test_command": "poetry run pytest",
    "repo_url": null,
    "branch": "main"
  }
}
```

---

### 3. Initialize Sandbox Setup Workflow
- **Endpoint**: `POST /api/v1/sandbox/setup`
- **Description**: Validates manifest, creates a unique workflow ID, and initiates the deterministic 4-stage mock setup pipeline.

```bash
curl -X POST http://localhost:8000/api/v1/sandbox/setup \
  -H "Content-Type: application/json" \
  -d '{
    "project_name": "fastapi-microservice",
    "project_type": "fastapi_service",
    "runtime": "python",
    "runtime_version": "3.11.9",
    "package_manager": "poetry",
    "dependencies": ["fastapi>=0.111.0"],
    "env_var_names": ["PORT"]
  }'
```

**Response (201 Created)**:
```json
{
  "workflow_id": "wf-a7e8b91c02df",
  "status": "completed",
  "is_simulated": true,
  "created_at": "2026-10-27T17:01:10.120000",
  "steps": [
    {
      "name": "validate_manifest",
      "description": "Validate manifest syntax, runtime compatibility, and security boundaries.",
      "status": "completed",
      "started_at": "2026-10-27T17:01:10.120000",
      "completed_at": "2026-10-27T17:01:10.240000",
      "duration_seconds": 0.12,
      "error_message": null
    },
    {
      "name": "prepare_environment",
      "description": "Allocate isolated virtual container and configure python 3.11.9.",
      "status": "completed",
      "started_at": "2026-10-27T17:01:10.250000",
      "completed_at": "2026-10-27T17:01:10.770000",
      "duration_seconds": 0.52,
      "error_message": null
    },
    {
      "name": "resolve_dependencies",
      "description": "Resolve package lockfiles and cache 1 dependencies using poetry.",
      "status": "completed",
      "started_at": "2026-10-27T17:01:10.780000",
      "completed_at": "2026-10-27T17:01:11.970000",
      "duration_seconds": 1.19,
      "error_message": null
    },
    {
      "name": "run_health_checks",
      "description": "Probe service readiness probe on port 8000 and execute smoke assertions.",
      "status": "completed",
      "started_at": "2026-10-27T17:01:11.980000",
      "completed_at": "2026-10-27T17:01:12.420000",
      "duration_seconds": 0.44,
      "error_message": null
    }
  ],
  "message": "Deterministic mock sandbox setup initialized."
}
```

---

### 4. Query Workflow Status
- **Endpoint**: `GET /api/v1/sandbox/status/{workflow_id}`
- **Description**: Returns execution status, timestamps, and step details for a workflow. Returns 404 for unknown IDs.

```bash
curl -X GET http://localhost:8000/api/v1/sandbox/status/wf-a7e8b91c02df
```

**Response (200 OK)**:
```json
{
  "workflow_id": "wf-a7e8b91c02df",
  "status": "completed",
  "is_simulated": true,
  "created_at": "2026-10-27T17:01:10.120000",
  "updated_at": "2026-10-27T17:01:10.120000",
  "completed_at": "2026-10-27T17:01:12.420000",
  "steps": [ ... ],
  "manifest_summary": {
    "project_name": "fastapi-microservice",
    "project_type": "fastapi_service",
    "runtime": "python 3.11.9",
    "package_manager": "poetry",
    "dependencies_count": 1,
    "port": 8000,
    "env_var_names": ["PORT"]
  },
  "error_details": null
}
```

---

### 5. Get Manifest JSON Schema
- **Endpoint**: `GET /api/v1/sandbox/manifest/schema`
- **Description**: Returns the Pydantic v2 JSON Schema definition for `SetupManifest`.

```bash
curl -X GET http://localhost:8000/api/v1/sandbox/manifest/schema
```
