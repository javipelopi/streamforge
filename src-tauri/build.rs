fn main() {
    // Trigger recompile when migrations change
    println!("cargo:rerun-if-changed=migrations");
    tauri_build::build()
}
