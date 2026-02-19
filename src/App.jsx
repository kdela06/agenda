import { GoogleOAuthProvider, useGoogleLogin, googleLogout } from '@react-oauth/google';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Editor from '@monaco-editor/react';

// --- CONFIGURACIÓN PDF (VITE COMPATIBLE 100%) ---
import { pdfjs, Document, Page } from 'react-pdf';

// 1. Estilos: Rutas actualizadas para v9
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// 2. WORKER LOCAL: Usamos ?url para que Vite lo empaquete dentro de la web
// Esto evita errores de CDN, CORS y versiones.
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

// --- CONFIGURACIÓN ENV ---
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ""; 

function App() {
  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!CLIENT_ID || CLIENT_ID === "") {
    return (
      <div style={{padding: "40px", textAlign: "center", background: "#F1D8D9", height: "100vh"}}>
        <h2 style={{color: "#C99597"}}>⚠️ Error de Configuración</h2>
        <p>Vite no detecta tu archivo <b>.env</b></p>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <AgendaWorkspace />
    </GoogleOAuthProvider>
  );
}

function AgendaWorkspace() {
  // --- ESTADOS USUARIO ---
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [nombreUsuario, setNombreUsuario] = useState(localStorage.getItem("nombre_personalizado") || "Admin");
  
  // --- POMODORO ---
  const [pomoMinutes, setPomoMinutes] = useState(25);
  const [pomoTime, setPomoTime] = useState(25 * 60);
  const [pomoActivo, setPomoActivo] = useState(false);
  const [pomoEditando, setPomoEditando] = useState(false);
  const [pomoInput, setPomoInput] = useState("25");

  // --- SELECCIÓN ---
  const [itemSeleccionado, setItemSeleccionado] = useState(null);

  // --- NAVEGACIÓN ---
  const [rootId, setRootId] = useState(null);
  const [carpetaActual, setCarpetaActual] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [carpetas, setCarpetas] = useState([]);
  const [archivos, setArchivos] = useState([]);
  
  // --- CALENDARIO ---
  const [misCalendarios, setMisCalendarios] = useState([]);
  const [calIdSeleccionado, setCalIdSeleccionado] = useState('');
  const [urlCalendarioCombinado, setUrlCalendarioCombinado] = useState(null);
  const [mostrarFormularioCal, setMostrarFormularioCal] = useState(false);
  const [evtTitulo, setEvtTitulo] = useState("");
  const [evtFechaIni, setEvtFechaIni] = useState("");
  const [evtHoraIni, setEvtHoraIni] = useState("");
  const [evtFechaFin, setEvtFechaFin] = useState(""); 
  const [evtHoraFin, setEvtHoraFin] = useState("");   

// --- VENTANAS (MULTITAREA) ---
  const [ventanasAbiertas, setVentanasAbiertas] = useState([]);
  const [ventanaActiva, setVentanaActiva] = useState('escritorio'); 
  
  // Arrays para múltiples archivos (Sustituyen a archivoEditando, pdfFile, etc.)
  const [editoresAbiertos, setEditoresAbiertos] = useState([]); 
  const [pdfsAbiertos, setPdfsAbiertos] = useState([]);
  
  // --- WIDGETS Y CALENDARIO ---
  const [verWidgets, setVerWidgets] = useState(true);
  const [verCalendario, setVerCalendario] = useState(true);

  // --- WIDGETS ---
  const [menuCrearAbierto, setMenuCrearAbierto] = useState(false);
  const [fileInputRef] = useState(useRef(null));
  const [nuevaNotaTexto, setNuevaNotaTexto] = useState(""); 
  const [notasActuales, setNotasActuales] = useState([]);   
  const [notasFileId, setNotasFileId] = useState(null); 
  const [hora, setHora] = useState(new Date().toLocaleTimeString());

  // Widgets Data
  const [tareas, setTareas] = useState(JSON.parse(localStorage.getItem("widget_tareas")) || []);
  const [examenes, setExamenes] = useState(JSON.parse(localStorage.getItem("widget_examenes")) || []);
  const [entregas, setEntregas] = useState(JSON.parse(localStorage.getItem("widget_entregas")) || []);
  const [cuentasAtras, setCuentasAtras] = useState(JSON.parse(localStorage.getItem("widget_cuentas")) || []);
  
  const [nuevaTarea, setNuevaTarea] = useState("");
  const [nuevoExamen, setNuevoExamen] = useState(""); const [fechaExamen, setFechaExamen] = useState("");
  const [nuevaEntrega, setNuevaEntrega] = useState(""); const [fechaEntrega, setFechaEntrega] = useState("");
  const [tituloCuenta, setTituloCuenta] = useState(""); const [fechaCuenta, setFechaCuenta] = useState("");

  const [anchoVentana, setAnchoVentana] = useState(window.innerWidth);

  // --- EFECTOS ---
  useEffect(() => { 
      const interval = setInterval(() => setHora(new Date().toLocaleTimeString()), 1000);
      const handleResize = () => setAnchoVentana(window.innerWidth);
      window.addEventListener('resize', handleResize);
      return () => { clearInterval(interval); window.removeEventListener('resize', handleResize); }
  }, []);
  
  // Recuperar Sesión
  useEffect(() => {
    const savedToken = localStorage.getItem('google_token');
    const savedUser = localStorage.getItem('google_user');
    if (savedToken && savedUser) {
        const tokenParsed = savedToken;
        setToken(tokenParsed);
        setUser(JSON.parse(savedUser));
        inicializarCarpetaRaiz(tokenParsed);
        cargarYConstruirCalendario(tokenParsed);
    }
  }, []);

  useEffect(() => localStorage.setItem("widget_tareas", JSON.stringify(tareas)), [tareas]);
  useEffect(() => localStorage.setItem("widget_examenes", JSON.stringify(examenes)), [examenes]);
  useEffect(() => localStorage.setItem("widget_entregas", JSON.stringify(entregas)), [entregas]);
  useEffect(() => localStorage.setItem("widget_cuentas", JSON.stringify(cuentasAtras)), [cuentasAtras]);

  // Pomodoro
  useEffect(() => {
      let interval = null;
      if (pomoActivo && pomoTime > 0) {
          interval = setInterval(() => setPomoTime(t => t - 1), 1000);
      } else if (pomoTime === 0 && pomoActivo) {
          setPomoActivo(false);
          alert("⏰ Fin del Pomodoro");
          setPomoTime(pomoMinutes * 60);
      }
      return () => clearInterval(interval);
  }, [pomoActivo, pomoTime, pomoMinutes]);

  const guardarConfigPomo = () => {
      const m = parseInt(pomoInput) || 25;
      setPomoMinutes(m);
      setPomoTime(m * 60);
      setPomoEditando(false);
      setPomoActivo(false);
  };

  // Carga Contenido
  useEffect(() => {
    if (token && carpetaActual) {
        setItemSeleccionado(null);
        if (carpetaActual.id === 'TRASH') cargarPapelera(token);
        else { 
            cargarContenidoDrive(token, carpetaActual.id); 
            cargarNotasDeDrive(token, carpetaActual.id); 
        }
    }
  }, [carpetaActual, token]);

  // --- LOGIN ---
  const login = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      const accessToken = codeResponse.access_token;
      setToken(accessToken);
      localStorage.setItem('google_token', accessToken);
      const userRes = await axios.get(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${accessToken}`, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });
      setUser(userRes.data);
      localStorage.setItem('google_user', JSON.stringify(userRes.data));
      if (nombreUsuario === "Sistema") cambiarNombre(userRes.data.given_name);
      inicializarCarpetaRaiz(accessToken);
      cargarYConstruirCalendario(accessToken);
    },
    onError: (error) => console.log('Login Failed:', error),
    scope: "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/calendar"
  });

  const inicializarCarpetaRaiz = async (accessToken) => {
      try {
        const query = "name = 'mi_agenda' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
        const res = await axios.get('https://www.googleapis.com/drive/v3/files', { headers: { Authorization: `Bearer ${accessToken}` }, params: { q: query } });
        let miAgendaId;
        if (res.data.files && res.data.files.length > 0) { miAgendaId = res.data.files[0].id; } 
        else { const createRes = await axios.post('https://www.googleapis.com/drive/v3/files', { name: 'mi_agenda', mimeType: 'application/vnd.google-apps.folder' }, { headers: { Authorization: `Bearer ${accessToken}` } }); miAgendaId = createRes.data.id; }
        setRootId(miAgendaId); setCarpetaActual({ id: miAgendaId, name: 'mi_agenda' });
      } catch (err) { 
          if(err.response && err.response.status === 401) cerrarSesion();
      }
  };

  const cerrarSesion = () => {
    googleLogout(); setUser(null); setToken(null);
    localStorage.removeItem('google_token'); localStorage.removeItem('google_user');
    setCarpetaActual(null); setRootId(null); setHistorial([]);
    setVentanasAbiertas([]); setVentanaActiva('escritorio');
    setMisCalendarios([]); setUrlCalendarioCombinado(null); setArchivoEditando(null);
  };
  const cambiarNombre = (nuevo) => { const n = nuevo || prompt("Nombre para la ventana:"); if (n) { setNombreUsuario(n); localStorage.setItem("nombre_personalizado", n); } };

  // --- GESTIÓN DE ARCHIVOS ---
  const handleSeleccion = (item, tipo) => {
      if (itemSeleccionado && itemSeleccionado.id === item.id) {
          setItemSeleccionado(null);
      } else {
          setItemSeleccionado({ ...item, tipo });
      }
  };

  const ejecutarRenombrar = async () => {
      if (!itemSeleccionado) return;
      const nuevoNombre = prompt("Nuevo nombre:", itemSeleccionado.name);
      if (nuevoNombre && nuevoNombre !== itemSeleccionado.name) {
          try {
              await axios.patch(`https://www.googleapis.com/drive/v3/files/${itemSeleccionado.id}`, 
                  { name: nuevoNombre }, 
                  { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
              );
              cargarContenidoDrive(token, carpetaActual.id);
              setItemSeleccionado(null);
          } catch (err) { alert("Error al renombrar"); }
      }
  };

  const ejecutarBorrar = async () => {
      if (!itemSeleccionado) return;
      if (window.confirm(`¿Mover "${itemSeleccionado.name}" a la papelera?`)) {
          try {
              await axios.patch(`https://www.googleapis.com/drive/v3/files/${itemSeleccionado.id}`, 
                  { trashed: true, appProperties: { deletedBy: 'agenda_web' } }, 
                  { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
              );
              cargarContenidoDrive(token, carpetaActual.id);
              setItemSeleccionado(null);
          } catch (err) { alert("Error al borrar"); }
      }
  };

  // --- CALENDARIO ---
  const cargarYConstruirCalendario = async (accessToken) => {
      try {
          const res = await axios.get('https://www.googleapis.com/calendar/v3/users/me/calendarList', { headers: { Authorization: `Bearer ${accessToken}` } });
          setMisCalendarios(res.data.items);
          if(res.data.items.length > 0) setCalIdSeleccionado(res.data.items[0].id);
          let baseUrl = "https://calendar.google.com/calendar/embed?ctz=Europe%2FMadrid&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=1&showCalendars=0";
          res.data.items.forEach(cal => {
              const calIdEncoded = encodeURIComponent(cal.id);
              const colorEncoded = encodeURIComponent(cal.backgroundColor || '#245ED1');
              baseUrl += `&src=${calIdEncoded}&color=${colorEncoded}`;
          });
          setUrlCalendarioCombinado(baseUrl);
      } catch (err) { console.error(err); }
  };

  const crearEvento = async () => {
      if (!evtTitulo || !evtFechaIni || !calIdSeleccionado || !token) return alert("Falta Título o Fecha");
      let evento = { summary: evtTitulo };
      const fechaFinReal = evtFechaFin || evtFechaIni; 
      if (!evtHoraIni) {
          evento.start = { date: evtFechaIni };
          const d = new Date(fechaFinReal); d.setDate(d.getDate() + 1);
          evento.end = { date: d.toISOString().split('T')[0] }; 
      } else {
          const horaInicioReal = evtHoraIni;
          const horaFinReal = evtHoraFin || "23:59";
          evento.start = { dateTime: new Date(`${evtFechaIni}T${horaInicioReal}`).toISOString() };
          evento.end = { dateTime: new Date(`${fechaFinReal}T${horaFinReal}`).toISOString() };
      }
      try { 
          await axios.post(`https://www.googleapis.com/calendar/v3/calendars/${calIdSeleccionado}/events`, evento, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }); 
          alert("✅ Evento añadido"); 
          setEvtTitulo(""); setEvtFechaIni(""); setEvtHoraIni(""); setEvtFechaFin(""); setEvtHoraFin("");
          setMostrarFormularioCal(false);
          const current = urlCalendarioCombinado; setUrlCalendarioCombinado(null); setTimeout(()=>setUrlCalendarioCombinado(current),200); 
      } catch (err) { alert("Error creando evento"); }
  };

  // --- DRIVE BASICO ---
  const cargarContenidoDrive = (tokenActual, folderId) => {
    const query = `'${folderId}' in parents and trashed = false and name != '_notes_config.json'`;
    axios.get('https://www.googleapis.com/drive/v3/files', { headers: { Authorization: `Bearer ${tokenActual}` }, params: { q: query, fields: 'files(id, name, mimeType, webViewLink, iconLink)', pageSize: 100 } })
      .then(response => { 
          const todos = response.data.files || []; 
          const sortAlphaNum = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
          setCarpetas(todos.filter(f => f.mimeType === 'application/vnd.google-apps.folder').sort(sortAlphaNum));
          setArchivos(todos.filter(f => f.mimeType !== 'application/vnd.google-apps.folder').sort(sortAlphaNum));
      })
      .catch(err => { if(err.response?.status === 401) cerrarSesion(); });
  };

  const cargarPapelera = (tokenActual) => {
      const query = "trashed = true and appProperties has { key='deletedBy' and value='agenda_web' }";
      axios.get('https://www.googleapis.com/drive/v3/files', { headers: { Authorization: `Bearer ${tokenActual}` }, params: { q: query, fields: 'files(id, name, mimeType)', pageSize: 50 } })
      .then(response => {
          const todos = response.data.files || [];
          setCarpetas(todos.filter(f => f.mimeType === 'application/vnd.google-apps.folder'));
          setArchivos(todos.filter(f => f.mimeType !== 'application/vnd.google-apps.folder'));
      });
  };
  
  const restaurarDePapelera = async (id) => {
      if(window.confirm("¿Restaurar archivo?")){
          await axios.patch(`https://www.googleapis.com/drive/v3/files/${id}`, { trashed: false }, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
          cargarPapelera(token);
      }
  };
  const eliminarDefinitivamente = async (id) => {
      if(window.confirm("⚠️ ELIMINAR PARA SIEMPRE.")){
          await axios.delete(`https://www.googleapis.com/drive/v3/files/${id}`, { headers: { Authorization: `Bearer ${token}` } });
          cargarPapelera(token);
      }
  };

  const subirNivel = () => {
      if (carpetaActual && carpetaActual.id === 'TRASH') { setCarpetaActual({ id: rootId, name: 'mi_agenda' }); setNotasActuales([]); } 
      else if (historial.length > 0) { const prev = historial[historial.length-1]; setHistorial(historial.slice(0,-1)); setCarpetaActual(prev); }
  };
  
  const crearArchivo = (tipo) => {
      setMenuCrearAbierto(false); 
      let nombre = prompt("Nombre del archivo:"); 
      if (!nombre || !token) return;

      if (tipo === 'txt') { if (!nombre.endsWith('.txt')) nombre += '.txt'; }

      let mime = tipo === 'folder' ? 'application/vnd.google-apps.folder' : (tipo === 'doc' ? 'application/vnd.google-apps.document' : (tipo === 'sheet' ? 'application/vnd.google-apps.spreadsheet' : (tipo === 'slide' ? 'application/vnd.google-apps.presentation' : 'text/plain')));
      
      const meta = { name: nombre, mimeType: mime, parents: [carpetaActual.id], appProperties: { createdBy: 'agenda_web' } };
      
      if (tipo === 'txt' || tipo === 'code') {
          const form = new FormData(); 
          form.append('metadata', new Blob([JSON.stringify(meta)], {type:'application/json'})); 
          form.append('file', new Blob([""], {type:'text/plain'}));
          axios.post('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', form, {headers:{'Authorization':`Bearer ${token}`}}).then(()=>cargarContenidoDrive(token,carpetaActual.id));
      } else { 
          axios.post('https://www.googleapis.com/drive/v3/files', meta, {headers:{'Authorization':`Bearer ${token}`, 'Content-Type':'application/json'}}).then(()=>cargarContenidoDrive(token,carpetaActual.id)); 
      }
  };
  const manejarSubida = (e) => { const f = e.target.files[0]; if(!f || !token) return; const fd = new FormData(); fd.append('metadata', new Blob([JSON.stringify({name:f.name, parents:[carpetaActual.id], appProperties:{createdBy:'agenda_web'}})], {type:'application/json'})); fd.append('file', f); axios.post('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', fd, {headers:{'Authorization':`Bearer ${token}`}}).then(()=>{alert("Subido");cargarContenidoDrive(token,carpetaActual.id)}); };

  // --- EDITOR & VISOR ---
  const detectingLenguaje = (nombreArchivo) => {
      const ext = nombreArchivo.split('.').pop().toLowerCase();
      if (ext === 'js' || ext === 'jsx') return 'javascript';
      if (ext === 'html') return 'html';
      if (ext === 'css') return 'css';
      if (ext === 'json') return 'json';
      return 'plaintext';
  };

  const esEditable = (archivo) => {
      const name = archivo.name.toLowerCase(); const mime = archivo.mimeType;
      return mime === 'text/plain' || mime === 'text/html' || mime.includes('json') || mime.includes('javascript') || name.endsWith('.js') || name.endsWith('.py') || name.endsWith('.css') || name.endsWith('.txt');
  };

  const abrirEnEditor = async (archivo, modo) => {
        // Si ya está abierto, solo lo enfocamos
        if (editoresAbiertos.find(e => e.id === archivo.id)) { setVentanaActiva(archivo.id); return; }
        try { 
            const res = await axios.get(`https://www.googleapis.com/drive/v3/files/${archivo.id}`, { headers: { Authorization: `Bearer ${token}` }, params: { alt: 'media' }, responseType: 'text' }); 
            setEditoresAbiertos(prev => [...prev, { id: archivo.id, file: archivo, content: res.data, modo }]);
            setVentanaActiva(archivo.id); 
        } catch (err) { alert("Error leyendo archivo"); }
    };

  const guardarCambiosEditor = async (id) => { 
      const editor = editoresAbiertos.find(e => e.id === id);
      if (!editor) return; 
      try { 
          await axios.patch(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, editor.content, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' } }); 
          alert("✅ Guardado correctamente");
      } catch (err) { console.error("Error al guardar"); } 
  };

  const actualizarContenido = (id, nuevoContenido) => {
      setEditoresAbiertos(prev => prev.map(e => e.id === id ? { ...e, content: nuevoContenido } : e));
  };

  const handleTabKeyMultiple = (e, id) => {
      if (e.key === 'Tab') { e.preventDefault(); const start = e.target.selectionStart; const end = e.target.selectionEnd; const val = e.target.value; 
      actualizarContenido(id, val.substring(0, start) + "\t" + val.substring(end)); 
      setTimeout(() => { e.target.selectionStart = e.target.selectionEnd = start + 1; }, 0); }
  };

  const actualizarPdf = (id, datosActualizados) => {
      setPdfsAbiertos(prev => prev.map(p => p.id === id ? { ...p, ...datosActualizados } : p));
  };

  const detectarTipoYAbrir = async (archivo) => {
      const mime = archivo.mimeType;
      const nombre = archivo.name.toLowerCase();

      if (esEditable(archivo)) { 
          const esTxtPuro = nombre.endsWith('.txt');
          abrirEnEditor(archivo, esTxtPuro ? 'txt' : 'code'); 
      
      } else if (mime.includes('pdf')) {
          if (pdfsAbiertos.find(p => p.id === archivo.id)) { setVentanaActiva(archivo.id); return; }
          try {
             const res = await axios.get(`https://www.googleapis.com/drive/v3/files/${archivo.id}?alt=media`, { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' });
             setPdfsAbiertos(prev => [...prev, { id: archivo.id, file: archivo, blob: res.data, pageNumber: 1, numPages: null, error: null }]);
             setVentanaActiva(archivo.id);
          } catch (e) { alert("Error al descargar el PDF de Drive."); }

      } else if (mime.includes('image')) {
          try {
             const res = await axios.get(`https://www.googleapis.com/drive/v3/files/${archivo.id}?alt=media`, { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' });
             const blobUrl = URL.createObjectURL(res.data);
             abrirVentanaVisor(archivo.id, archivo.name, blobUrl, mime);
          } catch (e) { alert("Error cargando vista previa."); }

      } else { 
          let url = archivo.webViewLink; 
          if (!url.includes('embedded=true')) url += (url.includes('?') ? '&' : '?') + 'embedded=true'; 
          abrirVentanaVisor(archivo.id, archivo.name, url, mime); 
      }
  };

  const abrirVentanaVisor = (id, title, url, mimeType) => { 
      const yaAbierto = ventanasAbiertas.find(v => v.id === id); 
      if (yaAbierto) { setVentanaActiva(id); } else { setVentanasAbiertas([...ventanasAbiertas, { id, title, url, mimeType }]); setVentanaActiva(id); } 
  };
  
  const cerrarVentana = (id, e) => { if(e) e.stopPropagation(); const nuevas = ventanasAbiertas.filter(v => v.id !== id); setVentanasAbiertas(nuevas); if (ventanaActiva === id) { setVentanaActiva(nuevas.length > 0 ? nuevas[nuevas.length-1].id : 'escritorio'); } };

  // --- NOTAS (SYNC NUBE) ---
  const cargarNotasDeDrive = async (tokenActual, folderId) => {
      try {
          const q = `name = '_notes_config.json' and '${folderId}' in parents and trashed = false`;
          const res = await axios.get('https://www.googleapis.com/drive/v3/files', { headers: { Authorization: `Bearer ${tokenActual}` }, params: { q: q } });
          if (res.data.files && res.data.files.length > 0) {
              const fileId = res.data.files[0].id;
              setNotasFileId(fileId);
              const contentRes = await axios.get(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: { Authorization: `Bearer ${tokenActual}` } });
              setNotasActuales(contentRes.data || []);
          } else { setNotasFileId(null); setNotasActuales([]); }
      } catch (err) { console.error("Error notas", err); setNotasActuales([]); }
  };

  const guardarNotasEnDrive = async (nuevasNotas) => {
      try {
          const blob = new Blob([JSON.stringify(nuevasNotas)], { type: 'application/json' });
          if (notasFileId) {
              await axios.patch(`https://www.googleapis.com/upload/drive/v3/files/${notasFileId}?uploadType=media`, blob, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
          } else {
              const metadata = { name: '_notes_config.json', parents: [carpetaActual.id], mimeType: 'application/json' };
              const formData = new FormData();
              formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
              formData.append('file', blob);
              const res = await axios.post('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', formData, { headers: { Authorization: `Bearer ${token}` } });
              setNotasFileId(res.data.id);
          }
      } catch (err) { console.error("Error guardando notas", err); }
  };

  const agregarNota = () => { if (!nuevaNotaTexto) return; const nuevas = [...notasActuales, { id: Date.now(), text: nuevaNotaTexto }]; setNotasActuales(nuevas); guardarNotasEnDrive(nuevas); setNuevaNotaTexto(""); };
  const borrarNota = (id) => { const nuevas = notasActuales.filter(n => n.id !== id); setNotasActuales(nuevas); guardarNotasEnDrive(nuevas); };

  // --- WIDGETS ---
  const addTarea = () => { if(nuevaTarea) { setTareas([...tareas, {id: Date.now(), txt: nuevaTarea}]); setNuevaTarea(""); }}; const delTarea = (id) => setTareas(tareas.filter(t => t.id !== id));
  const addExamen = () => { if(nuevoExamen && fechaExamen) { setExamenes([...examenes, {id: Date.now(), txt: nuevoExamen, fecha: fechaExamen}]); setNuevoExamen(""); }}; const delExamen = (id) => setExamenes(examenes.filter(t => t.id !== id));
  const addEntrega = () => { if(nuevaEntrega && fechaEntrega) { setEntregas([...entregas, {id: Date.now(), txt: nuevaEntrega, fecha: fechaEntrega}]); setNuevaEntrega(""); }}; const delEntrega = (id) => setEntregas(entregas.filter(t => t.id !== id));
  const addCuenta = () => { if(tituloCuenta && fechaCuenta) { setCuentasAtras([...cuentasAtras, {id: Date.now(), txt: tituloCuenta, fecha: fechaCuenta}]); setTituloCuenta(""); }}; const delCuenta = (id) => setCuentasAtras(cuentasAtras.filter(t => t.id !== id));
  const calcDias = (f) => Math.ceil((new Date(f) - new Date()) / (1000 * 60 * 60 * 24));
  const formatTime = (seconds) => { const m = Math.floor(seconds / 60); const s = seconds % 60; return `${m}:${s < 10 ? '0' : ''}${s}`; };

  return (
      <div style={xpFullPage}>
        <style>
          {`@import url('https://fonts.googleapis.com/css2?family=Mali:wght@400;700&family=Roboto+Mono:wght@400;700&display=swap');`}
        </style>

        <div style={xpTopBar}>
          <div style={{display:"flex", alignItems:"center", gap:"15px"}}>
              <div style={{fontWeight:"bold", fontSize:"15px"}}>{nombreUsuario}</div>
              <div style={{display:"flex", alignItems:"center", gap:"5px", background:"rgba(255,255,255,0.2)", padding:"2px 8px", borderRadius:"10px"}}>
                  {!pomoEditando ? (
                      <>
                        <span style={{fontSize:"15px", fontWeight:"bold"}}>🍅 {formatTime(pomoTime)}</span>
                        <button onClick={()=>setPomoActivo(!pomoActivo)} style={xpPomoBtn}>{pomoActivo ? '⏸' : '▶'}</button>
                        <button onClick={()=>{setPomoActivo(false); setPomoTime(pomoMinutes*60)}} style={xpPomoBtn}>↺</button>
                        <button onClick={()=>{setPomoEditando(true); setPomoInput(pomoMinutes.toString())}} style={xpPomoBtn}>✏️</button>
                      </>
                  ) : (
                      <>
                        <span style={{fontSize:"14px"}}>Mins:</span>
                        <input type="number" value={pomoInput} onChange={(e)=>setPomoInput(e.target.value)} style={{width:"40px", fontSize:"12px", textAlign:"center", fontFamily: "'Mali', cursive"}}/>
                        <button onClick={guardarConfigPomo} style={{...xpPomoBtn, color:"#fff", fontSize:"12px"}}>💾</button>
                        <button onClick={()=>setPomoEditando(false)} style={{...xpPomoBtn, color:"#ffcccb", fontSize:"12px"}}>❌</button>
                      </>
                  )}
              </div>
          </div>
          {user ? (<div style={{fontSize:"13px", display:"flex", gap:"15px", alignItems:"center"}}><span>{hora}</span><span onClick={()=>cambiarNombre()} style={xpLink}>Renombrar</span><span onClick={cerrarSesion} style={xpLink}>Salir</span></div>) : <div style={{fontSize:"13px"}}>{hora}</div>}
        </div>

        {!user ? (
          <div style={xpLoginWindow}>
            <div style={xpWindowTitle}>Login</div>
            <div style={{padding:"40px", textAlign:"center"}}><p style={{marginBottom:"20px"}}>Iniciando Sistema...</p><button onClick={()=>login()} style={xpLoginButton}>🔑 Autorizar Google</button></div>
          </div>
        ) : (
          <div style={{display:"flex", flexDirection:"column", flex:1, overflow:"hidden"}}>
            <div style={{position:"relative", flex:1, overflow:"hidden", display:"flex"}}>
                
                {/* 1. ESCRITORIO */}
                <div style={{display: (ventanaActiva === 'escritorio') ? 'flex' : 'none', width:"100%", height:"100%", overflow:"hidden"}} className="agenda-main-layout">
                    
                    {/* IZQ: WIDGETS */}
                    {verWidgets && (
                        <div style={{width:"250px", minWidth:"250px", borderRight:"3px solid #C99597", background:"#EAD4D5", padding:"10px", display:"flex", flexDirection:"column", overflowY:"auto"}} className="agenda-column">
                            {/* ... (WIDGETS CODE) ... */}
                            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px"}}>
                                <span style={{fontWeight:"bold", color:"#C99597"}}>Widgets</span>
                                <button onClick={()=>setVerWidgets(false)} style={{cursor:"pointer", border:"none", background:"transparent", color:"#C99597"}}>Efec. ◀</button>
                            </div>
                            <div style={{flex: 1}}>
                                <div style={xpSidebarSection}><div style={xpSidebarHeader}>📝 Tareas</div><div style={xpWidgetContent}>{tareas.map(t=>(<div key={t.id} style={{display:"flex",justifyContent:"space-between"}}><span>▫ {t.txt}</span><span onClick={()=>delTarea(t.id)} style={{color:"red",cursor:"pointer"}}>x</span></div>))}<div style={{display:"flex", marginTop:"3px"}}><input value={nuevaTarea} onChange={e=>setNuevaTarea(e.target.value)} style={xpInputSmall}/><button onClick={addTarea} style={xpBtnSmall}>+</button></div></div></div>
                                <div style={xpSidebarSection}><div style={xpSidebarHeader}>📦 Entregas</div><div style={xpWidgetContent}>{entregas.map(t=>(<div key={t.id}>❗ {t.txt} ({t.fecha}) <span onClick={()=>delEntrega(t.id)} style={{color:"red",cursor:"pointer"}}>x</span></div>))}<div style={{marginTop:"3px"}}><input value={nuevaEntrega} onChange={e=>setNuevaEntrega(e.target.value)} placeholder="Práctica" style={xpInputSmall}/><input type="date" value={fechaEntrega} onChange={e=>setFechaEntrega(e.target.value)} style={xpInputSmall}/><button onClick={addEntrega} style={{...xpBtnSmall,width:"100%"}}>Añadir</button></div></div></div>
                                <div style={xpSidebarSection}><div style={xpSidebarHeader}>⏳ Cuentas Atrás</div><div style={xpWidgetContent}>{cuentasAtras.map(c=>(<div key={c.id} style={{background:"#fff", border:"1px solid #eee", textAlign:"center", marginBottom:"2px"}}><div style={{fontSize:"11px"}}>{c.txt}</div><div style={{color:"#C99597",fontWeight:"bold"}}>{calcDias(c.fecha)} días</div><div onClick={()=>delCuenta(c.id)} style={{fontSize:"10px",cursor:"pointer"}}>borrar</div></div>))}<div style={{marginTop:"3px"}}><input value={tituloCuenta} onChange={e=>setTituloCuenta(e.target.value)} placeholder="Evento" style={xpInputSmall}/><input type="date" value={fechaCuenta} onChange={e=>setFechaCuenta(e.target.value)} style={xpInputSmall}/><button onClick={addCuenta} style={{...xpBtnSmall,width:"100%"}}>Crear</button></div></div></div>
                                <div style={xpSidebarSection}><div style={xpSidebarHeader}>🎓 Exámenes</div><div style={xpWidgetContent}>{examenes.map(t=>(<div key={t.id} style={{borderBottom:"1px dashed #ccc"}}><b>{t.txt}</b> ({t.fecha}) <span onClick={()=>delExamen(t.id)} style={{color:"red",cursor:"pointer"}}>x</span></div>))}<div style={{marginTop:"3px"}}><input value={nuevoExamen} onChange={e=>setNuevoExamen(e.target.value)} placeholder="Asignatura" style={xpInputSmall}/><input type="date" value={fechaExamen} onChange={e=>setFechaExamen(e.target.value)} style={xpInputSmall}/><button onClick={addExamen} style={{...xpBtnSmall,width:"100%"}}>Añadir</button></div></div></div>
                            </div>
                            <div style={{marginTop: "20px"}}>
                                <div onClick={()=>{setCarpetaActual({id:'TRASH', name:'Papelera'}); setNotasActuales([])}} style={{...xpSidebarSection, cursor:"pointer", background: carpetaActual?.id === 'TRASH' ? '#fff' : 'rgba(255,255,255,0.6)'}}>
                                    <div style={xpSidebarHeader}>🗑️ Papelera</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CENTRO: EXPLORADOR */}
                    <div style={{flex: 1, minWidth:"300px", display:"flex", flexDirection:"column", borderRight:"3px solid #C99597", background:"white"}} className="agenda-column">
                        
                        <div style={{display:"flex", background:"#FAF6F4", borderBottom:"1px solid #ccc"}}>
                             {!verWidgets && <button onClick={()=>setVerWidgets(true)} style={{border:"none", background:"transparent", cursor:"pointer", fontSize:"12px", padding:"5px"}}>▶ Mostrar Widgets</button>}
                             <div style={{flex:1}}></div>
                             {!verCalendario && <button onClick={()=>setVerCalendario(true)} style={{border:"none", background:"transparent", cursor:"pointer", fontSize:"12px", padding:"5px"}}>◀ Mostrar Calendario</button>}
                        </div>

                        {carpetaActual?.id !== 'TRASH' ? (
                            <>
                                <div style={{padding:"8px", borderBottom:"1px solid #DDB2B5", background:"#FAF6F4", display:"flex", gap:"10px", alignItems:"center"}}>
                                    <button onClick={subirNivel} disabled={!carpetaActual || carpetaActual.id === rootId} style={xpUpButton}>⬆ Subir</button>
                                    <div style={xpAddressInput}>C:\{nombreUsuario}\{carpetaActual ? carpetaActual.name : "..."}</div>
                                </div>
                                <div style={xpActionBar} className="agenda-action-bar">
                                    <div style={{position:"relative"}}>
                                        <button onClick={()=>setMenuCrearAbierto(!menuCrearAbierto)} style={{...xpButton, background:"#C99597", color:"white"}}>⭐ Nuevo... ▼</button>
                                        {menuCrearAbierto && (
                                            <div style={xpDropdownMenu}>
                                                <div onClick={()=>crearArchivo('folder')} style={xpDropdownItem}>📁 Carpeta</div>
                                                <div onClick={()=>crearArchivo('txt')} style={xpDropdownItem}>📝 Nota Texto</div>
                                                <div onClick={()=>crearArchivo('code')} style={xpDropdownItem}>💻 Código</div>
                                                <div onClick={()=>crearArchivo('doc')} style={xpDropdownItem}>📄 Google Doc</div>
                                                <div onClick={()=>crearArchivo('sheet')} style={xpDropdownItem}>📊 Google Sheet</div>
                                                <div onClick={()=>crearArchivo('slide')} style={xpDropdownItem}>📽 Google Slide</div>
                                                <div style={{borderTop:"1px solid #eee", margin:"5px 0"}}></div>
                                                <div onClick={()=>fileInputRef.current.click()} style={{...xpDropdownItem, fontWeight:"bold", color:"#2E7D32"}}>📤 Subir Archivo</div>
                                            </div>
                                        )}
                                        <input type="file" ref={fileInputRef} style={{display:"none"}} onChange={manejarSubida} />
                                    </div>

                                    {/* BARRA DE ACCIÓN INTELIGENTE */}
                                    {itemSeleccionado ? (
                                        <div style={{display:"flex", gap:"10px", marginLeft:"10px", alignItems:"center", background:"#E3C0C2", padding:"2px 10px", borderRadius:"4px", flex:1}}>
                                            <span style={{fontWeight:"bold", fontSize:"12px", color: "white"}}>Seleccionado: {itemSeleccionado.name}</span>
                                            <button onClick={ejecutarRenombrar} style={{...xpButton, fontSize:"12px", padding:"2px 8px"}}>✏️ Renombrar</button>
                                            <button onClick={ejecutarBorrar} style={{...xpButton, fontSize:"12px", padding:"2px 8px", color:"red"}}>🗑️ Borrar</button>
                                            <button onClick={()=>setItemSeleccionado(null)} style={{...xpButton, fontSize:"12px", padding:"2px 8px"}}>❌</button>
                                        </div>
                                    ) : (
                                        <div style={{borderLeft:"1px solid #ccc", paddingLeft:"10px", display:"flex", gap:"5px", flex:1}}>
                                            <input type="text" value={nuevaNotaTexto} onChange={(e)=>setNuevaNotaTexto(e.target.value)} placeholder="Nota..." style={{...xpInput, background:"#FFF5E5"}}/>
                                            <button onClick={agregarNota} style={{...xpButton, background:"#FFF5E5"}}>📌</button>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div style={{padding:"8px", background:"#333", color:"white", borderBottom:"1px solid #000", display:"flex", alignItems:"center", gap:"10px"}}>
                                <button onClick={subirNivel} style={xpUpButton}>⬆ Salir</button>
                                <span>🗑️ PAPELERA</span>
                            </div>
                        )}

                        <div style={{padding:"20px", overflowY:"auto", flex:1}}>
                            {/* NOTAS */}
                            {notasActuales.length > 0 && carpetaActual.id !== 'TRASH' && (
                                <div style={{marginBottom:"20px"}}>
                                    <div style={xpSectionTitle}>📌 Notas ({carpetaActual.name})</div>
                                    <div style={{display:"flex", flexWrap:"wrap", gap:"10px"}}>
                                        {notasActuales.map(nota => (
                                            <div key={nota.id} style={xpStickyNote}>{nota.text}<div onClick={()=>borrarNota(nota.id)} style={xpDeleteNote}>x</div></div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ARCHIVOS (SELECCIONABLES) */}
                            <div style={xpSectionTitle}>{carpetaActual?.id === 'TRASH' ? 'Archivos Eliminados' : '📂 Archivos'}</div>
                            <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(90px, 1fr))", gap:"15px"}}>
                                {carpetas.map(c => (
                                    <div key={c.id} 
                                         onClick={()=>handleSeleccion(c, 'folder')}
                                         onDoubleClick={()=>{setHistorial([...historial, carpetaActual]); setCarpetaActual(c);}} 
                                         style={{...xpIconContainer, background: itemSeleccionado?.id === c.id ? '#DCEAF7' : 'transparent', border: itemSeleccionado?.id === c.id ? '1px dotted #245ED1' : '1px solid transparent'}}>
                                        
                                        {carpetaActual?.id === 'TRASH' ? (
                                            <div style={{textAlign:"center"}}><div style={{...xpFolderIcon, opacity:0.5}}></div><div style={xpIconName}>{c.name}</div><button onClick={()=>restaurarDePapelera(c.id)} style={{fontSize:"12px"}}>♻️</button><button onClick={()=>eliminarDefinitivamente(c.id)} style={{fontSize:"12px", color:"red"}}>❌</button></div>
                                        ) : (
                                            <><div style={{cursor:"pointer"}}><div style={xpFolderIcon}></div><div style={xpIconName}>{c.name}</div></div></>
                                        )}
                                    </div>
                                ))}
                                {archivos.map(a => (
                                    <div key={a.id} 
                                         onClick={()=>handleSeleccion(a, 'file')}
                                         onDoubleClick={()=>detectarTipoYAbrir(a)} 
                                         style={{...xpIconContainer, background: itemSeleccionado?.id === a.id ? '#DCEAF7' : 'transparent', border: itemSeleccionado?.id === a.id ? '1px dotted #245ED1' : '1px solid transparent'}}>
                                        
                                        {carpetaActual?.id === 'TRASH' ? (
                                            <div style={{textAlign:"center"}}><div style={{...xpFileIcon, opacity:0.5}}></div><div style={xpIconName}>{a.name}</div><button onClick={()=>restaurarDePapelera(a.id)} style={{fontSize:"12px"}}>♻️</button><button onClick={()=>eliminarDefinitivamente(a.id)} style={{fontSize:"12px", color:"red"}}>❌</button></div>
                                        ) : (
                                            <><div style={{cursor:"pointer"}}><div style={xpFileIcon}><div style={xpFileCorner}></div></div><div style={xpIconName}>{a.name}</div></div></>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* DER: CALENDARIO */}
                    {verCalendario && (
                        <div style={{width:"400px", minWidth:"300px", display:"flex", flexDirection:"column", background:"#fff"}} className="agenda-column">
                            {/* ... (CALENDARIO CODE) ... */}
                            <div style={{display:"flex", justifyContent:"flex-end", padding:"5px", background:"#FAF6F4"}}>
                                <button onClick={()=>setVerCalendario(false)} style={{cursor:"pointer", border:"none", background:"transparent", color:"#C99597"}}>Ocultar ◀</button>
                            </div>

                            <div style={xpWindowHeader}>
                                📅 Agenda Google
                                <button onClick={()=>setMostrarFormularioCal(!mostrarFormularioCal)} style={{...xpBtnSmall, marginLeft:"10px", color:"black"}}>
                                    {mostrarFormularioCal ? '➖ Cancelar' : '➕ Añadir Evento'}
                                </button>
                            </div>
                            
                            {mostrarFormularioCal && (
                                <div style={{padding:"10px", background:"#F7E8E8", borderBottom:"1px solid #C99597"}}>
                                    <div style={{fontSize:"12px", fontWeight:"bold", color:"#C99597", marginBottom:"5px"}}>Nuevo Evento:</div>
                                    <input value={evtTitulo} onChange={e=>setEvtTitulo(e.target.value)} placeholder="Título" style={{...xpInputSmall, marginBottom:"5px"}}/>
                                    
                                    <div style={{marginBottom:"5px"}}>
                                        <select value={calIdSeleccionado} onChange={(e)=>setCalIdSeleccionado(e.target.value)} style={xpInputSmall}>
                                            {misCalendarios.map(cal => (
                                                <option key={cal.id} value={cal.id}>{cal.summary}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div style={{display:"flex", gap:"5px", marginBottom:"5px"}}>
                                        <div style={{flex:1}}>
                                            <span style={{fontSize:"10px", color:"#666"}}>Inicio:</span>
                                            <input type="date" value={evtFechaIni} onChange={e=>setEvtFechaIni(e.target.value)} style={xpInputSmall}/>
                                            <input type="time" value={evtHoraIni} onChange={e=>setEvtHoraIni(e.target.value)} style={xpInputSmall}/>
                                        </div>
                                        <div style={{flex:1}}>
                                            <span style={{fontSize:"10px", color:"#666"}}>Fin (Opc):</span>
                                            <input type="date" value={evtFechaFin} onChange={e=>setEvtFechaFin(e.target.value)} style={xpInputSmall}/>
                                            <input type="time" value={evtHoraFin} onChange={e=>setEvtHoraFin(e.target.value)} style={xpInputSmall}/>
                                        </div>
                                    </div>
                                    <button onClick={crearEvento} style={{...xpBtnSmall, width:"100%", background:"#C99597", color:"white"}}>Crear</button>
                                </div>
                            )}

                            {urlCalendarioCombinado && <iframe src={urlCalendarioCombinado} style={{flex:1, border:"none", width:"100%"}}></iframe>}
                        </div>
                    )}
                </div>

                {/* VENTANAS FLOTANTES */}
                {ventanasAbiertas.map((ventana) => (
                    <div key={ventana.id} style={{display: (ventanaActiva === ventana.id) ? 'flex' : 'none', position:"absolute", top:0, left:0, width:"100%", height:"100%", background:"#F1D8D9", flexDirection:"column", zIndex:50}}>
                        <div style={xpWindowHeader}>
                            <span>👁 {ventana.title}</span>
                            <div style={{display:"flex", gap:"5px"}}>
                                <button onClick={()=>window.open(ventana.url, '_blank')} style={{...xpWinControl, width:"auto", padding:"0 5px"}} title="Abrir en pestaña nueva">🔗</button>
                                <button onClick={()=>setVentanaActiva('escritorio')} style={xpWinControl}>_</button>
                                <button onClick={(e)=>cerrarVentana(ventana.id, e)} style={{...xpWinControl, background:"#ff4444", color:"white"}}>X</button>
                            </div>
                        </div>
                        <div style={{flex:1, background:"white", overflow:"hidden", display:"flex", justifyContent:"center", alignItems:"center"}}>
                           {ventana.mimeType && (ventana.mimeType.includes('image')) ? (
                                <img src={ventana.url} style={{maxWidth:"100%", maxHeight:"100%", objectFit:"contain"}} alt={ventana.title} />
                           ) : (
                              <iframe src={ventana.url} style={{width:"100%", height:"100%", border:"none"}}></iframe>
                           )}
                        </div>
                    </div>
                ))}

                {/* VISOR PDF MULTIPLE */}
                {pdfsAbiertos.map(pdf => (
                    <div key={pdf.id} style={{display: ventanaActiva === pdf.id ? 'flex' : 'none', position:"absolute", top:0, left:0, width:"100%", height:"100%", background:"#525659", flexDirection:"column", zIndex:200}}>
                        <div style={xpWindowHeader}>
                            <span>📄 PDF: {pdf.file.name}</span>
                            <div style={{display:"flex", gap:"5px"}}>
                                <button onClick={()=>setVentanaActiva('escritorio')} style={xpWinControl}>_</button>
                                <button onClick={()=>{setPdfsAbiertos(prev => prev.filter(p => p.id !== pdf.id)); if(ventanaActiva === pdf.id) setVentanaActiva('escritorio');}} style={{...xpWinControl, background:"#ff4444", color:"white"}}>X</button>
                            </div>
                        </div>
                        
                        <div style={{padding:"5px", background:"#333", color:"white", display:"flex", gap:"10px", justifyContent:"center", alignItems:"center", flexWrap: "wrap"}}>
                            {/* Controles de página */}
                            <button onClick={()=>actualizarPdf(pdf.id, { pageNumber: Math.max(1, pdf.pageNumber - 1) })} disabled={pdf.pageNumber <= 1} style={xpButton}>◀ Ant</button>
                            
                            <div style={{display: "flex", alignItems: "center", gap: "5px"}}>
                                <span>Pág</span>
                                <input 
                                    type="number" 
                                    value={pdf.pageNumber} 
                                    onChange={(e) => {
                                        let page = parseInt(e.target.value);
                                        if (!isNaN(page)) {
                                            if (pdf.numPages && page > pdf.numPages) page = pdf.numPages;
                                            if (page < 1) page = 1;
                                            actualizarPdf(pdf.id, { pageNumber: page });
                                        }
                                    }}
                                    style={{ width: "50px", textAlign: "center", borderRadius: "3px", border: "none", padding: "2px", fontFamily: "'Mali', cursive", outline: "none", color: "black" }}
                                />
                                <span> {pdf.numPages ? `de ${pdf.numPages}` : ''}</span>
                            </div>

                            <button onClick={()=>actualizarPdf(pdf.id, { pageNumber: Math.min(pdf.numPages || 999, pdf.pageNumber + 1) })} disabled={pdf.numPages && pdf.pageNumber >= pdf.numPages} style={xpButton}>Sig ▶</button>
                            
                            {/* Separador vertical */}
                            <div style={{ borderLeft: "2px solid #555", height: "20px", margin: "0 5px" }}></div>
                            
                            {/* Controles de Zoom */}
                            <button onClick={() => actualizarPdf(pdf.id, { zoom: Math.max(0.5, (pdf.zoom || 1) - 0.2) })} style={xpButton}>🔍 -</button>
                            <span style={{ fontSize: "13px", width: "45px", textAlign: "center" }}>{Math.round((pdf.zoom || 1) * 100)}%</span>
                            <button onClick={() => actualizarPdf(pdf.id, { zoom: Math.min(3, (pdf.zoom || 1) + 0.2) })} style={xpButton}>🔍 +</button>
                        </div>

                        <div style={{flex:1, overflow:"auto", display:"flex", justifyContent:"center", background:"#525659", padding:"20px"}}>
                            {pdf.error ? (
                                <div style={{color:"white", padding:"20px"}}>{pdf.error}</div>
                            ) : pdf.blob ? (
                                <Document file={pdf.blob} onLoadSuccess={({ numPages }) => actualizarPdf(pdf.id, { numPages, error: null })} onLoadError={(e) => actualizarPdf(pdf.id, { error: "Error al abrir PDF: " + e.message })} loading={<div style={{color:"white"}}>Cargando documento...</div>}>
                                    <Page pageNumber={pdf.pageNumber} renderTextLayer={false} renderAnnotationLayer={false} width={Math.min(anchoVentana * 0.9, 800) * (pdf.zoom || 1)} />
                                </Document>
                            ) : (<div style={{color:"white"}}>Descargando...</div>)}
                        </div>
                    </div>
                ))}

                {/* EDITOR (HÍBRIDO) MULTIPLE */}
                {editoresAbiertos.map(editor => (
                    <div key={editor.id} style={{display: ventanaActiva === editor.id ? 'flex' : 'none', position:"absolute", top:0, left:0, width:"100%", height:"100%", background: editor.modo === 'code' ? "#1e1e1e" : "#fff", color: editor.modo === 'code' ? "#d4d4d4" : "#000", zIndex:200, flexDirection:"column", border: editor.modo === 'txt' ? "10px solid #C99597" : "none"}}>
                         <div style={{background: editor.modo === 'code' ? "#3c3c3c" : "#C99597", color: "white", padding: "5px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", borderBottom: editor.modo==='code'?"1px solid #252526":"2px solid #A67577"}}>
                            <div style={{display:"flex", alignItems:"center", gap:"10px"}}>
                                <span style={{fontWeight:"bold"}}>{editor.modo === 'code' ? '💻 Visual Studio' : '📝 Bloc de Notas XP'} - {editor.file.name}</span>
                            </div>
                            <div style={{display:"flex", gap:"5px"}}>
                                <button onClick={()=>setVentanaActiva('escritorio')} style={xpWinControl}>_</button>
                                <button onClick={()=>{setEditoresAbiertos(prev => prev.filter(e => e.id !== editor.id)); if(ventanaActiva === editor.id) setVentanaActiva('escritorio');}} style={{...xpWinControl, background:"#ff4444", color:"white"}}>X</button>
                            </div>
                        </div>
                        <div style={{padding:"5px", background: editor.modo === 'code' ? "#007acc" : "#f0f0f0", borderBottom:"1px solid #ccc", display:"flex", justifyContent:"flex-end"}}>
                            <button onClick={()=>guardarCambiosEditor(editor.id)} style={{...xpButton, background: editor.modo === 'code' ? "transparent" : "#faf6f4", color: editor.modo === 'code' ? "white" : "#C99597", border: editor.modo==='code'?"1px solid white":"1px outset #DDB2B5"}}>💾 GUARDAR</button>
                        </div>
                        
                        <div style={{flex:1, overflow:"hidden", position:"relative"}}>
                            {editor.modo === 'code' ? (
                                <Editor height="100%" defaultLanguage="javascript" language={detectingLenguaje(editor.file.name)} theme="vs-dark" value={editor.content} onChange={(value) => actualizarContenido(editor.id, value)} loading={<div style={{color:"white", padding:"20px"}}>Cargando editor...</div>} options={{ minimap: { enabled: true }, fontSize: 14, wordWrap: 'on', automaticLayout: true }} />
                            ) : (
                                <textarea value={editor.content} onChange={(e) => actualizarContenido(editor.id, e.target.value)} onKeyDown={(e) => handleTabKeyMultiple(e, editor.id)} style={{width:"100%", height:"100%", background: "#fff", color: "#000", border:"none", padding:"20px", fontFamily: "'Mali', cursive", fontSize:"14px", outline:"none", resize:"none", boxSizing:"border-box"}} spellCheck="false" />
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div style={xpBottomTaskbar}>
                <button onClick={()=>{setVentanaActiva('escritorio')}} style={{...xpTaskButton, background: (ventanaActiva === 'escritorio') ? '#E3C0C2' : '#FAF6F4', fontWeight: "bold", borderRight:"2px solid #A67577", width:"100px"}}>📁 INICIO</button>
                <div style={{display:"flex", gap:"5px", overflowX:"auto", flex:1, paddingLeft:"10px"}}>
                    {ventanasAbiertas.map(ventana => (<button key={ventana.id} onClick={()=>{setVentanaActiva(ventana.id)}} style={{...xpTaskButton, background: ventanaActiva === ventana.id ? '#E3C0C2' : '#FAF6F4', width: "150px"}} title={ventana.title}>📄 {ventana.title}</button>))}
                    {pdfsAbiertos.map(pdf => (
                        <button key={`btn-pdf-${pdf.id}`} onClick={()=>setVentanaActiva(pdf.id)} style={{...xpTaskButton, background: ventanaActiva===pdf.id ?'#E3C0C2':'#fff', width: "150px"}}>📄 PDF {pdf.file.name}</button>
                    ))}
                    {editoresAbiertos.map(editor => (
                        <button key={`btn-ed-${editor.id}`} onClick={()=>setVentanaActiva(editor.id)} style={{...xpTaskButton, background: ventanaActiva===editor.id ? (editor.modo==='code'?'#007acc':'#E3C0C2') : '#fff', color: (ventanaActiva===editor.id && editor.modo==='code')?'white':'black', border: "1px solid #000", width: "150px"}}>{editor.modo==='code'?'💻':'📝'} {editor.file.name}</button>
                    ))}
                </div>
            </div>
          </div>
        )}
      </div>
  );
}

// ESTILOS
const xpFullPage = { background: "#F1D8D9", height: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Mali', cursive", width: "100vw", position: "fixed", top:0, left:0 };
const xpTopBar = { background: "#C99597", color: "white", padding: "4px 15px", display: "flex", justifyContent: "space-between", fontSize:"13px" };
const xpBottomTaskbar = { height: "35px", background: "linear-gradient(to bottom, #DDB2B5 0%, #C99597 100%)", borderTop: "2px solid #F1D8D9", display: "flex", alignItems: "center", padding: "2px 5px" };
const xpTaskButton = { height: "26px", border: "1px solid #A67577", borderRadius: "3px 3px 0 0", cursor: "pointer", fontSize: "13px", textAlign: "left", padding: "0 8px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#444", fontFamily: "'Mali', cursive" };
const xpLoginWindow = { width: "350px", margin: "100px auto", background: "#FAF6F4", border: "3px solid #C99597", boxShadow: "5px 5px 0 rgba(0,0,0,0.1)" };
const xpWindowTitle = { background: "#C99597", color: "white", padding: "5px", fontWeight: "bold", fontSize: "13px" };
const xpLink = { cursor:"pointer", textDecoration:"underline" };
const xpSidebarSection = { background: "rgba(255,255,255,0.7)", borderRadius: "3px", border: "1px solid #C99597", overflow: "hidden", marginBottom:"10px" };
const xpSidebarHeader = { background: "#FAF6F4", padding: "4px 8px", fontWeight: "bold", color: "#C99597", fontSize: "13px", borderBottom: "1px solid #E0E0E0" };
const xpWidgetContent = { padding:"8px", fontSize:"13px", color:"#444" };
const xpInputSmall = { width: "100%", marginBottom: "3px", border: "1px solid #ccc", padding: "2px", fontSize: "12px", boxSizing: "border-box", fontFamily: "'Mali', cursive" };
const xpBtnSmall = { cursor: "pointer", background: "#fff", border: "1px solid #ccc", fontSize: "12px", padding: "2px 5px", fontFamily: "'Mali', cursive" };
const xpAddressInput = { flex:1, border:"1px solid #DDB2B5", background:"white", padding:"3px 6px", fontSize:"13px", fontFamily: "'Mali', cursive" };
const xpActionBar = { padding:"10px", background:"#F7E8E8", display:"flex", gap:"20px", alignItems: "center" };
const xpInput = { flex:1, border:"1px solid #C99597", padding:"4px", fontSize:"13px", fontFamily: "'Mali', cursive" };
const xpButton = { background: "#FAF6F4", border: "1px outset #DDB2B5", cursor: "pointer", fontSize:"13px", color:"#C99597", fontWeight:"bold", padding:"4px 12px", whiteSpace:"nowrap", fontFamily: "'Mali', cursive" };
const xpUpButton = { background: "#F0F0F0", border: "1px outset #ccc", cursor: "pointer", fontSize:"13px", padding:"2px 8px", fontFamily: "'Mali', cursive" };
const xpLoginButton = { background: "#EAEAEA", border: "2px outset white", cursor: "pointer", padding: "8px 20px", fontWeight:"bold", fontFamily: "'Mali', cursive" };
const xpSectionTitle = { fontSize:"14px", fontWeight:"bold", color:"#C99597", borderBottom:"1px solid #F1D8D9", marginBottom:"10px", paddingBottom:"2px" };
const xpFolderIcon = { width: "40px", height: "30px", background: "#DDB2B5", border: "1px solid #C99597", borderRadius: "2px", boxShadow:"2px 2px 0 rgba(0,0,0,0.1)", margin:"0 auto" };
const xpFileIcon = { width: "30px", height: "40px", background: "#FAF6F4", border: "1px solid #DDB2B5", position:"relative", boxShadow:"1px 1px 0 rgba(0,0,0,0.1)", margin:"0 auto" };
const xpFileCorner = { position:"absolute", top:0, right:0, width:0, height:0, borderTop:"10px solid #F1D8D9", borderLeft:"10px solid transparent" };
const xpIconContainer = { display:"flex", flexDirection:"column", alignItems:"center", width:"90px", padding:"5px", position:"relative" };
const xpIconName = { fontSize:"12px", marginTop:"5px", textAlign:"center", wordBreak:"break-all", lineHeight:"1.2" };
const xpStickyNote = { width: "120px", minHeight: "80px", background: "#FFF5E5", border: "1px solid #DDB2B5", padding: "8px", fontSize: "12px", position:"relative", boxShadow:"2px 2px 0 rgba(0,0,0,0.1)", fontFamily: "'Mali', cursive" };
const xpDeleteNote = { position:"absolute", top:0, right:"3px", color:"#C99597", cursor:"pointer", fontWeight:"bold" };
const xpWindowHeader = { background: "#C99597", color:"white", padding:"5px 10px", display:"flex", justifyContent:"space-between", alignItems:"center", fontWeight:"bold", fontSize:"13px", borderBottom:"2px solid #A67577" };
const xpWinControl = { width:"20px", height:"20px", border:"1px outset #fff", background:"#ddd", cursor:"pointer", fontSize:"10px", marginLeft:"2px", fontWeight:"bold" };
const xpDropdownMenu = { position: "absolute", top: "100%", left: 0, background: "white", border: "1px solid #A67577", boxShadow: "2px 2px 5px rgba(0,0,0,0.2)", zIndex: 100, minWidth: "150px" };
const xpDropdownItem = { padding: "8px 15px", fontSize: "13px", cursor: "pointer", borderBottom: "1px solid #eee", color: "#333" };
const xpTrashButton = { position:"absolute", top:0, right:0, background:"transparent", border:"none", cursor:"pointer", fontSize:"12px" };
const xpPomoBtn = { border:"none", background:"transparent", cursor:"pointer", color:"white", fontWeight:"bold" };

export default App;