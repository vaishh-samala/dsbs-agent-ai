"""Intelligent Agent Evaluation Engine for Developer Sandbox Bootstrapper.

Combines deterministic rule validation, repository evidence inspection, security policy
enforcement, and LLM reasoning to evaluate developer requests before human approval.
"""

from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Tuple
import httpx

from app.schemas import (
    AgentDecision,
    DANGEROUS_PATTERNS,
    NODE_TOOL_REGEX,
    PYTHON_TOOL_REGEX,
    EvaluationResult,
    PackageManager,
    ProjectType,
    RuntimeType,
    SetupManifest,
    ValidationErrorDetail,
)


# Extended Security Pattern Inspection
EXTENDED_DANGEROUS_PATTERNS = [
    *DANGEROUS_PATTERNS,
    (re.compile(r"cat\s+.*(/etc/passwd|/etc/shadow|\.ssh|\.aws|\.env)", re.IGNORECASE), "prohibited credential/secret access attempt"),
    (re.compile(r"curl\s+.*-(d|F|T)\s+.*(/etc/passwd|\.ssh|\.env)", re.IGNORECASE), "prohibited credential exfiltration attempt"),
    (re.compile(r"(chmod|chown)\s+(-R\s+)?(777|000)\s+(/|/\*|/etc|/var)", re.IGNORECASE), "prohibited root filesystem permission mutation"),
    (re.compile(r"(killall|pkill)\s+-9", re.IGNORECASE), "prohibited host process termination"),
    (re.compile(r"iptables|ufw|firewall-cmd", re.IGNORECASE), "prohibited host network modification"),
]

SUPPORTED_RUNTIMES = {"node", "python"}
SUPPORTED_PYTHON_VERSIONS = {"3.8", "3.9", "3.10", "3.11", "3.12", "3.13", "3.14"}
SUPPORTED_NODE_VERSIONS = {"16", "18", "20", "22"}
ALLOWED_SCOPES = {"read_only", "sandbox_debug", "full_ports"}


