// Telefonbuch (Phonebook) Module
let contacts = [];
let contactsPage = 1;
const CONTACTS_PER_PAGE = 8; // number of non-favorite contacts per page
let draggingElement = null;
let dragStartIndex = null;
let selectedColor = '';

// State management for tab switching
let phoneBookState = {
  currentContacts: [],
  departmentFilters: [],
  searchQuery: '',
  sortDirection: 'asc'
};

document.addEventListener('DOMContentLoaded', function() {
  // Initialize phonebook when tab is clicked
  const tabs = document.querySelectorAll('#tabs button');
  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      if (this.dataset.module === 'telefonbuch') {
        initPhoneBook();
      }
    });
  });

  // If telefonbuch is the active tab on load, initialize it
  if (document.querySelector('#tabs button.active')?.dataset.module === 'telefonbuch') {
    initPhoneBook();
  }
});

function initPhoneBook() {
  // Load contacts from server
  loadContacts()
    .finally(() => {
      if (document.querySelector('.phonebook-calendar-right-new')) {
        initCalendar();
      }
    });

  // Set up the Add Contact button
  const addContactBtn = document.getElementById('add-contact-btn');
  if (addContactBtn) {
    addContactBtn.addEventListener('click', showAddContactModal);
  }

  // Set up Import button
  const importContactsBtn = document.getElementById('import-contacts-btn');
  if (importContactsBtn) {
    importContactsBtn.addEventListener('click', () => {
      showAddContactModal('file');
    });
  }

  // Set up search functionality
  // Prefer `phonebook-search` input moved under favorites; fallback to legacy `search-input` or `contact-search`
  const searchInput = document.getElementById('phonebook-search') || document.getElementById('search-input') || document.getElementById('contact-search');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      phoneBookState.searchQuery = this.value.toLowerCase();
      filterContacts();
    });
    
    // Restore previous search if it exists
    if (phoneBookState.searchQuery) {
      searchInput.value = phoneBookState.searchQuery;
    }
  }

  // Set up department filter
  const departmentFilter = document.getElementById('department-filter');
  if (departmentFilter) {
    departmentFilter.addEventListener('change', filterContacts);
  }

  // Set up sort toggle
  const sortToggle = document.getElementById('sort-toggle');
  if (sortToggle) {
    sortToggle.addEventListener('click', toggleSortDirection);
  }

  // Color picker functionality
  const colorOptions = document.querySelectorAll('.color-option');
  colorOptions.forEach(option => {
    option.addEventListener('click', function() {
      selectColor(this);
    });
  });

  // Clipboard processing
  const clipboardContent = document.getElementById('clipboard-content');
  if (clipboardContent) {
    clipboardContent.addEventListener('paste', function() {
      // Small delay to ensure content is pasted
      setTimeout(() => analyzeClipboardContent(), 100);
    });
  }

  const detectFormatBtn = document.getElementById('detect-format-btn');
  if (detectFormatBtn) {
    detectFormatBtn.addEventListener('click', analyzeClipboardContent);
  }

  const showManualMappingBtn = document.getElementById('show-manual-mapping-btn');
  if (showManualMappingBtn) {
    showManualMappingBtn.addEventListener('click', showManualMapping);
  }

  const processClipboardBtn = document.getElementById('process-clipboard-btn');
  if (processClipboardBtn) {
    processClipboardBtn.addEventListener('click', processClipboardContacts);
  }

  // File upload handling
  const fileInput = document.getElementById('contact-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', handleFileUpload);
  }

      // Kalender initialisieren
      if (document.querySelector('.phonebook-calendar-right')) {
        initCalendar();
      }
  // Entfernt: processFileBtn, da nicht definiert und nicht verwendet

  // Drag and drop for file upload
  const fileUploadArea = document.querySelector('.file-upload-area');
  if (fileUploadArea) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      fileUploadArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
      fileUploadArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      fileUploadArea.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
      fileUploadArea.classList.add('highlight');
    }

    function unhighlight() {
      fileUploadArea.classList.remove('highlight');
    }

    fileUploadArea.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
      const dt = e.dataTransfer;
      const files = dt.files;
      fileInput.files = files;
      handleFileUpload();
    }
  }
}

// Show add contact modal and switch to specific tab if requested
function showAddContactModal(tab = 'manual') {
  // Create modal element if it doesn't exist in DOM
  let modal = document.getElementById('add-contact-modal');
  if (!modal) {
    console.error('Modal template not found');
    return;
  }
  
  // Show the modal
  modal.style.display = 'flex';
  modal.classList.add('modal');
  modal.classList.remove('modal-template');
  
  // Switch to the requested tab
  switchInputTab(tab);
  
  // Focus on the first input field
  setTimeout(() => {
    if (tab === 'manual') {
      document.getElementById('contact-first-name')?.focus();
    } else if (tab === 'clipboard') {
      document.getElementById('clipboard-content')?.focus();
    }
  }, 100);
}

// Compatibility helper used by some HTML buttons
function openAddModal() {
  showAddContactModal();
}

