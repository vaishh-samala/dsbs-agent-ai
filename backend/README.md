# Developer Sandbox Bootstrapper - Backend API

Modular FastAPI backend service for discovering and validating developer environment setup manifests, generating safe workflow execution plans, and orchestrating sandboxed bootstrapping pipelines with LangGraph.

---

## Architecture & Technology Stack

- **Framework**: Python 3.11+ / FastAPI
- **Agent Orchestration**: LangGraph `StateGraph` with deterministic execution nodes and conditional edge routers
- **Data Validation & Schemas**: Pydantic v2 (`extra="forbid"`, custom field & model validators)
- **Serialization**: JSON & PyYAML
- **Sandbox Isolation Layer**: `SandboxExecutor` enforcing command safety policies (no arbitrary host execution)
- **Manifest Discovery**: Automatic search order across 12 standard locations with project inference (`pyproject.toml`, `requirements.txt`, `package.json`) and sensible fallback
- **ASGI Server**: Uvicorn
- **Testing**: pytest & HTTPX (`TestClient`)
- **State Store**: Thread-safe in-memory registry

---

# Agent Orchestration (5 Stages)

The LangGraph `StateGraph` strictly enforces a 5-stage deterministic workflow lifecycle:

1. **Inspect (`validate_manifest`)**:
   Inspects the repository or manifest data, parses runtime requirements and dependencies, enforces security constraints, and normalizes configuration.
2. **Plan (`plan_setup`)**:
   Formulates the sequential container setup plan, sets up environment allocation, lockfile installation, and service verification steps, and calculates a deterministic SHA-256 plan fingerprint.
3. **Approve (`approval_gate`)**:
   **Mandatory human-in-the-loop gate**. Pauses workflow execution using LangGraph `interrupt(...)` with checkpoint persistence (`MemorySaver`). Setup and verification commands **never** run until explicit user approval is received via the API or frontend. Rejection halts execution cleanly with zero commands executed.
4. **Execute (`execute_step`)**:
   Executes approved setup commands sequentially through `SandboxExecutor` simulation boundaries with strict command isolation.
5. **Verify (`verify_setup` & `finalize_workflow`)**:
   Executes validation commands and health probes, verifies port responsiveness, computes step durations, and generates a safe manifest execution summary.

---

## Directory Structure

```
backend/
├── .env.example                       # Environment variables template
├── .gitignore                         # Python build and cache artifacts exclusion
├── README.md                          # System documentation and API reference
├── requirements.txt                   # Python dependencies (FastAPI, LangGraph, Pydantic, PyYAML)
├── conftest.py                        # Pytest path bootstrap
├── app/
│   ├── __init__.py                    # Application package marker
│   ├── main.py                        # FastAPI application entry point and CORS configuration
│   ├── schemas.py                     # Typed Pydantic v2 schemas for manifests and workflows
│   ├── core/
│   │   ├── __init__.py
│   │   └── config.py                  # App configuration and environment variable parsing
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── health.py                  # System health check route
│   │   └── sandbox.py                 # Sandbox validation, discovery, setup, approval, and status routes
│   ├── agent/
│   │   ├── __init__.py                # LangGraph agent export
│   │   ├── state.py                   # TypedDict state schemas (SandboxAgentState, ExecutionPlanItem)
│   │   ├── nodes.py                   # Deterministic workflow nodes and edge routers
│   │   └── graph.py                   # Compiled StateGraph assembly and agent runner
│   └── services/
│       ├── __init__.py
│       ├── manifest_service.py        # Manifest discovery, parsing, normalization, and fallback
│       ├── sandbox_executor.py        # Safe sandbox execution layer & command safety policy
│       └── workflow_service.py        # In-memory workflow state powered by LangGraph agent
└── tests/
    ├── __init__.py
    ├── test_health.py                 # Health probe tests
    ├── test_sandbox.py                # Validation, setup, security, and status tests
    ├── test_agent.py                  # LangGraph workflow orchestration & failure branch tests
    ├── test_approval.py               # Explicit user approval gate, resumption, rejection, and fingerprint tests
    ├── test_manifest.py               # Unit tests: valid manifests, missing fields, invalid versions, commands
    └── test_manifest_agent_integration.py # Integration tests: discovery, agent loading, and fallback execution
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

---

## Running the Server

Start the Uvicorn development server:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive API documentation:
- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## Running the Test Suite

Execute the complete pytest test suite:

```bash
# From workspace root:
./.venv/bin/pytest backend

# Or from backend/ directory:
pytest -v
```

Execute specific test suites:

```bash
# Explicit approval gate, resumption, rejection, and tamper tests:
pytest tests/test_approval.py -v

