// Simple password-based authentication for Rezziter
// Password: rezziter2025

const CORRECT_PASSWORD = 'rezziter2025';
const SESSION_KEY = 'rezziter_authenticated';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Check if user is currently authenticated
 */
function isAuthenticated() {
    const authData = localStorage.getItem(SESSION_KEY);
    if (!authData) return false;
    
    try {
        const { timestamp } = JSON.parse(authData);
        const now = Date.now();
        
        // Check if session is still valid (24 hours)
        if (now - timestamp > SESSION_DURATION) {
            localStorage.removeItem(SESSION_KEY);
            return false;
        }
        
        return true;
    } catch (e) {
        localStorage.removeItem(SESSION_KEY);
        return false;
    }
}

/**
 * Authenticate user with password
 */
function authenticate(password) {
    if (password === CORRECT_PASSWORD) {
        const authData = {
            timestamp: Date.now(),
            authenticated: true
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(authData));
        return true;
    }
    return false;
}

/**
 * Logout user
 */
function logout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'login.html';
}

/**
 * Redirect to login if not authenticated
 */
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

/**
 * Handle login form submission
 */
function setupLoginForm() {
    const loginForm = document.getElementById('login-form');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('error-message');
    
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const password = passwordInput.value.trim();
            
            if (authenticate(password)) {
                // Redirect to main app
                window.location.href = 'index.html';
            } else {
                // Show error message
                errorMessage.textContent = 'Incorrect password. Please try again.';
                errorMessage.style.display = 'block';
                passwordInput.value = '';
                passwordInput.focus();
                
                // Hide error after 3 seconds
                setTimeout(() => {
                    errorMessage.style.display = 'none';
                }, 3000);
            }
        });
        
        // Focus password input on load
        passwordInput.focus();
    }
}

/**
 * Check if already authenticated and redirect to main app
 */
function checkAuthOnLogin() {
    if (isAuthenticated()) {
        window.location.href = 'index.html';
    }
}

// Initialize login functionality
document.addEventListener('DOMContentLoaded', () => {
    // If we're on the login page
    if (window.location.pathname.includes('login.html')) {
        checkAuthOnLogin();
        setupLoginForm();
    } else {
        // For other pages, require authentication
        requireAuth();
    }
});
