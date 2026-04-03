use std::path::Path;

fn main() {
    // Trigger recompile when migrations change
    println!("cargo:rerun-if-changed=migrations");

    // Trigger recompile when frontend build output changes
    println!("cargo:rerun-if-changed=../dist");

    // rust-embed requires the folder to exist at compile time.
    // If dist/ hasn't been built yet, create a placeholder so cargo check works.
    let dist_index = Path::new("../dist/index.html");
    if !dist_index.exists() {
        let dist_dir = Path::new("../dist");
        std::fs::create_dir_all(dist_dir).expect("failed to create dist directory");
        std::fs::write(
            dist_index,
            r#"<!DOCTYPE html>
<html>
<head><title>StreamForge</title></head>
<body>
<h1>Frontend not built</h1>
<p>Run: <code>pnpm build:vite</code></p>
</body>
</html>
"#,
        )
        .expect("failed to write placeholder index.html");
    }

    #[cfg(feature = "gui")]
    tauri_build::build()
}
