document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');
    const logoutBtn = document.getElementById('logout-btn');
    const navItems = document.querySelectorAll('.nav-item');
    const toast = document.getElementById('toast');

    // Check Auth State automatically
    if (typeof firebase !== 'undefined') {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                // User is authenticated, transition to Dashboard
                loginView.style.display = 'none';
                loginView.classList.remove('active');

                dashboardView.style.display = 'flex';
                void dashboardView.offsetWidth;
                dashboardView.classList.remove('hidden');
                dashboardView.classList.add('active');
            } else {
                // Not authenticated, ensure we show login
                dashboardView.classList.remove('active');
                dashboardView.style.display = 'none';
                dashboardView.classList.add('hidden');

                loginView.style.display = 'flex';
                void loginView.offsetWidth;
                loginView.classList.add('active');
            }
        });
    }

    // Submit handler (Login)
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value.trim();
        const btn = document.getElementById('submit-btn');
        const originalContent = btn.innerHTML;

        // Loader micro-animation
        btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i><span>Ingresando...</span>';
        btn.disabled = true;

        try {
            if (typeof firebase === 'undefined') {
                throw new Error('Servicio de Auth no disponible. ¿Estás en un entorno de Firebase (serve/deploy)?');
            }

            // Llamada segura a Firebase Auth
            await firebase.auth().signInWithEmailAndPassword(email, password);

            showToast('¡Bienvenido a DiagnoVet!');
            loginForm.reset();

        } catch (error) {
            console.error('Login error:', error);

            let userFriendlyMsg = 'Credenciales inválidas o error de conexión';

            // Map Firebase errors to user friendly spanish messages
            if (error.code === 'auth/invalid-credential') userFriendlyMsg = 'El correo o la contraseña son incorrectos';
            if (error.code === 'auth/user-not-found') userFriendlyMsg = 'Este usuario no existe en nuestros registros';
            if (error.code === 'auth/wrong-password') userFriendlyMsg = 'Contraseña incorrecta';
            if (error.code === 'auth/invalid-email') userFriendlyMsg = 'El formato del correo es inválido';

            showToast('Error: ' + userFriendlyMsg);
        } finally {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    });

    // Logout handler
    logoutBtn.addEventListener('click', async () => {
        try {
            if (typeof firebase !== 'undefined') {
                await firebase.auth().signOut();
            }
            showToast('Sesión cerrada correctamente');
        } catch (error) {
            showToast('Error al cerrar sesión');
            console.error(error);
        }
    });

    // Interactive Sidebar Navigation
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            // Find the anchor tag inside the clicked item
            const aTag = item.tagName === 'A' ? item : item.querySelector('a');
            if (!aTag) return;

            const target = aTag.getAttribute('data-target');

            // Highlight nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Switch views
            document.querySelectorAll('.content-wrapper').forEach(section => {
                section.style.display = 'none';
                section.classList.remove('active-section');
            });

            const targetSection = document.getElementById(`content-${target}`);
            if (targetSection) {
                targetSection.style.display = 'block';
                // trigger reflow
                void targetSection.offsetWidth;
                targetSection.classList.add('active-section');
            }
        });
    });

    // =========================================
    // UPLOAD PDF LOGIC
    // =========================================
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('pdf-upload');
    const fileListContainer = document.getElementById('file-list');
    const btnUpload = document.getElementById('btn-upload');
    const uploadForm = document.getElementById('upload-form');
    const ocrResults = document.getElementById('ocr-results');
    const resultJson = document.getElementById('result-json');

    let selectedFiles = [];

    // Drag and drop events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.remove('dragover');
        }, false);
    });

    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    });

    fileInput.addEventListener('change', function () {
        handleFiles(this.files);
    });

    function handleFiles(files) {
        const newFiles = Array.from(files).filter(file => file.type === 'application/pdf');

        if (newFiles.length !== files.length) {
            showToast('Solo se permiten archivos PDF');
        }

        selectedFiles = [...selectedFiles, ...newFiles];
        updateFileUI();
    }

    function removeFile(index) {
        selectedFiles.splice(index, 1);

        // Reset file input so same file can be selected again
        if (selectedFiles.length === 0) {
            fileInput.value = '';
        }

        updateFileUI();
    }

    function updateFileUI() {
        fileListContainer.innerHTML = '';

        if (selectedFiles.length > 0) {
            fileListContainer.classList.remove('hidden');
            btnUpload.disabled = false;

            selectedFiles.forEach((file, index) => {
                const sizeFormat = (file.size / (1024 * 1024)).toFixed(2);

                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.innerHTML = `
                    <div class="file-info">
                        <div class="file-icon">
                            <i class="ph-fill ph-file-pdf"></i>
                        </div>
                        <div class="file-details">
                            <h5>${file.name}</h5>
                            <span>${sizeFormat} MB &bull; PDF Document</span>
                        </div>
                    </div>
                    <button type="button" class="btn-remove" data-index="${index}">
                        <i class="ph ph-trash"></i>
                    </button>
                `;
                fileListContainer.appendChild(fileItem);
            });

            // Add remove listeners
            document.querySelectorAll('.btn-remove').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = Number(e.currentTarget.getAttribute('data-index'));
                    removeFile(idx);
                });
            });

        } else {
            fileListContainer.classList.add('hidden');
            btnUpload.disabled = true;
        }
    }

    // Handle Upload
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (selectedFiles.length === 0) return;

        const originalBtnContent = btnUpload.innerHTML;
        btnUpload.innerHTML = '<i class="ph ph-spinner ph-spin"></i><span>Analizando...</span>';
        btnUpload.disabled = true;

        // Hide previous results
        ocrResults.classList.add('hidden');

        try {
            const formData = new FormData();
            selectedFiles.forEach(file => {
                formData.append('files', file);
            });

            // Endpoint OCR
            const OCR_URL = 'https://ocr-veterinaria-43xon5tdla-ew.a.run.app';

            const response = await fetch(OCR_URL, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json'
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Error en el servidor: ${response.status}`);
            }

            const data = await response.json();

            // Format and show JSON
            resultJson.innerHTML = syntaxHighlight(JSON.stringify(data, null, 4));
            ocrResults.classList.remove('hidden');

            showToast('Documentos analizados exitosamente');

            // Clean up selections
            selectedFiles = [];
            updateFileUI();

        } catch (error) {
            console.error('Upload Error:', error);
            showToast('Error al analizar los documentos');
        } finally {
            btnUpload.innerHTML = originalBtnContent;
            btnUpload.disabled = selectedFiles.length === 0;
        }
    });

    // Helper for JSON syntax highlighting
    function syntaxHighlight(json) {
        json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
            let cls = 'json-number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'json-key';
                } else {
                    cls = 'json-string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'json-boolean';
            } else if (/null/.test(match)) {
                cls = 'json-null';
            }
            return '<span class="' + cls + '">' + match + '</span>';
        });
    }

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