# Manifest unit tests (schema, versions, security patterns, fallback discovery):
pytest tests/test_manifest.py -v

# Agent orchestration and state integration tests:
pytest tests/test_agent.py tests/test_manifest_agent_integration.py -v

# Sandbox API route tests:
pytest tests/test_sandbox.py -v
```

---

## Setup Manifest Specification

The Setup Manifest (`SetupManifest`) is a structured, versioned specification that defines how a project environment should be initialized, configured, and verified inside an isolated sandbox.

### Schema Fields

| Field | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `version` | `str` | No (default `"1.0"`) | Manifest schema specification version (`1.0`). | `"1.0"` |
| `project_name` | `str` | **Yes** | Alphanumeric project identifier `^[a-zA-Z0-9_\-\.]+$`. | `"fastapi-sample-api"` |
| `project_type` | `str` (Enum) | **Yes** | Project archetype (`fastapi_service`, `python_app`, `django_app`, `nextjs_app`, `express_api`, `node_app`). | `"fastapi_service"` |
| `runtime` | `str` (Enum) | **Yes** | Core execution runtime (`python` or `node`). | `"python"` |
| `language` | `str` | No (inferred) | Primary language (`python`, `javascript`, `typescript`). | `"python"` |
| `runtime_version` | `str` | **Yes** | Supported runtime version (Python 3.8–3.14, Node 16, 18, 20, 22). | `"3.11.9"` |
| `package_manager` | `str` (Enum) | **Yes** | Package manager (`poetry`, `pip`, `uv` for Python; `pnpm`, `npm`, `yarn`, `bun` for Node). | `"poetry"` |
| `dependencies` | `List[str]` | No (default `[]`) | Declared dependencies and version constraints. | `["fastapi>=0.111.0"]` |
| `env_var_names` | `List[str]` | No (default `[]`) | Required environment variable keys (POSIX keys only, **never** values). | `["PORT", "DATABASE_URL"]` |
| `setup_commands` | `List[str]` | No (default `[]`) | Ordered setup commands to run inside the sandbox container. | `["poetry install --no-root"]` |
| `validation_commands` | `List[str]` | No (default `[]`) | Verification / test commands to validate environment readiness. | `["poetry run pytest"]` |
| `port` | `int` | No | Bound network port (default: 8000 for Python, 3000 for Node). | `8000` |
| `start_command` | `str` | No | Command to launch the application process. | `"poetry run uvicorn main:app --port 8000"` |
| `test_command` | `str` | No | Test command (synchronized with `validation_commands`). | `"poetry run pytest"` |
| `repo_path` | `str` | No | Local filesystem path to repository for manifest auto-discovery. | `"/path/to/repo"` |

---

## Example Manifests

### Complete YAML Manifest (`sandbox.manifest.yaml`)

```yaml
version: "1.0"
project_name: "fastapi-sample-api"
project_type: "fastapi_service"
runtime: "python"
language: "python"
runtime_version: "3.11.9"
package_manager: "poetry"
dependencies:
  - "fastapi>=0.111.0"
  - "uvicorn[standard]>=0.29.0"
  - "pydantic>=2.7.1"
env_var_names:
  - "PORT"
  - "DATABASE_URL"
  - "APP_ENV"
setup_commands:
  - "poetry install --no-root"
validation_commands:
  - "poetry run pytest"
