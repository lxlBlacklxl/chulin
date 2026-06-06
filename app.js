// State Management
let currentScreen = 'main';
let selectedInventoryTitle = 'Mago';
let selectedEventDate = '';
let currentYear = 2026;
let currentMonth = 5; // June (0-indexed)

// Data Arrays
const commonInventoryItems = [
    "Alfombra", "Animales", "Aro", "Burbuja de fuego", "Caja de audio",
    "Caja de burbujas", "Caja de cables", "Caja de utilería", "Computadora",
    "Conejo", "Extensión verde", "Gasolina blanca", "Laterales",
    "Luces", "Rompe dedos", "Sombrero",
    "Sombrero Harry", "Tripies", "Tubo de varitas", "Venta"
];

const subMenuContent = {
    "Caja de utilería": ["Burbujas", "Fomi moldeable", "Slime", "Varita de Harry", "2 varitas rompibles", "Flor", "Drones", "Cuaderno para colorear", "Burbuja de cristal", "2 mascadas", "Capibaras y patitos", "Taza"],
    "Caja de burbujas": ["Boult", "Jarra", "Atomizador", "3 aros (ch, med, g)", "Trapos", "Burbuja continua", "Formula", "Guantes"],
    "Conejo": ["Tapas laterales", "Piso", "Tapa", "Y mesa redonda"],
    "Caja de cables": ["Conexión de para bocina (luz)", "Conexión de audio", "Escenario", "Extensión naranja", "Patas de laterales"],
    "Tripies": ["3 tripies para bocinas", "1 de luces", "Base de mesa"],
    "Computadora": ["Computadora", "Cargador", "Conector para el teléfono", "Mascada", "Cargador para paloma", "Burbuja humo", "Tarjetas", "Caja de micrófono"],
    "Tubo de varitas": ["Varita extendible normal", "Varita fuego"],
    "Animales": ["Confeti", "Desarmador", "Pulseras", "Bolsa de hielo"],
    "Magia pato": ["Erizo", "Mesa levitación", "Majicole", "Charola fuego", "Magia paloma", "Tapa de pato"],
    "Venta": ["Tubos de burbujas", "Squishi"]
};

// Initial warehouse (Bodega) items
const initialBodegaItems = [
    "Taza: Payaso", "Taza: Mago", "Slime", "Fomi", "Drones",
    "Cajas de burbujas", "Cajas de squishi", "Burbujas Ch"
];

// In-memory application data (syncs with localStorage)
let bodegaItems = [];
let bodegaCounts = {};
let scheduledEvents = [];

// Checklist states for Hora del Show
let showItems = [];
let checkedSimpleItems = {}; // { itemName: boolean }
let checkedSubmenuItems = {}; // { parentName: { childName: boolean } }
let activeSubmenuParent = '';
let selectedBodegaItemToAdd = '';

// Month Names in Spanish
const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// Firebase Configuration - REPLACE with your actual project keys
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

let db = null;
let isFirebaseActive = false;

// Check if configuration has been replaced by the user
if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY") {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        isFirebaseActive = true;
        console.log("Firebase Firestore inicializado.");
    } catch (e) {
        console.error("Error al inicializar Firebase:", e);
    }
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    loadData().then(() => {
        initShowInventory();
        buildAddRadioList();
        
        // Set Calendar to Current System Date
        const today = new Date();
        currentYear = today.getFullYear();
        currentMonth = today.getMonth();
        
        // Bind Back Button handler for physical key simulation / popstate
        window.addEventListener('popstate', handleHardwareBack);
        // Push initial state
        window.history.replaceState({ screen: 'main' }, 'Main', '');
    });
});

