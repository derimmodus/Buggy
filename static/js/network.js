// Dummy function to prevent ReferenceError if not implemented
function displayNetworkDevices(devices) {
  // You can implement actual rendering here
  console.log('displayNetworkDevices called with:', devices);
}
// Network Devices & Ping-Test Module

// State management for tab switching
let networkState = {
  pingResults: {},
  deviceList: [],
  searchQuery: '',
  filterType: '',
  pingResult: null,
  installResults: null,
  currentDevices: [],
  networkSettings: {}
};

// Variable declarations for network data
let networkData = null;
let networkDevices = [];
let networkSettings = {};
let isNetworkLoading = false;

// Single initialization function
function initNetworkModule() {
  console.log("Initializing network module");
  
  // Basic network module layout
  const content = document.getElementById('content');
  if (!content) return;
  
  content.innerHTML = `
    <div class="network-module">
      <div class="module-header">
        <h2><i class="fas fa-network-wired"></i> Netzwerk-Tools</h2>
      </div>

      <div class="network-layout">
        <!-- Left Column - Network Tools -->
        <div class="network-column">
          <!-- Ping-Test Card -->
          <div class="card network-ping">
            <div class="card-header">
              <h3 style="color: #ffffff !important;"><i class="fas fa-exchange-alt" style="color: #ffffff !important;"></i> <span style="color: #ffffff !important;">Ping-Test</span></h3>
            </div>
            <div class="card-body">
              <form id="ping-form" class="form">
                <div class="form-group">
                  <label for="device-id" class="text-light fw-bold">Gerät / IP-Adresse / Hostname:</label>
                  <div class="input-with-button">
                    <input type="text" id="device-id" class="form-control" placeholder="z.B. PC001, 192.168.1.1 oder server.local">
                    <button type="submit" class="btn btn-primary">Ping</button>
                  </div>
                </div>
              </form>
              <div id="ping-result"></div>
            </div>
          </div>

          <!-- Network Tools Card -->
          <div class="card network-tools">
            <div class="card-header">
              <h3 style="color: #ffffff !important;"><i class="fas fa-tools" style="color: #ffffff !important;"></i> <span style="color: #ffffff !important;">Netzwerk-Tools</span></h3>
            </div>
            <div class="card-body">
              <div class="network-tools-grid">
                <button class="network-tool-btn" onclick="openRemoteDesktop()">
                  <i class="fas fa-desktop"></i> <span>Remote Desktop</span>
                </button>
                <button class="network-tool-btn" onclick="openNetworkExplorer()">
                  <i class="fas fa-folder-open"></i> <span>Netzwerk-Explorer</span>
                </button>
                <button class="network-tool-btn" onclick="openSharedDrives()">
                  <i class="fas fa-hdd"></i> <span>Freigegebene Laufwerke</span>
                </button>
                <button class="network-tool-btn" onclick="showNetworkDiagnostics()">
                  <i class="fas fa-chart-line"></i> <span>Netzwerkdiagnose</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column - Network Devices -->
        <div class="network-column">
          <div class="card network-devices">
            <div class="card-header">
              <h3 style="color: #ffffff !important;"><i class="fas fa-server" style="color: #ffffff !important;"></i> <span style="color: #ffffff !important;">Netzwerkgeräte</span></h3>
              <div class="header-actions">
                <button id="add-device" class="btn-sm btn-success" title="Gerät hinzufügen">
                  <i class="fas fa-plus"></i>
                </button>
                <button id="refresh-devices" class="btn-sm" title="Aktualisieren">
                  <i class="fas fa-sync-alt"></i>
                </button>
              </div>
            </div>
            <div class="card-body">
              <div class="form-group">
                <input type="text" id="device-search" class="form-control" placeholder="Geräte durchsuchen...">
              </div>
              
              <div class="table-responsive">
                <table class="data-table" id="devices-table">
                  <thead>
                    <tr>
                      <th>Gerät-ID</th>
                      <th>Hostname</th>
                      <th>IP-Adresse</th>
                      <th>Status</th>
                      <th>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody id="devices-table-body">
                    <tr>
                      <td colspan="5" class="empty-table">Lade Geräte...</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Setup event listeners
  setupNetworkEventListeners();
  
  // Load network devices
  loadNetworkDevices();
  
  // Load settings if applicable
  loadNetworkSettings();
  
  // Load shortcuts if applicable
  const shortcutsContainer = document.querySelector('.shortcuts-container');
  if (shortcutsContainer) {
    loadNetworkShortcuts();
  }
  
  // Restore state if we have cached results
  restoreNetworkState();
}

// Compatibility function for backwards compatibility
function initNetworkFunctions() {
  console.log("Redirecting to initNetworkModule");
  initNetworkModule();
}

// Register just ONE event listener for initialization
document.addEventListener('DOMContentLoaded', function() {
  // Register module initialization when network tab is clicked
  const tabs = document.querySelectorAll('#tabs button');
  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      if (this.dataset.module === 'netzwerk') {
        initNetworkModule();
      }
    });
  });
  
  // If network is the initial active tab, initialize immediately
  if (document.querySelector('#tabs button.active')?.dataset.module === 'netzwerk') {
    initNetworkModule();
  }
});

// Setup event listeners for network functionality
function setupNetworkEventListeners() {
  // Ping form submission
  const pingForm = document.getElementById('ping-form');
  if (pingForm) {
    pingForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const deviceId = document.getElementById('device-id').value.trim();
      if (deviceId) {
        performPingTest(deviceId);
      } else {
        showNotification('Bitte geben Sie eine Geräte-ID oder IP-Adresse ein', 'warning');
      }
    });
  }
  
  // Device search functionality
  const deviceSearch = document.getElementById('device-search');
  if (deviceSearch) {
    deviceSearch.addEventListener('input', function() {
      filterDevices(this.value);
    });
  }
  
  // Refresh devices button
  const refreshBtn = document.getElementById('refresh-devices');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function() {
      loadNetworkDevices(true); // true to force refresh
    });
  }
  
  // Installationsprogramm-Suche
  const installForm = document.getElementById('install-form');
  if (installForm) {
    installForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const programName = document.getElementById('program-name').value.trim();
      if (programName) {
        searchInstallProgram(programName);
      } else {
        showNotification('Bitte geben Sie einen Programmnamen ein', 'warning');
      }
    });
  }
  
  // Netzwerkeinstellungen speichern
  const settingsForm = document.getElementById('network-settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', function(e) {
      e.preventDefault();
      saveNetworkSettings();
    });
  }
  
  // Dual Explorer öffnen Button
  const dualExplorerBtn = document.getElementById('open-dual-explorer');
  if (dualExplorerBtn) {
    dualExplorerBtn.addEventListener('click', function() {
      openDualExplorer();
    });
  }
  
  // Ping button from advanced UI
  const pingBtn = document.getElementById('ping-btn');
  if (pingBtn) {
    pingBtn.addEventListener('click', performPing);
  }
  
  // Device type filter
  const typeFilter = document.getElementById('device-type-filter');
  if (typeFilter) {
    typeFilter.addEventListener('change', filterDevices);
  }
  
  // Refresh devices button (advanced UI)
  const refreshDevicesBtn = document.getElementById('refresh-devices-btn');
  if (refreshDevicesBtn) {
    refreshDevicesBtn.addEventListener('click', () => {
      loadNetworkData(true);
    });
  }
  
  // Add device button
  const addDeviceBtn = document.getElementById('add-device');
  if (addDeviceBtn) {
    addDeviceBtn.addEventListener('click', showAddDeviceDialog);
  }
}

// Restore the previous network state when switching back to the network tab
function restoreNetworkState() {
  // Restore ping results if they exist
  if (networkState.pingResult) {
    const pingResultDiv = document.getElementById('ping-result');
    if (pingResultDiv) {
      pingResultDiv.innerHTML = networkState.pingResult;
    }
  }
  
  // Restore installation search results if they exist
  if (networkState.installResults) {
    const installResultsDiv = document.getElementById('install-results');
    if (installResultsDiv) {
      installResultsDiv.innerHTML = networkState.installResults;
    }
  }
}

// Ping-Test durchführen
async function performPingTest(deviceId) {
  try {
    const pingResult = document.getElementById('ping-result');
    if (!pingResult) return;
    
    pingResult.innerHTML = '<div class="loading">Führe Ping-Test durch...</div>';
    
    const response = await fetch('/api/network/ping', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ deviceId })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Fehler ${response.status}`);
    }
    
    const data = await response.json();
    displayPingResult(data);
    
    // Geräteliste aktualisieren, falls das Gerät hinzugefügt wurde
    if (data.in_database) {
      loadNetworkDevices();
    }
    
  } catch (error) {
    const pingResultDiv = document.getElementById('ping-result');
    if (pingResultDiv) {
      pingResultDiv.innerHTML = `
        <div class="error-message">
          Fehler beim Ping-Test: ${error.message}
        </div>
      `;
      // Save error state for tab switching
      networkState.pingResult = pingResultDiv.innerHTML;
    }
    console.error('Ping-Test Fehler:', error);
  }
}

