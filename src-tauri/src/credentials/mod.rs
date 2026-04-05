//! Credential storage module for secure password management
//!
//! All credentials are stored using AES-256-GCM file-based encryption.
//! Keys are derived via HKDF-SHA256 from a stored random salt and the machine
//! hostname.

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use hkdf::Hkdf;
use rand::RngCore;
use sha2::Sha256;
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

/// Salt filename for AES encryption
const SALT_FILENAME: &str = "credential_salt";

/// Length of the salt used for key derivation
const SALT_LENGTH: usize = 32;

/// Nonce length for AES-256-GCM
const NONCE_LENGTH: usize = 12;

/// Prefix used by the legacy Keychain storage backend.
/// Placeholders stored in the DB have the format `keychain:{account_id}`.
const KEYCHAIN_PLACEHOLDER_PREFIX: &[u8] = b"keychain:";

/// Errors that can occur during credential operations
#[derive(Debug, Error)]
pub enum CredentialError {
    #[error("Encryption error: {0}")]
    EncryptionError(String),

    #[error("Decryption error: {0}")]
    DecryptionError(String),

    #[error("I/O error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Invalid data: {0}")]
    InvalidData(String),

    #[error("Legacy Keychain credential for account '{0}' must be re-entered via the web UI")]
    KeychainMigrationRequired(String),
}

/// Result type for credential operations
pub type Result<T> = std::result::Result<T, CredentialError>;

/// Credential manager handles secure storage and retrieval of passwords
pub struct CredentialManager {
    app_data_dir: PathBuf,
}

impl CredentialManager {
    /// Create a new credential manager
    ///
    /// # Arguments
    /// * `app_data_dir` - Directory for storing encryption data (salt file)
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self { app_data_dir }
    }

    /// Store a password securely using AES-256-GCM encryption.
    ///
    /// # Arguments
    /// * `_account_id` - Unique identifier for the account (unused, kept for API compat)
    /// * `password` - The password to store
    ///
    /// # Returns
    /// The encrypted bytes for database storage
    pub fn store_password(
        &self,
        _account_id: &str,
        password: &str,
    ) -> Result<Vec<u8>> {
        self.encrypt_password(password)
    }

    /// Retrieve a password by decrypting the stored data.
    ///
    /// Returns `KeychainMigrationRequired` if the data is a legacy Keychain
    /// placeholder, since the Keychain backend has been removed.
    pub fn retrieve_password(&self, account_id: &str, encrypted_data: &[u8]) -> Result<String> {
        if is_keychain_placeholder(encrypted_data) {
            return Err(CredentialError::KeychainMigrationRequired(
                account_id.to_string(),
            ));
        }

        self.decrypt_password(encrypted_data)
    }

    /// Delete a password from storage.
    ///
    /// Encrypted data in the database is deleted by the caller (database delete).
    /// This is now a no-op since all credentials are stored as AES blobs in the DB.
    pub fn delete_password(&self, _account_id: &str, _encrypted_data: &[u8]) -> Result<()> {
        Ok(())
    }

    /// Encrypt password using AES-256-GCM
    fn encrypt_password(&self, password: &str) -> Result<Vec<u8>> {
        let key = self.get_or_create_encryption_key()?;
        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|e| CredentialError::EncryptionError(e.to_string()))?;

        // Generate random nonce
        let mut nonce_bytes = [0u8; NONCE_LENGTH];
        rand::rngs::OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        // Encrypt
        let ciphertext = cipher
            .encrypt(nonce, password.as_bytes())
            .map_err(|e| CredentialError::EncryptionError(e.to_string()))?;

        // Prepend nonce to ciphertext for storage
        let mut result = nonce_bytes.to_vec();
        result.extend(ciphertext);
        Ok(result)
    }

    /// Decrypt password using AES-256-GCM
    fn decrypt_password(&self, encrypted: &[u8]) -> Result<String> {
        if encrypted.len() < NONCE_LENGTH {
            return Err(CredentialError::InvalidData(
                "Encrypted data too short".to_string(),
            ));
        }

        let key = self.get_or_create_encryption_key()?;
        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|e| CredentialError::DecryptionError(e.to_string()))?;

        // Split nonce and ciphertext
        let (nonce_bytes, ciphertext) = encrypted.split_at(NONCE_LENGTH);
        let nonce = Nonce::from_slice(nonce_bytes);

        // Decrypt
        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| CredentialError::DecryptionError(e.to_string()))?;

        String::from_utf8(plaintext)
            .map_err(|e| CredentialError::DecryptionError(e.to_string()))
    }

    /// Get or create the encryption key
    /// Key is derived from a stored salt combined with machine-specific info using HKDF-SHA256
    fn get_or_create_encryption_key(&self) -> Result<[u8; 32]> {
        let salt = self.get_or_create_salt()?;
        let machine_id = self.get_machine_identifier();

        // Use HKDF-SHA256 for proper key derivation
        // IKM (Input Key Material) = machine identifier
        // Salt = stored random salt
        // Info = application context
        let hk = Hkdf::<Sha256>::new(Some(&salt), &machine_id);
        let mut key = [0u8; 32];
        hk.expand(b"iptv-credential-encryption-key-v1", &mut key)
            .map_err(|e| CredentialError::EncryptionError(format!("HKDF expand failed: {}", e)))?;

        Ok(key)
    }

    /// Get or create the encryption salt
    fn get_or_create_salt(&self) -> Result<[u8; SALT_LENGTH]> {
        let salt_path = self.app_data_dir.join(SALT_FILENAME);

        if salt_path.exists() {
            let salt_data = fs::read(&salt_path).map_err(|e| {
                CredentialError::IoError(std::io::Error::new(
                    e.kind(),
                    format!("Failed to read salt file '{}': {}", salt_path.display(), e),
                ))
            })?;
            if salt_data.len() == SALT_LENGTH {
                let mut salt = [0u8; SALT_LENGTH];
                salt.copy_from_slice(&salt_data);
                return Ok(salt);
            }
            // Salt file exists but has wrong length — regenerate it
            eprintln!(
                "Salt file '{}' has invalid length {} (expected {}), regenerating",
                salt_path.display(),
                salt_data.len(),
                SALT_LENGTH,
            );
        }

        // Create new salt
        let mut salt = [0u8; SALT_LENGTH];
        rand::rngs::OsRng.fill_bytes(&mut salt);

        // Ensure directory exists
        if let Some(parent) = salt_path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                CredentialError::IoError(std::io::Error::new(
                    e.kind(),
                    format!(
                        "Failed to create salt directory '{}': {}",
                        parent.display(),
                        e
                    ),
                ))
            })?;
        }

        // Save salt
        fs::write(&salt_path, salt).map_err(|e| {
            CredentialError::IoError(std::io::Error::new(
                e.kind(),
                format!("Failed to write salt file '{}': {}", salt_path.display(), e),
            ))
        })?;

        Ok(salt)
    }

    /// Get a machine-specific identifier
    /// This helps tie the encryption to this specific machine
    fn get_machine_identifier(&self) -> Vec<u8> {
        // Use hostname as a simple machine identifier
        // In production, consider using more robust machine identification
        hostname::get()
            .map(|h| h.to_string_lossy().into_owned())
            .unwrap_or_else(|_| "default-machine".to_string())
            .into_bytes()
    }
}