// Close the modal
function closeModal() {
  const modal = document.querySelector('.modal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('modal');
    modal.classList.add('modal-template');
    
    // Reset forms and previews
    document.getElementById('manual-contact-form')?.reset();
    
    if (document.getElementById('clipboard-content')) {
      document.getElementById('clipboard-content').value = '';
    }
    
    if (document.getElementById('parsed-preview')) {
      document.getElementById('parsed-preview').innerHTML = '';
    }
    
    if (document.getElementById('file-upload-preview')) {
      document.getElementById('file-upload-preview').innerHTML = '';
    }
    
    if (document.getElementById('file-parsed-preview')) {
      document.getElementById('file-parsed-preview').innerHTML = '';
    }
    
    // Unselect color
    const selectedColor = document.querySelector('.color-option.selected');
    if (selectedColor) {
      selectedColor.classList.remove('selected');
    }
    
    if (document.getElementById('contact-color')) {
      document.getElementById('contact-color').value = '';
    }
  }
}

// Switch between tabs in the add contact modal
function switchInputTab(tabId) {
  // Update tab buttons
  const tabs = document.querySelectorAll('.input-tab');
  tabs.forEach(tab => {
    if (tab.dataset.tab === tabId) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  // Update content sections
  const contents = document.querySelectorAll('.input-method-content');
  contents.forEach(content => {
    if (content.id === tabId + '-input') {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });
}

// Load contacts from the server
async function loadContacts() {
  try {
    const response = await fetch('/api/telefonbuch');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    contacts = await response.json();
    window.contacts = contacts; // Für Kalenderintegration
    // Kalenderdaten abrufen
    fetch('/api/telefonbuch/termine').then(r => r.json()).then(termine => {
        window.kalenderTermine = termine;
    });
    phoneBookState.currentContacts = [...contacts]; // Save to state
    
    // Update department filter options
    updateDepartmentFilter();
    
  // ...existing code...
    displayContacts(contacts);
    
    // Set up drag and drop for contact items
    setupDragAndDrop();
    
  } catch (error) {
    console.error('Error loading contacts:', error);
    showNotification('Fehler beim Laden der Kontakte', 'error');
  }
}

// Update department filter dropdown with unique departments
function updateDepartmentFilter() {
  const departmentFilter = document.getElementById('department-filter');
  if (!departmentFilter) return;
  
  // Get unique departments
  const departments = [...new Set(contacts.map(contact => contact.department).filter(Boolean))];
  phoneBookState.departmentFilters = departments; // Save to state
  
  // Clear existing options except the first one
  while (departmentFilter.options.length > 1) {
    departmentFilter.options.remove(1);
  }
  
  // Add department options
  departments.forEach(department => {
    const option = document.createElement('option');
    option.value = department;
    option.textContent = department;
    departmentFilter.appendChild(option);
  });
}

// Display contacts in the list
function displayContacts(contactsToShow) {
  const contactsList = document.getElementById('contacts-list');
  if (!contactsList) return;
  
  if (contactsToShow.length === 0) {
    contactsList.innerHTML = `
      <li class="empty-state">
        <i class="fas fa-address-book fa-3x"></i>
        <h3>Keine Kontakte vorhanden</h3>
        <p>Fügen Sie Kontakte hinzu, um sie hier zu sehen.</p>
      </li>
    `;
    return;
  }
  // Separate favorites (max 10) and paginated others
  const favorites = contactsToShow.filter(c => c.favorite).slice(0, 10);
  const others = contactsToShow.filter(c => !c.favorite);

  // Calculate pagination for others
  const totalPages = Math.max(1, Math.ceil(others.length / CONTACTS_PER_PAGE));
  if (contactsPage > totalPages) contactsPage = totalPages;
  const startIdx = (contactsPage - 1) * CONTACTS_PER_PAGE;
  const pageItems = others.slice(startIdx, startIdx + CONTACTS_PER_PAGE);

  // Render favorites strip
  const favContainer = document.getElementById('favorites-list');
  if (favContainer) {
    if (favorites.length === 0) {
      favContainer.innerHTML = '';
    } else {
      favContainer.innerHTML = favorites.map(f => `
        <div class="favorite-contact" title="${(f.first_name||'') + ' ' + (f.last_name||'')}">
          <div class="fav-initial">${((f.first_name||'')[0]||'')}${((f.last_name||'')[0]||'')}</div>
          <div class="name">${(f.first_name? f.first_name + ' ':'') + (f.last_name||'')}</div>
        </div>
      `).join('');
    }
  }

  contactsList.innerHTML = pageItems.map((contact, idx) => {
    // find absolute index in full contacts array
    const absIndex = contacts.findIndex(c => c === contact);
    const index = absIndex >= 0 ? absIndex : idx;
    return `
    <li class="contact-item" draggable="true" data-index="${index}">
      <div class="contact-color-marker" style="background-color: ${contact.color || 'transparent'}"></div>
      <div class="contact-info">
        <div class="contact-name">${contact.first_name ? contact.first_name + ' ' : ''}${contact.last_name || ''}</div>
        
        <div class="contact-phone">
          <i class="fas fa-phone"></i>
          <span>${contact.phone || ''}</span>
        </div>
        
        ${contact.mobile ? `
        <div class="contact-phone">
          <i class="fas fa-mobile-alt"></i>
          <span>${contact.mobile}</span>
        </div>
        ` : ''}
        
        ${contact.email ? `
        <div class="contact-email">
          <i class="fas fa-envelope"></i>
          <span>${contact.email}</span>
        </div>
        ` : ''}
        
        ${contact.department ? `
        <div class="contact-department">
          <i class="fas fa-users"></i>
          <span>${contact.department}</span>
        </div>
        ` : ''}
      </div>
      <div class="contact-actions">
        <button class="btn-icon" onclick="editContact(${index})" title="Bearbeiten">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn-icon" onclick="deleteContact(${index})" title="Löschen">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </li>
  `}).join('');

  // After inserting, make items draggable for external drop (calendar)
  const insertedItems = contactsList.querySelectorAll('.contact-item');
  insertedItems.forEach(item => {
    item.setAttribute('draggable', 'true');
    item.addEventListener('dragstart', function(e) {
      const idx = parseInt(this.getAttribute('data-index'));
      const contact = contacts[idx] || {};
      try {
        const payload = JSON.stringify(contact);
        e.dataTransfer.setData('application/json', payload);
        e.dataTransfer.effectAllowed = 'copy';
      } catch (err) { console.error('Error serializing contact for drag', err); }
    });
  });

  // Render pagination controls
  renderContactsPagination(totalPages, contactsPage);
  
  // Setup drag and drop after populating list
  setupDragAndDrop();
}

function renderContactsPagination(totalPages, currentPage) {
  const p = document.getElementById('contacts-pagination');
  if (!p) return;
  // If only one page and no favorites, hide pagination
  if (totalPages <= 1) {
    p.innerHTML = '';
    return;
  }

  const prevDisabled = currentPage <= 1 ? 'disabled' : '';
  const nextDisabled = currentPage >= totalPages ? 'disabled' : '';

  p.innerHTML = `
    <div class="pagination-info">Seite ${currentPage} / ${totalPages}</div>
    <div class="pagination-btn ${prevDisabled}" id="contacts-prev">&#9664;</div>
    <div style="width:8px;"></div>
    <div class="pagination-btn ${nextDisabled}" id="contacts-next">&#9654;</div>
  `;

  const prev = document.getElementById('contacts-prev');
  const next = document.getElementById('contacts-next');
  if (prev && !prevDisabled) prev.onclick = () => { contactsPage = Math.max(1, contactsPage - 1); displayContacts(phoneBookState.currentContacts); };
  if (next && !nextDisabled) next.onclick = () => { contactsPage = Math.min(totalPages, contactsPage + 1); displayContacts(phoneBookState.currentContacts); };
}

// Filter contacts based on search and department filter
function filterContacts() {
  const searchQuery = phoneBookState.searchQuery || '';
  const departmentFilter = document.getElementById('department-filter');
  const selectedDepartment = departmentFilter ? departmentFilter.value : '';
  
  let filteredContacts = contacts;
  
  // Apply search filter
  if (searchQuery) {
    filteredContacts = filteredContacts.filter(contact => {
      const fullName = `${contact.first_name || ''} ${contact.last_name || ''}`.toLowerCase();
      const phone = contact.phone || '';
      const email = contact.email || '';
      const department = contact.department || '';
      
      return fullName.includes(searchQuery) || 
             phone.includes(searchQuery) || 
             email.includes(searchQuery) ||
             department.toLowerCase().includes(searchQuery);
    });
  }
  
  // Apply department filter
  if (selectedDepartment) {
    filteredContacts = filteredContacts.filter(contact => 
      contact.department === selectedDepartment
    );
  }
  
  // Apply sorting
  filteredContacts = sortContacts(filteredContacts);
  
  // Display filtered contacts
  displayContacts(filteredContacts);
}

// Sort contacts by last name
function sortContacts(contactsToSort) {
  return [...contactsToSort].sort((a, b) => {
    const nameA = `${a.last_name || ''}, ${a.first_name || ''}`.toLowerCase();
    const nameB = `${b.last_name || ''}, ${b.first_name || ''}`.toLowerCase();
    
    if (phoneBookState.sortDirection === 'asc') {
      return nameA.localeCompare(nameB);
    } else {
      return nameB.localeCompare(nameA);
    }
  });
}

// Toggle sort direction
function toggleSortDirection() {
  const sortButton = document.getElementById('sort-toggle');
  
  if (phoneBookState.sortDirection === 'asc') {
    phoneBookState.sortDirection = 'desc';
    sortButton.innerHTML = '<i class="fas fa-sort-alpha-up"></i>';
  } else {
    phoneBookState.sortDirection = 'asc';
    sortButton.innerHTML = '<i class="fas fa-sort-alpha-down"></i>';
  }
  
  filterContacts();
}

// Set up drag and drop functionality for reordering contacts
function setupDragAndDrop() {
  const contactItems = document.querySelectorAll('.contact-item');
  
  contactItems.forEach(item => {
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('dragleave', handleDragLeave);
    item.addEventListener('drop', handleDrop);
    item.addEventListener('dragend', handleDragEnd);
  });
}

function handleDragStart(e) {
  this.classList.add('dragging');
  draggingElement = this;
  dragStartIndex = parseInt(this.getAttribute('data-index'));
  
  // Required for Firefox
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragOver(e) {
  e.preventDefault();
  this.classList.add('drag-over');
  e.dataTransfer.dropEffect = 'move';
}

function handleDragLeave() {
  this.classList.remove('drag-over');
}

function handleDrop(e) {
  e.stopPropagation();
  e.preventDefault();
  
  if (draggingElement !== this) {
    const dragEndIndex = parseInt(this.getAttribute('data-index'));
    
    // Reorder contacts array
    const movedContact = contacts[dragStartIndex];
    
    // Remove from original position
    contacts.splice(dragStartIndex, 1);
    
    // Add at new position
    contacts.splice(dragEndIndex, 0, movedContact);
    
    // Save the reordered contacts
    saveContacts();
    
    // Display updated contacts
    displayContacts(contacts);
  }
  
  this.classList.remove('drag-over');
  return false;
}

function handleDragEnd() {
  this.classList.remove('dragging');
  
  const contactItems = document.querySelectorAll('.contact-item');
  contactItems.forEach(item => {
    item.classList.remove('drag-over');
  });
}

// Enable dragging from the visual contact cards (static and dynamic)
function enableExternalDragForContactCards() {
  const cards = document.querySelectorAll('.contact-card, .contact-item');
  cards.forEach(card => {
    // If already set, skip
    if (card.getAttribute('data-external-drag') === '1') return;
    card.setAttribute('draggable', 'true');
    card.setAttribute('data-external-drag', '1');
    card.addEventListener('dragstart', function(e) {
      // Try to find contact id on static card or index on runtime item
      const contactId = this.dataset.id || null;
      let contact = {};
      if (contactId && window.contacts) {
        contact = window.contacts.find(c => (c.id || '').toString() === contactId.toString()) || {};
      } else if (this.classList.contains('contact-item')) {
        const idx = parseInt(this.getAttribute('data-index'));
        contact = contacts[idx] || {};
      }
      try {
        e.dataTransfer.setData('application/json', JSON.stringify(contact));
        e.dataTransfer.effectAllowed = 'copy';
      } catch (err) {
        console.error('Error setting drag data', err);
      }
    });
  });
}

// Add contact manually
function addManualContact() {
  const firstName = document.getElementById('contact-first-name').value.trim();
  const lastName = document.getElementById('contact-last-name').value.trim();
  const phone = document.getElementById('contact-phone').value.trim();
  const mobile = document.getElementById('contact-mobile').value.trim();
  const email = document.getElementById('contact-email').value.trim();
  const department = document.getElementById('contact-department').value.trim();
  const address = document.getElementById('contact-address').value.trim();
  const notes = document.getElementById('contact-notes').value.trim();
  const color = document.getElementById('contact-color').value;
  
  if (!lastName || !phone) {
    showNotification('Nachname und Telefon sind erforderlich', 'warning');
    return;
  }
  
  const newContact = {
    first_name: firstName,
    last_name: lastName,
    phone: phone,
    mobile: mobile,
    email: email,
    department: department,
    address: address,
    notes: notes,
    color: color,
    added_date: new Date().toISOString()
  };
  
  // Add to contacts array
  contacts.push(newContact);
  
  // Save contacts
  saveContacts();
  
  // Close modal
  closeModal();
  
  // Show notification
  showNotification('Kontakt erfolgreich hinzugefügt', 'success');
}

// Select color in color picker
function selectColor(colorOption) {
  // Remove selection from previous color
  const prevSelected = document.querySelector('.color-option.selected');
  if (prevSelected) {
    prevSelected.classList.remove('selected');
  }
  
  // Add selection to clicked color
  colorOption.classList.add('selected');
  
  // Store color value
  const colorValue = colorOption.dataset.color;
  document.getElementById('contact-color').value = colorValue;
}

// Save contacts to server
async function saveContacts() {
  try {
    const response = await fetch('/api/telefonbuch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contacts)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Update state
    phoneBookState.currentContacts = [...contacts];
    
    // Update department filter
    updateDepartmentFilter();
    
    // Refresh displayed contacts
    filterContacts();
    
  } catch (error) {
    console.error('Error saving contacts:', error);
    showNotification('Fehler beim Speichern der Kontakte', 'error');
  }
}

// Edit contact
function editContact(index) {
  const contact = contacts[index];
  
  // Show add contact modal
  showAddContactModal();
  
  // Fill form with contact data
  document.getElementById('contact-first-name').value = contact.first_name || '';
  document.getElementById('contact-last-name').value = contact.last_name || '';
  document.getElementById('contact-phone').value = contact.phone || '';
  document.getElementById('contact-mobile').value = contact.mobile || '';
  document.getElementById('contact-email').value = contact.email || '';
  document.getElementById('contact-department').value = contact.department || '';
  document.getElementById('contact-address').value = contact.address || '';
  document.getElementById('contact-notes').value = contact.notes || '';
  
  // Set color
  if (contact.color) {
    document.getElementById('contact-color').value = contact.color;
    const colorOption = document.querySelector(`.color-option[data-color="${contact.color}"]`);
    if (colorOption) {
      selectColor(colorOption);
    }
  }
  
  // Change button text
  const submitButton = document.querySelector('#manual-contact-form button[type="submit"]');
  if (submitButton) {
    submitButton.textContent = 'Aktualisieren';
  }
  
  // Update form submission handler to update instead of add
  const form = document.getElementById('manual-contact-form');
  const originalSubmitHandler = form.onsubmit;
  
  form.onsubmit = function(e) {
    e.preventDefault();
    
    // Update contact with form values
    contact.first_name = document.getElementById('contact-first-name').value.trim();
    contact.last_name = document.getElementById('contact-last-name').value.trim();
    contact.phone = document.getElementById('contact-phone').value.trim();
    contact.mobile = document.getElementById('contact-mobile').value.trim();
    contact.email = document.getElementById('contact-email').value.trim();
    contact.department = document.getElementById('contact-department').value.trim();
    contact.address = document.getElementById('contact-address').value.trim();
    contact.notes = document.getElementById('contact-notes').value.trim();
    contact.color = document.getElementById('contact-color').value;
    contact.updated_date = new Date().toISOString();
    
    // Save contacts
    saveContacts();
    
    // Close modal
    closeModal();
    
    // Show notification
    showNotification('Kontakt erfolgreich aktualisiert', 'success');
    
    // Restore original submit handler
    form.onsubmit = originalSubmitHandler;
  };
}

// Delete contact
function deleteContact(index) {
  if (confirm('Möchten Sie diesen Kontakt wirklich löschen?')) {
    contacts.splice(index, 1);
    saveContacts();
    showNotification('Kontakt erfolgreich gelöscht', 'success');
  }
}

// Analyze clipboard content for contact data
function analyzeClipboardContent() {
  const clipboardText = document.getElementById('clipboard-content').value.trim();
  if (!clipboardText) {
    showNotification('Bitte fügen Sie zuerst Daten ein', 'warning');
    return;
  }
  
  // Try to detect structure (CSV, tab-delimited, etc.)
  const lines = clipboardText.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return;
  
  // Check for common delimiters
  let delimiter = '\t'; // Default to tab
  const possibleDelimiters = [',', ';', '\t', '|'];
  const delimiterCounts = {};
  
  possibleDelimiters.forEach(d => {
    delimiterCounts[d] = lines[0].split(d).length - 1;
  });
  
  // Find the delimiter with most occurrences
  delimiter = possibleDelimiters.reduce((a, b) => 
    delimiterCounts[a] > delimiterCounts[b] ? a : b
  );
  
  // Parse lines with the detected delimiter
  const parsedData = lines.map(line => line.split(delimiter));
  
  // Try to identify columns by header or content
  let headerRow = null;
  let dataStartIndex = 0;
  let parsedContacts = [];
  
  // Check if first row looks like a header
  const firstRow = parsedData[0].map(cell => cell.toLowerCase().trim());
  const headerKeywords = {
    first_name: ['vorname', 'first name', 'first', 'given name'],
    last_name: ['nachname', 'last name', 'last', 'surname', 'family name'],
    phone: ['telefon', 'phone', 'tel', 'telephone', 'festnetz'],
    mobile: ['mobil', 'mobile', 'handy', 'cell', 'cellphone'],
    email: ['email', 'e-mail', 'mail', 'e-mail-adresse'],
    department: ['abteilung', 'department', 'dept', 'bereich', 'abt'],
    address: ['adresse', 'address', 'anschrift']
  };
  
  const headerMatch = {};
  let headerMatchCount = 0;
  
  firstRow.forEach((cell, index) => {
    for (const [field, keywords] of Object.entries(headerKeywords)) {
      if (keywords.some(keyword => cell.includes(keyword))) {
        headerMatch[field] = index;
        headerMatchCount++;
        break;
      }
    }
  });
  
    // Notification-Code entfernt, showNotification wird global verwendet
    showNotification('Kontakt erfolgreich hinzugefügt', 'success');
    if (headerRow) {
      // Use header mapping
      for (const [field, index] of Object.entries(headerRow)) {
        if (index < row.length) {
          contact[field] = row[index].trim();
        }
      }
    } else {
      // Guess mapping based on common patterns
      // This is a simplified approach - in a real app, you'd want more sophisticated detection
      if (row.length >= 1) contact.last_name = row[0].trim();
      if (row.length >= 2) contact.first_name = row[1].trim();
      if (row.length >= 3) {
        // Check if third column looks like a phone number
        const thirdCol = row[2].trim();
        if (/^[0-9+\-\(\)\s]+$/.test(thirdCol)) {
          contact.phone = thirdCol;
        } else if (thirdCol.includes('@')) {
          contact.email = thirdCol;
        } else {
          contact.department = thirdCol;
        }
      }
      if (row.length >= 4) {
        const fourthCol = row[3].trim();
        if (!contact.phone && /^[0-9+\-\(\)\s]+$/.test(fourthCol)) {
          contact.phone = fourthCol;
        } else if (!contact.email && fourthCol.includes('@')) {
          contact.email = fourthCol;
        } else if (!contact.department) {
          contact.department = fourthCol;
        }
      }
    }
    
    // Ensure we have at least a name
    if (contact.last_name || contact.first_name) {
      parsedContacts.push(contact);
    }
  }
  
  // Show the preview
  // parsedContacts wird am Anfang der Funktion deklariert und in der Schleife gefüllt
  if (typeof parsedContacts === 'undefined') {
    parsedContacts = [];
  }
  showParsedContactsPreview(parsedContacts);
  
  // Update manual mapping UI
  if (typeof parsedData === 'undefined' || !Array.isArray(parsedData) || !parsedData[0]) {
    parsedData = [[]];
  }
  updateManualMappingUI(parsedData[0].length);

// Show manual mapping UI for clipboard data
function showManualMapping() {
  const mappingContainer = document.getElementById('manual-mapping-container');
  if (mappingContainer) {
    mappingContainer.style.display = 'block';
  }
}

// Update manual mapping UI based on detected columns
function updateManualMappingUI(columnCount) {
  const container = document.getElementById('manual-mapping-container');
  if (!container) return;
  
  // Clear existing rows except the first one
  while (container.children.length > 1) {
    container.removeChild(container.lastChild);
  }
  
  // Update or add rows for each column
  for (let i = 1; i < columnCount; i++) {
    const row = document.createElement('div');
    row.className = 'mapping-row';
    row.innerHTML = `
      <label>Spalte ${i + 1}:</label>
      <select class="form-control column-mapping">
        <option value="">Ignorieren</option>
        <option value="first_name">Vorname</option>
        <option value="last_name">Nachname</option>
        <option value="phone">Telefon</option>
        <option value="mobile">Mobil</option>
        <option value="email">E-Mail</option>
        <option value="department">Abteilung</option>
        <option value="address">Adresse</option>
        <option value="notes">Notizen</option>
      </select>
    `;
    container.appendChild(row);
  }
}

// Show preview of parsed contacts
function showParsedContactsPreview(parsedContacts) {
  const previewContainer = document.getElementById('parsed-preview');
  if (!previewContainer || parsedContacts.length === 0) return;
  
  previewContainer.innerHTML = `
    <div class="preview-header">
      <h4>Erkannte Kontakte (${parsedContacts.length})</h4>
    </div>
    <div class="preview-content">
      <table class="preview-table">
        <thead>
          <tr>
            <th>Vorname</th>
            <th>Nachname</th>
            <th>Telefon</th>
            <th>Abteilung</th>
          </tr>
        </thead>
        <tbody>
          ${parsedContacts.map(contact => `
            <tr>
              <td>${contact.first_name || ''}</td>
              <td>${contact.last_name || ''}</td>
              <td>${contact.phone || contact.mobile || ''}</td>
              <td>${contact.department || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Process contacts from clipboard
function processClipboardContacts() {
  const clipboardText = document.getElementById('clipboard-content').value.trim();
  if (!clipboardText) {
    showNotification('Bitte fügen Sie zuerst Daten ein', 'warning');
    return;
  }
  
  // Re-analyze to get the latest data
  analyzeClipboardContent();
  
  // Import the contacts
  const previewContainer = document.getElementById('parsed-preview');
  const previewTable = previewContainer.querySelector('table tbody');
  
  if (!previewTable || previewTable.children.length === 0) {
    showNotification('Keine gültigen Kontakte gefunden', 'warning');
    return;
  }
  
  // Get data from the preview table
  const newContacts = [];
  Array.from(previewTable.rows).forEach(row => {
    const cells = row.cells;
    const contact = {
      first_name: cells[0].textContent.trim(),
      last_name: cells[1].textContent.trim(),
      phone: cells[2].textContent.trim(),
      department: cells[3].textContent.trim(),
      added_date: new Date().toISOString()
    };
    
    // Validate minimal data (either first or last name, and phone)
    if ((contact.first_name || contact.last_name) && contact.phone) {
      newContacts.push(contact);
    }
  });
  
  if (newContacts.length === 0) {
    showNotification('Keine gültigen Kontakte gefunden', 'warning');
    return;
  }
  
  // Add to contacts array
  contacts.push(...newContacts);
  
  // Save contacts
  saveContacts();
  
  // Close modal
  closeModal();
  
  // Show notification
  showNotification(`${newContacts.length} Kontakte erfolgreich importiert`, 'success');
}

// Handle file upload
function handleFileUpload() {
  const fileInput = document.getElementById('contact-file-input');
  const previewContainer = document.getElementById('file-upload-preview');
  
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    return;
  }
  
  const file = fileInput.files[0];
  
  // Show file information
  previewContainer.innerHTML = `
    <div class="file-info">
      <i class="fas ${getFileIcon(file.name)}"></i>
      <div class="file-details">
        <div class="file-name">${file.name}</div>
        <div class="file-size">${formatFileSize(file.size)}</div>
      </div>
    </div>
  `;
  
  // Simple simulation of contact extraction
  // In a real app, you'd use proper libraries to extract data from PDFs, images, etc.
  setTimeout(() => {
    // Simulate finding contacts in the file
    const simulatedContacts = generateSimulatedContacts(3);
    
    // Show preview
    showFileContactsPreview(simulatedContacts);
  }, 1000);
}

// Get appropriate icon for file type
function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  
  if (['pdf'].includes(ext)) return 'fa-file-pdf';
  if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) return 'fa-file-image';
  if (['csv', 'xls', 'xlsx'].includes(ext)) return 'fa-file-excel';
  
  return 'fa-file';
}

// Format file size in human-readable format
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' bytes';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Show preview of contacts extracted from file
function showFileContactsPreview(contacts) {
  const previewContainer = document.getElementById('file-parsed-preview');
  if (!previewContainer || contacts.length === 0) return;
  
  previewContainer.innerHTML = `
    <div class="preview-header">
      <h4>Gefundene Kontakte (${contacts.length})</h4>
    </div>
    <div class="preview-content">
      <table class="preview-table">
        <thead>
          <tr>
            <th>Vorname</th>
            <th>Nachname</th>
            <th>Telefon</th>
            <th>Abteilung</th>
          </tr>
        </thead>
        <tbody>
          ${contacts.map(contact => `
            <tr>
              <td>${contact.first_name || ''}</td>
              <td>${contact.last_name || ''}</td>
              <td>${contact.phone || contact.mobile || ''}</td>
              <td>${contact.department || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Generate some simulated contacts (for demo purposes)
function generateSimulatedContacts(count) {
  const firstNames = ['Anna', 'Max', 'Maria', 'Thomas', 'Laura', 'Felix', 'Sophie', 'Jonas'];
  const lastNames = ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker'];
  const departments = ['Vertrieb', 'Marketing', 'IT', 'HR', 'Finanzen', 'Produktion', 'Einkauf', 'Support'];
  
  const contacts = [];
  
  for (let i = 0; i < count; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const department = departments[Math.floor(Math.random() * departments.length)];
    
    contacts.push({
      first_name: firstName,
      last_name: lastName,
      phone: `+49 ${Math.floor(Math.random() * 900 + 100)} ${Math.floor(Math.random() * 9000000 + 1000000)}`,
      department: department
    });
  }
  
  return contacts;
}

// Process contacts from file
function processFileContacts() {
  const fileInput = document.getElementById('contact-file-input');
  
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    showNotification('Bitte wählen Sie zuerst eine Datei aus', 'warning');
    return;
  }
  
  // Get contacts from preview
  const previewContainer = document.getElementById('file-parsed-preview');
  const previewTable = previewContainer?.querySelector('table tbody');
  
  if (!previewTable || previewTable.children.length === 0) {
    showNotification('Keine gültigen Kontakte gefunden', 'warning');
    return;
  }
  
  // Get data from the preview table
  const newContacts = [];
  Array.from(previewTable.rows).forEach(row => {
    const cells = row.cells;
    const contact = {
      first_name: cells[0].textContent.trim(),
      last_name: cells[1].textContent.trim(),
      phone: cells[2].textContent.trim(),
      department: cells[3].textContent.trim(),
      added_date: new Date().toISOString()
    };
    
    // Validate minimal data
    if ((contact.first_name || contact.last_name) && contact.phone) {
      newContacts.push(contact);
    }
  });
  
  if (newContacts.length === 0) {
    showNotification('Keine gültigen Kontakte gefunden', 'warning');
    return;
  }
  
  // Add to contacts array
  contacts.push(...newContacts);
  
  // Save contacts
  saveContacts();
  
  // Close modal
  closeModal();
  
  // Show notification
  showNotification(`${newContacts.length} Kontakte erfolgreich importiert`, 'success');
}
// The showNotification function has been moved to script.js for application-wide use
// function showNotification() {}  // Removed duplicate implementation
  
  // Create notification element
  // Entfernt: notification-Code mit 'type', da showNotification global in script.js definiert ist
  
  // Entfernt: Auto-remove Notification, da showNotification global und automatisch handled
  // calendar.js - Kalender-Frontend für HelpTool


// Modal für Event-Erstellung anzeigen
function showCalendarEventModal(date) {
    const modal = document.getElementById('calendar-event-modal');
    if (!modal) return;
  modal.style.display = 'flex';
  modal.classList.remove('modal-template');
  modal.classList.add('modal');
  const titleInput = document.getElementById('event-title');
  const contactInput = document.getElementById('event-contact');
  if (titleInput) { titleInput.value = ''; titleInput.focus(); }
  if (contactInput) { contactInput.value = ''; contactInput.dataset.contactId = ''; }
  renderContactAutocomplete();
  modal.dataset.date = date;
}

// Modal für Event-Erstellung schließen
function closeCalendarEventModal() {
    const modal = document.getElementById('calendar-event-modal');
    if (modal) modal.style.display = 'none';
}

// Kontakt-Autovervollständigung rendern
function renderContactAutocomplete() {
    const input = document.getElementById('event-contact');
    const list = document.getElementById('event-contact-list');
    if (!input || !list) return;

    input.addEventListener('input', function() {
        const query = this.value.toLowerCase();
        list.innerHTML = '';
        if (window.contacts && query.length > 0) {
            const matches = window.contacts.filter(c =>
                (c.first_name + ' ' + c.last_name).toLowerCase().includes(query)
            );
            matches.forEach(contact => {
                const item = document.createElement('div');
                item.className = 'autocomplete-item';
                item.textContent = contact.first_name + ' ' + contact.last_name;
                item.onclick = () => {
                    input.value = item.textContent;
                    input.dataset.contactId = contact.id || '';
                    list.innerHTML = '';
                };
                list.appendChild(item);
            });
        }
    });
}

// DOM geladen - Kalender initialisieren
// Make calendar initialization callable after render
function initializeTelefonbuchCalendar() {
  console.log('initializeTelefonbuchCalendar called');
  const calendarEl = document.getElementById('fc-calendar');
  if (!calendarEl) return;
  if (typeof FullCalendar === 'undefined') {
    console.error('FullCalendar is not loaded. Ensure CDN is available and <script> is included before telefonbuch.js');
    return;
  }

  // Events laden und Kalender initialisieren
  console.log('loadTermine: trying /api/telefonbuch/termine first');
  fetch('/api/telefonbuch/termine')
    .then(response => {
      if (!response.ok) throw new Error('telefonbuch/termine not ok');
      return response.json();
    })
    .then(events => {
      console.log('loadTermine: got events from /api/telefonbuch/termine', events && events.length);
      // Platzhalter entfernen
      const placeholder = document.getElementById('calendar-placeholder');
      if (placeholder) placeholder.remove();

      // FullCalendar initialisieren
      const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        height: 'auto',
        contentHeight: 560,
        dayMaxEventRows: 4,
        events: events.map(e => ({
          id: e.id,
          title: e.title || e.name || 'Termin',
          start: e.start || e.date,
          end: e.end || e.date,
          extendedProps: e
        })),
        dateClick: function(info) {
          showCalendarEventModal(info.dateStr);
        }
      });
      calendar.render();
      enableExternalDragForContactCards();
      // Make day cells accept drops for creating events
      setTimeout(() => {
        const dayCells = document.querySelectorAll('.fc-daygrid-day');
        dayCells.forEach(cell => {
          cell.addEventListener('dragover', function(e) { e.preventDefault(); this.classList.add('drop-target'); });
          cell.addEventListener('dragleave', function() { this.classList.remove('drop-target'); });
          cell.addEventListener('drop', function(e) {
            e.preventDefault(); this.classList.remove('drop-target');
            try {
              const payload = e.dataTransfer.getData('application/json');
              if (!payload) return;
              const contact = JSON.parse(payload);
              const date = this.dataset.date;
              if (!date) return;
              // Pre-fill modal and open
              showCalendarEventModal(date);
              document.getElementById('event-title').value = contact.first_name ? (contact.first_name + ' ' + (contact.last_name||'')) : (contact.name || '');
              const evtContact = document.getElementById('event-contact');
              if (evtContact) { evtContact.value = contact.first_name ? (contact.first_name + ' ' + (contact.last_name||'')) : (contact.name || ''); evtContact.dataset.contactId = contact.id || ''; }
            } catch (err) {
              console.error('Error parsing dropped contact', err);
            }
          });
        });
      }, 200);
      console.log('Kalender erfolgreich gerendert');
    })
    .catch(err => {
      console.warn('loadTermine: /api/telefonbuch/termine failed, trying /api/termine', err);
      return fetch('/api/termine')
        .then(r => {
          if (!r.ok) throw new Error('api/termine not ok');
          return r.json();
        })
        .then(events => {
          console.log('loadTermine: got events from /api/termine', events && events.length);

          const placeholder = document.getElementById('calendar-placeholder');
          if (placeholder) placeholder.remove();

          const calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            height: 'auto',
            contentHeight: 560,
            dayMaxEventRows: 4,
            events: events.map(e => ({
              id: e.id,
              title: e.title || e.name || 'Termin',
              start: e.start || e.date,
              end: e.end || e.date,
              extendedProps: e
            })),
            dateClick: function(info) {
              showCalendarEventModal(info.dateStr);
            }
          });
          calendar.render();
          console.log('Kalender erfolgreich gerendert (fallback)');
        })
        .catch(error => {
          console.error('Fehler beim Laden der Termine (fallback):', error);
          calendarEl.innerHTML = '<div style="color:red; text-align:center; padding:20px;">Fehler beim Laden der Termine</div>';
        });
    });

  // Event-Speicher-Handler
  const saveBtn = document.getElementById('save-calendar-event-btn');
  if (saveBtn) { 
    saveBtn.onclick = function() {
      const modal = document.getElementById('calendar-event-modal');
      const title = document.getElementById('event-title').value;
      const contactName = document.getElementById('event-contact').value;
      const contactId = document.getElementById('event-contact').dataset.contactId || '';
      const date = modal.dataset.date;

      if (!title || !date) return;

      fetch('/api/termine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title,
          contact: contactName,
          contact_id: contactId,
          date: date
        })
      })
      .then(response => {
        if (response.ok) {
          closeCalendarEventModal();
          // Kalender neu laden nach Speichern
          location.reload();
        } else {
          console.error('Fehler beim Speichern des Events');
        }
      })
      .catch(error => {
        console.error('Netzwerkfehler beim Speichern:', error);
      });
    };
  }
}

// Call on initial DOM ready (for cases where telefonbuch.html static file is used)
document.addEventListener('DOMContentLoaded', function() {
  if (document.getElementById('fc-calendar')) {
    initializeTelefonbuchCalendar();
  }
});
