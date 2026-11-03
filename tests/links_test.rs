// Every AppLinks.open-url("...") literal in the UI must pass the runtime allowlist,
// otherwise the button silently does nothing in the browser.
#[test]
fn all_ui_links_are_allowlisted() {
    let mut found = 0;
    for entry in std::fs::read_dir("ui").unwrap() {
        let path = entry.unwrap().path();
        if path.extension().and_then(|e| e.to_str()) != Some("slint") {
            continue;
        }
        let src = std::fs::read_to_string(&path).unwrap();
        for (i, _) in src.match_indices("open-url(\"") {
            let rest = &src[i + "open-url(\"".len()..];
            let url = &rest[..rest.find('"').unwrap()];
            assert!(vhpc26::is_allowed_url(url), "{}: {url} not allowlisted", path.display());
            found += 1;
        }
    }
    assert!(found >= 7, "expected >=7 links, found {found}");
}
