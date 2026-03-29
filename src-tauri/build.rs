fn main() {
    // Trigger recompile when migrations change
    println!("cargo:rerun-if-changed=migrations");

    #[cfg(feature = "gui")]
    tauri_build::build()
}