/// Check whether the given encrypted data is a legacy Keychain placeholder.
pub fn is_keychain_placeholder(data: &[u8]) -> bool {
    data.starts_with(KEYCHAIN_PLACEHOLDER_PREFIX)
}

/// Standalone function to store a password (for backward compatibility)
pub fn store_password(
    app_data_dir: &Path,
    _account_id: &str,
    password: &str,
) -> Result<Vec<u8>> {
    let manager = CredentialManager::new(app_data_dir.to_path_buf());
    manager.store_password(_account_id, password)
}

/// Standalone function to retrieve a password (for backward compatibility)
pub fn retrieve_password(
    app_data_dir: &Path,
    account_id: &str,
    encrypted_data: &[u8],
) -> Result<String> {
    let manager = CredentialManager::new(app_data_dir.to_path_buf());
    manager.retrieve_password(account_id, encrypted_data)
}

/// Standalone function to delete a password (for backward compatibility)
pub fn delete_password(
    app_data_dir: &Path,
    account_id: &str,
    encrypted_data: &[u8],
) -> Result<()> {
    let manager = CredentialManager::new(app_data_dir.to_path_buf());
    manager.delete_password(account_id, encrypted_data)
}

/// Returns the canonical credential storage directory, consistent across desktop
/// and headless modes.
///
/// This resolves the Tauri vs `dirs` path mismatch: Tauri uses an app-identifier
/// based path (e.g. `com.streamforge.app`) while `dirs` uses a plain name. By
/// always using `dirs::data_dir()/streamforge`, credentials encrypted in one
/// mode can be decrypted in the other.
pub fn get_credential_dir() -> PathBuf {
    dirs::data_dir()
        .map(|d| d.join("streamforge"))
        .unwrap_or_else(|| PathBuf::from("."))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::sync::atomic::{AtomicU64, Ordering};

    // Counter to ensure unique test directories for parallel tests
    static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

    fn get_unique_test_app_data_dir() -> PathBuf {
        let count = TEST_COUNTER.fetch_add(1, Ordering::SeqCst);
        let thread_id = std::thread::current().id();
        env::temp_dir().join(format!("iptv_test_credentials_{:?}_{}", thread_id, count))
    }

    #[test]
    fn test_password_encryption_roundtrip() {
        let app_data_dir = get_unique_test_app_data_dir();
        let manager = CredentialManager::new(app_data_dir.clone());

        let password = "test_password_123!@#";
        let encrypted = manager.encrypt_password(password).unwrap();

        // Encrypted should be different from original
        assert_ne!(encrypted, password.as_bytes());

        // Should be able to decrypt back
        let decrypted = manager.decrypt_password(&encrypted).unwrap();
        assert_eq!(decrypted, password);

        // Cleanup
        let _ = fs::remove_dir_all(&app_data_dir);
    }

    #[test]
    fn test_different_passwords_produce_different_ciphertexts() {
        let app_data_dir = get_unique_test_app_data_dir();
        let manager = CredentialManager::new(app_data_dir.clone());

        let password1 = "password1";
        let password2 = "password2";

        let encrypted1 = manager.encrypt_password(password1).unwrap();
        let encrypted2 = manager.encrypt_password(password2).unwrap();

        // Different passwords should produce different ciphertexts
        assert_ne!(encrypted1, encrypted2);

        // Cleanup
        let _ = fs::remove_dir_all(&app_data_dir);
    }

    #[test]
    fn test_same_password_produces_different_ciphertexts() {
        let app_data_dir = get_unique_test_app_data_dir();
        let manager = CredentialManager::new(app_data_dir.clone());

        let password = "same_password";

        let encrypted1 = manager.encrypt_password(password).unwrap();
        let encrypted2 = manager.encrypt_password(password).unwrap();

        // Same password encrypted twice should produce different ciphertexts (due to random nonce)
        assert_ne!(encrypted1, encrypted2);

        // But both should decrypt to the same value
        let decrypted1 = manager.decrypt_password(&encrypted1).unwrap();
        let decrypted2 = manager.decrypt_password(&encrypted2).unwrap();
        assert_eq!(decrypted1, password);
        assert_eq!(decrypted2, password);

        // Cleanup
        let _ = fs::remove_dir_all(&app_data_dir);
    }

    #[test]
    fn test_keychain_placeholder_detection() {
        assert!(is_keychain_placeholder(b"keychain:123"));
        assert!(is_keychain_placeholder(b"keychain:some_account"));
        assert!(!is_keychain_placeholder(b"not_a_placeholder"));
        assert!(!is_keychain_placeholder(b""));
        assert!(!is_keychain_placeholder(&[0, 1, 2, 3]));
    }

    #[test]
    fn test_retrieve_keychain_placeholder_returns_migration_error() {
        let app_data_dir = get_unique_test_app_data_dir();
        let manager = CredentialManager::new(app_data_dir.clone());

        let result = manager.retrieve_password("42", b"keychain:42");
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(
            err_msg.contains("re-entered"),
            "error should mention re-entering credentials: {}",
            err_msg
        );

        // Cleanup
        let _ = fs::remove_dir_all(&app_data_dir);
    }

    #[test]
    fn test_store_and_retrieve_roundtrip() {
        let app_data_dir = get_unique_test_app_data_dir();
        let manager = CredentialManager::new(app_data_dir.clone());

        let password = "my_secret";
        let encrypted = manager.store_password("acct1", password).unwrap();
        let decrypted = manager.retrieve_password("acct1", &encrypted).unwrap();
        assert_eq!(decrypted, password);

        // Cleanup
        let _ = fs::remove_dir_all(&app_data_dir);
    }

    #[test]
    fn test_invalid_encrypted_data() {
        let app_data_dir = get_unique_test_app_data_dir();
        let manager = CredentialManager::new(app_data_dir.clone());

        // Too short data should fail
        let result = manager.decrypt_password(&[0, 1, 2]);
        assert!(result.is_err());

        // Cleanup
        let _ = fs::remove_dir_all(&app_data_dir);
    }
}
