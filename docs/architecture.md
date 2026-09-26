# Lockora Architecture & Security Model

## 1. Overview
Lockora is a secure secrets-management application designed around a Client-Side Encryption (End-to-End Encryption) architecture. 

## 2. Threat Model
- **Server Compromise**: If the database is leaked, an attacker only gets ciphertexts. The server does not have access to the Vault Password or the plaintext encryption keys.
- **Transport Security**: All communication is over TLS.
- **Client Compromise**: The client is assumed to be trusted. If the client is compromised (e.g., malware), secrets can be stolen when decrypted in memory.
- **"Zero-Knowledge" claim**: Lockora claims zero-knowledge regarding stored sensitive secret values. The server cannot decrypt secrets because it never possesses the necessary decryption keys in plaintext. The server does, however, process authentication and metadata (like secret names, categories) in plaintext for search and display purposes.

## 3. Cryptographic Architecture

To support both secure storage and sharing without giving the server access to plaintext, Lockora uses a hybrid encryption system:

### 3.1 Key Hierarchy
1. **Vault Password**: Provided by the user, never leaves the client.
2. **Master Key (MK)**: Derived on the client from the Vault Password and a user-specific Salt using Argon2id (or PBKDF2).
3. **Asymmetric Key Pair**: Generated on the client during vault setup (e.g., RSA-OAEP or ECDH).
   - **Public Key (PK)**: Stored in plaintext on the server. Used by others to share secrets with this user.
   - **Private Key (SK)**: Encrypted with the Master Key (MK) before being stored on the server.
4. **Secret Data Key (SDK)**: A random symmetric key (e.g., AES-GCM) generated on the client for each individual secret.

### 3.2 Secret Creation
1. Client generates a random `SDK`.
2. Client encrypts the sensitive payload with `SDK` -> `Ciphertext`.
3. Client encrypts `SDK` using the user's own `PK` -> `EncryptedSDK`.
4. Server stores `Ciphertext` and `EncryptedSDK`.

### 3.3 Secret Retrieval (Reveal)
1. User provides Vault Password, unlocking the Master Key (MK).
2. Client fetches their Encrypted Private Key from the server and decrypts it using MK -> `SK`.
3. Client fetches the secret. The server enforces authorization and returns `Ciphertext` + `EncryptedSDK`.
4. Client uses `SK` to decrypt `EncryptedSDK` -> `SDK`.
5. Client uses `SDK` to decrypt `Ciphertext` -> Plaintext Secret.
6. The server records an audit event for the retrieval and sends an email alert if configured.

### 3.4 Secret Sharing
1. User A wants to share a secret with User B.
2. User A's client retrieves User B's `PK` from the server.
3. User A's client unlocks the secret's `SDK` (using User A's `SK`).
4. User A's client encrypts the `SDK` using User B's `PK` -> `EncryptedSDK_B`.
5. Server stores `EncryptedSDK_B` and grants User B access to the secret's `Ciphertext`.

## 4. Vault Session & Auto-Lock
- The derived `Master Key` and `Private Key` are kept in volatile client memory (React State / Context) during an active session.
- If the user explicitly locks the vault, or the auto-lock timeout triggers, the keys are purged from memory.
- The user must re-enter the Vault Password to re-derive the `Master Key`.

## 5. Recovery
- If the Vault Password is lost, the `Private Key` cannot be decrypted.
- Consequently, all secrets become permanently inaccessible unless a Recovery Key was explicitly generated and safely stored by the user during vault setup.
- Administrators CANNOT recover secrets. There is no backdoor.

## 6. Authorization
- The server enforces access control lists (ACLs). A client cannot fetch `EncryptedSDK` or `Ciphertext` unless the database confirms ownership or a valid share record.
- The server performs these checks BEFORE returning any data.

## 7. Metadata
- Fields like `name`, `category`, `tags`, and `expiry` are stored in plaintext to allow server-side searching, sorting, and filtering without decrypting the entire vault.
