"""Business logic for validating, discovering, and normalizing developer setup manifests."""

import json
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Tuple, Union
from pydantic import ValidationError
import yaml

from app.schemas import (
    ManifestDiscoveryResult,
    PackageManager,
    ProjectType,
    RuntimeType,
    SetupManifest,
    ValidationErrorDetail,
    ValidationResult,
)


MANIFEST_SEARCH_FILENAMES = [
    "sandbox.manifest.json",
    "sandbox.manifest.yaml",
    "sandbox.manifest.yml",
    ".sandbox/manifest.json",
    ".sandbox/manifest.yaml",
    ".sandbox/manifest.yml",
    "setup.manifest.json",
    "setup.manifest.yaml",
    "setup.manifest.yml",
    ".sandbox.json",
    ".sandbox.yaml",
    ".sandbox.yml",
]


class ManifestService:
    """Service to validate, discover, load, and normalize setup manifests."""

    @classmethod
    def validate_manifest_data(cls, raw_data: Dict[str, Any]) -> ValidationResult:
        """Validate an arbitrary dictionary against the SetupManifest schema.

        If raw_data specifies a repo_path and lacks other core fields, it triggers
        automatic manifest discovery in that directory.
        """
        errors: List[ValidationErrorDetail] = []
        warnings: List[str] = []
        normalized: Optional[SetupManifest] = None

        # Check if auto-discovery is requested via repo_path
        repo_path_val = raw_data.get("repo_path")
        is_discovery_only = (
            repo_path_val is not None
            and "project_name" not in raw_data
            and "runtime" not in raw_data
        )

        if is_discovery_only:
            disc_res = cls.discover_manifest(repo_path_val)
            if disc_res.discovered and disc_res.manifest is not None:
                return ValidationResult(
                    is_valid=True,
                    errors=[],
                    warnings=disc_res.warnings,
                    normalized_manifest=disc_res.manifest,
                )
            elif disc_res.errors:
                return ValidationResult(
                    is_valid=False,
                    errors=disc_res.errors,
                    warnings=disc_res.warnings,
                    normalized_manifest=None,
                )
            elif disc_res.is_fallback and disc_res.manifest is not None:
                return ValidationResult(
                    is_valid=True,
                    errors=[],
                    warnings=disc_res.warnings,
                    normalized_manifest=disc_res.manifest,
                )

        try:
            normalized = SetupManifest(**raw_data)

            # Business-level warnings
            if not normalized.dependencies:
                warnings.append("No dependencies declared in manifest. Default baseline packages will be used.")
            if not normalized.validation_commands and not normalized.test_command:
                warnings.append("No custom test or validation command specified. Standard smoke test probes will be executed.")
            if not normalized.start_command:
                warnings.append(
                    f"No custom start command specified. Default start command for {normalized.package_manager.value} will be applied."
                )

            return ValidationResult(
                is_valid=True,
                errors=[],
                warnings=warnings,
                normalized_manifest=normalized,
            )

        except ValidationError as exc:
            for err in exc.errors():
                loc_path = " -> ".join(str(part) for part in err["loc"]) if err.get("loc") else "manifest"
                msg = err["msg"]
                if msg.startswith("Value error, "):
                    msg = msg[len("Value error, "):]

                errors.append(
                    ValidationErrorDetail(
                        field=loc_path,
                        message=msg,
                        error_type=err.get("type", "value_error"),
                    )
                )

            return ValidationResult(
                is_valid=False,
                errors=errors,
                warnings=warnings,
                normalized_manifest=None,
            )
        except Exception as exc:
            errors.append(
                ValidationErrorDetail(
                    field="manifest",
                    message=f"Unexpected error during manifest validation: {str(exc)}",
                    error_type="system_error",
                )
            )
            return ValidationResult(
                is_valid=False,
                errors=errors,
                warnings=warnings,
                normalized_manifest=None,
            )

    @classmethod
    def load_manifest_file(cls, file_path: Union[str, Path]) -> Tuple[Optional[SetupManifest], List[ValidationErrorDetail]]:
        """Load and parse a manifest file from disk (JSON or YAML)."""
        path = Path(file_path).resolve()
        if not path.is_file():
            return None, [
                ValidationErrorDetail(
                    field="file_path",
                    message=f"Manifest file not found: {path}",
                    error_type="file_not_found",
                )
            ]

        try:
            content = path.read_text(encoding="utf-8")
        except Exception as exc:
            return None, [
                ValidationErrorDetail(
                    field="file_read",
                    message=f"Could not read manifest file: {str(exc)}",
                    error_type="io_error",
                )
            ]

        raw_data: Optional[Dict[str, Any]] = None
        if path.suffix.lower() == ".json":
            try:
                raw_data = json.loads(content)
            except json.JSONDecodeError as exc:
                return None, [
                    ValidationErrorDetail(
                        field="json_syntax",
                        message=f"Malformed JSON in manifest: {exc.msg} at line {exc.lineno} column {exc.colno}.",
                        error_type="json_decode_error",
                    )
                ]
        else:
            try:
                raw_data = yaml.safe_load(content)
            except yaml.YAMLError as exc:
                return None, [
                    ValidationErrorDetail(
                        field="yaml_syntax",
                        message=f"Malformed YAML in manifest: {str(exc)}",
                        error_type="yaml_decode_error",
                    )
                ]

        if not isinstance(raw_data, dict):
            return None, [
                ValidationErrorDetail(
                    field="manifest_root",
                    message="Manifest content must be a key-value mapping / dictionary object.",
                    error_type="type_error",
                )
            ]

        # Attach repo_path if not set
        if "repo_path" not in raw_data:
            raw_data["repo_path"] = str(path.parent)

        validation = cls.validate_manifest_data(raw_data)
        if validation.is_valid and validation.normalized_manifest:
            return validation.normalized_manifest, []
        return None, validation.errors

    @classmethod
    def discover_manifest(cls, repo_path: Union[str, Path]) -> ManifestDiscoveryResult:
        """Search a repository for a setup manifest, inferring configuration or applying a fallback.

        Discovery order:
        1. Explicit manifest files (sandbox.manifest.json, sandbox.manifest.yaml, etc.)
        2. Automatic inference from pyproject.toml / requirements.txt (Python projects)
        3. Automatic inference from package.json (Node.js projects)
        4. Heuristic inference from repository source files
        5. Sensible default fallback manifest if repository is unconfigured or empty
        """
        root = Path(repo_path).resolve()
        if not root.exists() or not root.is_dir():
            fallback_manifest = cls._build_default_fallback("unresolved-repo")
            return ManifestDiscoveryResult(
                discovered=False,
                source="fallback: path_not_found",
                manifest_file_path=None,
                manifest=fallback_manifest,
                is_fallback=True,
                warnings=[f"Repository path '{root}' does not exist or is not a directory. Fallback manifest applied."],
            )

        # 1. Search for explicit manifest files
        for rel_path in MANIFEST_SEARCH_FILENAMES:
            target = root / rel_path
            if target.is_file():
                manifest, errors = cls.load_manifest_file(target)
                if manifest is not None:
                    return ManifestDiscoveryResult(
                        discovered=True,
                        source=f"explicit_file: {rel_path}",
                        manifest_file_path=str(target),
                        manifest=manifest,
                        is_fallback=False,
                        warnings=[],
                    )
                else:
                    # Explicit manifest exists but has errors
                    err_msg = "; ".join(e.message for e in errors)
                    warnings = [f"Found manifest file '{rel_path}' but it contained validation errors: {err_msg}."]
                    return ManifestDiscoveryResult(
                        discovered=False,
                        source=f"explicit_file: {rel_path}",
                        manifest_file_path=str(target),
                        manifest=None,
                        is_fallback=False,
                        warnings=warnings,
                        errors=errors,
                    )

        # 2. Inquire project indicators: Python (pyproject.toml, requirements.txt)
        pyproject = root / "pyproject.toml"
        requirements = root / "requirements.txt"

        if pyproject.is_file():
            inferred = cls._infer_python_pyproject(root, pyproject)
            if inferred:
                return ManifestDiscoveryResult(
                    discovered=True,
                    source="inferred: pyproject.toml",
                    manifest_file_path=str(pyproject),
                    manifest=inferred,
                    is_fallback=False,
                    warnings=["Manifest auto-discovered and inferred from pyproject.toml."],
                )

        if requirements.is_file():
            inferred = cls._infer_python_requirements(root, requirements)
            if inferred:
                return ManifestDiscoveryResult(
                    discovered=True,
                    source="inferred: requirements.txt",
                    manifest_file_path=str(requirements),
                    manifest=inferred,
                    is_fallback=False,
                    warnings=["Manifest auto-discovered and inferred from requirements.txt."],
                )

        # 3. Inquire project indicators: Node.js (package.json)
        pkg_json = root / "package.json"
        if pkg_json.is_file():
            inferred = cls._infer_node_package_json(root, pkg_json)
            if inferred:
                return ManifestDiscoveryResult(
                    discovered=True,
                    source="inferred: package.json",
                    manifest_file_path=str(pkg_json),
                    manifest=inferred,
                    is_fallback=False,
                    warnings=["Manifest auto-discovered and inferred from package.json."],
                )

        # 4. Heuristic inference from code files
        py_files = list(root.glob("*.py"))
        if py_files:
            inferred = cls._build_default_python_manifest(root.name)
            return ManifestDiscoveryResult(
                discovered=True,
                source="heuristic: python_source_files",
                manifest_file_path=None,
                manifest=inferred,
                is_fallback=False,
                warnings=["Inferred Python project configuration from repository source files."],
            )

        js_ts_files = list(root.glob("*.js")) + list(root.glob("*.ts"))
        if js_ts_files:
            inferred = cls._build_default_node_manifest(root.name)
            return ManifestDiscoveryResult(
                discovered=True,
                source="heuristic: node_source_files",
                manifest_file_path=None,
                manifest=inferred,
                is_fallback=False,
                warnings=["Inferred Node.js project configuration from repository source files."],
            )

        # 5. Sensible default fallback
        fallback = cls._build_default_fallback(root.name)
        return ManifestDiscoveryResult(
            discovered=False,
            source="fallback: default",
            manifest_file_path=None,
            manifest=fallback,
            is_fallback=True,
            warnings=["No setup manifest or recognized project configuration found. Sensible default fallback manifest generated."],
        )

    # --- Internal inference helpers ---

    @classmethod
    def _sanitize_name(cls, raw: str) -> str:
        clean = re.sub(r"[^a-zA-Z0-9_\-\.]", "-", raw).strip("-")
        return clean[:80] if clean else "developer-sandbox"

    @classmethod
    def _infer_python_pyproject(cls, root: Path, file_path: Path) -> Optional[SetupManifest]:
        try:
            content = file_path.read_text(encoding="utf-8")
        except Exception:
            return None

        clean_name = cls._sanitize_name(root.name)
        package_manager = PackageManager.POETRY if "[tool.poetry]" in content else PackageManager.PIP
        dependencies: List[str] = []

        # Parse basic dependencies
        dep_section = False
        for line in content.splitlines():
            line_str = line.strip()
            if line_str.startswith("[tool.poetry.dependencies]") or line_str.startswith("[project.dependencies]"):
                dep_section = True
                continue
            elif line_str.startswith("[") and dep_section:
                dep_section = False
            if dep_section and line_str and not line_str.startswith("#"):
                match = re.match(r'^([a-zA-Z0-9_\-\.]+)', line_str)
                if match:
                    pkg = match.group(1).lower()
                    if pkg != "python":
                        dependencies.append(pkg)

        # Determine archetype
        has_fastapi = any("fastapi" in d for d in dependencies) or "fastapi" in content.lower()
        has_django = any("django" in d for d in dependencies) or "django" in content.lower()

        if has_fastapi:
            project_type = ProjectType.FASTAPI_SERVICE
            port = 8000
            start_cmd = "poetry run uvicorn main:app --port 8000" if package_manager == PackageManager.POETRY else "uvicorn main:app --port 8000"
        elif has_django:
            project_type = ProjectType.DJANGO_APP
            port = 8000
            start_cmd = "python manage.py runserver 0.0.0.0:8000"
        else:
            project_type = ProjectType.PYTHON_APP
            port = 8000
            start_cmd = "python main.py" if (root / "main.py").exists() else None

        setup_cmds = ["poetry install"] if package_manager == PackageManager.POETRY else ["pip install ."]
        val_cmds = ["poetry run pytest"] if package_manager == PackageManager.POETRY else ["pytest"]

        return SetupManifest(
            version="1.0",
            project_name=clean_name,
            project_type=project_type,
            runtime=RuntimeType.PYTHON,
            language="python",
            runtime_version="3.11.9",
            package_manager=package_manager,
            dependencies=dependencies[:10],
            env_var_names=["PORT"],
            port=port,
            setup_commands=setup_cmds,
            validation_commands=val_cmds,
            start_command=start_cmd,
            test_command=val_cmds[0],
            repo_path=str(root),
        )

    @classmethod
    def _infer_python_requirements(cls, root: Path, file_path: Path) -> Optional[SetupManifest]:
        try:
            content = file_path.read_text(encoding="utf-8")
        except Exception:
            return None

        clean_name = cls._sanitize_name(root.name)
        dependencies: List[str] = []
        for line in content.splitlines():
            clean_l = line.strip()
            if clean_l and not clean_l.startswith("#") and not clean_l.startswith("-"):
                dependencies.append(clean_l)

        has_fastapi = any("fastapi" in d.lower() for d in dependencies)
        has_django = any("django" in d.lower() for d in dependencies)

        if has_fastapi:
            project_type = ProjectType.FASTAPI_SERVICE
            port = 8000
            start_cmd = "uvicorn main:app --port 8000"
        elif has_django:
            project_type = ProjectType.DJANGO_APP
            port = 8000
            start_cmd = "python manage.py runserver 0.0.0.0:8000"
        else:
            project_type = ProjectType.PYTHON_APP
            port = 8000
            start_cmd = "python main.py" if (root / "main.py").exists() else None

        return SetupManifest(
            version="1.0",
            project_name=clean_name,
            project_type=project_type,
            runtime=RuntimeType.PYTHON,
            language="python",
            runtime_version="3.11.9",
            package_manager=PackageManager.PIP,
            dependencies=dependencies[:10],
            env_var_names=["PORT"],
            port=port,
            setup_commands=["pip install -r requirements.txt"],
            validation_commands=["pytest"],
            start_command=start_cmd,
            test_command="pytest",
            repo_path=str(root),
        )

    @classmethod
    def _infer_node_package_json(cls, root: Path, file_path: Path) -> Optional[SetupManifest]:
        try:
            data = json.loads(file_path.read_text(encoding="utf-8"))
        except Exception:
            return None

        clean_name = cls._sanitize_name(data.get("name") or root.name)

        # Detect package manager from lockfiles
        if (root / "pnpm-lock.yaml").exists():
            package_manager = PackageManager.PNPM
        elif (root / "yarn.lock").exists():
            package_manager = PackageManager.YARN
        elif (root / "bun.lockb").exists() or (root / "bun.lock").exists():
            package_manager = PackageManager.BUN
        else:
            package_manager = PackageManager.NPM

        all_deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
        dep_list = [f"{k}@{v}" for k, v in list(all_deps.items())[:10]]

        if "next" in all_deps:
            project_type = ProjectType.NEXTJS_APP
            language = "typescript" if (root / "tsconfig.json").exists() else "javascript"
            port = 3000
        elif "express" in all_deps:
            project_type = ProjectType.EXPRESS_API
            language = "javascript"
            port = 3000
        else:
            project_type = ProjectType.NODE_APP
            language = "typescript" if (root / "tsconfig.json").exists() else "javascript"
            port = 3000

        scripts = data.get("scripts", {})
        start_cmd = None
        if "dev" in scripts:
            start_cmd = f"{package_manager.value} run dev"
        elif "start" in scripts:
            start_cmd = f"{package_manager.value} start"

        test_cmd = f"{package_manager.value} test" if "test" in scripts else None

        return SetupManifest(
            version="1.0",
            project_name=clean_name,
            project_type=project_type,
            runtime=RuntimeType.NODE,
            language=language,
            runtime_version="20.14.0",
            package_manager=package_manager,
            dependencies=dep_list,
            env_var_names=["PORT"],
            port=port,
            setup_commands=[f"{package_manager.value} install"],
            validation_commands=[test_cmd] if test_cmd else [],
            start_command=start_cmd,
            test_command=test_cmd,
            repo_path=str(root),
        )

    @classmethod
    def _build_default_python_manifest(cls, name: str) -> SetupManifest:
        clean_name = cls._sanitize_name(name)
        return SetupManifest(
            version="1.0",
            project_name=clean_name,
            project_type=ProjectType.PYTHON_APP,
            runtime=RuntimeType.PYTHON,
            language="python",
            runtime_version="3.11.9",
            package_manager=PackageManager.PIP,
            dependencies=[],
            env_var_names=["PORT"],
            port=8000,
            setup_commands=[],
            validation_commands=[],
        )

    @classmethod
    def _build_default_node_manifest(cls, name: str) -> SetupManifest:
        clean_name = cls._sanitize_name(name)
        return SetupManifest(
            version="1.0",
            project_name=clean_name,
            project_type=ProjectType.NODE_APP,
            runtime=RuntimeType.NODE,
            language="javascript",
            runtime_version="20.14.0",
            package_manager=PackageManager.NPM,
            dependencies=[],
            env_var_names=["PORT"],
            port=3000,
            setup_commands=[],
            validation_commands=[],
        )

    @classmethod
    def _build_default_fallback(cls, name: str) -> SetupManifest:
        return cls._build_default_python_manifest(name)

    @classmethod
    def get_manifest_schema(cls) -> Dict[str, Any]:
        """Return the JSON Schema for SetupManifest."""
        return SetupManifest.model_json_schema()
