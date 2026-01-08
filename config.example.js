// Rezziter Frontend Configuration
// Copy this file to config.local.js and update with your values
// config.local.js will be ignored by git
// For GitHub Pages: These are injected by GitHub Actions from secrets

window.REZZITER_CONFIG = {
    authPassword: 'your_password_here',
    supabaseUrl: 'https://your-project.supabase.co',
    supabaseAnonKey: 'your_anon_key_here',
    sessionDuration: 24 * 60 * 60 * 1000
};
