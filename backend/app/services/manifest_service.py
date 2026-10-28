"""Business logic for validating and normalizing developer setup manifests."""

from typing import Any, Dict, List, Optional
from pydantic import ValidationError

from app.schemas import (
    SetupManifest,
    ValidationErrorDetail,
    ValidationResult,
)


class ManifestService:
    """Service to validate, normalize, and inspect setup manifests."""

    @classmethod
    def validate_manifest_data(cls, raw_data: Dict[str, Any]) -> ValidationResult:
        """Validate an arbitrary dictionary against the SetupManifest schema."""
        errors: List[ValidationErrorDetail] = []
        warnings: List[str] = []
        normalized: Optional[SetupManifest] = None

        try:
            normalized = SetupManifest(**raw_data)

            # Business-level warnings
            if not normalized.dependencies:
                warnings.append("No dependencies declared in manifest. Default baseline packages will be used.")
            if not normalized.test_command:
                warnings.append("No custom test command specified. Standard smoke test probes will be executed.")
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
                # For root / model validators in Pydantic v2, err['loc'] can be empty
                loc_path = " -> ".join(str(part) for part in err["loc"]) if err.get("loc") else "manifest"
                # Strip Pydantic v2's default 'Value error, ' prefix for cleaner client messages
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
    def get_manifest_schema(cls) -> Dict[str, Any]:
        """Return the JSON Schema for SetupManifest."""
        return SetupManifest.model_json_schema()