port: 8000
start_command: "poetry run uvicorn main:app --host 0.0.0.0 --port 8000"
test_command: "poetry run pytest"
```

### Complete JSON Manifest (`sandbox.manifest.json`)

```json
{
  "version": "1.0",
  "project_name": "nextjs-saas-starter",
  "project_type": "nextjs_app",
  "runtime": "node",
  "language": "typescript",
  "runtime_version": "20.14.0",
  "package_manager": "pnpm",
  "dependencies": [
    "next@14.2.3",
    "react@18.3.1",
    "react-dom@18.3.1"
  ],
  "env_var_names": [
    "PORT",
    "NEXT_PUBLIC_API_URL"
  ],
  "setup_commands": [
    "pnpm install --frozen-lockfile"
  ],
  "validation_commands": [
    "pnpm test"
  ],
  "port": 3000,
  "start_command": "pnpm dev",
  "test_command": "pnpm test"
}
```

---

## Automatic Manifest Discovery & Fallback System

When a repository directory is provided to the agent or API, `ManifestService.discover_manifest(repo_path)` resolves the configuration using the following priority order:

1. **Explicit Manifest Files**:
   Searches for manifest files in root or `.sandbox/`:
   - `sandbox.manifest.json` / `sandbox.manifest.yaml` / `sandbox.manifest.yml`
   - `.sandbox/manifest.json` / `.sandbox/manifest.yaml` / `.sandbox/manifest.yml`
   - `setup.manifest.json` / `setup.manifest.yaml` / `setup.manifest.yml`
   - `.sandbox.json` / `.sandbox.yaml` / `.sandbox.yml`
2. **Inference from `pyproject.toml`**:
   Detects package manager (`poetry` or `pip`), dependencies, archetype (`fastapi_service` or `python_app`), and configures setup & test commands.
3. **Inference from `requirements.txt`**:
   Detects `pip` dependencies, project archetype, and default smoke test commands.
4. **Inference from `package.json`**:
   Detects package manager (`pnpm`, `yarn`, `bun`, or `npm` via lockfiles), dependencies, scripts (`dev`, `test`), and language (`typescript` if `tsconfig.json` exists).
5. **Heuristic Source File Inference**:
   Infers Python or Node from top-level `*.py` or `*.js`/`*.ts` files.
6. **Sensible Fallback**:
   When no manifest or project files exist (e.g., empty or unconfigured repository), generates a safe default baseline manifest (`is_fallback=True`) with actionable diagnostic warnings.

---

## Sandbox Security & Command Isolation Layer

Repository commands **never execute directly on the host**. All execution is routed through `SandboxExecutor` which enforces:

1. **Privilege Escalation Prevention**:
   Commands containing `sudo`, `su`, or `doas` are strictly rejected with exit code 126.
2. **Destructive Operation Blocking**:
   Commands attempting recursive deletion of root/home (`rm -rf /`, `rm -rf ~`), disk wiping (`mkfs`, `dd if=`), or system shutdown (`reboot`, `shutdown`) are rejected immediately.
3. **Remote Script Piping Prevention**:
   Piping unverified remote URLs into shells (`curl ... | bash`, `wget ... | sh`) is prohibited.
4. **Runtime Environment Tool Isolation**:
   Attempting to invoke Node tools (`npm`, `yarn`) in a Python sandbox, or Python tools (`pip`, `poetry`) in a Node sandbox is blocked.
5. **Secret Protection**:
   `env_var_names` accepts variable keys only. Key-value assignments (e.g. `KEY=value`) and secret strings are rejected and never reflected in error messages or logs.

---

## API Endpoints Reference

### 1. Discover Manifest
- **Endpoint**: `POST /api/v1/sandbox/manifest/discover`
- **Body**: `{"repo_path": "/path/to/repo"}`
- **Response**: `ManifestDiscoveryResult` containing discovery source, manifest model, and fallback flag.

### 2. Validate Manifest
- **Endpoint**: `POST /api/v1/sandbox/validate`
- **Body**: Manifest JSON payload
- **Response**: `ValidationResult` with `is_valid: bool`, actionable `errors`, and `normalized_manifest`.

### 3. Initialize Sandbox Setup Workflow
- **Endpoint**: `POST /api/v1/sandbox/setup`
- **Body**: Manifest payload (or `{"repo_path": "/path/to/repo"}` for discovery)
- **Response (201 Created)**: `WorkflowCreateResponse` with initial step progression.

### 4. Retrieve Pending Execution Plan
- **Endpoint**: `GET /api/v1/sandbox/{workflow_id}/plan` (alias: `GET /api/v1/sandbox/plan/{workflow_id}`)
- **Response (200 OK)**: `WorkflowPlanResponse` with ordered setup and validation commands, runtime metadata, fingerprint, and approval status.

### 5. Explicitly Approve Execution Plan
- **Endpoint**: `POST /api/v1/sandbox/{workflow_id}/approve` (alias: `POST /api/v1/sandbox/approve/{workflow_id}`)
- **Body**: `{"approved": true, "plan_fingerprint": "<sha256>", "reason": "optional notes"}`
- **Response (200 OK)**: `WorkflowStatusResponse` with resumed execution and completion status.
- **Error (409 Conflict)**: Returned if the supplied `plan_fingerprint` does not match the plan presented to the user.

### 6. Explicitly Reject Execution Plan
- **Endpoint**: `POST /api/v1/sandbox/{workflow_id}/reject` (alias: `POST /api/v1/sandbox/reject/{workflow_id}`)
- **Body**: `{"approved": false, "reason": "Security review denied."}`
- **Response (200 OK)**: `WorkflowStatusResponse` with `status: "rejected"` and zero commands executed.

### 7. Query Workflow Status
- **Endpoint**: `GET /api/v1/sandbox/status/{workflow_id}`
- **Response (200 OK)**: `WorkflowStatusResponse` with step timeline, execution durations, approval status, and safe manifest summary.

### 8. Get Manifest JSON Schema
- **Endpoint**: `GET /api/v1/sandbox/manifest/schema`
- **Response (200 OK)**: Canonical JSON Schema for `SetupManifest`.