// Ping-Ergebnis anzeigen
function displayPingResult(data) {
  const pingResult = document.getElementById('ping-result');
  if (!pingResult) return;
  
  const statusClass = data.is_online ? 'online' : 'offline';
  const statusText = data.is_online ? 'Online' : 'Offline';
  
  pingResult.innerHTML = `
    <div class="result-card">
      <div class="result-header ${statusClass}">
        <strong>${data.device_id}</strong> ist <strong>${statusText}</strong>
      </div>
      <div class="result-body">
        <dl>
          <dt>Hostname:</dt>
          <dd>${data.hostname || 'Nicht verfügbar'}</dd>
          
          <dt>IP-Adresse:</dt>
          <dd>${data.ip_address || 'Nicht verfügbar'}</dd>
          
          <dt>Netzwerkpfad:</dt>
          <dd class="network-path">${data.network_path}</dd>
        </dl>
        
        <div class="action-buttons mt-10">
          <button onclick="openNetworkPath('${data.network_path}')" 
                  class="btn btn-primary ${data.is_online ? '' : 'disabled'}" 
                  ${data.is_online ? '' : 'disabled'}>
            Netzwerkpfad öffnen
          </button>
          <button onclick="openDualExplorerWithDevice('${data.device_id}')" 
                  class="btn btn-primary ${data.is_online ? '' : 'disabled'}" 
                  ${data.is_online ? '' : 'disabled'}>
            Dual-Explorer öffnen
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Save the result HTML for tab switching
  networkState.pingResult = pingResult.innerHTML;
}

// Nach Installationsprogrammen suchen
async function searchInstallProgram(programName) {
  try {
    const resultDiv = document.getElementById('install-results');
    if (!resultDiv) return;
    
    resultDiv.innerHTML = '<div class="loading">Suche nach Programmen...</div>';
    
    const response = await fetch('/api/network/install', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ programName })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Fehler ${response.status}`);
    }
    
    const data = await response.json();
    displayInstallResults(data);
    
  } catch (error) {
    const installResultsDiv = document.getElementById('install-results');
    if (installResultsDiv) {
      installResultsDiv.innerHTML = `
        <div class="error-message">
          Fehler bei der Programmsuche: ${error.message}
        </div>
      `;
      // Save error state for tab switching
      networkState.installResults = installResultsDiv.innerHTML;
    }
    console.error('Programmsuche Fehler:', error);
  }
}

// Installationsprogramme anzeigen
function displayInstallResults(data) {
  const resultDiv = document.getElementById('install-results');
  if (!resultDiv) return;
  
  if (!data.found || data.programs.length === 0) {
    resultDiv.innerHTML = `
      <div class="notice warning">
        Keine Programme mit diesem Namen gefunden.
      </div>
    `;
    // Save state for tab switching
    networkState.installResults = resultDiv.innerHTML;
    return;
  }
  
  resultDiv.innerHTML = `
    <div class="found-programs">
      <div class="notice">
        ${data.count} Programme gefunden.
      </div>
      ${data.programs.map(program => `
        <div class="program-item">
          <div class="program-header">
            <strong>${program.name}</strong>
            <span>${program.size_formatted}</span>
          </div>
          <div class="program-path">${program.path}</div>
          <div class="program-actions mt-10">
            <button onclick="copyInstallProgram('${program.path.replace(/\\/g, '\\\\')}')" class="btn">
              Zu Gerät kopieren
            </button>
            <button onclick="openFolder('${program.path.replace(/\\/g, '\\\\')}')" class="btn secondary">
              Speicherort öffnen
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  
  // Save state for tab switching
  networkState.installResults = resultDiv.innerHTML;
}