// Load data from Firestore or LocalStorage Fallback
async function loadData() {
    if (isFirebaseActive) {
        showToast("Conectando con base de datos...", "info");
        try {
            // 1. Load bodega items & counts
            const bodegaSnap = await db.collection('bodega').get();
            if (!bodegaSnap.empty) {
                bodegaItems = [];
                bodegaCounts = {};
                bodegaSnap.forEach(doc => {
                    const data = doc.data();
                    bodegaItems.push(data.name);
                    bodegaCounts[data.name] = data.count || 0;
                });
            } else {
                // Initialize database with defaults
                bodegaItems = [...initialBodegaItems];
                bodegaCounts = {};
                const batch = db.batch();
                bodegaItems.forEach(item => {
                    let count = 24;
                    if (item.startsWith("Taza")) {
                        count = 12;
                    } else if (item === "Slime" || item === "Fomi") {
                        count = 20;
                    } else if (item === "Drones") {
                        count = 5;
                    } else if (item.includes("Cajas")) {
                        count = 10;
                    }
                    bodegaCounts[item] = count;
                    const docRef = db.collection('bodega').doc(item);
                    batch.set(docRef, { name: item, count: count });
                });
                await batch.commit();
            }

            // 2. Load events
            const eventsSnap = await db.collection('events').get();
            scheduledEvents = [];
            eventsSnap.forEach(doc => {
                scheduledEvents.push(doc.data());
            });

            showToast("Base de datos sincronizada", "success");
        } catch (error) {
            console.error("Error cargando de Firestore, usando local:", error);
            showToast("Error de conexión. Usando almacenamiento local.", "error");
            loadLocalDataFallback();
        }
    } else {
        showToast("Ejecutando en Modo Local (Firebase no configurado)", "info");
        loadLocalDataFallback();
    }
}

function loadLocalDataFallback() {
    const savedItems = localStorage.getItem('bodega_items');
    if (savedItems) {
        bodegaItems = JSON.parse(savedItems);
    } else {
        bodegaItems = [...initialBodegaItems];
        localStorage.setItem('bodega_items', JSON.stringify(bodegaItems));
    }

    const savedCounts = localStorage.getItem('bodega_counts');
    if (savedCounts) {
        bodegaCounts = JSON.parse(savedCounts);
    } else {
        bodegaCounts = {};
        bodegaItems.forEach(item => {
            if (item.startsWith("Taza")) {
                bodegaCounts[item] = 12;
            } else if (item === "Slime" || item === "Fomi") {
                bodegaCounts[item] = 20;
            } else if (item === "Drones") {
                bodegaCounts[item] = 5;
            } else if (item.includes("Cajas")) {
                bodegaCounts[item] = 10;
            } else {
                bodegaCounts[item] = 24;
            }
        });
        localStorage.setItem('bodega_counts', JSON.stringify(bodegaCounts));
    }

    const savedEvents = localStorage.getItem('events');
    if (savedEvents) {
        scheduledEvents = JSON.parse(savedEvents);
    } else {
        scheduledEvents = [];
        localStorage.setItem('events', JSON.stringify(scheduledEvents));
    }
}

// Save Bodega Items and Counts
function saveBodegaData(item) {
    if (isFirebaseActive && item) {
        db.collection('bodega').doc(item).set({ name: item, count: bodegaCounts[item] })
            .catch(err => console.error("Error al guardar bodega en Firestore:", err));
    }
    localStorage.setItem('bodega_items', JSON.stringify(bodegaItems));
    localStorage.setItem('bodega_counts', JSON.stringify(bodegaCounts));
}

function saveNewBodegaItem(item) {
    if (isFirebaseActive && item) {
        db.collection('bodega').doc(item).set({ name: item, count: 0 })
            .catch(err => console.error("Error al crear artículo en Firestore:", err));
    }
    localStorage.setItem('bodega_items', JSON.stringify(bodegaItems));
    localStorage.setItem('bodega_counts', JSON.stringify(bodegaCounts));
}

function saveEvent(event) {
    if (isFirebaseActive && event) {
        db.collection('events').doc(String(event.id)).set(event)
            .catch(err => console.error("Error al guardar evento en Firestore:", err));
    }
    localStorage.setItem('events', JSON.stringify(scheduledEvents));
}

function removeEvent(eventId) {
    if (isFirebaseActive && eventId) {
        db.collection('events').doc(String(eventId)).delete()
            .catch(err => console.error("Error al eliminar evento en Firestore:", err));
    }
    localStorage.setItem('events', JSON.stringify(scheduledEvents));
}

