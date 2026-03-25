# VHPC 2026 Workshop Dashboard

Interactive web dashboard for the [Workshop on Virtualization in High-Performance Cloud Computing](https://vhpc.org), built with Rust + Slint + WebAssembly.

## Stack

- **Rust** → **WebAssembly** via `wasm-pack`
- **Slint** GUI framework — renders entirely on a `<canvas>` (no DOM UI)
- **wasm-bindgen** v0.2.112 (CLI version must match crate exactly)

## Prerequisites

```bash
# Rust toolchain with wasm32 target
rustup target add wasm32-unknown-unknown

# wasm-pack
cargo install wasm-pack

# wasm-bindgen CLI — must be 0.2.112
cargo install wasm-bindgen-cli --version 0.2.112
```

Verify versions before building:

```bash
wasm-bindgen --version   # must print 0.2.112
wasm-pack --version
```

## Build

```bash
# Check native compilation
cargo check

# Run tests (headless, single-threaded required)
cargo test -- --test-threads=1

# Build WASM (output → pkg/)
wasm-pack build --release --target web
```

## Run

```bash
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000).

After any rebuild, hard-refresh (`Cmd+Shift+R`) to bypass browser cache.

## Deploy

Copy `index.html` and the entire `pkg/` directory to your web server. Both must be served from the same origin.

## Project Structure

```
├── src/
│   ├── lib.rs          # WASM entry point (wasm_bindgen(start))
│   └── main.rs         # Native desktop entry point
├── ui/
│   ├── main.slint      # Root window (900×600, preferred size)
│   ├── theme.slint     # Color palette, spacing, typography
│   ├── sidebar.slint   # Horizontal tab bar navigation
│   ├── dashboard.slint # Overview panel
│   ├── schedule.slint  # Workshop program
│   ├── topics.slint    # Call for papers
│   ├── speakers.slint  # Committee members
│   └── submission.slint# Paper submission info
├── tests/
│   └── smoke_test.rs   # Headless Slint component tests
├── index.html          # HTML shell with WASM loading screen
├── build.rs            # slint_build::compile("ui/main.slint")
└── teststatus.md       # Test status tracking
```

## Troubleshooting

**`function signature mismatch` at runtime** — wasm-bindgen CLI version doesn't match the crate version. Run:
```bash
cargo install wasm-bindgen-cli --version 0.2.112 --force
wasm-pack build --release --target web
```

**Blank screen / stale behaviour after rebuild** — hard-refresh (`Cmd+Shift+R`) to clear browser cache.

**Tests hang** — always pass `-- --test-threads=1` when running `cargo test`.
