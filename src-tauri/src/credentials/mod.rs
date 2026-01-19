//! Credential storage module for secure password management
//!
//! This module provides secure credential storage using:
//! 1. OS Keychain (via keyring crate) as primary storage
//! 2. AES-256-GCM encryption as fallback when keychain is unavailable

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::RngCore;
use std::fs;
use std::path::PathBuf;
use thiserror::Error;

/// Service name for keyring entries
const SERVICE_NAME: &str = "iptv";

/// Salt filename for AES fallback encryption
const SALT_FILENAME: &str = "credential_salt";

/// Length of the salt used for key derivation
const SALT_LENGTH: usize = 32;

/// Nonce length for AES-256-GCM
const NONCE_LENGTH: usize = 12;

/// Errors that can occur during credential operations
#[derive(Debug, Error)]
pub enum CredentialError {
    #[error("Keyring error: {0}")]
    KeyringError(String),

    #[error("Encryption error: {0}")]
    EncryptionError(String),

    #[error("Decryption error: {0}")]
    DecryptionError(String),

    #[error("I/O error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Invalid data: {0}")]
    InvalidData(String),
}

/// Result type for credential operations
pub type Result<T> = std::result::Result<T, CredentialError>;

/// Credential storage backend
#[derive(Debug, Clone)]
pub enum StorageBackend {
    /// OS Keychain storage (preferred)
    Keychain,
    /// AES-256-GCM encrypted storage (fallback)
    Encrypted,
}

/// Credential manager handles secure storage and retrieval of passwords
pub struct CredentialManager {
    app_data_dir: PathBuf,
}

