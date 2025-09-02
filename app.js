const CLIENT_ID = '769671858332-d05s6m2jmlfuokv8eamm6td8gq34tnlj.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile';

// Elementos del DOM
const authorizeButton = document.getElementById('authorize_button'); // Reintroducimos el botón Autorizar
const signoutButton = document.getElementById('signout_button');
const searchButton = document.getElementById('search_button');
const searchQueryInput = document.getElementById('search_query');
const authStatusDiv = document.getElementById('auth_status');
const searchContainerDiv = document.getElementById('search_container');
const pdfList = document.getElementById('pdf_list');
const uploadContainerDiv = document.getElementById('upload_container'); // Nuevo
const uploadFileInput = document.getElementById('upload_file_input');   // Nuevo
const uploadButton = document.getElementById('upload_button');         // Nuevo
const uploadStatusP = document.getElementById('upload_status');         // Nuevo
const userInfoDiv = document.getElementById('user_info');               // Nuevo
const userProfilePic = document.getElementById('user_profile_pic');     // Nuevo
const userNameSpan = document.getElementById('user_name');             // Nuevo

let gapiInited = false;
let gisInited = false;
let tokenClient;
let accessToken = null; // Variable para almacenar el token de acceso

console.log('app.js cargado y ejecutándose.');

function gisInit() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // Se definirá en el momento de la solicitud de token
    });
    gisInited = true;
    maybeEnableButtons();
}

function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    await gapi.client.init({
        // apiKey: API_KEY, // Puedes quitar esto si no usas ninguna API Key
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    });
    gapiInited = true;
    maybeEnableButtons();
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        authorizeButton.onclick = handleAuthClick;
        signoutButton.onclick = handleSignoutClick;
        searchButton.onclick = searchPdfs;
        searchQueryInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                searchPdfs();
            }
        });
        uploadButton.onclick = uploadFile; // Nuevo: Enlazar la función de subida
        updateSigninStatus(false); // Inicialmente no autenticado
    }
}

// Eliminamos la función handleCredentialResponse ya que no la usaremos con este enfoque.

function handleAuthClick() {
    console.log('handleAuthClick llamado.');
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            throw (resp);
        }
        accessToken = resp.access_token;
        updateSigninStatus(true);
    };

    if (accessToken === null) {
        tokenClient.requestAccessToken({'prompt': 'consent'});
    } else {
        tokenClient.requestAccessToken({'prompt': 'none'});
    }
}

function handleSignoutClick() {
    console.log('handleSignoutClick llamado.');
    if (accessToken !== null) {
        google.accounts.oauth2.revoke(accessToken, () => {
            console.log('access token revoked');
            accessToken = null;
            updateSigninStatus(false);
        });
    }
}

function updateSigninStatus(isSignedIn) {
    if (isSignedIn) {
        authorizeButton.style.display = 'none';
        signoutButton.style.display = 'block';
        authStatusDiv.querySelector('p').textContent = 'Sesión iniciada.';
        searchContainerDiv.style.display = 'flex';
        uploadContainerDiv.style.display = 'block';
        userInfoDiv.style.display = 'inline-block'; // Mostrar info de usuario

        // Obtener y mostrar info del usuario
        gapi.client.oauth2.userinfo.get().then(function(response) {
            const profile = response.result;
            userProfilePic.src = profile.picture; // URL de la imagen de perfil
            userNameSpan.textContent = profile.name; // Nombre del usuario
            authStatusDiv.querySelector('p').style.display = 'none'; // Ocultar mensaje "Sesión iniciada."
        }, function(reason) {
            console.error('Error al obtener información de perfil:', reason);
        });

        searchPdfs(); // Buscar PDFs automáticamente al iniciar sesión
    } else {
        authorizeButton.style.display = 'block';
        signoutButton.style.display = 'none';
        authStatusDiv.querySelector('p').style.display = 'block'; // Mostrar mensaje "Inicia sesión"
        authStatusDiv.querySelector('p').textContent = 'Inicia sesión con tu cuenta de Google para buscar PDFs.';
        searchContainerDiv.style.display = 'none';
        uploadContainerDiv.style.display = 'none';
        userInfoDiv.style.display = 'none'; // Ocultar info de usuario
        pdfList.innerHTML = ''; // Limpiar resultados al cerrar sesión
    }
}

