// ============================================
// Authentication Functions
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Check if already logged in
  checkAuth();
});

async function checkAuth() {
  const client = getClient();
  const { data: { session } } = await client.auth.getSession();
  
  if (session) {
    // Already logged in, redirect to main app
    const currentPage = window.location.pathname.split('/').pop();
    if (currentPage === 'login.html' || currentPage === 'register.html') {
      window.location.href = 'index.html';
    }
  } else {
    // Not logged in
    const currentPage = window.location.pathname.split('/').pop();
    if (currentPage === '' || currentPage === 'index.html') {
      window.location.href = 'login.html';
    }
  }
}

// Login
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('error-msg');
    
    try {
      const client = getClient();
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      
      if (error) throw error;
      
      window.location.href = 'index.html';
    } catch (error) {
      errorMsg.textContent = error.message || 'Login failed. Please check your credentials.';
      errorMsg.classList.remove('hidden');
    }
  });
}

// Register
const registerForm = document.getElementById('register-form');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = document.getElementById('full-name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const errorMsg = document.getElementById('error-msg');
    
    if (password !== confirmPassword) {
      errorMsg.textContent = 'Passwords do not match';
      errorMsg.classList.remove('hidden');
      return;
    }
    
    try {
      const client = getClient();
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }
        }
      });
      
      if (error) throw error;
      
      alert('Account created! Please check your email to confirm your account, then login.');
      window.location.href = 'login.html';
    } catch (error) {
      errorMsg.textContent = error.message || 'Registration failed. Please try again.';
      errorMsg.classList.remove('hidden');
    }
  });
}

// Logout
async function logout() {
  const client = getClient();
  await client.auth.signOut();
  window.location.href = 'login.html';
}

// Get current user
async function getCurrentUser() {
  const client = getClient();
  const { data: { user } } = await client.auth.getUser();
  return user;
}