impl CredentialManager {
    /// Create a new credential manager
    ///
    /// # Arguments
    /// * `app_data_dir` - Directory for storing fallback encryption data
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self { app_data_dir }
    }

    /// Store a password securely
    ///
    /// Tries keychain first, falls back to AES encryption if unavailable.
    /// Returns the encrypted bytes for database storage (used in fallback mode).
    ///
    /// # Arguments
    /// * `account_id` - Unique identifier for the account
    /// * `password` - The password to store
    ///
    /// # Returns
    /// * `(StorageBackend, Vec<u8>)` - The storage backend used and encrypted data for database
    pub fn store_password(
        &self,
        account_id: &str,
        password: &str,
    ) -> Result<(StorageBackend, Vec<u8>)> {
        // Try keychain first
        match self.store_in_keychain(account_id, password) {
            Ok(()) => {
                // For keychain storage, we still store a placeholder in the database
                // to indicate we're using keychain storage
                let placeholder = self.create_keychain_placeholder(account_id);
                Ok((StorageBackend::Keychain, placeholder))
            }
            Err(_) => {
                // Keychain failed, use AES encryption fallback
                let encrypted = self.encrypt_password(password)?;
                Ok((StorageBackend::Encrypted, encrypted))
            }
        }
    }

    /// Retrieve a password
    ///
    /// # Arguments
    /// * `account_id` - Unique identifier for the account
    /// * `encrypted_data` - The encrypted data from database
    ///
    /// # Returns
    /// The decrypted password
    pub fn retrieve_password(&self, account_id: &str, encrypted_data: &[u8]) -> Result<String> {
        // Check if this is a keychain placeholder
        if self.is_keychain_placeholder(account_id, encrypted_data) {
            return self.retrieve_from_keychain(account_id);
        }

        // Otherwise, decrypt using AES
        self.decrypt_password(encrypted_data)
    }

    /// Delete a password from storage
    ///
    /// # Arguments
    /// * `account_id` - Unique identifier for the account
    /// * `encrypted_data` - The encrypted data from database (to determine storage type)
    pub fn delete_password(&self, account_id: &str, encrypted_data: &[u8]) -> Result<()> {
        // Try to delete from keychain (if it exists there)
        if self.is_keychain_placeholder(account_id, encrypted_data) {
            let _ = self.delete_from_keychain(account_id);
        }
        // Encrypted data in database is deleted by the caller (database delete)
        Ok(())
    }

    /// Store password in OS keychain
    fn store_in_keychain(&self, account_id: &str, password: &str) -> Result<()> {
        let entry = keyring::Entry::new(SERVICE_NAME, account_id)
            .map_err(|e| CredentialError::KeyringError(e.to_string()))?;
        entry
            .set_password(password)
            .map_err(|e| CredentialError::KeyringError(e.to_string()))?;
        Ok(())
    }

    /// Retrieve password from OS keychain
    fn retrieve_from_keychain(&self, account_id: &str) -> Result<String> {
        let entry = keyring::Entry::new(SERVICE_NAME, account_id)
            .map_err(|e| CredentialError::KeyringError(e.to_string()))?;
        entry
            .get_password()
            .map_err(|e| CredentialError::KeyringError(e.to_string()))
    }

    /// Delete password from OS keychain
    fn delete_from_keychain(&self, account_id: &str) -> Result<()> {
        let entry = keyring::Entry::new(SERVICE_NAME, account_id)
            .map_err(|e| CredentialError::KeyringError(e.to_string()))?;
        entry
            .delete_credential()
            .map_err(|e| CredentialError::KeyringError(e.to_string()))?;
        Ok(())
    }

    /// Create a placeholder for keychain storage
    /// This is stored in the database to indicate that the actual password is in keychain
    fn create_keychain_placeholder(&self, account_id: &str) -> Vec<u8> {
        // Format: "keychain:" + account_id
        format!("keychain:{}", account_id).into_bytes()
    }

    /// Check if the encrypted data is a keychain placeholder
    fn is_keychain_placeholder(&self, account_id: &str, data: &[u8]) -> bool {
        let expected = format!("keychain:{}", account_id);
        data == expected.as_bytes()
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
    /// Key is derived from a stored salt combined with machine-specific info
    fn get_or_create_encryption_key(&self) -> Result<[u8; 32]> {
        let salt = self.get_or_create_salt()?;

        // Derive key from salt and machine-specific identifier
        // Using a simple XOR-based derivation (in production, use HKDF or similar)
        let machine_id = self.get_machine_identifier();

        let mut key = [0u8; 32];
        for i in 0..32 {
            key[i] = salt[i] ^ machine_id[i % machine_id.len()];
        }

        Ok(key)
    }

    /// Get or create the encryption salt
    fn get_or_create_salt(&self) -> Result<[u8; SALT_LENGTH]> {
        let salt_path = self.app_data_dir.join(SALT_FILENAME);

        if salt_path.exists() {
            let salt_data = fs::read(&salt_path)?;
            if salt_data.len() == SALT_LENGTH {
                let mut salt = [0u8; SALT_LENGTH];
                salt.copy_from_slice(&salt_data);
                return Ok(salt);
            }
        }

        // Create new salt
        let mut salt = [0u8; SALT_LENGTH];
        rand::rngs::OsRng.fill_bytes(&mut salt);

        // Ensure directory exists
        if let Some(parent) = salt_path.parent() {
            fs::create_dir_all(parent)?;
        }

        // Save salt
        fs::write(&salt_path, &salt)?;

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

/// Standalone function to store a password (for backward compatibility)
pub fn store_password(
    app_data_dir: &PathBuf,
    account_id: &str,
    password: &str,
) -> Result<Vec<u8>> {
    let manager = CredentialManager::new(app_data_dir.clone());
    let (_, encrypted) = manager.store_password(account_id, password)?;
    Ok(encrypted)
}

/// Standalone function to retrieve a password (for backward compatibility)
pub fn retrieve_password(
    app_data_dir: &PathBuf,
    account_id: &str,
    encrypted_data: &[u8],
) -> Result<String> {
    let manager = CredentialManager::new(app_data_dir.clone());
    manager.retrieve_password(account_id, encrypted_data)
}

/// Standalone function to delete a password (for backward compatibility)
pub fn delete_password(
    app_data_dir: &PathBuf,
    account_id: &str,
    encrypted_data: &[u8],
) -> Result<()> {
    let manager = CredentialManager::new(app_data_dir.clone());
    manager.delete_password(account_id, encrypted_data)
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
    fn test_keychain_placeholder() {
        let app_data_dir = get_unique_test_app_data_dir();
        let manager = CredentialManager::new(app_data_dir.clone());

        let account_id = "test_account_123";
        let placeholder = manager.create_keychain_placeholder(account_id);

        assert!(manager.is_keychain_placeholder(account_id, &placeholder));
        assert!(!manager.is_keychain_placeholder("other_account", &placeholder));

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
