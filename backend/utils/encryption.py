"""
AES-256-GCM encryption utilities.
"""
import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def generate_key() -> bytes:
    """Generate a random 256-bit AES key."""
    return os.urandom(32)


def encrypt_text(plaintext: str, key: bytes) -> str:
    """Encrypt text using AES-256-GCM. Returns base64-encoded ciphertext."""
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ct = aesgcm.encrypt(nonce, plaintext.encode('utf-8'), None)
    # Prepend nonce to ciphertext
    return base64.b64encode(nonce + ct).decode('utf-8')


def decrypt_text(ciphertext_b64: str, key: bytes) -> str:
    """Decrypt AES-256-GCM ciphertext."""
    data = base64.b64decode(ciphertext_b64.encode('utf-8'))
    nonce, ct = data[:12], data[12:]
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ct, None).decode('utf-8')


def get_encryption_key() -> bytes:
    """Get key from env or generate a new one."""
    key_b64 = os.getenv('ENCRYPTION_KEY')
    if key_b64:
        return base64.b64decode(key_b64)
    return generate_key()