// Gespeicherte Netzwerkgeräte laden
async function loadNetworkDevices(forceRefresh = false) {
  try {
    // If we have cached devices and not forcing refresh, use them
    if (networkState.deviceList.length > 0 && !forceRefresh) {
      displayNetworkDevices(networkState.deviceList);
      return;
    }
    
    let devices = [];
    
    try {
      // Try to load from backend first
      const response = await fetch('/api/network/devices');
      if (response.ok) {
        devices = await response.json();
      }
    } catch (backendError) {
      console.log('Backend not available, loading from localStorage:', backendError);
    }
    
    // Also load from localStorage (for manually added devices)
    const localDevices = JSON.parse(localStorage.getItem('network_devices') || '[]');
    
    // Merge backend devices with localStorage devices
    if (localDevices.length > 0) {
      // Combine devices, preferring localStorage versions if they have the same ID
      const deviceMap = new Map();
      
      // Add backend devices first
      devices.forEach(device => {
        deviceMap.set(device.id, device);
      });
      
      // Add/update with localStorage devices
      localDevices.forEach(device => {
        deviceMap.set(device.id, device);
      });
      
      devices = Array.from(deviceMap.values());
    }
    
    // Store devices in state
    networkState.deviceList = devices;
    networkState.currentDevices = devices;
    
    // Update tables/views that might be present
    updateDeviceTable(devices);
    updateDeviceList(devices);
    
  } catch (error) {
    console.error('Error loading network devices:', error);
    
    // Try to fallback to localStorage only
    try {
      const localDevices = JSON.parse(localStorage.getItem('network_devices') || '[]');
      if (localDevices.length > 0) {
        networkState.deviceList = localDevices;
        networkState.currentDevices = localDevices;
        updateDeviceTable(localDevices);
        updateDeviceList(localDevices);
        return;
      }
    } catch (localError) {
      console.error('Error loading from localStorage:', localError);
    }
    
    const tableBody = document.getElementById('devices-table-body');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-table error">
            Fehler beim Laden der Geräte: ${error.message}
          </td>
        </tr>
      `;
    }
    
    const deviceList = document.getElementById('device-list');
    if (deviceList) {
      deviceList.innerHTML = `
        <div class="error-message">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Fehler beim Laden der Geräte: ${error.message}</p>
        </div>
      `;
    }
  }
}

// Update the device table (basic UI)
function updateDeviceTable(devices) {
  const tableBody = document.getElementById('devices-table-body');
  if (!tableBody) return;
  
  // Empty state
  if (!devices || devices.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-table">Keine Geräte gefunden</td>
      </tr>
    `;
    return;
  }
  
  // Sort devices by online status
  const sortedDevices = [...devices].sort((a, b) => {
    if (a.is_online !== b.is_online) {
      return a.is_online ? -1 : 1; // Online devices first
    }
    return a.id.localeCompare(b.id);
  });
  
  tableBody.innerHTML = sortedDevices.map(device => {
    const hostname = device.hostname || '-';
    const ipAddress = device.ip_address || device.ip || '-';
    
    return `
      <tr class="${device.is_online ? 'online' : 'offline'}" data-id="${device.id}">
        <td>${device.id}</td>
        <td>${hostname}</td>
        <td>${ipAddress}</td>
        <td><span class="status-badge ${device.is_online ? 'online' : 'offline'}">${device.is_online ? 'Online' : 'Offline'}</span></td>
        <td class="tool-buttons">
          <button onclick="performPingTest('${device.id}')" class="network-tool-btn" title="Ping-Test">
            <i class="fas fa-exchange-alt"></i>
          </button>
          <button onclick="openNetworkPath('${device.network_path || `\\\\${device.id}\\c$`}')" 
                  class="network-tool-btn ${device.is_online ? '' : 'disabled'}" 
                  ${device.is_online ? '' : 'disabled'} title="Netzwerkpfad öffnen">
            <i class="fas fa-folder-open"></i>
          </button>
          <button onclick="openRemoteSessionToDevice('${device.id}')" 
                  class="network-tool-btn ${device.is_online ? '' : 'disabled'}" 
                  ${device.is_online ? '' : 'disabled'} title="Remote-Sitzung">
            <i class="fas fa-desktop"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Update device list (advanced UI)
function updateDeviceList(devices) {
  const deviceList = document.getElementById('device-list');
  if (!deviceList) return;
  
  deviceList.innerHTML = getDeviceListHTML(devices);
  
  // Re-attach event listeners
  setupDeviceListeners();
}

// Display network devices in card view (advanced UI)
function getDeviceListHTML(devices) {
  if (!devices || devices.length === 0) {
    return `
      <div class="empty-state">
        <i class="fas fa-desktop fa-3x"></i>
        <h4>Keine Geräte gefunden</h4>
        <p>Es wurden keine Netzwerkgeräte gefunden oder die Suche ergab keine Treffer.</p>
      </div>
    `;
  }
  
  return `
    <div class="device-grid">
      ${devices.map(device => `
        <div class="device-card ${device.is_online ? 'online' : 'offline'}" data-id="${device.id}" data-type="${device.type || 'pc'}">
          <div class="device-icon">
            <i class="fas ${getDeviceIcon(device.type || 'pc')}"></i>
          </div>
          <div class="device-info">
            <h4>${device.name || device.id}</h4>
            <div class="device-details">
              <span class="device-ip">${device.ip_address || device.ip || '-'}</span>
              ${device.mac_address ? `<span class="device-mac">${device.mac_address}</span>` : ''}
            </div>
            <div class="device-status ${device.is_online ? 'online' : 'offline'}">
              ${device.is_online ? 'Online' : 'Offline'}
            </div>
          </div>
          <div class="device-actions">
            <button class="btn-icon ping-device" title="Ping" data-id="${device.id}">
              <i class="fas fa-paper-plane"></i>
            </button>
            <button class="btn-icon connect-device" title="Verbinden" data-id="${device.id}" ${device.is_online ? '' : 'disabled'}>
              <i class="fas fa-link"></i>
            </button>
            <button class="btn-icon device-info-btn" title="Info" data-id="${device.id}">
              <i class="fas fa-info-circle"></i>
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Netzwerkeinstellungen laden
async function loadNetworkSettings() {
  try {
    const response = await fetch('/api/network/settings');
    if (!response.ok) {
      throw new Error(`Fehler ${response.status}`);
    }
    
    const settings = await response.json();
    // Save for state restoration
    networkState.networkSettings = settings;
    
    // Formular mit Werten füllen
    const networkPathInput = document.getElementById('network-path-template');
    const installFolderInput = document.getElementById('install-folder-path');
    
    if (networkPathInput) networkPathInput.value = settings.network_path_template || '';
    if (installFolderInput) installFolderInput.value = settings.install_folder_path || '';
    
  } catch (error) {
    console.error('Fehler beim Laden der Netzwerkeinstellungen:', error);
    showNotification('Fehler beim Laden der Einstellungen', 'error');
  }
}

// Load network shortcuts from the server
async function loadNetworkShortcuts() {
  try {
    const response = await fetch('/api/network/shortcuts');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const shortcuts = await response.json();
    displayNetworkShortcuts(shortcuts);
    
  } catch (error) {
    console.error('Error loading network shortcuts:', error);
    showNotification('Fehler beim Laden der Netzwerk-Shortcuts', 'error');
  }
}

// Display network shortcuts in the UI
function displayNetworkShortcuts(shortcuts) {
  const container = document.querySelector('.shortcuts-container');
  if (!container) return;
  
  if (!shortcuts || shortcuts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-star"></i>
        <p>Keine Shortcuts definiert</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = shortcuts.map((shortcut, index) => `
    <div class="shortcut-item">
      <input type="text" class="form-control shortcut-path" 
             value="${shortcut.path}" placeholder="\\\\server\\share"
             data-index="${index}">
      <button class="btn-remove" onclick="removeShortcut(${index})">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `).join('');
  
  // Add event listeners for shortcut path changes
  document.querySelectorAll('.shortcut-path').forEach(input => {
    input.addEventListener('change', function() {
      updateShortcut(this.dataset.index, this.value);
    });
  });
}

// Utility functions
function getDeviceIcon(type) {
  switch (type) {
    case 'pc': return 'fa-desktop';
    case 'printer': return 'fa-print';
    case 'router': return 'fa-router';
    case 'server': return 'fa-server';
    case 'mobile': return 'fa-mobile-alt';
    case 'tablet': return 'fa-tablet-alt';
    default: return 'fa-network-wired';
  }
}

function getDeviceTypeName(type) {
  switch (type) {
    case 'pc': return 'Computer';
    case 'printer': return 'Drucker';
    case 'router': return 'Router';
    case 'server': return 'Server';
    case 'mobile': return 'Mobilgerät';
    case 'tablet': return 'Tablet';
    default: return 'Sonstiges Gerät';
  }
}

// Filter devices based on search input
function filterDevices(searchQuery) {
  // If search is coming from an event, get the value
  if (typeof searchQuery === 'object' && searchQuery.target) {
    searchQuery = searchQuery.target.value;
  }
  
  const searchTerm = (searchQuery || '').toLowerCase();
  networkState.searchQuery = searchTerm;
  
  // Get the selected device type if available
  const typeFilter = document.getElementById('device-type-filter');
  const selectedType = typeFilter ? typeFilter.value : '';
  networkState.filterType = selectedType;
  
  // Filter the devices
  let filteredDevices = [...networkState.deviceList];
  
  // Apply search term filter
  if (searchTerm) {
    filteredDevices = filteredDevices.filter(device => {
      return (device.id && device.id.toLowerCase().includes(searchTerm)) ||
             (device.name && device.name.toLowerCase().includes(searchTerm)) ||
             (device.hostname && device.hostname.toLowerCase().includes(searchTerm)) ||
             (device.ip_address && device.ip_address.includes(searchTerm)) ||
             (device.ip && device.ip.includes(searchTerm));
    });
  }
  
  // Apply type filter
  if (selectedType) {
    filteredDevices = filteredDevices.filter(device => device.type === selectedType);
  }
  
  // Update UI based on which view is active
  updateDeviceTable(filteredDevices);
  updateDeviceList(filteredDevices);
}

// Event listeners for device cards in advanced UI
function setupDeviceListeners() {
  // Device ping buttons
  document.querySelectorAll('.ping-device').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const deviceId = e.currentTarget.getAttribute('data-id');
      performPingTest(deviceId);
    });
  });
  
  // Device connect buttons
  document.querySelectorAll('.connect-device').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const deviceId = e.currentTarget.getAttribute('data-id');
      openRemoteSessionToDevice(deviceId);
    });
  });
  
  // Device info buttons
  document.querySelectorAll('.device-info-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const deviceId = e.currentTarget.getAttribute('data-id');
      showDeviceInfo(deviceId);
    });
  });
}

// Advanced UI ping function
function performPing() {
  const pingInput = document.getElementById('ping-input');
  const pingResults = document.getElementById('ping-results');
  
  if (!pingInput || !pingResults) return;
  
  const target = pingInput.value.trim();
  if (!target) {
    pingResults.innerHTML = `
      <div class="alert alert-warning">
        Bitte geben Sie eine IP-Adresse oder einen Hostnamen ein.
      </div>
    `;
    return;
  }
  
  // Show loading
  pingResults.innerHTML = `
    <div class="ping-loading">
      <i class="fas fa-circle-notch fa-spin"></i> Pinge ${target}...
    </div>
  `;
  
  // Call the main ping test function
  performPingTest(target);
}

// Network path functionality
function openNetworkPath(path) {
  showNotification(`Öffne Netzwerkpfad: ${path}`, 'info');
  
  fetch('/api/network/open-path', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ path: path })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showNotification('Netzwerkpfad geöffnet', 'success');
    } else {
      showNotification(`Fehler: ${data.error || 'Unbekannter Fehler'}`, 'error');
    }
  })
  .catch(error => {
    showNotification(`Fehler: ${error.message}`, 'error');
  });
}

// Open Dual Explorer (for general use)
function openDualExplorer() {
  showNotification('Dual-Explorer wird geöffnet...', 'info');
  
  fetch('/api/network/open-tool', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ tool: 'dual-explorer' })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showNotification('Dual-Explorer geöffnet', 'success');
    } else {
      showNotification(`Fehler: ${data.error || 'Unbekannter Fehler'}`, 'error');
    }
  })
  .catch(error => {
    showNotification(`Fehler: ${error.message}`, 'error');
  });
}

// Open Dual Explorer with specific device
function openDualExplorerWithDevice(deviceId) {
  showNotification(`Öffne Dual-Explorer mit Gerät ${deviceId}...`, 'info');
  
  fetch('/api/network/open-dual-explorer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ deviceId: deviceId })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showNotification(`Dual-Explorer mit ${deviceId} geöffnet`, 'success');
    } else {
      showNotification(`Fehler: ${data.error || 'Unbekannter Fehler'}`, 'error');
    }
  })
  .catch(error => {
    showNotification(`Fehler: ${error.message}`, 'error');
  });
}

// Open remote session to device
function openRemoteSessionToDevice(deviceId) {
  showNotification(`Starte Remote-Sitzung zu ${deviceId}...`, 'info');
  
  fetch('/api/network/remote-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ deviceId: deviceId })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showNotification(data.message || `Remote-Sitzung zu ${deviceId} gestartet`, 'success');
    } else {
      showNotification(`Fehler: ${data.error || 'Unbekannter Fehler'}`, 'error');
    }
  })
  .catch(error => {
    showNotification(`Fehler: ${error.message}`, 'error');
  });
}

// Open remote desktop tool
function openRemoteDesktop() {
  showNotification('Remote Desktop wird geöffnet...', 'info');
  
  fetch('/api/network/open-tool', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ tool: 'remote-desktop' })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showNotification('Remote Desktop geöffnet', 'success');
    } else {
      showNotification(`Fehler: ${data.error || 'Unbekannter Fehler'}`, 'error');
    }
  })
  .catch(error => {
    showNotification(`Fehler: ${error.message}`, 'error');
  });
}

// Open network explorer
function openNetworkExplorer() {
  showNotification('Netzwerk-Explorer wird geöffnet...', 'info');
  
  fetch('/api/network/open-tool', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ tool: 'network-explorer' })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showNotification('Netzwerk-Explorer geöffnet', 'success');
    } else {
      showNotification(`Fehler: ${data.error || 'Unbekannter Fehler'}`, 'error');
    }
  })
  .catch(error => {
    showNotification(`Fehler: ${error.message}`, 'error');
  });
}

// Open shared drives view
function openSharedDrives() {
  showNotification('Freigegebene Laufwerke werden angezeigt...', 'info');
  
  fetch('/api/network/open-tool', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ tool: 'shared-drives' })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showNotification('Freigegebene Laufwerke angezeigt', 'success');
    } else {
      showNotification(`Fehler: ${data.error || 'Unbekannter Fehler'}`, 'error');
    }
  })
  .catch(error => {
    showNotification(`Fehler: ${error.message}`, 'error');
  });
}

// Show network diagnostics
function showNetworkDiagnostics() {
  showNotification('Netzwerkdiagnose wird gestartet...', 'info');
  
  // Create a modal for network diagnostics
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3><i class="fas fa-chart-line"></i> Netzwerkdiagnose</h3>
        <button class="close-modal" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="diagnostic-results">
          <div class="loading">Führe Netzwerkdiagnose durch...</div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Simulate diagnostic results
  fetch('/api/network/diagnostics')
    .then(response => response.json())
    .then(data => {
      const resultsContainer = modal.querySelector('.diagnostic-results');
      
      if (data.success) {
        let resultsHTML = '';
        
        // Add status items
        data.checks.forEach(check => {
          const statusClass = check.status === 'ok' ? 'success' : 
                             (check.status === 'warning' ? 'warning' : 'error');
          const iconClass = check.status === 'ok' ? 'fa-check-circle' : 
                           (check.status === 'warning' ? 'fa-exclamation-triangle' : 'fa-times-circle');
          
          resultsHTML += `
            <div class="diagnostic-item ${statusClass}">
              <i class="fas ${iconClass}"></i>
              <span>${check.name}: ${check.message}</span>
            </div>
          `;
        });
        
        // Add network details
        resultsHTML += `
          <div class="diagnostic-stats">
            <h4>Netzwerkdetails</h4>
            <table class="details-table">
              <tr>
                <th>IP-Adresse:</th>
                <td>${data.details.ip_address}</td>
              </tr>
              <tr>
                <th>Subnetzmaske:</th>
                <td>${data.details.subnet_mask}</td>
              </tr>
              <tr>
                <th>Gateway:</th>
                <td>${data.details.gateway}</td>
              </tr>
              <tr>
                <th>DNS-Server:</th>
                <td>${data.details.dns_servers.join(', ')}</td>
              </tr>
              <tr>
                <th>Ping (Gateway):</th>
                <td>${data.details.ping_gateway}</td>
              </tr>
              <tr>
                <th>Ping (Internet):</th>
                <td>${data.details.ping_internet}</td>
              </tr>
            </table>
          </div>
        `;
        
        resultsContainer.innerHTML = resultsHTML;
      } else {
        resultsContainer.innerHTML = `
          <div class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            <p>${data.error || 'Fehler bei der Netzwerkdiagnose.'}</p>
          </div>
        `;
      }
    })
    .catch(error => {
      const resultsContainer = modal.querySelector('.diagnostic-results');
      resultsContainer.innerHTML = `
        <div class="error-message">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Fehler bei der Netzwerkdiagnose: ${error.message}</p>
        </div>
      `;
    });
}

// General utility function to close modals
function closeModal() {
  const modals = document.querySelectorAll('.modal-overlay');
  modals.forEach(modal => {
    document.body.removeChild(modal);
  });
}

// Add CSS for the network module
document.addEventListener('DOMContentLoaded', function() {
  if (!document.getElementById('network-styles')) {
    const style = document.createElement('style');
    style.id = 'network-styles';
    style.textContent = `
      /* Network Module Styles */
      .network-module { width: 100%; }
      
      .network-layout {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      
      @media (min-width: 992px) {
        .network-layout {
          flex-direction: row;
        }
        
        .network-column:first-child {
          flex: 1;
        }
        
        .network-column:last-child {
          flex: 2;
        }
      }
      
      .network-column .card {
        margin-bottom: 20px;
      }
      
      .card {
        background-color: #fff;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        overflow: hidden;
      }
      
      .card-header {
        background-color: #f5f5f5;
        padding: 15px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #eee;
      }
      
      .card-header h3 {
        margin: 0;
        font-size: 1.2rem;
        font-weight: 500;
      }
      
      .card-body {
        padding: 20px;
      }
      
      .form-group {
        margin-bottom: 15px;
      }
      
      .form-group label {
        display: block;
        margin-bottom: 5px;
        font-weight: 500;
      }
      
      .input-with-button {
        display: flex;
      }
      
      .input-with-button input {
        flex: 1;
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
      }
      
      .input-with-button button {
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
      }
      
      .form-control {
        display: block;
        width: 100%;
        padding: 8px 12px;
        font-size: 14px;
        border: 1px solid #ddd;
        border-radius: 4px;
      }
      
      .btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      }
      
      .btn-primary {
        background-color: #1e88e5;
        color: white;
      }
      
      .btn-primary:hover {
        background-color: #1976d2;
      }
      
      .btn-secondary {
        background-color: #f5f5f5;
        color: #333;
        border: 1px solid #ddd;
      }
      
      .btn-secondary:hover {
        background-color: #e0e0e0;
      }
      
      .btn-sm {
        padding: 4px 8px;
        font-size: 12px;
      }
      
      .network-tools-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 10px;
      }
      
      .network-tool-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background-color: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 6px;
        padding: 15px 10px;
        cursor: pointer;
        transition: all 0.2s;
        text-align: center;
      }
      
      .network-tool-btn:hover {
        background-color: #e3f2fd;
        border-color: #bbdefb;
      }
      
      .network-tool-btn i {
        font-size: 1.5rem;
        margin-bottom: 8px;
        color: #1e88e5;
      }
      
      .table-responsive {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }
      
      .data-table {
        width: 100%;
        border-collapse: collapse;
      }
      
      .data-table th,
      .data-table td {
        padding: 8px 12px;
        text-align: left;
        border-bottom: 1px solid #eee;
      }
      
      .data-table th {
        background-color: #f9f9f9;
        font-weight: 600;
        color: #333;
      }
      
      .data-table tr:hover {
        background-color: #f5f5f5;
      }
      
      .data-table tr.online {
        background-color: rgba(76, 175, 80, 0.05);
      }
      
      .data-table tr.offline {
        background-color: rgba(244, 67, 54, 0.05);
      }
      
      .status-badge {
        display: inline-block;
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 12px;
      }
      
      .status-badge.online {
        background-color: rgba(76, 175, 80, 0.2);
        color: #388e3c;
      }
      
      .status-badge.offline {
        background-color: rgba(244, 67, 54, 0.2);
        color: #d32f2f;
      }
      
      .tool-buttons {
        display: flex;
        gap: 5px;
      }
      
      .result-card {
        border: 1px solid #ddd;
        border-radius: 6px;
        overflow: hidden;
        margin-top: 15px;
      }
      
      .result-header {
        padding: 10px 15px;
        background-color: #f5f5f5;
        border-bottom: 1px solid #ddd;
        font-weight: 500;
      }
      
      .result-header.online {
        background-color: rgba(76, 175, 80, 0.2);
        border-bottom-color: rgba(76, 175, 80, 0.3);
      }
      
      .result-header.offline {
        background-color: rgba(244, 67, 54, 0.2);
        border-bottom-color: rgba(244, 67, 54, 0.3);
      }
      
      .result-body {
        padding: 15px;
      }
      
      .result-body dl {
        margin: 0;
        display: grid;
        grid-template-columns: 120px 1fr;
        row-gap: 8px;
      }
      
      .result-body dt {
        font-weight: 600;
      }
      
      .result-body dd {
        margin: 0;
      }
      
      .action-buttons {
        display: flex;
        gap: 10px;
        margin-top: 15px;
      }
      
      .empty-table {
        text-align: center;
        padding: 20px;
        color: #666;
      }
      
      .loading {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100px;
        color: #666;
      }
      
      /* Additional styles for diagnostics */
      .diagnostic-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        border-radius: 4px;
        margin-bottom: 8px;
      }
      
      .diagnostic-item i {
        font-size: 1.2rem;
      }
      
      .diagnostic-item.success {
        background-color: rgba(76, 175, 80, 0.1);
      }
      
      .diagnostic-item.success i {
        color: #4CAF50;
      }
      
      .diagnostic-item.warning {
        background-color: rgba(255, 152, 0, 0.1);
      }
      
      .diagnostic-item.warning i {
        color: #FF9800;
      }
      
      .diagnostic-item.error {
        background-color: rgba(244, 67, 54, 0.1);
      }
      
      .diagnostic-item.error i {
        color: #F44336;
      }
      
      .diagnostic-item.info {
        background-color: rgba(33, 150, 243, 0.1);
      }
      
      .diagnostic-item.info i {
        color: #2196F3;
      }
      
      .diagnostic-stats {
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid #eee;
      }
      
      .diagnostic-stats h4 {
        margin-top: 0;
        margin-bottom: 15px;
      }
      
      .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }
      
      .modal-content {
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 3px 15px rgba(0, 0, 0, 0.3);
        width: 90%;
        max-width: 600px;
        max-height: 90vh;
        overflow-y: auto;
      }
      
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 20px;
        border-bottom: 1px solid #eee;
      }
      
      .modal-header h3 {
        margin: 0;
        font-size: 1.3rem;
        font-weight: 500;
      }
      
      .close-modal {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #666;
      }
      
      .modal-body {
        padding: 20px;
      }
      
      /* Make sure buttons are disabled when needed */
      button.disabled,
      button[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
      }
      
      /* Spacing utilities */
      .mt-10 {
        margin-top: 10px;
      }
    `;
    document.head.appendChild(style);
  }
});

// Show Network Links Dialog
function showNetworkLinksDialog() {
  const modal = document.createElement('div');
  modal.className = 'network-links-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: center;
  `;

  // Load existing network links
  const networkLinks = JSON.parse(localStorage.getItem('network-links') || '[]');
  
  modal.innerHTML = `
    <div class="modal-content" style="
      background: #2d3748;
      border-radius: 8px;
      width: 90%;
      max-width: 800px;
      max-height: 80vh;
      overflow-y: auto;
      color: white;
      border: 1px solid #4a5568;
    ">
      <div class="modal-header" style="padding: 20px; border-bottom: 1px solid #4a5568; display: flex; justify-content: space-between; align-items: center;">
        <h2 style="margin: 0; color: #ffffff;"><i class="fas fa-link"></i> Netzwerk Links</h2>
        <button class="close-btn" style="background: none; border: none; color: #cbd5e0; font-size: 24px; cursor: pointer;">&times;</button>
      </div>
      <div class="modal-body" style="padding: 20px;">
        <div class="form-group" style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 5px; color: #e2e8f0; font-weight: bold;">Neuen Link hinzufügen:</label>
          <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <input type="text" id="link-name" class="form-control" placeholder="Link-Name" style="flex: 1; background: #1a202c; border: 1px solid #4a5568; color: white; padding: 8px;">
            <input type="url" id="link-url" class="form-control" placeholder="https://..." style="flex: 2; background: #1a202c; border: 1px solid #4a5568; color: white; padding: 8px;">
            <select id="link-browser" class="form-control" style="background: #1a202c; border: 1px solid #4a5568; color: white; padding: 8px;">
              <option value="default">Standard Browser</option>
              <option value="chrome">Google Chrome</option>
              <option value="firefox">Mozilla Firefox</option>
              <option value="edge">Microsoft Edge</option>
              <option value="safari">Safari</option>
            </select>
            <button id="add-link" class="btn btn-success" style="padding: 8px 16px; background: #48bb78; border: none; color: white; cursor: pointer; border-radius: 4px;">
              <i class="fas fa-plus"></i> Hinzufügen
            </button>
          </div>
        </div>
        <div class="links-container">
          <h3 style="color: #e2e8f0; margin-bottom: 15px;">Gespeicherte Links:</h3>
          <div id="links-list" style="display: grid; gap: 10px;">
            <!-- Links werden hier eingefügt -->
          </div>
        </div>
      </div>
      <div class="modal-footer" style="padding: 20px; border-top: 1px solid #4a5568; display: flex; justify-content: flex-end; gap: 10px;">
        <button class="cancel-btn btn btn-secondary" style="padding: 10px 20px; background: #718096; border: none; color: white; cursor: pointer; border-radius: 4px;">Schließen</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Event listeners for the modal
  const closeBtn = modal.querySelector('.close-btn');
  const cancelBtn = modal.querySelector('.cancel-btn');
  const addLinkBtn = modal.querySelector('#add-link');
  const linkNameInput = modal.querySelector('#link-name');
  const linkUrlInput = modal.querySelector('#link-url');
  const linkBrowserSelect = modal.querySelector('#link-browser');

  const closeModal = () => {
    document.body.removeChild(modal);
  };

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  // Add new link
  addLinkBtn.addEventListener('click', () => {
    const name = linkNameInput.value.trim();
    const url = linkUrlInput.value.trim();
    const browser = linkBrowserSelect.value;

    if (!name || !url) {
      alert('Bitte Name und URL eingeben!');
      return;
    }

    const newLink = {
      id: Date.now(),
      name: name,
      url: url,
      browser: browser,
      created: new Date().toISOString()
    };

    networkLinks.push(newLink);
    localStorage.setItem('network-links', JSON.stringify(networkLinks));
    
    // Clear inputs
    linkNameInput.value = '';
    linkUrlInput.value = '';
    linkBrowserSelect.value = 'default';
    
    // Refresh links display
    displayNetworkLinks(networkLinks, modal.querySelector('#links-list'));
  });

  // Display existing links
  displayNetworkLinks(networkLinks, modal.querySelector('#links-list'));
}

// Display network links
function displayNetworkLinks(links, container) {
  if (!container) return;
  
  container.innerHTML = links.map(link => `
    <div class="link-item" style="
      background: #1a202c;
      border: 1px solid #4a5568;
      border-radius: 6px;
      padding: 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    ">
      <div class="link-info" style="flex: 1;">
        <div class="link-name" style="
          font-weight: bold;
          font-size: 16px;
          color: #e2e8f0;
          margin-bottom: 5px;
        ">${link.name}</div>
        <div class="link-url" style="
          color: #cbd5e0;
          font-size: 14px;
          word-break: break-all;
        ">${link.url}</div>
        <div class="link-browser" style="
          color: #9ca3af;
          font-size: 12px;
          margin-top: 3px;
        ">Browser: ${getBrowserName(link.browser)}</div>
      </div>
      <div class="link-actions" style="display: flex; gap: 10px; margin-left: 15px;">
        <button onclick="openNetworkLink('${link.url}', '${link.browser}')" class="btn btn-primary" style="
          padding: 8px 12px;
          background: #4299e1;
          border: none;
          color: white;
          cursor: pointer;
          border-radius: 4px;
          font-size: 14px;
        ">
          <i class="fas fa-external-link-alt"></i> Öffnen
        </button>
        <button onclick="deleteNetworkLink(${link.id})" class="btn btn-danger" style="
          padding: 8px 12px;
          background: #f56565;
          border: none;
          color: white;
          cursor: pointer;
          border-radius: 4px;
          font-size: 14px;
        ">
          <i class="fas fa-trash"></i> Löschen
        </button>
      </div>
    </div>
  `).join('');
}

// Get browser display name
function getBrowserName(browser) {
  const browserNames = {
    'default': 'Standard Browser',
    'chrome': 'Google Chrome',
    'firefox': 'Mozilla Firefox', 
    'edge': 'Microsoft Edge',
    'safari': 'Safari'
  };
  return browserNames[browser] || 'Standard Browser';
}

// Open network link
function openNetworkLink(url, browser) {
  console.log(`Opening ${url} with ${browser}`);
  
  // For now, just open with default browser
  // In a real implementation, you would send a request to the backend
  // to open with the specific browser
  window.open(url, '_blank');
}

// Delete network link
function deleteNetworkLink(linkId) {
  if (!confirm('Möchten Sie diesen Link wirklich löschen?')) return;
  
  let networkLinks = JSON.parse(localStorage.getItem('network-links') || '[]');
  networkLinks = networkLinks.filter(link => link.id !== linkId);
  localStorage.setItem('network-links', JSON.stringify(networkLinks));
  
  // Refresh the dialog
  const modal = document.querySelector('.network-links-modal');
  if (modal) {
    const container = modal.querySelector('#links-list');
    displayNetworkLinks(networkLinks, container);
  }
}

// Show Add Device Dialog
function showAddDeviceDialog() {
  const modal = document.createElement('div');
  modal.className = 'add-device-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: center;
  `;

  modal.innerHTML = `
    <div class="modal-content" style="
      background: #2d3748;
      border-radius: 8px;
      width: 90%;
      max-width: 600px;
      color: white;
      border: 1px solid #4a5568;
    ">
      <div class="modal-header" style="padding: 20px; border-bottom: 1px solid #4a5568; display: flex; justify-content: space-between; align-items: center;">
        <h2 style="margin: 0; color: #ffffff;"><i class="fas fa-plus"></i> Netzwerkgerät hinzufügen</h2>
        <button class="close-btn" style="background: none; border: none; color: #cbd5e0; font-size: 24px; cursor: pointer;">&times;</button>
      </div>
      <div class="modal-body" style="padding: 20px;">
        <div class="form-group" style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; color: #e2e8f0; font-weight: bold;">Gerätename:</label>
          <input type="text" id="device-name" class="form-control" placeholder="z.B. PC-001, Server-01" style="width: 100%; background: #1a202c; border: 1px solid #4a5568; color: white; padding: 10px;">
        </div>
        <div class="form-group" style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; color: #e2e8f0; font-weight: bold;">IP-Adresse / Hostname:</label>
          <input type="text" id="device-ip" class="form-control" placeholder="z.B. 192.168.1.100 oder pc001.local" style="width: 100%; background: #1a202c; border: 1px solid #4a5568; color: white; padding: 10px;">
        </div>
        <div class="form-group" style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; color: #e2e8f0; font-weight: bold;">Gerätetyp:</label>
          <select id="device-type" class="form-control" style="width: 100%; background: #1a202c; border: 1px solid #4a5568; color: white; padding: 10px;">
            <option value="pc">PC/Workstation</option>
            <option value="server">Server</option>
            <option value="printer">Drucker</option>
            <option value="router">Router</option>
            <option value="switch">Switch</option>
            <option value="other">Sonstiges</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; color: #e2e8f0; font-weight: bold;">Beschreibung (optional):</label>
          <textarea id="device-description" class="form-control" placeholder="Zusätzliche Informationen..." rows="3" style="width: 100%; background: #1a202c; border: 1px solid #4a5568; color: white; padding: 10px; resize: vertical;"></textarea>
        </div>
      </div>
      <div class="modal-footer" style="padding: 20px; border-top: 1px solid #4a5568; display: flex; justify-content: flex-end; gap: 10px;">
        <button class="cancel-btn btn btn-secondary" style="padding: 10px 20px; background: #718096; border: none; color: white; cursor: pointer; border-radius: 4px;">Abbrechen</button>
        <button class="save-btn btn btn-primary" style="padding: 10px 20px; background: #4299e1; border: none; color: white; cursor: pointer; border-radius: 4px;">Hinzufügen</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Event listeners for the modal
  const closeBtn = modal.querySelector('.close-btn');
  const cancelBtn = modal.querySelector('.cancel-btn');
  const saveBtn = modal.querySelector('.save-btn');
  const nameInput = modal.querySelector('#device-name');
  const ipInput = modal.querySelector('#device-ip');
  const typeSelect = modal.querySelector('#device-type');
  const descriptionInput = modal.querySelector('#device-description');

  const closeModal = () => {
    document.body.removeChild(modal);
  };

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  saveBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    const ip = ipInput.value.trim();
    const type = typeSelect.value;
    const description = descriptionInput.value.trim();

    if (!name || !ip) {
      alert('Bitte Gerätename und IP-Adresse eingeben!');
      return;
    }

    // Load existing devices
    let devices = JSON.parse(localStorage.getItem('network_devices') || '[]');
    
    // Create new device
    const newDevice = {
      id: ip, // Use IP as ID for simplicity
      name: name,
      ip: ip,
      type: type,
      description: description,
      is_online: null, // Will be determined by ping
      last_seen: null,
      created: new Date().toISOString(),
      network_path: `\\\\${ip}\\c$`
    };

    // Check if device already exists
    const existingDevice = devices.find(d => d.id === ip || d.ip === ip);
    if (existingDevice) {
      if (!confirm('Ein Gerät mit dieser IP-Adresse existiert bereits. Überschreiben?')) {
        return;
      }
      // Update existing device
      Object.assign(existingDevice, newDevice);
    } else {
      // Add new device
      devices.push(newDevice);
    }

    // Save devices
    localStorage.setItem('network_devices', JSON.stringify(devices));
    
    closeModal();
    alert('Gerät wurde hinzugefügt!');
    
    // Refresh devices table with force refresh
    loadNetworkDevices(true);
  });
}

// Export methods for global access
window.networkModule = {
  initNetworkModule,
  performPingTest,
  openNetworkPath,
  openRemoteSessionToDevice,
  openRemoteDesktop,
  openNetworkExplorer,
  openSharedDrives,
  showNetworkDiagnostics,
  closeModal
};