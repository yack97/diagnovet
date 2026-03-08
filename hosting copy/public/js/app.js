document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');
    const logoutBtn = document.getElementById('logout-btn');
    const navItems = document.querySelectorAll('.nav-item');
    const toast = document.getElementById('toast');

    // Submit handler
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const btn = document.getElementById('submit-btn');
        const originalContent = btn.innerHTML;

        // Loader micro-animation
        btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i><span>Ingresando...</span>';
        btn.disabled = true;

        setTimeout(() => {
            // Fade out login
            loginView.classList.remove('active');

            setTimeout(() => {
                loginView.style.display = 'none';

                // Prepare dashboard
                dashboardView.style.display = 'flex';
                // Trigger reflow to restart css animation
                void dashboardView.offsetWidth;
                dashboardView.classList.remove('hidden');
                dashboardView.classList.add('active');

                // Show success toast
                showToast('¡Bienvenido a DiagnoVet!');

                // Reset login form for future
                btn.innerHTML = originalContent;
                btn.disabled = false;
                loginForm.reset();
            }, 500); // Wait for transition duration

        }, 1500); // Simulate network latency
    });

    // Logout handler
    logoutBtn.addEventListener('click', () => {
        dashboardView.classList.remove('active');

        setTimeout(() => {
            dashboardView.style.display = 'none';
            dashboardView.classList.add('hidden');

            loginView.style.display = 'flex';
            void loginView.offsetWidth; // Reflow
            loginView.classList.add('active');

            showToast('Sesión cerrada correctamente');
        }, 500);
    });

    // Interactive Sidebar Navigation
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // Utility: Show Toast notification
    function showToast(message) {
        const toastMsg = document.getElementById('toast-message');
        toastMsg.textContent = message;

        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 4000); // Hide after 4s
    }
});
