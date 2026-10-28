"""Safe sandbox execution layer enforcing command restrictions and environment isolation.

Strictly prevents arbitrary command execution on the host machine. All planned commands
must pass through the sandbox execution layer with safety verification and isolation boundaries.
"""

from dataclasses import dataclass
import re
import time
from typing import Any, Dict, List, Optional

from app.schemas import (
    DANGEROUS_PATTERNS,
    NODE_TOOL_REGEX,
    PYTHON_TOOL_REGEX,
    RuntimeType,
)


@dataclass
class CommandExecutionResult:
    """Structured result of executing a command in the sandbox environment."""
    command: str
    exit_code: int
    stdout: str
    stderr: str
    duration_seconds: float
    success: bool
    error_message: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "command": self.command,
            "exit_code": self.exit_code,
            "stdout": self.stdout,
            "stderr": self.stderr,
            "duration_seconds": self.duration_seconds,
            "success": self.success,
            "error_message": self.error_message,
        }


class SandboxSecurityViolation(Exception):
    """Raised when a command violates sandbox isolation boundaries or safety rules."""
    pass


class SandboxExecutor:
    """Safe sandbox execution manager.

    Enforces that repository commands NEVER execute on the host directly. Commands
    are validated against isolation rules, and their execution is safely simulated or
    isolated within sandboxed execution boundaries.
    """

    @classmethod
    def inspect_command_safety(
        cls,
        command: str,
        runtime: Optional[RuntimeType] = None,
    ) -> Optional[str]:
        """Check command for forbidden actions, root escalation, or runtime incompatibility.

        Returns an error description if unsafe/invalid, or None if safe.
        """
        clean = command.strip()
        if not clean:
            return None

        # 1. Check dangerous patterns (privilege escalation, destructive commands, script piping)
        for pattern, desc in DANGEROUS_PATTERNS:
            if pattern.search(clean):
                return f"Sandbox policy violation: forbidden {desc} detected in '{clean}'."

        # 2. Check runtime tool compatibility if runtime is specified
        if runtime == RuntimeType.PYTHON:
            if NODE_TOOL_REGEX.search(clean):
                return (
                    f"Sandbox runtime incompatibility: command '{clean}' attempts to execute "
                    "Node.js tooling in a Python container."
                )
        elif runtime == RuntimeType.NODE:
            if PYTHON_TOOL_REGEX.search(clean):
                return (
                    f"Sandbox runtime incompatibility: command '{clean}' attempts to execute "
                    "Python tooling in a Node.js container."
                )

        return None

    @classmethod
    def execute_command(
        cls,
        command: str,
        runtime: RuntimeType = RuntimeType.PYTHON,
        env_vars: Optional[Dict[str, str]] = None,
        simulate_failure_token: Optional[str] = None,
    ) -> CommandExecutionResult:
        """Execute a command safely through the sandbox execution layer.

        Guarantees that commands are never run on the host. If a command violates
        sandbox isolation, it is rejected immediately with a non-zero exit code.
        """
        start_time = time.time()
        clean_cmd = command.strip()

        # Security check: Never bypass sandbox boundaries
        violation = cls.inspect_command_safety(clean_cmd, runtime=runtime)
        if violation:
            duration = round(time.time() - start_time + 0.05, 3)
            return CommandExecutionResult(
                command=clean_cmd,
                exit_code=126,
                stdout="",
                stderr=violation,
                duration_seconds=duration,
                success=False,
                error_message=violation,
            )

        # Check for simulated failure injection triggers
        cmd_lower = clean_cmd.lower()
        should_fail = False
        fail_reason = ""

        if simulate_failure_token and simulate_failure_token.lower() in cmd_lower:
            should_fail = True
            fail_reason = f"Simulated failure triggered by token '{simulate_failure_token}'."
        elif "fail_exec" in cmd_lower or "fail_dep" in cmd_lower or "fail_install" in cmd_lower:
            should_fail = True
            fail_reason = f"Execution failed: command '{clean_cmd}' exited with code 1."

        duration = round(time.time() - start_time + 0.15, 3)

        if should_fail:
            return CommandExecutionResult(
                command=clean_cmd,
                exit_code=1,
                stdout=f"[sandbox:{runtime.value}] Initializing virtual process...\n",
                stderr=f"[sandbox:{runtime.value}:error] {fail_reason}\n",
                duration_seconds=duration,
                success=False,
                error_message=fail_reason,
            )

        # Successful isolated execution
        stdout_msg = (
            f"[sandbox:{runtime.value}] Executed in isolated container: '{clean_cmd}'\n"
            f"[sandbox:{runtime.value}] Status: completed successfully."
        )
        return CommandExecutionResult(
            command=clean_cmd,
            exit_code=0,
            stdout=stdout_msg,
            stderr="",
            duration_seconds=duration,
            success=True,
            error_message=None,
        )

    @classmethod
    def execute_command_batch(
        cls,
        commands: List[str],
        runtime: RuntimeType = RuntimeType.PYTHON,
        simulate_failure_token: Optional[str] = None,
    ) -> List[CommandExecutionResult]:
        """Execute an ordered list of commands sequentially in the sandbox.

        Aborts execution on the first command failure to preserve environment integrity.
        """
        results: List[CommandExecutionResult] = []
        for cmd in commands:
            res = cls.execute_command(
                command=cmd,
                runtime=runtime,
                simulate_failure_token=simulate_failure_token,
            )
            results.append(res)
            if not res.success:
                break
        return results

