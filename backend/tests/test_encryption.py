"""Tests for API key encryption/decryption utility."""

import os
import stat

import pytest

from backend.encryption import (
    EncryptionError,
    decrypt_value,
    encrypt_value,
    get_or_create_key,
)


@pytest.fixture()
def keyfile(tmp_path):
    """Return a path to a non-existent keyfile in a temp directory."""
    return str(tmp_path / ".keyfile")


def test_get_or_create_key_creates_new(keyfile):
    """First call creates the keyfile and returns a key."""
    key = get_or_create_key(keyfile)
    assert key is not None
    assert os.path.exists(keyfile)
    # Key should be URL-safe base64 (Fernet keys are 44 chars)
    assert len(key) == 44


def test_get_or_create_key_permissions(keyfile):
    """Keyfile should be created with 0o600 permissions."""
    get_or_create_key(keyfile)
    mode = os.stat(keyfile).st_mode
    assert stat.S_IMODE(mode) == 0o600


def test_get_or_create_key_reads_existing(keyfile):
    """Second call reads the same key from disk."""
    key1 = get_or_create_key(keyfile)
    key2 = get_or_create_key(keyfile)
    assert key1 == key2


def test_encrypt_decrypt_roundtrip(keyfile):
    """Encrypting then decrypting returns the original value."""
    get_or_create_key(keyfile)
    plaintext = "sk-test-1234567890abcdef"
    ciphertext = encrypt_value(plaintext, keyfile)
    assert ciphertext != plaintext
    result = decrypt_value(ciphertext, keyfile)
    assert result == plaintext


def test_decrypt_with_missing_keyfile(tmp_path):
    """Decrypting with a missing keyfile raises EncryptionError."""
    missing = str(tmp_path / "nonexistent")
    with pytest.raises(EncryptionError):
        decrypt_value("some-ciphertext", missing)


def test_decrypt_with_corrupt_keyfile(keyfile):
    """Decrypting with a corrupt keyfile raises EncryptionError."""
    with open(keyfile, "w") as f:
        f.write("not-a-valid-fernet-key")
    with pytest.raises(EncryptionError):
        decrypt_value("some-ciphertext", keyfile)


def test_decrypt_with_wrong_key(keyfile, tmp_path):
    """Decrypting with a different key raises EncryptionError."""
    get_or_create_key(keyfile)
    ciphertext = encrypt_value("secret", keyfile)

    # Create a second keyfile with a different key
    other_keyfile = str(tmp_path / ".keyfile2")
    get_or_create_key(other_keyfile)

    with pytest.raises(EncryptionError):
        decrypt_value(ciphertext, other_keyfile)
