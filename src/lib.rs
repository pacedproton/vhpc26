slint::include_modules!();

/// Hosts the UI is allowed to open in a new tab. Anything else is dropped.
/// Keeps a compromised/edited .slint string (or future data-driven link)
/// from becoming a `javascript:` / `data:` / open-redirect vector.
pub const ALLOWED_HOSTS: &[&str] = &[
    "vhpc.org",
    "www.vhpc.org",
    "edas.info",
    "www.springer.com",
    "bsky.app",
    "x.com",
];

/// Same-origin documents the UI may open (exact match, served by nginx).
pub const ALLOWED_LOCAL_PATHS: &[&str] = &["cfp/cfp.text"];

/// Returns true iff `url` is an exact allowlisted same-origin path, or
/// `https://<allowed-host>[/<path>]` with no userinfo, port, whitespace or
/// control characters.
pub fn is_allowed_url(url: &str) -> bool {
    if ALLOWED_LOCAL_PATHS.contains(&url) {
        return true;
    }
    let Some(rest) = url.strip_prefix("https://") else {
        return false;
    };
    if url.len() > 2048 || url.chars().any(|c| c.is_whitespace() || c.is_control() || c == '\\') {
        return false;
    }
    let authority_end = rest.find(['/', '?', '#']).unwrap_or(rest.len());
    let host = &rest[..authority_end];
    // Rejects userinfo (`user@host`) and explicit ports implicitly: the exact
    // match below only succeeds for bare allowlisted hostnames.
    ALLOWED_HOSTS.iter().any(|h| host.eq_ignore_ascii_case(h))
}

#[cfg(target_arch = "wasm32")]
mod web {
    use wasm_bindgen::prelude::*;
    // `noopener,noreferrer` prevents reverse tabnabbing via window.opener.
    #[wasm_bindgen(
        inline_js = "export function open_url(url) { const w = window.open(url, '_blank', 'noopener,noreferrer'); if (w) { w.opener = null; } }"
    )]
    extern "C" {
        pub fn open_url(url: &str);
    }
}

#[cfg_attr(target_arch = "wasm32", wasm_bindgen::prelude::wasm_bindgen(start))]
pub fn main() {
    let window = MainWindow::new().unwrap();

    #[cfg(target_arch = "wasm32")]
    window.global::<AppLinks>().on_open_url(|url| {
        if is_allowed_url(url.as_str()) {
            web::open_url(url.as_str());
        }
    });

    window.run().unwrap();
}

#[cfg(test)]
mod tests {
    use super::is_allowed_url;

    #[test]
    fn allows_known_https_links() {
        for u in [
            "https://edas.info/newPaper.php?c=35100",
            "https://bsky.app/profile/vhpc.bsky.social",
            "https://x.com/VHPCworkshop",
            "https://www.springer.com/gp/computer-science/lncs/conference-proceedings-guidelines",
            "https://vhpc.org",
            "cfp/cfp.text",
        ] {
            assert!(is_allowed_url(u), "{u}");
        }
    }

    #[test]
    fn rejects_dangerous_or_foreign_links() {
        for u in [
            "javascript:alert(1)",
            "JAVASCRIPT:alert(1)",
            "data:text/html,<script>alert(1)</script>",
            "http://x.com/",
            "https://evil.com/",
            "https://x.com.evil.com/",
            "https://x.com@evil.com/",
            "https://evil.com\\@x.com/",
            "https://x.com:8443/",
            "https://x.com/\nfoo",
            "//x.com/",
            "cfp/../Cargo.toml",
            "/cfp/cfp.text",
            "",
        ] {
            assert!(!is_allowed_url(u), "{u:?}");
        }
    }
}