// Screen Navigation
function navigateTo(screenId) {
    // Hide Ready message if navigating back to/from inventory
    document.getElementById('show-ready-message').classList.add('hidden');

    const activeScreen = document.querySelector('.screen.active-screen');
    if (activeScreen) {
        activeScreen.classList.remove('active-screen');
    }

    const nextScreen = document.getElementById(`screen-${screenId}`);
    if (nextScreen) {
        nextScreen.classList.add('active-screen');
        currentScreen = screenId;

        // Custom screen trigger logic
        if (screenId === 'bodega') {
            renderBodegaList();
            checkLowStock();
            buildAddRadioList();
        } else if (screenId === 'inventory') {
            resetShowInventory();
            renderShowInventory();
        } else if (screenId === 'calendar') {
            renderCalendar();
            hideSelectedDateBox();
        } else if (screenId === 'list') {
            renderEventsList();
        }
        
        // Handle history states for back action
        const state = { screen: screenId };
        if (window.history.state?.screen !== screenId) {
            window.history.pushState(state, '', '');
        }
    }
}

// Simulate physical Android Back Button
function handleHardwareBack(event) {
    if (!event.state) return;
    const targetScreen = event.state.screen;
    
    // Custom back paths from MainActivity.kt
    if (currentScreen === 'details') {
        navigateTo('calendar');
    } else if (currentScreen === 'list') {
        navigateTo('calendar');
    } else if (currentScreen === 'calendar') {
        navigateTo('main');
    } else if (currentScreen === 'inventory' || currentScreen === 'bodega') {
        navigateTo('main');
    } else if (targetScreen) {
        navigateTo(targetScreen);
    }
}

