"""Fernet-based encryption for API keys stored at rest."""

import logging
import os

from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)


class EncryptionError(Exception):
    """Raised when encryption/decryption fails (missing keyfile, corrupt key, etc.)."""


def get_or_create_key(path: str) -> str:
    """Read or generate a Fernet key at the given path.

    Creates the file with 0o600 permissions if it doesn't exist.
    Returns the key as a URL-safe base64 string.
    """
    if os.path.exists(path):
        with open(path) as f:
            return f.read().strip()

    key = Fernet.generate_key().decode()
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        os.write(fd, key.encode())
    finally:
        os.close(fd)
    return key


def encrypt_value(plaintext: str, keyfile_path: str) -> str:
    """Encrypt a plaintext string using the Fernet key at keyfile_path."""
    key = get_or_create_key(keyfile_path)
    f = Fernet(key.encode())
    return f.encrypt(plaintext.encode()).decode()


def decrypt_value(ciphertext: str, keyfile_path: str) -> str:
    """Decrypt a ciphertext string using the Fernet key at keyfile_path.

    Raises EncryptionError if the keyfile is missing, corrupt, or the wrong key.
    """
    if not os.path.exists(keyfile_path):
        raise EncryptionError(f"Keyfile not found: {keyfile_path}")

    try:
        with open(keyfile_path) as f:
            key = f.read().strip()
        fernet = Fernet(key.encode())
        return fernet.decrypt(ciphertext.encode()).decode()
    except (InvalidToken, ValueError) as e:
        raise EncryptionError(f"Decryption failed: {e}") from e
