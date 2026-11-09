// ============================================================
// API.JS - Capa de conexión con Google Sheets
// ============================================================

// ⚠️ IMPORTANTE: Reemplaza esta URL con la que te dio Google Apps Script
// después de desplegar la aplicación web.
const API_URL = 'https://script.google.com/macros/s/AKfycby2l-J5soheP4RXRrSwuP0ymBOR_0ZQa61aUndXcshu4q8xrT-kGU6aYCAp9UXOiHeA/exec';

// Variable global donde se almacenarán los datos (similar a "db" en el HTML)
let db = {};

// ------------------------------------------------------------
// 1. Cargar todos los datos desde Google Sheets
// ------------------------------------------------------------
async function loadData() {
  try {
    const response = await fetch(`${API_URL}?action=getAll`, {
      method: 'GET',
      mode: 'cors'
    });
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Mapear los datos a la estructura que espera la aplicación
    db = {
      operators: data.operators || [],
      queue: data.queue || [],
      playlist: data.playlist || [],
      services: data.services || [],
      rss: data.rss || [],
      clients: data.clients || [],
      opHistory: data.opHistory || [],
      pushMessage: data.pushMessage || { text: '', color: 'red' },
      config: {
        primaryColor: data.config?.primaryColor || '#0056b3',
        showVideo: data.config?.showVideo !== undefined ? data.config.showVideo : true
      },
      // Los mensajes push se guardan en "config" como JSON
      // pero los exponemos como objeto
    };
    
    // Si no hay datos iniciales, crear unos por defecto (opcional)
    if (db.operators.length === 0) {
      db.operators = [{ name: 'Admin', pin: '1234', box: 'Box 1' }];
    }
    if (db.services.length === 0) {
      db.services = [
        { name: 'Medicina General', emoji: '🩺' },
        { name: 'Odontología', emoji: '🦷' },
        { name: 'Asesoría Comercial', emoji: '💼' }
      ];
    }
    
    console.log('✅ Datos cargados desde Google Sheets:', db);
    return db;
  } catch (error) {
    console.error('❌ Error al cargar datos:', error);
    // Fallback: cargar desde localStorage si el servidor falla
    console.warn('Usando datos locales como respaldo.');
    return loadFromLocalStorageFallback();
  }
}

// ------------------------------------------------------------
// 2. Guardar todos los datos en Google Sheets
// ------------------------------------------------------------
async function saveData() {
  try {
    // Preparar el payload (similar a la estructura de la hoja)
    const payload = {
      action: 'saveAll',
      payload: {
        operators: db.operators,
        queue: db.queue,
        playlist: db.playlist,
        services: db.services,
        rss: db.rss,
        clients: db.clients,
        opHistory: db.opHistory,
        config: {
          primaryColor: db.config?.primaryColor || '#0056b3',
          showVideo: db.config?.showVideo !== undefined ? db.config.showVideo : true,
          pushMessage: JSON.stringify(db.pushMessage || { text: '', color: 'red' })
        }
      }
    };
    
    const response = await fetch(API_URL, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('✅ Datos guardados en Google Sheets:', result);
    return result;
  } catch (error) {
    console.error('❌ Error al guardar datos:', error);
    // Respaldo: guardar en localStorage
    saveToLocalStorageFallback();
    throw error;
  }
}

// ------------------------------------------------------------
// 3. Funciones de respaldo (por si falla la conexión)
// ------------------------------------------------------------
function loadFromLocalStorageFallback() {
  console.warn('Cargando desde localStorage como respaldo.');
  return {
    operators: JSON.parse(localStorage.getItem('operators') || '[]'),
    queue: JSON.parse(localStorage.getItem('queue') || '[]'),
    playlist: JSON.parse(localStorage.getItem('playlist') || '[]'),
    services: JSON.parse(localStorage.getItem('services') || '[]'),
    rss: JSON.parse(localStorage.getItem('rss') || '[]'),
    clients: JSON.parse(localStorage.getItem('clients') || '[]'),
    opHistory: JSON.parse(localStorage.getItem('opHistory') || '[]'),
    pushMessage: JSON.parse(localStorage.getItem('pushMessage') || '{"text":"","color":"red"}'),
    config: JSON.parse(localStorage.getItem('config') || '{"primaryColor":"#0056b3","showVideo":true}')
  };
}

function saveToLocalStorageFallback() {
  console.warn('Guardando en localStorage como respaldo.');
  localStorage.setItem('operators', JSON.stringify(db.operators));
  localStorage.setItem('queue', JSON.stringify(db.queue));
  localStorage.setItem('playlist', JSON.stringify(db.playlist));
  localStorage.setItem('services', JSON.stringify(db.services));
  localStorage.setItem('rss', JSON.stringify(db.rss));
  localStorage.setItem('clients', JSON.stringify(db.clients));
  localStorage.setItem('opHistory', JSON.stringify(db.opHistory));
  localStorage.setItem('pushMessage', JSON.stringify(db.pushMessage));
  localStorage.setItem('config', JSON.stringify(db.config));
}
