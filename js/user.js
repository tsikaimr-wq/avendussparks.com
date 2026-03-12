console.log("🔥 user.js LOADED");

// Bridge UserService to the existing DB abstraction
window.UserService = {
    getCurrentUser: function () {
        if (window.DB && typeof window.DB.getCurrentUser === 'function') {
            return window.DB.getCurrentUser();
        }
        return null;
    },
    refreshCurrentUser: async function () {
        if (window.DB && typeof window.DB.refreshCurrentUser === 'function') {
            return await window.DB.refreshCurrentUser();
        }
        return null;
    }
};