// TOAST NOTIFICATIONS
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'info';
    if (type === 'success') icon = 'check_circle';
    if (type === 'error') icon = 'error';

    toast.innerHTML = `
        <span class="material-icons">${icon}</span>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Auto remove
    setTimeout(() => {
        toast.classList.add('toast-exit');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 3000);
}

// SYSTEM MODALS UTILS
function openModal(modalId) {
    document.getElementById(modalId).classList.add('modal-active');
    
    // Reset specific forms
    if (modalId === 'new-item-modal') {
        document.getElementById('new-item-name').value = '';
    } else if (modalId === 'add-item-modal') {
        selectAddRadioItem(bodegaItems[0]);
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('modal-active');
}

// --- 2. HORA DEL SHOW (INVENTORY) LOGIC ---
function initShowInventory() {
    const specificItems = ["Magia pato", "Transportadora con paloma", "Conejo"];
    
    // Combine lists, unique elements, case-insensitive sort
    const uniqueItems = Array.from(new Set([...commonInventoryItems, ...specificItems]));
    showItems = uniqueItems.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

    // Reset checklists
    checkedSimpleItems = {};
    checkedSubmenuItems = {};

    showItems.forEach(item => {
        if (item in subMenuContent) {
            checkedSubmenuItems[item] = {};
            subMenuContent[item].forEach(sub => {
                checkedSubmenuItems[item][sub] = false;
            });
        } else {
            checkedSimpleItems[item] = false;
        }
    });
}

function resetShowInventory() {
    // Clear selections
    for (let key in checkedSimpleItems) {
        checkedSimpleItems[key] = false;
    }
    for (let parent in checkedSubmenuItems) {
        for (let child in checkedSubmenuItems[parent]) {
            checkedSubmenuItems[parent][child] = false;
        }
    }
    document.getElementById('btn-inventory-ready').disabled = true;
    document.getElementById('show-ready-message').classList.add('hidden');
}

function renderShowInventory() {
    const grid = document.getElementById('inventory-grid');
    grid.innerHTML = '';

    showItems.forEach(item => {
        const hasSubMenu = item in subMenuContent;
        let cardClass = 'inventory-card';
        let bgStyle = '';

        if (hasSubMenu) {
            // Count checked sub-items
            const subStates = checkedSubmenuItems[item];
            const children = Object.keys(subStates);
            const checkedCount = children.filter(c => subStates[c]).length;
            
            if (checkedCount === 0) {
                cardClass += ' empty';
            } else if (checkedCount === children.length) {
                cardClass += ' checked';
            } else {
                cardClass += ' partial';
            }
        } else {
            if (checkedSimpleItems[item]) {
                cardClass += ' checked';
            }
        }

        const card = document.createElement('div');
        card.className = cardClass;
        card.innerHTML = `<span class="inventory-card-title">${item}</span>`;
        card.onclick = () => handleInventoryCardClick(item);
        
        grid.appendChild(card);
    });

    validateInventoryReady();
}

function handleInventoryCardClick(item) {
    const hasSubMenu = item in subMenuContent;
    if (hasSubMenu) {
        openSubmenuModal(item);
    } else {
        checkedSimpleItems[item] = !checkedSimpleItems[item];
        renderShowInventory();
    }
}

function openSubmenuModal(parentItem) {
    activeSubmenuParent = parentItem;
    document.getElementById('submenu-modal-title').textContent = parentItem;
    
    renderSubmenuItems();
    openModal('submenu-modal');
}

function renderSubmenuItems() {
    const container = document.getElementById('submenu-items-list');
    container.innerHTML = '';

    const subItems = subMenuContent[activeSubmenuParent];
    const states = checkedSubmenuItems[activeSubmenuParent];

    subItems.forEach(sub => {
        const isChecked = states[sub];
        const row = document.createElement('div');
        row.className = `submenu-item-row ${isChecked ? 'checked' : ''}`;
        row.innerHTML = `• ${sub}`;
        row.onclick = () => {
            states[sub] = !states[sub];
            renderSubmenuItems();
            renderShowInventory();
        };
        container.appendChild(row);
    });
}

function promptSelectAllSubmenu() {
    openModal('confirm-select-all-modal');
}

function confirmSelectAllSubmenu() {
    const states = checkedSubmenuItems[activeSubmenuParent];
    for (let sub in states) {
        states[sub] = true;
    }
    closeModal('confirm-select-all-modal');
    renderSubmenuItems();
    renderShowInventory();
}

function closeSubmenuModal() {
    closeModal('submenu-modal');
    activeSubmenuParent = '';
}

function validateInventoryReady() {
    // Check all simple items
    const allSimpleChecked = Object.values(checkedSimpleItems).every(val => val === true);
    
    // Check all submenus
    let allSubmenusChecked = true;
    for (let parent in checkedSubmenuItems) {
        const states = checkedSubmenuItems[parent];
        const allSubChecked = Object.values(states).every(val => val === true);
        if (!allSubChecked) {
            allSubmenusChecked = false;
            break;
        }
    }

    const readyBtn = document.getElementById('btn-inventory-ready');
    readyBtn.disabled = !(allSimpleChecked && allSubmenusChecked);
}

function onInventoryReady() {
    const msg = document.getElementById('show-ready-message');
    msg.classList.remove('hidden');
    showToast('¡Inventario verificado con éxito!', 'success');
}


// --- 3. INVENTARIO BODEGA LOGIC ---
function renderBodegaList() {
    const list = document.getElementById('bodega-list');
    list.innerHTML = '';

    bodegaItems.forEach(item => {
        const count = bodegaCounts[item] || 0;
        
        let qtyText = '';
        if (item.startsWith("Taza")) {
            const boxes = Math.floor(count / 12);
            const remaining = count % 12;
            if (boxes > 0) {
                qtyText = `${boxes} caja${boxes > 1 ? 's' : ''} (${remaining} taza${remaining !== 1 ? 's' : ''})`;
            } else {
                qtyText = `${remaining} taza${remaining !== 1 ? 's' : ''}`;
            }
        } else {
            qtyText = `${count} unidad${count !== 1 ? 'es' : ''}`;
        }

        const isOutOfStock = count <= 0;
        const qtyClass = isOutOfStock ? 'qty-val out-of-stock' : 'qty-val in-stock';

        const row = document.createElement('div');
        row.className = 'table-row';
        row.innerHTML = `
            <span class="table-row-name">${item}</span>
            <div class="table-row-actions">
                <span class="${qtyClass}">${qtyText}</span>
                <button class="row-action-btn" onclick="decrementBodegaItem('${item}')" ${isOutOfStock ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''}>
                    <span class="material-icons">remove</span>
                </button>
            </div>
        `;
        list.appendChild(row);
    });
}

function decrementBodegaItem(item) {
    if (bodegaCounts[item] && bodegaCounts[item] > 0) {
        bodegaCounts[item]--;
        saveBodegaData(item);
        renderBodegaList();
    }
}

function checkLowStock() {
    const lowStock = bodegaItems.filter(item => (bodegaCounts[item] || 0) <= 10);
    if (lowStock.length > 0) {
        const listContainer = document.getElementById('low-stock-list');
        listContainer.innerHTML = '';
        
        lowStock.forEach(item => {
            const li = document.createElement('li');
            li.textContent = `${item}: ${bodegaCounts[item] || 0} unidades`;
            listContainer.appendChild(li);
        });
        
        openModal('low-stock-modal');
    }
}

function createNewBodegaItem() {
    const nameInput = document.getElementById('new-item-name');
    const name = nameInput.value.trim();

    if (name === '') {
        showToast('El nombre no puede estar vacío', 'error');
        return;
    }

    if (bodegaItems.includes(name)) {
        showToast('Este objeto ya existe en la bodega', 'error');
        return;
    }

    bodegaItems.push(name);
    bodegaCounts[name] = 0;
    
    saveNewBodegaItem(name);
    closeModal('new-item-modal');
    renderBodegaList();
    showToast(`Artículo "${name}" creado`, 'success');
}

function buildAddRadioList() {
    const container = document.getElementById('add-item-radio-list');
    container.innerHTML = '';

    bodegaItems.forEach((item, index) => {
        const label = document.createElement('label');
        label.className = 'radio-item';
        label.innerHTML = `
            <input type="radio" name="bodega-add-item" value="${item}" ${index === 0 ? 'checked' : ''} onchange="selectAddRadioItem('${item}')">
            <span>${item}</span>
        `;
        container.appendChild(label);
    });
}

function selectAddRadioItem(item) {
    selectedBodegaItemToAdd = item;
    const inputsContainer = document.getElementById('dynamic-add-inputs');
    inputsContainer.innerHTML = '';

    if (item.startsWith("Taza") || item.includes("Burbujas Ch")) {
        inputsContainer.innerHTML = `
            <div class="input-group">
                <label for="add-boxes">Número de cajas</label>
                <input type="number" id="add-boxes" min="0" value="0" placeholder="0">
            </div>
            <div class="input-group">
                <label for="add-units-per-box">Piezas por caja</label>
                <input type="number" id="add-units-per-box" min="1" value="12" placeholder="12">
            </div>
        `;
    } else if (item.includes("Cajas de burbujas") || item.includes("squishi")) {
        inputsContainer.innerHTML = `
            <div class="input-group">
                <label for="add-boxes">Número de cajas</label>
                <input type="number" id="add-boxes" min="0" value="0" placeholder="0">
            </div>
            <div class="input-group">
                <label for="add-units-per-box">Contenido de caja (piezas)</label>
                <input type="number" id="add-units-per-box" min="1" value="10" placeholder="10">
            </div>
        `;
    } else {
        inputsContainer.innerHTML = `
            <div class="input-group">
                <label for="add-simple-units">Unidades</label>
                <input type="number" id="add-simple-units" min="0" value="0" placeholder="0">
            </div>
        `;
    }
}

function saveAddBodegaItem() {
    let totalToAdd = 0;
    const item = selectedBodegaItemToAdd;

    if (item.startsWith("Taza") || item.includes("burbujas") || item.includes("squishi") || item.includes("Burbujas Ch")) {
        const boxesInput = document.getElementById('add-boxes');
        const unitsPerBoxInput = document.getElementById('add-units-per-box');
        
        const boxes = parseInt(boxesInput.value) || 0;
        const unitsPerBox = parseInt(unitsPerBoxInput.value) || 0;
        totalToAdd = boxes * unitsPerBox;
    } else {
        const simpleUnitsInput = document.getElementById('add-simple-units');
        totalToAdd = parseInt(simpleUnitsInput.value) || 0;
    }

    if (totalToAdd <= 0) {
        showToast('Ingrese una cantidad válida mayor que 0', 'error');
        return;
    }

    bodegaCounts[item] = (bodegaCounts[item] || 0) + totalToAdd;
    saveBodegaData(item);
    closeModal('add-item-modal');
    renderBodegaList();
    showToast(`Se agregaron ${totalToAdd} unidades a ${item}`, 'success');
}


// --- 4. CALENDARIO / DATEPICKER LOGIC ---
function changeMonth(direction) {
    currentMonth += direction;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    } else if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    renderCalendar();
}

function renderCalendar() {
    const monthYearTitle = document.getElementById('calendar-month-year');
    monthYearTitle.textContent = `${monthNames[currentMonth]} ${currentYear}`;

    const daysContainer = document.getElementById('calendar-days');
    daysContainer.innerHTML = '';

    // First day of the month
    const firstDay = new Date(currentYear, currentMonth, 1);
    // Day of week of first day (0 = Sunday, 1 = Monday...)
    const startDayOfWeek = firstDay.getDay();

    // Total days in current month
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Render empty spaces for previous month's overlapping days
    for (let i = 0; i < startDayOfWeek; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'datepicker-day empty-day';
        daysContainer.appendChild(emptyCell);
    }

    const today = new Date();

    // Render calendar days
    for (let day = 1; day <= totalDays; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'datepicker-day';
        dayCell.textContent = day;

        const dateStr = formatDateString(day, currentMonth, currentYear);

        // Highlight if today
        if (today.getDate() === day && today.getMonth() === currentMonth && today.getFullYear() === currentYear) {
            dayCell.classList.add('today');
        }

        // Highlight if selected
        if (selectedEventDate === dateStr) {
            dayCell.classList.add('selected');
        }

        // Event indicator dot under the day number
        const eventCount = scheduledEvents.filter(ev => ev.date === dateStr).length;
        if (eventCount > 0) {
            dayCell.classList.add('has-events-indicator');
        }

        dayCell.onclick = () => selectCalendarDate(day, currentMonth, currentYear);
        daysContainer.appendChild(dayCell);
    }
}

function formatDateString(day, month, year) {
    const d = day.toString().padStart(2, '0');
    const m = (month + 1).toString().padStart(2, '0');
    return `${d}/${m}/${year}`;
}

function selectCalendarDate(day, month, year) {
    selectedEventDate = formatDateString(day, month, year);
    
    // Highlight day cell
    const cells = document.querySelectorAll('.datepicker-day:not(.empty-day)');
    cells.forEach(cell => {
        if (parseInt(cell.textContent) === day) {
            cell.classList.add('selected');
        } else {
            cell.classList.remove('selected');
        }
    });

    renderCalendar(); // Redraw to update classes cleanly
    showSelectedDateBox();
}

function showSelectedDateBox() {
    const box = document.getElementById('selected-date-status-box');
    const dateValText = document.getElementById('status-selected-date');
    const descText = document.getElementById('status-selected-desc');
    const confirmBtn = document.getElementById('btn-schedule-on-date');

    dateValText.textContent = selectedEventDate;

    // Calculate details
    const [day, month, year] = selectedEventDate.split('/').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

    const eventCount = scheduledEvents.filter(ev => ev.date === selectedEventDate).length;

    box.classList.remove('hidden');

    let statusColor = '';
    let statusText = '';

    if (isWeekend) {
        if (eventCount === 0) {
            statusColor = 'state-available';
            statusText = 'Disponible';
            confirmBtn.style.backgroundColor = '#4CAF50';
            confirmBtn.style.color = '#FFFFFF';
        } else if (eventCount < 3) {
            statusColor = 'state-moderate';
            statusText = `Saturación media (${eventCount} evento${eventCount > 1 ? 's' : ''})`;
            confirmBtn.style.backgroundColor = '#FFD700';
            confirmBtn.style.color = '#000000';
        } else {
            statusColor = 'state-busy';
            statusText = `Día ocupado (${eventCount} evento${eventCount > 1 ? 's' : ''})`;
            confirmBtn.style.backgroundColor = '#FF5252';
            confirmBtn.style.color = '#FFFFFF';
        }
        
        dateValText.className = `status-date-val ${statusColor}`;
        descText.textContent = statusText;
        descText.className = `status-desc-val ${statusColor}`;
        descText.classList.remove('hidden');
    } else {
        // Weekday status (Cyan)
        statusColor = 'state-weekday';
        confirmBtn.style.backgroundColor = '#00E5FF';
        confirmBtn.style.color = '#000000';

        dateValText.className = `status-date-val ${statusColor}`;
        descText.classList.add('hidden');
    }
}

function hideSelectedDateBox() {
    document.getElementById('selected-date-status-box').classList.add('hidden');
    selectedEventDate = '';
}

function proceedToEventDetails() {
    navigateTo('details');
    
    // Set pre-filled header date
    document.getElementById('details-event-date').textContent = `Fecha: ${selectedEventDate}`;
    
    // Clear details inputs
    document.getElementById('input-event-name').value = '';
    document.getElementById('input-event-time').value = '';
    document.getElementById('input-event-location').value = '';
    document.getElementById('input-event-reminder').checked = false;
    
    validateDetailsForm();
}


// --- 5. DETALLES DEL EVENTO LOGIC ---
function validateDetailsForm() {
    const name = document.getElementById('input-event-name').value.trim();
    const time = document.getElementById('input-event-time').value.trim();
    const location = document.getElementById('input-event-location').value.trim();
    
    const saveBtn = document.getElementById('btn-save-event');
    saveBtn.disabled = !(name !== '' && time !== '' && location !== '');
}

function handleSaveEvent() {
    const eventCount = scheduledEvents.filter(ev => ev.date === selectedEventDate).length;
    if (eventCount >= 3) {
        openModal('event-saturation-modal');
    } else {
        confirmSaveEvent();
    }
}

function confirmSaveEvent() {
    closeModal('event-saturation-modal');
    
    const name = document.getElementById('input-event-name').value.trim();
    const time = document.getElementById('input-event-time').value.trim();
    const location = document.getElementById('input-event-location').value.trim();
    const hasReminder = document.getElementById('input-event-reminder').checked;

    const newEvent = {
        id: Date.now(),
        date: selectedEventDate,
        name: name,
        time: time,
        location: location
    };

    scheduledEvents.push(newEvent);
    saveEvent(newEvent);

    if (hasReminder) {
        showToast(`Recordatorio programado para: ${name}`, 'info');
    } else {
        showToast(`Evento "${name}" guardado`, 'success');
    }

    navigateTo('list');
}


// --- 6. LISTA DE EVENTOS LOGIC ---
function renderEventsList() {
    const container = document.getElementById('events-list-container');
    container.innerHTML = '';

    if (scheduledEvents.length === 0) {
        container.innerHTML = '<div class="no-events">No hay eventos agendados</div>';
        return;
    }

    // Sort by date (optional, let's keep insertion order or simple sort)
    const sortedEvents = [...scheduledEvents].sort((a, b) => {
        const parseDate = (dStr) => {
            const [d, m, y] = dStr.split('/').map(Number);
            return new Date(y, m - 1, d);
        };
        return parseDate(a.date) - parseDate(b.date);
    });

    sortedEvents.forEach(event => {
        const card = document.createElement('div');
        card.className = 'event-card';
        card.innerHTML = `
            <div class="event-details-col">
                <span class="event-title">${event.name}</span>
                <span class="event-meta">Fecha: ${event.date}</span>
                <span class="event-meta">Hora: ${event.time}</span>
                <span class="event-meta">Lugar: ${event.location}</span>
            </div>
            <button class="row-action-btn btn-delete-event" onclick="deleteEvent(${event.id})">
                <span class="material-icons">delete</span>
            </button>
        `;
        container.appendChild(card);
    });
}

function deleteEvent(eventId) {
    scheduledEvents = scheduledEvents.filter(ev => ev.id !== eventId);
    removeEvent(eventId);
    renderEventsList();
    showToast('Evento eliminado', 'info');
}