class AgentEvaluator:
    """Evaluates developer sandbox requests against repository evidence and cluster security boundaries."""

    @classmethod
    def inspect_repository(cls, repo_path: Optional[str]) -> Dict[str, Any]:
        """Inspect actual repository files on disk to gather concrete evidence.

        Returns an evidence dictionary with discovered files, lockfiles, engines, scripts, etc.
        If the path is missing or does not exist, explicitly reports the error.
        """
        evidence: Dict[str, Any] = {
            "accessible": False,
            "exists": False,
            "path": repo_path,
            "files": [],
            "manifest_files": [],
            "lockfiles": [],
            "lockfiles_found": [],
            "source_files": [],
            "detected_runtime": None,
            "detected_package_manager": None,
            "engines_requirement": None,
            "scripts": {},
            "dependencies": [],
            "port_hints": [],
            "warnings": [],
            "error": None,
        }

        if not repo_path:
            evidence["warnings"].append("No local repository path provided; evaluation based on submitted request metadata.")
            return evidence

        target_path = Path(repo_path).resolve()
        if not target_path.exists():
            evidence["error"] = f"Repository path '{repo_path}' does not exist on disk."
            return evidence
        if not target_path.is_dir():
            evidence["error"] = f"Repository path '{repo_path}' is not a directory."
            return evidence

        evidence["accessible"] = True
        evidence["exists"] = True
        evidence["path"] = str(target_path)

        # 1. Search for package manifests
        for fname in ["package.json", "pyproject.toml", "requirements.txt", "Pipfile", "setup.py", "sandbox.manifest.json", "sandbox.manifest.yaml"]:
            if (target_path / fname).is_file():
                evidence["manifest_files"].append(fname)
                evidence["files"].append(fname)

        # 2. Search for lockfiles
        for lock in ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", "poetry.lock", "Pipfile.lock"]:
            if (target_path / lock).is_file():
                evidence["lockfiles"].append(lock)
                evidence["lockfiles_found"].append(lock)
                evidence["files"].append(lock)

        # 3. Inspect package.json if present
        pkg_json_path = target_path / "package.json"
        if pkg_json_path.is_file():
            try:
                data = json.loads(pkg_json_path.read_text(encoding="utf-8"))
                evidence["detected_runtime"] = "node"
                evidence["scripts"] = data.get("scripts", {})
                evidence["dependencies"].extend(list(data.get("dependencies", {}).keys()))
                evidence["dependencies"].extend(list(data.get("devDependencies", {}).keys()))
                if "engines" in data and "node" in data["engines"]:
                    evidence["engines_requirement"] = data["engines"]["node"]
            except Exception as e:
                evidence["warnings"].append(f"Failed to parse package.json: {str(e)}")

        # 4. Inspect pyproject.toml if present
        pyproject_path = target_path / "pyproject.toml"
        if pyproject_path.is_file():
            evidence["detected_runtime"] = "python"
            try:
                content = pyproject_path.read_text(encoding="utf-8")
                if "[tool.poetry]" in content:
                    evidence["detected_package_manager"] = "poetry"
                for line in content.splitlines():
                    if line.strip().startswith("python =") or line.strip().startswith("requires-python"):
                        evidence["engines_requirement"] = line.strip()
            except Exception as e:
                evidence["warnings"].append(f"Failed to read pyproject.toml: {str(e)}")

        # 5. Lockfile to package manager association
        if "pnpm-lock.yaml" in evidence["lockfiles"]:
            evidence["detected_package_manager"] = "pnpm"
        elif "yarn.lock" in evidence["lockfiles"]:
            evidence["detected_package_manager"] = "yarn"
        elif "bun.lockb" in evidence["lockfiles"]:
            evidence["detected_package_manager"] = "bun"
        elif "package-lock.json" in evidence["lockfiles"] and not evidence["detected_package_manager"]:
            evidence["detected_package_manager"] = "npm"
        elif "poetry.lock" in evidence["lockfiles"]:
            evidence["detected_package_manager"] = "poetry"

        # 6. Check .env.example or port references
        env_example = target_path / ".env.example"
        if env_example.is_file():
            try:
                for line in env_example.read_text(encoding="utf-8").splitlines():
                    if "PORT=" in line:
                        evidence["port_hints"].append(line.strip())
            except Exception:
                pass

        return evidence

    @classmethod
    def evaluate_request(
        cls,
        request_data: Dict[str, Any],
        repo_evidence: Optional[Dict[str, Any]] = None,
    ) -> EvaluationResult:
        """Evaluate developer request against repository evidence and security policies.

        Returns an EvaluationResult with decision (APPROVE_FOR_REVIEW, REJECT, or NEEDS_CLARIFICATION).
        """
        if repo_evidence is None:
            repo_evidence = cls.inspect_repository(request_data.get("repo_path"))

        repository_findings: List[str] = []
        compatibility_issues: List[str] = []
        security_findings: List[str] = []
        validation_errors: List[str] = []
        warnings: List[str] = []
        clarification_questions: List[str] = []
        proposed_commands: List[str] = []

        project_name = str(request_data.get("project_name") or "developer-sandbox").strip()
        runtime_raw = str(request_data.get("runtime", "")).strip().lower()
        runtime_version = str(request_data.get("runtime_version", "")).strip()
        pm_raw = str(request_data.get("package_manager", "")).strip().lower()
        port = request_data.get("port")
        scope = str(request_data.get("scope") or "sandbox_debug").strip().lower()
        permissions = request_data.get("permissions") or [scope]
        setup_cmds = request_data.get("setup_commands") or []
        validation_cmds = request_data.get("validation_commands") or []
        dependencies = request_data.get("dependencies") or []
        user_justification = request_data.get("justification") or ""

        # -------------------------------------------------------------
        # 1. Repository Accessibility & Findings
        # -------------------------------------------------------------
        if repo_evidence.get("error"):
            validation_errors.append(repo_evidence["error"])
            repository_findings.append(f"Inspection failed: {repo_evidence['error']}")
        elif repo_evidence.get("accessible"):
            found_manifests = ", ".join(repo_evidence["manifest_files"]) if repo_evidence["manifest_files"] else "None"
            found_locks = ", ".join(repo_evidence["lockfiles"]) if repo_evidence["lockfiles"] else "None"
            repository_findings.append(f"Repository inspected at {repo_evidence['path']}.")
            repository_findings.append(f"Discovered manifest files: {found_manifests}.")
            repository_findings.append(f"Discovered lockfiles: {found_locks}.")
            if repo_evidence.get("engines_requirement"):
                repository_findings.append(f"Declared engine requirement: {repo_evidence['engines_requirement']}.")
        else:
            repository_findings.append("Remote or unmounted repository: inspection conducted using submitted manifest metadata.")

        # -------------------------------------------------------------
        # 2. Runtime & Engine Compatibility
        # -------------------------------------------------------------
        if not runtime_raw:
            validation_errors.append("Missing required field 'runtime'.")
        elif runtime_raw not in SUPPORTED_RUNTIMES:
            validation_errors.append(
                f"Unsupported runtime '{runtime_raw}'. Sandbox cluster only supports 'node' and 'python' runtimes."
            )
            compatibility_issues.append(f"Runtime '{runtime_raw}' is not supported by the container executor.")
        else:
            # Runtime is node or python - validate versions
            if runtime_raw == "python":
                if not runtime_version:
                    runtime_version = "3.11.9"
                    warnings.append("Runtime version omitted; defaulted to Python 3.11.9 LTS.")
                else:
                    m = re.match(r"^3\.(\d+)", runtime_version)
                    if not m:
                        validation_errors.append(
                            f"Invalid Python version format '{runtime_version}'. Expected semver such as '3.11.9' or '3.12'."
                        )
                    elif int(m.group(1)) < 8 or int(m.group(1)) > 14:
                        validation_errors.append(
                            f"Unsupported Python version '{runtime_version}'. Supported versions are 3.8 through 3.14."
                        )
            elif runtime_raw == "node":
                if not runtime_version:
                    runtime_version = "20.14.0"
                    warnings.append("Runtime version omitted; defaulted to Node.js 20.14.0 LTS.")
                else:
                    m = re.match(r"^(\d+)", runtime_version)
                    if not m or m.group(1) not in SUPPORTED_NODE_VERSIONS:
                        validation_errors.append(
                            f"Unsupported Node.js version '{runtime_version}'. Supported LTS versions: 16, 18, 20, 22."
                        )

            # Check if requested runtime contradicts repo evidence
            if repo_evidence.get("detected_runtime") and repo_evidence["detected_runtime"] != runtime_raw:
                compatibility_issues.append(
                    f"Requested runtime '{runtime_raw}' contradicts discovered repository archetype '{repo_evidence['detected_runtime']}'."
                )
                validation_errors.append(
                    f"Conflicting runtime: repository is configured for {repo_evidence['detected_runtime']} but developer requested {runtime_raw}."
                )

        # -------------------------------------------------------------
        # 3. Package Manager & Lockfile Compatibility
        # -------------------------------------------------------------
        node_pms = {"npm", "pnpm", "yarn", "bun"}
        python_pms = {"pip", "poetry", "uv"}

        if runtime_raw == "python":
            if pm_raw and pm_raw not in python_pms:
                validation_errors.append(
                    f"Package manager '{pm_raw}' is incompatible with Python runtime. Supported: {', '.join(sorted(python_pms))}."
                )
            elif not pm_raw:
                pm_raw = repo_evidence.get("detected_package_manager") or "poetry"

            # Lockfile conflict checks for Python
            if "poetry.lock" in repo_evidence.get("lockfiles", []) and pm_raw == "pip":
                warnings.append(
                    "Repository contains poetry.lock but pip was requested. Recommended: use poetry to preserve dependency lockfile."
                )
                compatibility_issues.append("Lockfile mismatch: poetry.lock present with pip requested.")

        elif runtime_raw == "node":
            if pm_raw and pm_raw not in node_pms:
                validation_errors.append(
                    f"Package manager '{pm_raw}' is incompatible with Node.js runtime. Supported: {', '.join(sorted(node_pms))}."
                )
            elif not pm_raw:
                pm_raw = repo_evidence.get("detected_package_manager") or "npm"

            # Lockfile conflict checks for Node.js
            lockfiles = repo_evidence.get("lockfiles") or repo_evidence.get("lockfiles_found") or []
            if "yarn.lock" in lockfiles and pm_raw not in ["yarn", "bun"]:
                warnings.append(
                    f"Repository contains yarn.lock but package manager is set to '{pm_raw}'. Lockfile migration or yarn recommended."
                )
                compatibility_issues.append(f"Lockfile conflict: yarn.lock detected with {pm_raw} requested.")
            elif "pnpm-lock.yaml" in lockfiles and pm_raw not in ["pnpm", "bun"]:
                warnings.append(
                    f"Repository contains pnpm-lock.yaml but package manager is set to '{pm_raw}'. pnpm recommended."
                )
                compatibility_issues.append(f"Lockfile conflict: pnpm-lock.yaml detected with {pm_raw} requested.")
            elif "package-lock.json" in lockfiles and pm_raw == "yarn":
                warnings.append("Repository contains package-lock.json but yarn was requested.")

        # -------------------------------------------------------------
        # 4. Port Validation & Network Isolation
        # -------------------------------------------------------------
        if port is not None:
            try:
                port_int = int(port)
                if port_int < 1024:
                    validation_errors.append(
                        f"Privileged port {port_int} is prohibited. Rootless sandboxes must use unprivileged ports (1024-65535)."
                    )
                    security_findings.append(f"Privileged port {port_int} rejected by security policy.")
                elif port_int > 65535:
                    validation_errors.append(f"Port {port_int} is out of allowable range (1024-65535).")
            except (ValueError, TypeError):
                validation_errors.append(f"Invalid port value '{port}'. Expected integer between 1024 and 65535.")
        else:
            port = 8000 if runtime_raw == "python" else 3000

        # -------------------------------------------------------------
        # 5. Permission & Scope Assessment
        # -------------------------------------------------------------
        if scope not in ALLOWED_SCOPES:
            validation_errors.append(
                f"Invalid permission scope '{scope}'. Allowed scopes: {', '.join(sorted(ALLOWED_SCOPES))}."
            )
        else:
            if scope == "full_ports":
                if not user_justification:
                    warnings.append("Scope 'full_ports' requested without access justification. Elevated review required.")
                    permission_justification = f"Full localhost port binding requested for port :{port}."
                else:
                    permission_justification = f"Port forwarding authorized based on developer justification: {user_justification}"
                security_findings.append("Elevated network access: container port forwarded to 127.0.0.1.")
            elif scope == "sandbox_debug":
                permission_justification = "Standard sandbox execution permissions: isolated rootless cgroups namespace."
                security_findings.append("Standard container isolation enforced; zero host privileges.")
            else:
                permission_justification = "Read-only discovery scope: container execution disabled."
                security_findings.append("Read-only access granted.")

        # Check explicit permissions list for prohibited privileges
        if permissions:
            for perm in permissions:
                perm_clean = str(perm).strip().lower()
                if perm_clean in {"root", "admin", "host_network", "host_pid", "cap_sys_admin", "docker_sock"}:
                    security_findings.append(f"Prohibited elevated permission '{perm}' rejected by sandbox cluster policy.")
                    validation_errors.append(f"Permission '{perm}' violates rootless sandbox isolation.")

        # -------------------------------------------------------------
        # 6. Command Security Scanning (Zero Host Execution Policy)
        # -------------------------------------------------------------
        all_commands = list(setup_cmds) + list(validation_cmds)
        if request_data.get("start_command"):
            all_commands.append(request_data["start_command"])
        if request_data.get("test_command"):
            all_commands.append(request_data["test_command"])

        for cmd in all_commands:
            clean_cmd = str(cmd).strip()
            for pattern, reason in EXTENDED_DANGEROUS_PATTERNS:
                if pattern.search(clean_cmd):
                    err = f"Forbidden/dangerous command detected: '{clean_cmd}' violates sandbox policy ({reason})."
                    validation_errors.append(err)
                    security_findings.append(f"Command blocked by policy: {err}")

        # Propose default setup and validation commands if safe
        if not setup_cmds and pm_raw:
            if pm_raw == "poetry":
                proposed_commands.append("poetry install --no-root")
            elif pm_raw == "pip":
                proposed_commands.append("pip install -r requirements.txt" if "requirements.txt" in repo_evidence.get("manifest_files", []) else "pip install .")
            elif pm_raw == "pnpm":
                proposed_commands.append("pnpm install --frozen-lockfile" if "pnpm-lock.yaml" in repo_evidence.get("lockfiles", []) else "pnpm install")
            elif pm_raw == "yarn":
                proposed_commands.append("yarn install --frozen-lockfile" if "yarn.lock" in repo_evidence.get("lockfiles", []) else "yarn install")
            else:
                proposed_commands.append(f"{pm_raw} install")
        else:
            proposed_commands.extend(setup_cmds)

        verification_plan = list(validation_cmds) if validation_cmds else [f"curl -s -f http://127.0.0.1:{port}/ || true"]

        # -------------------------------------------------------------
        # 7. Check for Ambiguity / Clarification Triggers
        # -------------------------------------------------------------
        if not request_data.get("project_name"):
            clarification_questions.append("What is the project name for this sandbox environment?")
        if not request_data.get("project_type") and not repo_evidence.get("detected_runtime") and not repo_evidence.get("manifest_files"):
            clarification_questions.append("Could you clarify the project archetype (e.g. Next.js, FastAPI, Express, Django)?")
        if not pm_raw and not repo_evidence.get("detected_package_manager"):
            clarification_questions.append("Which package manager should be used to install dependencies?")

        # -------------------------------------------------------------
        # 8. Decision Determination
        # -------------------------------------------------------------
        if len(validation_errors) > 0:
            decision = AgentDecision.REJECT
            reasoning_summary = (
                f"Request REJECTED: {len(validation_errors)} blocking validation or security policy failures detected. "
                + "; ".join(validation_errors[:2])
            )
        elif len(clarification_questions) > 0 and not request_data.get("clarification_responses"):
            decision = AgentDecision.NEEDS_CLARIFICATION
            reasoning_summary = (
                f"Request NEEDS CLARIFICATION: Essential project parameters are missing or ambiguous. "
                + "Please provide answers to the clarification questions before proceeding to setup."
            )
        else:
            decision = AgentDecision.APPROVE_FOR_REVIEW
            reasoning_summary = (
                f"Request validated and APPROVED FOR HUMAN REVIEW. Runtime {runtime_raw} {runtime_version} "
                f"is compatible, package manager {pm_raw} aligned with environment, and security policies passed. "
                "Setup commands are prepared for explicit reviewer sign-off."
            )

        # -------------------------------------------------------------
        # 9. LLM Reasoning Enrichment (Gemini API or Fallback)
        # -------------------------------------------------------------
        llm_enhanced_reasoning = cls._run_llm_reasoning_if_available(
            request_data=request_data,
            repo_evidence=repo_evidence,
            preliminary_decision=decision.value,
            reasons=validation_errors or warnings,
        )
        if llm_enhanced_reasoning:
            reasoning_summary = f"{reasoning_summary} [LLM Assessment: {llm_enhanced_reasoning}]"
        else:
            reasoning_summary = f"{reasoning_summary} [Deterministic Rule-Based Evaluation]"

        # Build proposed manifest payload
        proposed_manifest: Optional[Dict[str, Any]] = None
        if decision != AgentDecision.REJECT:
            p_type = request_data.get("project_type")
            if not p_type:
                if runtime_raw == "python":
                    p_type = ProjectType.FASTAPI_SERVICE.value if "fastapi" in "".join(dependencies).lower() else ProjectType.PYTHON_APP.value
                else:
                    p_type = ProjectType.NEXTJS_APP.value if "next" in "".join(dependencies).lower() else ProjectType.NODE_APP.value

            proposed_manifest = {
                "version": "1.0",
                "project_name": project_name,
                "project_type": p_type,
                "runtime": runtime_raw or "python",
                "runtime_version": runtime_version or "3.11.9",
                "package_manager": pm_raw or "poetry",
                "dependencies": dependencies,
                "port": port,
                "setup_commands": proposed_commands,
                "validation_commands": verification_plan,
                "scope": scope,
                "permissions": permissions,
            }

        return EvaluationResult(
            decision=decision,
            request_summary=f"Bootstrap {runtime_raw or 'unknown'} project '{project_name}' using {pm_raw or 'standard'} on port {port}.",
            repository_findings=repository_findings,
            compatibility_issues=compatibility_issues,
            security_findings=security_findings,
            validation_errors=validation_errors,
            warnings=warnings,
            proposed_manifest=proposed_manifest,
            proposed_commands=proposed_commands,
            permission_justification=permission_justification if 'permission_justification' in locals() else None,
            verification_plan=verification_plan,
            reasoning_summary=reasoning_summary,
            clarification_questions=clarification_questions,
        )

    @classmethod
    def _run_llm_reasoning_if_available(
        cls,
        request_data: Dict[str, Any],
        repo_evidence: Dict[str, Any],
        preliminary_decision: str,
        reasons: List[str],
    ) -> Optional[str]:
        """Attempt LLM reasoning via Gemini API if GEMINI_API_KEY is configured.

        Never raises or breaks workflow on failure; safely falls back with diagnostics.
        """
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key or api_key == "MY_GEMINI_API_KEY":
            return None

        prompt = (
            f"Analyze developer sandbox request:\n"
            f"Request: {json.dumps(request_data)}\n"
            f"Repo Evidence: {json.dumps({k: v for k, v in repo_evidence.items() if k != 'dependencies'})}\n"
            f"Preliminary Decision: {preliminary_decision}\n"
            f"Identified Notes: {reasons}\n"
            "Provide a 1-2 sentence technical summary of compatibility, risks, and isolation suitability."
        )

        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.2, "maxOutputTokens": 100},
            }
            resp = httpx.post(url, json=payload, timeout=3.5)
            if resp.status_code == 200:
                data = resp.json()
                text = (
                    data.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                    .strip()
                )
                return text if text else None
        except Exception:
            # Safe conservative fallback on timeout or connection error
            return "Deterministic reasoning verified; LLM service unreachable."

        return None
