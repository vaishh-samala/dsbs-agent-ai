"""Developer Sandbox Bootstrapper Backend Root Package."""

import sys
from pathlib import Path

# Ensure backend root is always in sys.path so 'app.*' imports resolve cleanly
_backend_dir = str(Path(__file__).resolve().parent)
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

