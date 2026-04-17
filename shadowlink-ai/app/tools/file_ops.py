"""File operations tool — read, write, and manage files.

Provides file system operations for the agent, with path restriction
to prevent access outside allowed directories.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from app.models.mcp import ToolCategory
from app.tools.base import ShadowLinkTool


class FileReadInput(BaseModel):
    path: str = Field(description="File path to read")
    max_lines: int = Field(default=100, ge=1, le=1000, description="Maximum lines to read")


class FileReadTool(ShadowLinkTool):
    """Read file contents."""

    name: str = "file_read"
    description: str = "Read the contents of a file. Returns the text content."
    args_schema: type[BaseModel] = FileReadInput
    category: ToolCategory = ToolCategory.FILE

    allowed_dirs: list[str] = Field(default_factory=lambda: ["./data"])

    def _run(self, path: str, max_lines: int = 100) -> str:
        raise NotImplementedError("Use async version")

    async def _arun(self, path: str, max_lines: int = 100) -> str:
        """Read a file with path restrictions."""
        # 1. Try resolving as absolute or relative to CWD
        file_path = Path(path).resolve()
        allowed = any(str(file_path).startswith(str(Path(d).resolve())) for d in self.allowed_dirs)
        
        # 2. If not allowed, try resolving relative to each allowed directory
        if not allowed:
            for d in self.allowed_dirs:
                temp_path = (Path(d) / path).resolve()
                if str(temp_path).startswith(str(Path(d).resolve())):
                    file_path = temp_path
                    allowed = True
                    break

        if not allowed:
            return f"Error: Access denied to {path}. Allowed directories: {self.allowed_dirs}"

        if not file_path.exists():
            return f"Error: File not found: {path}"

        try:
            lines = file_path.read_text(encoding="utf-8").splitlines()[:max_lines]
            return "\n".join(lines)
        except Exception as exc:
            return f"Error reading file: {exc}"


class FileWriteInput(BaseModel):
    path: str = Field(description="File path to write")
    content: str = Field(description="Content to write to the file")


class FileWriteTool(ShadowLinkTool):
    """Write content to a file."""

    name: str = "file_write"
    description: str = "Create a new file or overwrite an existing one with the provided content."
    args_schema: type[BaseModel] = FileWriteInput
    category: ToolCategory = ToolCategory.FILE

    allowed_dirs: list[str] = Field(default_factory=lambda: ["./data"])

    def _run(self, path: str, content: str) -> str:
        raise NotImplementedError("Use async version")

    async def _arun(self, path: str, content: str) -> str:
        """Write content to a file with path restrictions."""
        # 1. Try resolving as absolute or relative to CWD
        file_path = Path(path).expanduser().resolve()
        allowed = any(str(file_path).startswith(str(Path(d).resolve())) for d in self.allowed_dirs)
        
        # 2. If not allowed, try resolving relative to each allowed directory
        if not allowed:
            for d in self.allowed_dirs:
                temp_path = (Path(d) / path).expanduser().resolve()
                if str(temp_path).startswith(str(Path(d).resolve())):
                    file_path = temp_path
                    allowed = True
                    break

        if not allowed:
            return f"Error: Access denied to {path}. Allowed directories: {self.allowed_dirs}"

        try:
            # Ensure the directory exists
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Write with explicit encoding
            file_path.write_text(content, encoding="utf-8")
            
            # Get the absolute path to show to the user
            abs_path = str(file_path.absolute())
            print(f"DEBUG: FileWriteTool wrote to {abs_path}")
            
            return f"Successfully wrote file to absolute path: {abs_path}"
        except Exception as exc:
            print(f"DEBUG: FileWriteTool failed to write to {file_path}: {exc}")
            return f"Error writing file: {exc}"
