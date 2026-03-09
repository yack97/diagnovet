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
                // User is authenticated, transition to Carga de Info (Records) as Dashboard was removed
                loginView.style.display = 'none';
                loginView.classList.remove('active');

                // Show main dashboard wrapper
                dashboardView.style.display = 'flex';
                dashboardView.classList.remove('hidden');
                dashboardView.classList.add('active');

                // Switch views explicitly to records
                document.querySelectorAll('.content-wrapper').forEach(section => {
                    section.style.display = 'none';
                    section.classList.remove('active-section');
                });

                const recordsView = document.getElementById('content-records');
                if (recordsView) {
                    recordsView.style.display = 'block';
                    void recordsView.offsetWidth;
                    recordsView.classList.add('active-section');
                }
            } else {
                // Not authenticated, ensure we show login
                dashboardView.style.display = 'none';
                dashboardView.classList.remove('active');
                dashboardView.classList.add('hidden');

                document.querySelectorAll('.content-wrapper').forEach(section => {
                    section.classList.remove('active-section');
                    section.style.display = 'none';
                    section.classList.add('hidden');
                });

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

                // --- Hook: Load patients on entering the view ---
                if (target === 'patients') {
                    loadAllPatients();
                }
            }
        });
    });

    // =========================================
    // PATIENTS MASTER-DETAIL STATE
    // =========================================
    let currentPatientsData = []; // Store raw firestore docs to handle view toggling locally

    // =========================================
    // LOAD ALL PATIENTS LOGIC
    // =========================================
    async function loadAllPatients() {
        const patientsResultsContainer = document.getElementById('patients-results-container');
        const searchStatus = document.getElementById('search-status');
        const searchLoader = document.getElementById('search-loader');
        const searchMessage = document.getElementById('search-message');

        patientsResultsContainer.innerHTML = '';
        searchStatus.style.display = 'block';
        searchLoader.style.display = 'inline-block';
        searchMessage.textContent = 'Cargando registros recientes...';

        try {
            const user = firebase.auth().currentUser;
            const idToken = await user.getIdToken(true);

            const response = await fetch('https://ocr-veterinaria-43xon5tdla-ew.a.run.app/?action=list-patients', {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });

            if (!response.ok) throw new Error('Error cargando pacientes del servidor');
            const result = await response.json();

            searchLoader.style.display = 'none';

            if (!result.patients || result.patients.length === 0) {
                searchMessage.textContent = 'Aún no hay historiales clínicos registrados.';
                return;
            }

            searchStatus.style.display = 'none';

            // Map backend field names to frontend field names
            // Backend stores as 'metadatos_extraidos', frontend expects 'datos_extraidos'
            currentPatientsData = result.patients.map(p => ({
                ...p,
                datos_extraidos: p.metadatos_extraidos || p.datos_extraidos || {}
            }));

            // Render Master View
            renderMasterView(currentPatientsData);

        } catch (error) {
            console.error("Error loading all patients:", error);
            searchLoader.style.display = 'none';
            searchMessage.textContent = 'Ocurrió un error al cargar los historiales.';
        }
    }

    // =========================================
    // UPLOAD PDF LOGIC
    // =========================================
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('pdf-upload');
    const selectFilesBtn = document.getElementById('btn-select-files');
    const fileListContainer = document.getElementById('file-list');
    const btnUpload = document.getElementById('btn-upload');
    const uploadForm = document.getElementById('upload-form');
    const ocrResults = document.getElementById('ocr-results');

    let selectedFiles = [];

    if (selectFilesBtn) {
        selectFilesBtn.addEventListener('click', () => {
            fileInput.click();
        });
    }

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

                const fileInfo = document.createElement('div');
                fileInfo.className = 'file-info';

                const fileIcon = document.createElement('div');
                fileIcon.className = 'file-icon';
                const icon = document.createElement('i');
                icon.className = 'ph-fill ph-file-pdf';
                fileIcon.appendChild(icon);

                const fileDetails = document.createElement('div');
                fileDetails.className = 'file-details';
                const title = document.createElement('h5');
                title.textContent = file.name;
                const details = document.createElement('span');
                details.textContent = `${sizeFormat} MB - PDF Document`;
                fileDetails.appendChild(title);
                fileDetails.appendChild(details);

                fileInfo.appendChild(fileIcon);
                fileInfo.appendChild(fileDetails);

                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'btn-remove';
                removeBtn.setAttribute('data-index', String(index));
                const removeIcon = document.createElement('i');
                removeIcon.className = 'ph ph-trash';
                removeBtn.appendChild(removeIcon);

                fileItem.appendChild(fileInfo);
                fileItem.appendChild(removeBtn);
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

            // Obtener el ID Token (refresca de ser necesario)
            const user = firebase.auth().currentUser;
            if (!user) {
                throw new Error('Debes iniciar sesión primero para analizar documentos.');
            }
            const idToken = await user.getIdToken(true);

            // Endpoint OCR
            const OCR_URL = 'https://ocr-veterinaria-43xon5tdla-ew.a.run.app';

            const response = await fetch(OCR_URL, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Error en el servidor: ${response.status}`);
            }

            const data = await response.json();

            // Format and display the new UI Cards instead of raw JSON
            const container = document.getElementById('diagnoses-container');
            container.innerHTML = ''; // Limpiar anteriores

            if (data.resultados && data.resultados.length > 0) {
                const template = document.getElementById('diagnosis-card-template');

                // We need to wait for all cards to render because of async storage calls
                const renderPromises = data.resultados.map(async res => {
                    if (res.status === 'success' && res.datos_extraidos) {
                        try {
                            const card = await createDiagnosisCard(res, template);
                            container.appendChild(card);
                        } catch (err) {
                            console.error("Error creating card for", res.filename, err);
                        }
                    } else if (res.status === 'error') {
                        const errDiv = document.createElement('div');
                        errDiv.className = 'glass-panel';
                        errDiv.style.cssText = 'margin-top: 1.5rem; background: #fee2e2; border-color: #fca5a5;';

                        const errTitle = document.createElement('h4');
                        errTitle.style.color = '#b91c1c';
                        errTitle.textContent = `Error procesando ${res.filename || 'archivo'}`;

                        const errBody = document.createElement('p');
                        errBody.style.cssText = 'color: #991b1b; font-size: 0.9rem;';
                        errBody.textContent = res.error_message || 'No se pudo procesar el documento.';

                        errDiv.appendChild(errTitle);
                        errDiv.appendChild(errBody);
                        container.appendChild(errDiv);
                    }
                });

                await Promise.all(renderPromises);

                ocrResults.classList.remove('hidden');
                showToast('Documentos analizados exitosamente');
            } else {
                showToast('No se generaron resultados validos');
            }

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

    // =========================================
    // PATIENTS SEARCH LOGIC (Firestore)
    // =========================================
    const btnSearchPatient = document.getElementById('btn-search-patient');
    const inputSearchPatient = document.getElementById('patient-search-input');
    const inputSearchDate = document.getElementById('patient-search-date');
    const btnBackPatients = document.getElementById('btn-back-patients');
    const searchStatus = document.getElementById('search-status');
    const searchLoader = document.getElementById('search-loader');
    const searchMessage = document.getElementById('search-message');
    const patientsResultsContainer = document.getElementById('patients-results-container');
    const searchBoxControls = document.querySelector('.search-box').parentElement; // The header wrapper containing search

    if (btnSearchPatient) {
        btnSearchPatient.addEventListener('click', async () => {
            const queryName = inputSearchPatient.value.trim().toUpperCase();
            const queryDate = inputSearchDate ? inputSearchDate.value : '';

            if (!queryName && !queryDate) {
                // If both empty, reload all
                loadAllPatients();
                return;
            }

            // If data hasn't been loaded yet, load it first
            if (currentPatientsData.length === 0) {
                await loadAllPatients();
            }

            // Restore from any detail view
            btnBackPatients.style.display = 'none';

            let results = [...currentPatientsData];

            // Filter by Name (case-insensitive partial match)
            if (queryName) {
                results = results.filter(doc => {
                    const patientName = (doc.datos_extraidos && doc.datos_extraidos.paciente) || '';
                    return patientName.toUpperCase().includes(queryName);
                });
            }

            // Filter by Date
            if (queryDate) {
                results = results.filter(doc => {
                    if (!doc.fecha_procesamiento) return false;
                    return doc.fecha_procesamiento.startsWith(queryDate);
                });
            }

            if (results.length === 0) {
                patientsResultsContainer.innerHTML = '';
                searchStatus.style.display = 'block';
                searchLoader.style.display = 'none';
                searchMessage.textContent = 'No se encontraron historiales con esos criterios.';
                return;
            }

            searchStatus.style.display = 'none';
            renderMasterView(results);
            showToast(`Se encontraron ${results.length} reportes`);
        });
    }

    inputSearchPatient.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') btnSearchPatient.click();
    });

    if (inputSearchDate) {
        inputSearchDate.addEventListener('change', () => btnSearchPatient.click());
    }

    // Back button listener (Detail -> Master)
    btnBackPatients.addEventListener('click', () => {
        btnBackPatients.style.display = 'none';
        searchBoxControls.style.display = 'flex'; // Restore search controls
        renderMasterView(currentPatientsData);
    });

    // =========================================
    // MASTER VIEW RENDERING (Group by Patient)
    // =========================================
    function renderMasterView(dataArray) {
        patientsResultsContainer.innerHTML = '';
        searchStatus.style.display = 'none';

        if (dataArray.length === 0) return;

        // Group by patient name
        const grouped = {};
        dataArray.forEach(record => {
            const rawName = (record.datos_extraidos && record.datos_extraidos.paciente) ? record.datos_extraidos.paciente : 'Desconocido';
            // Normalize for grouping
            const key = rawName.trim().toUpperCase();

            if (!grouped[key]) {
                grouped[key] = {
                    displayName: rawName,
                    records: [],
                    latestDate: '1970-01-01'
                };
            }

            grouped[key].records.push(record);

            // Track latest date
            if (record.fecha_procesamiento && record.fecha_procesamiento > grouped[key].latestDate) {
                grouped[key].latestDate = record.fecha_procesamiento;
            }
        });

        const template = document.getElementById('patient-summary-template');

        // Render each group
        Object.values(grouped).forEach(group => {
            const clone = template.content.cloneNode(true);
            const cardInner = clone.querySelector('.patient-summary-card');

            clone.querySelector('.patient-name').textContent = group.displayName;
            clone.querySelector('.pet-avatar').textContent = group.displayName.charAt(0).toUpperCase();
            clone.querySelector('.report-count').textContent = `${group.records.length} Reporte${group.records.length !== 1 ? 's' : ''} Clínico${group.records.length !== 1 ? 's' : ''}`;

            // Format date
            let displayDate = 'Desconocida';
            if (group.latestDate !== '1970-01-01') {
                const d = new Date(group.latestDate);
                displayDate = d.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
            }
            clone.querySelector('.last-visit-date').textContent = displayDate;

            cardInner.addEventListener('click', () => {
                renderDetailView(group.displayName, group.records);
            });

            patientsResultsContainer.appendChild(clone);
        });
    }

    // =========================================
    // DETAIL VIEW RENDERING
    // =========================================
    async function renderDetailView(patientName, records) {
        patientsResultsContainer.innerHTML = '';

        // Hide search, show back button
        searchBoxControls.style.display = 'none';
        btnBackPatients.style.display = 'block';
        document.getElementById('detail-patient-name').textContent = `Historial Clínico: ${patientName}`;

        // Sort records by date descending inside detail view
        const sortedRecords = [...records].sort((a, b) => {
            const dateA = a.fecha_procesamiento || '';
            const dateB = b.fecha_procesamiento || '';
            return dateB.localeCompare(dateA); // Reverse string compare for ISO dates
        });

        const template = document.getElementById('diagnosis-card-template');

        const renderPromises = sortedRecords.map(async data => {
            // Mock backend response structure expected by createDiagnosisCard
            const mockRes = {
                status: 'success',
                filename: data.filename || `Documento.pdf`,
                datos_extraidos: data.datos_extraidos || {},
                imagenes_urls: data.imagenes_urls || [],
                fecha_procesamiento: data.fecha_procesamiento
            };

            try {
                const card = await createDiagnosisCard(mockRes, template);
                patientsResultsContainer.appendChild(card);
            } catch (err) {
                console.error("Error drawing card in detail view:", err);
            }
        });

        await Promise.all(renderPromises);
    }

    // Utility: Generate UI Card and Load Firebase Images
    async function createDiagnosisCard(res, template) {
        const clone = template.content.cloneNode(true);
        const ex = res.datos_extraidos;

        // Populate Processing Date if present
        const dateEl = clone.querySelector('.processing-date');
        if (dateEl) {
            if (res.fecha_procesamiento) {
                const d = new Date(res.fecha_procesamiento);
                dateEl.textContent = d.toLocaleString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            } else {
                dateEl.textContent = "Fecha no disponible";
            }
        }

        // Populate text data
        clone.querySelector('.patient-name').textContent = ex.paciente || 'Paciente Desconocido';
        clone.querySelector('.pet-avatar').textContent = (ex.paciente ? ex.paciente.charAt(0) : 'P').toUpperCase();
        clone.querySelector('.owner-name').textContent = ex.propietario ? `Dueño: ${ex.propietario}` : 'Dueño: No especificado';
        clone.querySelector('.vet-name').textContent = ex.veterinario ? `Dr. ${ex.veterinario}` : 'Veterinario No Especificado';
        clone.querySelector('.file-source').textContent = res.filename || 'Documento';
        clone.querySelector('.diagnosis-text').textContent = ex.diagnostico || 'Sin diagnóstico extraído.';

        // Optional recommendations
        if (ex.recomendaciones && ex.recomendaciones.trim() !== '') {
            const recBlock = clone.querySelector('.recommendations-block');
            recBlock.style.display = 'block';
            clone.querySelector('.recommendations-text').textContent = ex.recomendaciones;
        }

        // Populate PDF Original Link
        // El backend devuelve txt_url para la transcripcion pero debido a la implementacion preveia (pdfUrl) vamos a extraer
        // la ruta del storage_service original que subía el documento como "documento_original.pdf"
        // Construiremos el gs:// bucket original basándonos en imagenes_urls si existe
        if (res.imagenes_urls && res.imagenes_urls.length > 0) {
            const firstImg = res.imagenes_urls[0];
            // gs://<bucket>/processed/<batch_id>/<doc_id>/imagenes/logo.png -> gs://.../<doc_id>/documento_original.pdf
            const baseUrl = firstImg.split('/imagenes/')[0];
            const pdfGsUrl = `${baseUrl}/documento_original.pdf`;

            const btnPdf = clone.querySelector('.btn-view-pdf');
            if (btnPdf) {
                btnPdf.style.display = 'flex';
                btnPdf.addEventListener('click', async () => {
                    const originalContent = btnPdf.innerHTML;
                    btnPdf.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Cargando...';
                    btnPdf.disabled = true;
                    try {
                        const user = firebase.auth().currentUser;
                        const idToken = await user.getIdToken(true);

                        // Pedir URL firmada al servidor Python via endpoint: https://ocr-veterinaria.../?action=get-signed-url&gs_url=...
                        const endpoint = `https://ocr-veterinaria-43xon5tdla-ew.a.run.app/?action=get-signed-url&gs_url=${encodeURIComponent(pdfGsUrl)}`;

                        const response = await fetch(endpoint, {
                            headers: { 'Authorization': `Bearer ${idToken}` }
                        });

                        if (!response.ok) {
                            const errData = await response.json().catch(() => ({}));
                            console.error("Backend Error Details (PDF):", errData);
                            throw new Error('Error firmando URL');
                        }
                        const data = await response.json();

                        window.open(data.signed_url, '_blank', 'noopener,noreferrer');
                    } catch (err) {
                        console.error("Error cargando PDF Original:", err);
                        showToast('Error cargando PDF Original');
                    } finally {
                        btnPdf.innerHTML = originalContent;
                        btnPdf.disabled = false;
                    }
                });
            }
        }

        // Populate images securely using Firebase Storage SDK
        const imgGrid = clone.querySelector('.img-grid');
        if (res.imagenes_urls && res.imagenes_urls.length > 0) {
            // Wait for all GS URLs to be resolved into temporary signed URLs
            await Promise.all(res.imagenes_urls.map(async urlGs => {
                let publicUrl = '';
                try {
                    if (urlGs.startsWith('gs://')) {
                        const user = firebase.auth().currentUser;
                        const idToken = await user.getIdToken(true);
                        const endpoint = `https://ocr-veterinaria-43xon5tdla-ew.a.run.app/?action=get-signed-url&gs_url=${encodeURIComponent(urlGs)}`;

                        const response = await fetch(endpoint, {
                            headers: { 'Authorization': `Bearer ${idToken}` }
                        });

                        if (!response.ok) {
                            const errData = await response.json().catch(() => ({}));
                            console.error("Backend Error Details (IMG):", errData);
                            throw new Error('Error firmando URL de Imagen');
                        }
                        const data = await response.json();
                        publicUrl = data.signed_url;
                    } else {
                        publicUrl = urlGs;
                    }

                    const imgWrapper = document.createElement('div');
                    imgWrapper.style.cssText = 'border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; height: 180px;';

                    const imgEl = document.createElement('img');
                    imgEl.src = publicUrl;
                    imgEl.style.cssText = 'width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease; cursor: pointer;';
                    imgEl.alt = 'Imagen extraída';

                    // Hover effect
                    imgEl.onmouseover = () => imgEl.style.transform = 'scale(1.05)';
                    imgEl.onmouseout = () => imgEl.style.transform = 'scale(1)';

                    imgWrapper.appendChild(imgEl);
                    imgGrid.appendChild(imgWrapper);

                } catch (imgErr) {
                    console.error("Failed to load image securely:", urlGs, imgErr);
                }
            }));

            // If all images failed to load, show a message
            if (imgGrid.children.length === 0) {
                imgGrid.innerHTML = '<p style="color: #ef4444; font-size: 0.9rem; margin-top: 0.5rem;"><i class="ph ph-warning"></i> Error cargando las imágenes por falta de permisos en Firebase Storage.</p>';
            }
        } else {
            imgGrid.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.5rem;">No se encontraron imágenes extraibles en este documento.</p>';
        }

        // Create a root wrapper element since DocumentFragment can't be returned and appended asynchronously easily
        const rootDiv = document.createElement('div');
        rootDiv.appendChild(clone);
        return rootDiv;
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
