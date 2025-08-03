// Alternative: Server-based authentication (more secure)
// This approach validates passwords server-side instead of client-side

const AUTH_API_URL = '/api/auth'; // Your authentication endpoint
const SESSION_KEY = 'rezziter_authenticated';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Check if user is currently authenticated
 */
function isAuthenticated() {
    const authData = localStorage.getItem(SESSION_KEY);
    if (!authData) return false;
    
    try {
        const { timestamp, token } = JSON.parse(authData);
        const now = Date.now();
        
        // Check if session is still valid (24 hours)
        if (now - timestamp > SESSION_DURATION) {
            localStorage.removeItem(SESSION_KEY);
            return false;
        }
        
        return token ? true : false;
    } catch (e) {
        localStorage.removeItem(SESSION_KEY);
        return false;
    }
}

/**
 * Authenticate user with password via server API
 */
async function authenticate(password) {
    try {
        const response = await fetch(AUTH_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password })
        });
        
        if (response.ok) {
            const { token } = await response.json();
            const authData = {
                timestamp: Date.now(),
                token: token,
                authenticated: true
            };
            localStorage.setItem(SESSION_KEY, JSON.stringify(authData));
            return true;
        }
        return false;
    } catch (error) {
        console.error('Authentication error:', error);
        return false;
    }
}

/**
 * Logout user
 */
function logout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'login.html';
}

/**
 * Require authentication - redirect to login if not authenticated
 */
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
    }
}
