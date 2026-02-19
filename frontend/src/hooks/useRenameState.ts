"use client";

import { useState, useRef, useEffect } from "react";

export function useRenameState(currentName: string, onRename: (newName: string) => void) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const startRename = () => {
    setRenameValue(currentName);
    setIsRenaming(true);
  };

  const handleSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== currentName) {
      onRename(trimmed);
    }
    setIsRenaming(false);
    setRenameValue(currentName);
  };

  const handleCancel = () => {
    setIsRenaming(false);
    setRenameValue(currentName);
  };

  return { isRenaming, renameValue, setRenameValue, startRename, handleSubmit, handleCancel, inputRef };
}