async function searchPdfs() {
    console.log('searchPdfs llamado.');
    if (!accessToken) {
        pdfList.innerHTML = '<li>Por favor, inicia sesión para buscar PDFs.</li>';
        return;
    }

    pdfList.innerHTML = '<li>Buscando PDFs...</li>';
    const query = searchQueryInput.value ? `name contains '${searchQueryInput.value}' and ` : '';
    const folderId = '1A9CVJoyWcUmuqNH3UC90T0eAs-YnVs_7'; // ID de tu carpeta de Google Drive

    try {
        const response = await gapi.client.drive.files.list({
            q: `'${folderId}' in parents and ${query}mimeType='application/pdf'`,
            fields: 'files(id, name, webContentLink, webViewLink)',
            pageSize: 10,
            // Se requiere el token de acceso para las solicitudes de API
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        displayPdfs(response.result.files);
    } catch (error) {
        console.error('Error al buscar PDFs:', error);
        pdfList.innerHTML = '<li>Error al buscar PDFs. Consulta la consola para más detalles.</li>';
    }
}

function displayPdfs(files) {
    pdfList.innerHTML = '';
    if (files && files.length > 0) {
        files.forEach(file => {
            const listItem = document.createElement('li');
            listItem.className = 'pdf-item';

            const icon = document.createElement('i');
            icon.className = 'fas fa-file-pdf pdf-icon';
            listItem.appendChild(icon);

            const link = document.createElement('a');
            link.href = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
            link.target = '_blank'; // Abrir en nueva pestaña
            link.textContent = file.name;
            listItem.appendChild(link);
            pdfList.appendChild(listItem);
        });
    } else {
        pdfList.innerHTML = '<li>No se encontraron archivos PDF.</li>';
    }
}

// Nueva función para subir archivos
async function uploadFile() {
    console.log('uploadFile llamado.');
    if (!accessToken) {
        uploadStatusP.textContent = 'Por favor, inicia sesión para subir archivos.';
        return;
    }

    const file = uploadFileInput.files[0];
    if (!file) {
        uploadStatusP.textContent = 'Por favor, selecciona un archivo PDF para subir.';
        return;
    }

    if (file.type !== 'application/pdf') {
        uploadStatusP.textContent = 'Solo se permiten archivos PDF.';
        return;
    }

    uploadStatusP.textContent = `Subiendo ${file.name}...`;

    const folderId = '1A9CVJoyWcUmuqNH3UC90T0eAs-YnVs_7'; // ID de tu carpeta de Google Drive

    const metadata = {
        name: file.name,
        parents: [folderId],
        mimeType: 'application/pdf'
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    try {
        const response = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                },
                body: form
            }
        );

        if (response.ok) {
            const result = await response.json();
            uploadStatusP.textContent = `Archivo ${result.name} subido exitosamente.`;
            uploadFileInput.value = ''; // Limpiar input
            searchPdfs(); // Actualizar la lista de PDFs después de subir
        } else {
            const errorText = await response.text();
            throw new Error(`Error ${response.status}: ${errorText}`);
        }
    } catch (error) {
        console.error('Error al subir el archivo:', error);
        uploadStatusP.textContent = 'Error al subir el archivo. Consulta la consola para más detalles.';
    }
}

// Carga las bibliotecas después de que el DOM esté listo
window.addEventListener('load', () => {
    gapiLoaded(); // Carga la API de GAPI para las solicitudes a Drive
    gisInit();    // Inicializa el cliente de GIS para la autenticación
});
