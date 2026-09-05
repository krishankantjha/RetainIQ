#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e
echo "=== Starting Environment Setup ==="
# 1. Verify Python is installed
if ! command -v python &> /dev/null
then
    echo "ERROR: python could not be found. Please install Python 3.9+."
    exit 1
fi
# 2. Resolve paths (navigate to repository root)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"
echo "Repository Root: $ROOT_DIR"
# 3. Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment 'venv'..."
    python -m venv venv
else
    echo "Virtual environment 'venv' already exists."
fi
# 4. Activate virtual environment (handles Linux/macOS and Windows styles)
echo "Activating virtual environment..."
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    source venv/Scripts/activate
else
    source venv/bin/activate
fi
# 5. Upgrade package manager and install requirements
echo "Upgrading pip..."
python -m pip install --upgrade pip
echo "Installing dependencies from backend/requirements-dev.txt..."
pip install -r backend/requirements-dev.txt
# 6. Duplicate env template (repo root — shared by backend, frontend, Docker)
if [ ! -f ".env" ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "SUCCESS: .env created at repo root. Remember to replace placeholder values."
else
    echo "INFO: .env already exists at repo root. Skipping copy."
fi
echo "=== Setup Completed Successfully ==="
echo "To activate your virtual environment, run:"
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    echo "  source venv/Scripts/activate"
else
    echo "  source venv/bin/activate"
fi
