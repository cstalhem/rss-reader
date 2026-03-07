"""CLI entry points for the backend."""

import uvicorn


def dev():
    """Start the development server with hot reload."""
    uvicorn.run("backend.main:app", reload=True, port=8912)
