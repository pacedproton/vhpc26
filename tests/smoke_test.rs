slint::include_modules!();

#[test]
fn main_window_instantiates() {
    i_slint_backend_testing::init_no_event_loop();
    let _window = MainWindow::new().unwrap();
}

#[test]
fn default_panel_is_overview() {
    i_slint_backend_testing::init_no_event_loop();
    let window = MainWindow::new().unwrap();
    assert_eq!(window.get_active_panel(), 0);
}

#[test]
fn set_active_panel() {
    i_slint_backend_testing::init_no_event_loop();
    let window = MainWindow::new().unwrap();
    window.set_active_panel(2);
    assert_eq!(window.get_active_panel(), 2);
}

#[test]
fn all_panel_indices_valid() {
    i_slint_backend_testing::init_no_event_loop();
    let window = MainWindow::new().unwrap();
    for i in 0..5 {
        window.set_active_panel(i);
        assert_eq!(window.get_active_panel(), i);
    }
}
