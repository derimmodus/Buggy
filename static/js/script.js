/* HelpTool Dashboard Controller */
(() => {
  'use strict';

  const TTL_FAST = 15 * 1000;
  const TTL_SLOW = 60 * 1000;

  const state = {
    content: null,
    overlay: null,
    notification: null,
    status: null,
    time: null,
    navButtons: [],
    activeModule: null,
    cache: new Map()
  };

  const helpers = {
    async fetchJson(url, options = {}) {
      const {
        ttl = TTL_FAST,
        cacheKey = url,
        bust = false,
        allowError = false
      } = options;

      if (!bust && state.cache.has(cacheKey)) {
        const entry = state.cache.get(cacheKey);
        if (Date.now() - entry.timestamp < entry.ttl) {
          return entry.value;
        }
      }

      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
          if (allowError) {
            return null;
          }
          throw new Error(`HTTP ${response.status} für ${url}`);
        }
        const data = await response.json();
        state.cache.set(cacheKey, { value: data, timestamp: Date.now(), ttl });
        return data;
      } catch (error) {
        if (allowError) {
          console.warn('Fehler beim Laden, ignoriere aufgrund allowError:', error);
          return null;
        }
        throw error;
      }
    },
    escapeHtml(value) {
      if (value == null) return '';
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },
    formatDate(value) {
      if (!value) return '';
      try {
        return new Intl.DateTimeFormat('de-DE', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }).format(new Date(value));
      } catch (error) {
        return value;
      }
    },
    formatDateTime(value) {
      if (!value) return '';
      try {
        return new Intl.DateTimeFormat('de-DE', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }).format(new Date(value));
      } catch (error) {
        return value;
      }
    },
    formatDateSpan(start, end) {
      if (!start) return 'Kein Datum angegeben';
      const startLabel = helpers.formatDateTime(start);
      if (!end) return startLabel;
      return `${startLabel} – ${helpers.formatDateTime(end)}`;
    },
    renderEmpty(title, message, icon = 'fa-circle-info') {
      return `
        <section class="empty-state">
          <div class="empty-icon"><i class="fas ${icon}"></i></div>
          <h2>${helpers.escapeHtml(title)}</h2>
          <p>${helpers.escapeHtml(message)}</p>
        </section>
      `;
    },
    notify(message, type = 'info') {
      if (!state.notification) return;
      const toast = document.createElement('div');
      toast.className = `notification ${type}`;
      toast.innerHTML = `
        <span>${helpers.escapeHtml(message)}</span>
        <button type="button" class="notification-close" aria-label="Schließen">
          <i class="fas fa-times"></i>
        </button>
      `;

      const close = () => {
        toast.classList.add('is-hiding');
        setTimeout(() => toast.remove(), 200);
      };

      toast.querySelector('.notification-close')?.addEventListener('click', close);
      state.notification.appendChild(toast);
      setTimeout(close, 5000);
    }
  };

  const MODULES = {
    tools: {
      icon: 'fa-toolbox',
      async render() {
        const tools = await helpers.fetchJson('/api/tools', { cacheKey: 'tools', ttl: TTL_FAST, allowError: true }) || [];
        if (!Array.isArray(tools) || tools.length === 0) {
          return helpers.renderEmpty('Keine Tools vorhanden', 'Fügen Sie Tools über das Backend hinzu.', 'fa-toolbox');
        }

  const normalizeType = tool => (tool?.type || '').toLowerCase();

        const applications = tools.filter(tool => {
          const type = normalizeType(tool);
          return type === 'executable' || type === 'application';
        });
        const networkPaths = tools.filter(tool => normalizeType(tool) === 'network');
        const links = tools.filter(tool => normalizeType(tool) === 'link');
        const handled = new Set([...applications, ...networkPaths, ...links].map(tool => tool.id));
        const others = tools.filter(tool => !handled.has(tool.id));

        const iconForType = type => {
          switch (type) {
            case 'network':
              return 'fa-network-wired';
            case 'link':
              return 'fa-link';
            case 'application':
            case 'executable':
              return 'fa-cogs';
            default:
              return 'fa-toolbox';
          }
        };

        const renderBadge = label => `<span class="badge badge-soft">${helpers.escapeHtml(label)}</span>`;

        const renderMeta = tool => {
          const parts = [];
          if (tool.tags?.length) {
            parts.push(`<p class="card-meta">${tool.tags.map(tag => `<span class="tag">${helpers.escapeHtml(tag)}</span>`).join('')}</p>`);
          }
          if (tool.created_at) {
            parts.push(`<p class="card-meta"><i class="fas fa-clock"></i> ${helpers.formatDate(tool.created_at)}</p>`);
          }
          if (tool.args) {
            parts.push(`<p class="card-meta"><i class="fas fa-terminal"></i> ${helpers.escapeHtml(tool.args)}</p>`);
          }
          return parts.join('');
        };

        const renderEmptyBlock = (title, message, icon) => `
          <div class="empty-state">
            <div class="empty-icon"><i class="fas ${icon}"></i></div>
            <h3>${helpers.escapeHtml(title)}</h3>
            <p>${helpers.escapeHtml(message)}</p>
          </div>
        `;

        const renderToolCards = (items, { icon, emptyTitle, emptyMessage, actionLabel, useShortcut = false }) => {
          if (!items.length) {
            return renderEmptyBlock(emptyTitle, emptyMessage, icon);
          }

          const cards = items.map(tool => {
            const badges = [];
            if (tool.favorite) badges.push(renderBadge('Favorit'));
            if (tool.autostart) badges.push(renderBadge('Autostart'));
            if (tool.admin) badges.push(renderBadge('Admin'));
            const description = tool.description ? `<p>${helpers.escapeHtml(tool.description)}</p>` : '';
            const path = tool.path ? `<p class="card-path"><i class="fas fa-location-arrow"></i> ${helpers.escapeHtml(tool.path)}</p>` : '';

            return `
              <article class="card tool-card" data-tool-id="${tool.id}">
                <header class="card-header">
                  <h3><i class="fas ${icon}"></i> ${helpers.escapeHtml(tool.name || tool.title || 'Tool')}</h3>
                  ${badges.join('')}
                </header>
                <div class="card-body">
                  ${description}
                  ${path}
                  ${renderMeta(tool)}
                </div>
                <footer class="card-footer">
                  <button class="btn btn-primary" data-action="start-tool" data-tool-id="${tool.id}" ${useShortcut ? 'data-use-shortcut="true"' : ''}>
                    <i class="fas fa-play"></i> ${helpers.escapeHtml(actionLabel)}
                  </button>
                </footer>
              </article>
            `;
          }).join('');

          return `<div class="card-grid">${cards}</div>`;
        };

        const sections = [];

        sections.push(`
          <section class="module-section">
            <header class="section-header">
              <h2><i class="fas fa-cogs"></i> Anwendungen</h2>
            </header>
            ${renderToolCards(applications, {
              icon: 'fa-cogs',
              emptyTitle: 'Keine Anwendungen',
              emptyMessage: 'Fügen Sie Anwendungen hinzu, um sie hier anzuzeigen.',
              actionLabel: 'Starten'
            })}
          </section>
        `);

        sections.push(`
          <section class="module-section">
            <header class="section-header">
              <h2><i class="fas fa-network-wired"></i> Netzwerkpfade</h2>
            </header>
            ${renderToolCards(networkPaths, {
              icon: 'fa-network-wired',
              emptyTitle: 'Keine Netzwerkpfade',
              emptyMessage: 'Pflegen Sie Netzwerkpfade im Backend.',
              actionLabel: 'Öffnen',
              useShortcut: true
            })}
          </section>
        `);

        sections.push(`
          <section class="module-section">
            <header class="section-header">
              <h2><i class="fas fa-link"></i> Links</h2>
            </header>
            ${renderToolCards(links, {
              icon: 'fa-link',
              emptyTitle: 'Keine Links',
              emptyMessage: 'Pflegen Sie Links im Backend.',
              actionLabel: 'Öffnen',
              useShortcut: true
            })}
          </section>
        `);

        if (others.length) {
          sections.push(`
            <section class="module-section">
              <header class="section-header">
                <h2><i class="fas fa-toolbox"></i> Weitere Tools</h2>
              </header>
              ${renderToolCards(others, {
                icon: 'fa-toolbox',
                emptyTitle: 'Keine weiteren Tools',
                emptyMessage: '',
                actionLabel: 'Starten'
              })}
            </section>
          `);
        }

        return {
          html: sections.join(''),
          onMount(root) {
            root.querySelectorAll('[data-action="start-tool"]').forEach(button => {
              button.addEventListener('click', async () => {
                const id = Number(button.dataset.toolId);
                if (!id || button.disabled) return;
                button.disabled = true;
                try {
                  const payload = { id };
                  if (button.dataset.useShortcut === 'true') {
                    payload.use_shortcut = true;
                  }
                  const response = await fetch('/api/start-tool', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                  });
                  const data = await response.json().catch(() => ({}));
                  if (response.ok && data?.success !== false) {
                    helpers.notify(data.message || 'Tool gestartet.', 'success');
                  } else {
                    helpers.notify(data.error || data.message || 'Tool konnte nicht gestartet werden.', 'error');
                  }
                } catch (error) {
                  helpers.notify('Verbindung zum Backend fehlgeschlagen.', 'error');
                } finally {
                  button.disabled = false;
                }
              });
            });
          }
        };
      }
    },
    tickets: {
      icon: 'fa-ticket-alt',
      async render() {
        const rawTickets = await helpers.fetchJson('/api/tickets', { cacheKey: 'tickets', ttl: TTL_FAST, allowError: true }) || [];

        const statusOptions = [
          { value: 'open', label: 'Offen' },
          { value: 'in-progress', label: 'In Bearbeitung' },
          { value: 'waiting', label: 'Wartend' },
          { value: 'resolved', label: 'Gelöst' },
          { value: 'closed', label: 'Geschlossen' }
        ];

        const priorityOptions = [
          { value: 'high', label: 'Hoch' },
          { value: 'medium', label: 'Mittel' },
          { value: 'low', label: 'Niedrig' }
        ];

        const statusLookup = new Map(statusOptions.map(option => [option.value, option.label]));
        const priorityLookup = new Map(priorityOptions.map(option => [option.value, option.label]));

        const todayKey = new Date().toISOString().split('T')[0];

        const normalizeStatus = value => {
          const normalized = (value || '').toString().trim().toLowerCase().replace(/[_\s-]+/g, '');
          if (!normalized) return 'open';
          if (['offen', 'open'].includes(normalized)) return 'open';
          if (['inbearbeitung', 'inprogress', 'bearbeitung', 'laufend'].includes(normalized)) return 'in-progress';
          if (['wartend', 'waiting', 'pending', 'wartezeit'].includes(normalized)) return 'waiting';
          if (['geloest', 'gelost', 'resolved', 'erledigt'].includes(normalized)) return 'resolved';
          if (['geschlossen', 'closed', 'zu'].includes(normalized)) return 'closed';
          return 'open';
        };

        const normalizePriority = value => {
          const normalized = (value || '').toString().trim().toLowerCase();
          if (!normalized) return '';
          if (['hoch', 'high'].includes(normalized)) return 'high';
          if (['mittel', 'medium', 'normal'].includes(normalized)) return 'medium';
          if (['niedrig', 'low'].includes(normalized)) return 'low';
          return '';
        };

        const sanitizeDescription = value => {
          if (!value) return '';
          let working = value.replace(/<\s*br\s*\/?>/gi, '\n');
          working = working.replace(/<\/?div[^>]*>/gi, '\n');
          working = working.replace(/<\/?p[^>]*>/gi, '\n');
          const escaped = helpers.escapeHtml(working);
          return escaped.replace(/\n+/g, '<br />').trim();
        };

        const formatTime = value => {
          if (!value) return 'Unbekannt';
          try {
            return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
          } catch (error) {
            return 'Unbekannt';
          }
        };

        const toDateKey = value => {
          if (!value) return todayKey;
          const date = new Date(value);
          if (Number.isNaN(date.getTime())) {
            return todayKey;
          }
          return date.toISOString().split('T')[0];
        };

        const formatDateLabel = key => {
          if (!key) return 'Unbekannt';
          if (key === todayKey) return 'Heute';
          try {
            return helpers.formatDate(key);
          } catch (error) {
            return key;
          }
        };

        const normalizedTickets = rawTickets
          .map((ticket, index) => {
            if (!ticket) return null;
            const id = typeof ticket.id === 'number' ? ticket.id : Number(ticket.id) || index + 1;
            const createdAt = ticket.created_at || ticket.created || ticket.createdAt || ticket.date || new Date().toISOString();
            const dateKey = toDateKey(createdAt);
            const statusKey = normalizeStatus(ticket.status || ticket.state || ticket.statusLabel);
            const priorityKey = normalizePriority(ticket.priority || ticket.priorityLabel);
            const title = ticket.title || ticket.headerText || `Ticket ${id}`;
            const rawDescription = ticket.description || ticket.details || '';
            return {
              id,
              ticketNumber: ticket.ticketNumber || id,
              title,
              statusKey,
              statusLabel: statusLookup.get(statusKey) || ticket.status || ticket.state || 'Offen',
              priorityKey,
              priorityLabel: priorityKey ? priorityLookup.get(priorityKey) || ticket.priority : ticket.priority || '',
              assignedTo: ticket.assignedTo || ticket.assigned || ticket.owner || '',
              phone: ticket.phone || ticket.contact_phone || '',
              pkz: ticket.pkz || ticket.contact_pkz || '',
              createdAt,
              dateKey,
              timeLabel: formatTime(createdAt),
              descriptionRaw: rawDescription,
              descriptionHtml: sanitizeDescription(rawDescription),
              original: ticket
            };
          })
          .filter(Boolean);

  const todaysTickets = normalizedTickets.filter(ticket => ticket.dateKey === todayKey);

        const renderTicketItem = (ticket) => `
          <div class="ticket-item" data-ticket-id="${ticket.id}">
            <div class="ticket-header">
              <div class="ticket-number"><span class="ticket-number-badge">#${helpers.escapeHtml(ticket.ticketNumber)}</span></div>
              <div class="ticket-title-section">
                <span class="ticket-title editable" contenteditable="true" data-field="title" data-ticket-id="${ticket.id}">${helpers.escapeHtml(ticket.title)}</span>
                <span class="ticket-status status-${helpers.escapeHtml(ticket.statusKey)}">${helpers.escapeHtml(ticket.statusLabel)}</span>
              </div>
              <div class="ticket-actions">
                <button class="btn-icon ticket-toggle" data-ticket-id="${ticket.id}" aria-expanded="true" title="Ticketdetails einklappen"><i class="fas fa-chevron-down"></i></button>
                <button class="btn-icon delete-ticket" data-ticket-id="${ticket.id}" title="Ticket löschen"><i class="fas fa-trash"></i></button>
              </div>
            </div>
            <div class="ticket-body">
              <div class="ticket-meta">
                <span class="ticket-extra"><i class="fas fa-clock"></i> ${helpers.escapeHtml(ticket.timeLabel)}</span>
                ${ticket.priorityKey ? `<span class="ticket-priority priority-${helpers.escapeHtml(ticket.priorityKey)}">${helpers.escapeHtml(ticket.priorityLabel)}</span>` : ''}
                <span class="ticket-extra"><i class="fas fa-phone"></i> <span class="editable" contenteditable="true" data-field="phone" data-ticket-id="${ticket.id}">${helpers.escapeHtml(ticket.phone || '')}</span></span>
                <span class="ticket-extra"><i class="fas fa-id-card"></i> <span class="editable" contenteditable="true" data-field="pkz" data-ticket-id="${ticket.id}">${helpers.escapeHtml(ticket.pkz || '')}</span></span>
              </div>
              <div class="ticket-inline-controls">
                <label class="inline-label" for="ticket-status-${ticket.id}"><i class="fas fa-toggle-on"></i> Status</label>
                <select id="ticket-status-${ticket.id}" class="input input-sm ticket-inline-status" data-ticket-id="${ticket.id}">
                  ${statusOptions.map(o => `<option value="${o.value}" ${o.value === ticket.statusKey ? 'selected' : ''}>${o.label}</option>`).join('')}
                </select>
                <label class="inline-label" for="ticket-priority-${ticket.id}"><i class="fas fa-flag"></i> Priorität</label>
                <select id="ticket-priority-${ticket.id}" class="input input-sm ticket-inline-priority" data-ticket-id="${ticket.id}">
                  <option value="">Keine</option>
                  ${priorityOptions.map(o => `<option value="${o.value}" ${o.value === (ticket.priorityKey || '') ? 'selected' : ''}>${o.label}</option>`).join('')}
                </select>
              </div>
              <div class="ticket-description editable" contenteditable="true" data-field="description" data-ticket-id="${ticket.id}">${helpers.escapeHtml(ticket.descriptionRaw || '')}</div>
              <div class="ticket-assigned"><i class="fas fa-user-circle"></i> <span class="editable" contenteditable="true" data-field="assignedTo" data-ticket-id="${ticket.id}">${helpers.escapeHtml(ticket.assignedTo || '')}</span></div>
            </div>
          </div>
        `;

        const ticketGroupsHtml = (() => {
          const ticketsForDay = todaysTickets.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
          if (!ticketsForDay.length) {
            return `
              <div class="empty-state">
                <div class="empty-icon"><i class="fas fa-ticket-alt"></i></div>
                <h3>Keine Tickets</h3>
                <p>Erstellen Sie ein Ticket, um Supportfälle zu verfolgen.</p>
              </div>
            `;
          }
          const items = ticketsForDay.map(renderTicketItem).join('');
          const dateLabel = helpers.escapeHtml(formatDateLabel(todayKey));
          return `
            <div class="ticket-date-group">
              <div class="ticket-date-header today">
                <div class="ticket-date-title">
                  <h3><i class="fas fa-calendar-day"></i> Tagesticket</h3>
                  <span class="ticket-date-label">${dateLabel}</span>
                </div>
                <span class="ticket-count">${ticketsForDay.length} Ticket${ticketsForDay.length === 1 ? '' : 's'}</span>
              </div>
              <div class="tickets-list">${items}</div>
            </div>
          `;
        })();

        const archiveNotice = '';

        const html = `
          <section class="module-section tickets-module">
            <header class="section-header">
              <div>
                <h2><i class="fas fa-ticket-alt"></i> Tickets</h2>
                <div class="section-subtitle">Tagesticket</div>
              </div>
              <div class="section-actions">
                <button id="refresh-tickets-btn" class="btn btn-secondary"><i class="fas fa-sync-alt"></i> Aktualisieren</button>
                <button id="add-ticket-btn" class="btn btn-primary"><i class="fas fa-plus"></i> Neues Ticket</button>
              </div>
            </header>
            <div class="tickets-wrapper">
              ${ticketGroupsHtml}
            </div>
            ${archiveNotice}
          </section>
        `;

        return {
          html,
          onMount(root) {
            const ticketMap = new Map(todaysTickets.filter(ticket => ticket?.id != null).map(ticket => [String(ticket.id), ticket]));

            // Archivansicht entfernt, da Tagesticket immer aktuelles Datum hat

            const createModal = ({ title, content, actions = [], size = 'default' }) => {
              const backdrop = document.createElement('div');
              backdrop.className = 'modal-backdrop';

              const panel = document.createElement('div');
              panel.className = `modal-panel${size === 'large' ? ' large' : ''}`;
              panel.innerHTML = `
                <div class="modal-head">
                  <h3>${title}</h3>
                  <button type="button" class="modal-close" aria-label="Schließen"><i class="fas fa-times"></i></button>
                </div>
                <div class="modal-body">${content}</div>
                <div class="modal-footer"></div>
              `;

              backdrop.appendChild(panel);
              document.body.appendChild(backdrop);
              document.body.classList.add('no-scroll');

              const close = () => {
                document.body.classList.remove('no-scroll');
                backdrop.remove();
              };

              backdrop.addEventListener('click', event => {
                if (event.target === backdrop) close();
              });

              panel.querySelector('.modal-close')?.addEventListener('click', close);

              const footer = panel.querySelector('.modal-footer');
              actions.forEach(action => {
                const button = document.createElement('button');
                button.type = action.type || 'button';
                button.className = action.className || 'btn btn-secondary';
                button.innerHTML = action.label;
                button.addEventListener('click', event => {
                  action.onClick?.(event, { close, panel, backdrop });
                });
                footer.appendChild(button);
              });

              return { close, panel };
            };

            const openTicketView = ticket => {
              createModal({
                title: `Ticket #${helpers.escapeHtml(ticket.ticketNumber)}`,
                size: 'large',
                content: `
                  <div class="modal-columns">
                    <div><strong>Status</strong><br />${helpers.escapeHtml(ticket.statusLabel)}</div>
                    <div><strong>Priorität</strong><br />${helpers.escapeHtml(ticket.priorityLabel || 'Keine')}</div>
                    <div><strong>Erstellt</strong><br />${helpers.escapeHtml(helpers.formatDateTime(ticket.createdAt))}</div>
                    ${ticket.assignedTo ? `<div><strong>Zugewiesen an</strong><br />${helpers.escapeHtml(ticket.assignedTo)}</div>` : ''}
                    ${ticket.phone ? `<div><strong>Telefon</strong><br />${helpers.escapeHtml(ticket.phone)}</div>` : ''}
                    ${ticket.pkz ? `<div><strong>PKZ</strong><br />${helpers.escapeHtml(ticket.pkz)}</div>` : ''}
                  </div>
                  <div>
                    <h4>Beschreibung</h4>
                    <p class="ticket-description">${ticket.descriptionHtml || '<em>Keine Beschreibung vorhanden.</em>'}</p>
                  </div>
                `,
                actions: [
                  { label: '<i class="fas fa-times"></i> Schließen', className: 'btn btn-secondary', onClick: (_, ctx) => ctx.close() }
                ]
              });
            };

            const openTicketForm = (mode, ticket) => {
              const isEdit = mode === 'edit';
              const initial = isEdit && ticket ? ticket : {
                title: '',
                statusKey: 'open',
                priorityKey: '',
                assignedTo: '',
                phone: '',
                pkz: '',
                descriptionRaw: ''
              };

              const formId = `ticket-form-${Date.now()}`;
              const formHtml = `
                <form id="${formId}" class="form-grid">
                  <div class="form-row">
                    <label for="${formId}-title">Titel</label>
                    <input id="${formId}-title" name="title" class="input" type="text" value="${helpers.escapeHtml(initial.title)}" required />
                  </div>
                  <div class="form-row">
                    <label for="${formId}-status">Status</label>
                    <select id="${formId}-status" name="status" class="input">
                      ${statusOptions.map(option => `<option value="${option.value}" ${option.value === (initial.statusKey || 'open') ? 'selected' : ''}>${option.label}</option>`).join('')}
                    </select>
                  </div>
                  <div class="form-row">
                    <label for="${formId}-priority">Priorität</label>
                    <select id="${formId}-priority" name="priority" class="input">
                      <option value="">Keine Priorität</option>
                      ${priorityOptions.map(option => `<option value="${option.value}" ${option.value === (initial.priorityKey || '') ? 'selected' : ''}>${option.label}</option>`).join('')}
                    </select>
                  </div>
                  <div class="form-row">
                    <label for="${formId}-assigned">Zugewiesen an</label>
                    <input id="${formId}-assigned" name="assigned" class="input" type="text" value="${helpers.escapeHtml(initial.assignedTo || '')}" />
                  </div>
                  <div class="form-row">
                    <label for="${formId}-phone">Telefon</label>
                    <input id="${formId}-phone" name="phone" class="input" type="text" value="${helpers.escapeHtml(initial.phone || '')}" />
                  </div>
                  <div class="form-row">
                    <label for="${formId}-pkz">PKZ / Kennung</label>
                    <input id="${formId}-pkz" name="pkz" class="input" type="text" value="${helpers.escapeHtml(initial.pkz || '')}" />
                  </div>
                  <div class="form-row">
                    <label for="${formId}-description">Beschreibung</label>
                    <textarea id="${formId}-description" name="description">${helpers.escapeHtml(initial.descriptionRaw || '')}</textarea>
                  </div>
                </form>
              `;

              const modal = createModal({
                title: isEdit ? 'Ticket bearbeiten' : 'Neues Ticket',
                size: 'large',
                content: formHtml,
                actions: [
                  { label: '<i class="fas fa-times"></i> Abbrechen', className: 'btn btn-secondary', onClick: (_, ctx) => ctx.close() },
                  { label: `<i class="fas fa-save"></i> ${isEdit ? 'Speichern' : 'Erstellen'}`, className: 'btn btn-primary', onClick: () => document.getElementById(formId)?.requestSubmit() }
                ]
              });

              const form = modal.panel.querySelector('form');
              form?.addEventListener('submit', async event => {
                event.preventDefault();
                const formData = new FormData(form);

                const statusValue = formData.get('status')?.toString() || 'open';
                const priorityValue = formData.get('priority')?.toString() || '';

                const payload = {
                  title: (formData.get('title') || '').toString().trim(),
                  description: (formData.get('description') || '').toString().trim(),
                  status: statusLookup.get(statusValue) || statusValue,
                  priority: priorityValue ? (priorityLookup.get(priorityValue) || priorityValue) : '',
                  assignedTo: (formData.get('assigned') || '').toString().trim(),
                  phone: (formData.get('phone') || '').toString().trim(),
                  pkz: (formData.get('pkz') || '').toString().trim(),
                  created_at: isEdit && ticket ? ticket.createdAt : new Date().toISOString()
                };

                if (!payload.title) {
                  helpers.notify('Bitte geben Sie einen Titel ein.', 'warning');
                  return;
                }

                const url = isEdit && ticket ? `/api/tickets/${ticket.id}` : '/api/tickets';
                const method = isEdit ? 'PUT' : 'POST';

                try {
                  const response = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                  });

                  if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    throw new Error(data.error || data.message || 'Ticket konnte nicht gespeichert werden.');
                  }

                  state.cache.delete('tickets');
                  modal.close();
                  helpers.notify(isEdit ? 'Ticket aktualisiert.' : 'Ticket erstellt.', 'success');
                  loadModule('tickets');
                } catch (error) {
                  helpers.notify(error.message || 'Unbekannter Fehler beim Speichern.', 'error');
                }
              });
            };

            root.querySelectorAll('.ticket-toggle').forEach(button => {
              const item = button.closest('.ticket-item');
              if (!item) return;
              button.addEventListener('click', () => {
                const collapsed = item.classList.toggle('collapsed');
                button.setAttribute('aria-expanded', (!collapsed).toString());
                button.classList.toggle('is-expanded', !collapsed);
              });
            });

            root.querySelector('#add-ticket-btn')?.addEventListener('click', () => openTicketForm('create'));

            root.querySelector('#refresh-tickets-btn')?.addEventListener('click', () => {
              state.cache.delete('tickets');
              loadModule('tickets');
            });

            // Keine Archiv-Interaktion

            // Inline editing handlers (title, description, assignedTo, phone, pkz)
            const sanitizePlain = (val) => {
              const tmp = document.createElement('div');
              tmp.innerHTML = val || '';
              const text = tmp.textContent || tmp.innerText || '';
              return text.replace(/\u00A0/g, ' ').trim();
            };

            const commitInline = async (el) => {
              const field = el.dataset.field;
              const ticketId = el.dataset.ticketId;
              if (!field || !ticketId) return;
              const newValue = sanitizePlain(el.innerHTML);
              const ticket = ticketMap.get(String(ticketId));
              if (!ticket) return;

              // Determine if change is needed
              const current = (field === 'description') ? (ticket.descriptionRaw || '') : (ticket[field] || '');
              if (newValue === current) return;

              const changes = {};
              if (field === 'assignedTo') changes.assignedTo = newValue;
              else if (field === 'phone') changes.phone = newValue;
              else if (field === 'pkz') changes.pkz = newValue;
              else if (field === 'title') changes.title = newValue;
              else if (field === 'description') changes.description = newValue;

              const ok = await updateTicketInline(ticketId, changes);
              if (!ok) {
                // revert
                el.textContent = current;
                return;
              }
              // update local map values for immediate UI consistency
              Object.assign(ticket, {
                assignedTo: changes.assignedTo ?? ticket.assignedTo,
                phone: changes.phone ?? ticket.phone,
                pkz: changes.pkz ?? ticket.pkz,
                title: changes.title ?? ticket.title,
                descriptionRaw: changes.description ?? ticket.descriptionRaw,
                descriptionHtml: changes.description ? helpers.escapeHtml(changes.description).replace(/\n/g, '<br />') : ticket.descriptionHtml
              });
            };

            root.querySelectorAll('.editable[contenteditable][data-field]').forEach(el => {
              const isMultiline = el.dataset.field === 'description';
              el.addEventListener('keydown', (e) => {
                if (!isMultiline && e.key === 'Enter') {
                  e.preventDefault();
                  el.blur();
                }
              });
              el.addEventListener('blur', () => commitInline(el));
            });

            // Inline Status/Prio Änderungen
            const updateTicketInline = async (ticketId, changes) => {
              const ticket = ticketMap.get(String(ticketId));
              if (!ticket) return false;
              const payload = {
                title: ticket.title,
                description: ticket.descriptionRaw || '',
                status: changes.statusLabel ?? ticket.statusLabel,
                priority: changes.priorityLabel ?? ticket.priorityLabel ?? '',
                assignedTo: ticket.assignedTo || '',
                phone: ticket.phone || '',
                pkz: ticket.pkz || '',
                created_at: ticket.createdAt
              };

              try {
                const res = await fetch(`/api/tickets/${ticket.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error('Aktualisierung fehlgeschlagen');
                // Update local map for immediate feedback
                if (changes.statusKey) {
                  ticket.statusKey = changes.statusKey;
                  ticket.statusLabel = changes.statusLabel || ticket.statusLabel;
                }
                if (changes.priorityKey !== undefined) {
                  ticket.priorityKey = changes.priorityKey || '';
                  ticket.priorityLabel = changes.priorityLabel || '';
                }
                return true;
              } catch (e) {
                helpers.notify(e.message || 'Aktualisierung fehlgeschlagen', 'error');
                return false;
              }
            };

            // Status ändern
            root.querySelectorAll('.ticket-inline-status').forEach(sel => {
              sel.addEventListener('change', async () => {
                const ticketId = sel.dataset.ticketId;
                const statusKey = sel.value;
                const statusLabel = statusLookup.get(statusKey) || statusKey;
                const ok = await updateTicketInline(ticketId, { statusKey, statusLabel });
                if (!ok) {
                  // revert
                  const ticket = ticketMap.get(String(ticketId));
                  sel.value = ticket?.statusKey || 'open';
                  return;
                }
                // Update badge
                const item = root.querySelector(`.ticket-item[data-ticket-id="${ticketId}"]`);
                const badge = item?.querySelector('.ticket-status');
                if (badge) {
                  badge.className = `ticket-status status-${statusKey}`;
                  badge.textContent = statusLabel;
                }
              });
            });

            // Priorität ändern
            root.querySelectorAll('.ticket-inline-priority').forEach(sel => {
              sel.addEventListener('change', async () => {
                const ticketId = sel.dataset.ticketId;
                const priorityKey = sel.value || '';
                const priorityLabel = priorityKey ? (priorityLookup.get(priorityKey) || priorityKey) : '';
                const ok = await updateTicketInline(ticketId, { priorityKey, priorityLabel });
                if (!ok) {
                  const ticket = ticketMap.get(String(ticketId));
                  sel.value = ticket?.priorityKey || '';
                  return;
                }
                // Update pill (create if missing)
                const item = root.querySelector(`.ticket-item[data-ticket-id="${ticketId}"]`);
                let pill = item?.querySelector('.ticket-priority');
                if (priorityKey) {
                  if (!pill && item) {
                    const meta = item.querySelector('.ticket-meta');
                    pill = document.createElement('span');
                    pill.className = 'ticket-priority';
                    meta?.appendChild(pill);
                  }
                  if (pill) {
                    pill.className = `ticket-priority priority-${priorityKey}`;
                    pill.textContent = priorityLabel;
                  }
                } else if (pill) {
                  pill.remove();
                }
              });
            });

            root.querySelectorAll('.delete-ticket').forEach(button => {
              button.addEventListener('click', async () => {
                const ticket = ticketMap.get(button.dataset.ticketId || '');
                if (!ticket) return;
                if (!window.confirm(`Ticket "${ticket.title}" wirklich löschen?`)) return;

                try {
                  const response = await fetch(`/api/tickets/${ticket.id}`, { method: 'DELETE' });
                  if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    throw new Error(data.error || data.message || 'Ticket konnte nicht gelöscht werden.');
                  }
                  state.cache.delete('tickets');
                  helpers.notify('Ticket gelöscht.', 'success');
                  loadModule('tickets');
                } catch (error) {
                  helpers.notify(error.message || 'Unbekannter Fehler beim Löschen.', 'error');
                }
              });
            });
          }
        };
      }
    },
    contacts: {
      icon: 'fa-address-book',
      async render() {
        const contacts = await helpers.fetchJson('/api/telefonbuch', { cacheKey: 'contacts', ttl: TTL_SLOW });
        if (!Array.isArray(contacts) || contacts.length === 0) {
          return helpers.renderEmpty('Keine Kontakte vorhanden', 'Pflegen Sie Kontakte im Telefonbuch.', 'fa-address-book');
        }

        contacts.sort((a, b) => {
          const nameA = `${a.last_name || ''} ${a.first_name || ''}`.toLowerCase();
          const nameB = `${b.last_name || ''} ${b.first_name || ''}`.toLowerCase();
          return nameA.localeCompare(nameB);
        });

        const departments = [...new Set(contacts.map(contact => contact.department).filter(Boolean))].sort();
        const items = contacts.map(contact => `
          <li class="contact-row" data-name="${helpers.escapeHtml(`${contact.first_name || ''} ${contact.last_name || ''}`)}" data-department="${helpers.escapeHtml(contact.department || '')}">
            <span class="contact-name"><i class="fas fa-user-circle"></i> ${helpers.escapeHtml(contact.first_name || '')} ${helpers.escapeHtml(contact.last_name || '')}</span>
            <span class="contact-meta">
              ${contact.phone ? `<span><i class="fas fa-phone"></i> ${helpers.escapeHtml(contact.phone)}</span>` : ''}
              ${contact.mobile ? `<span><i class="fas fa-mobile-alt"></i> ${helpers.escapeHtml(contact.mobile)}</span>` : ''}
              ${contact.email ? `<span><i class="fas fa-envelope"></i> ${helpers.escapeHtml(contact.email)}</span>` : ''}
              ${contact.department ? `<span class="badge badge-soft">${helpers.escapeHtml(contact.department)}</span>` : ''}
            </span>
          </li>
        `).join('');

        return {
          html: `
            <section class="module-section">
              <header class="section-header">
                <h2><i class="fas fa-address-book"></i> Telefonbuch</h2>
              </header>
              <div class="toolbar">
                <input id="contact-search" type="search" class="input" placeholder="Suchen…" autocomplete="off" />
                <select id="contact-department" class="input">
                  <option value="">Alle Abteilungen</option>
                  ${departments.map(dep => `<option value="${helpers.escapeHtml(dep)}">${helpers.escapeHtml(dep)}</option>`).join('')}
                </select>
              </div>
              <ul class="contact-list">${items}</ul>
            </section>
          `,
          onMount(root) {
            const search = root.querySelector('#contact-search');
            const select = root.querySelector('#contact-department');
            const rows = Array.from(root.querySelectorAll('.contact-row'));

            const apply = () => {
              const term = (search?.value || '').toLowerCase();
              const department = select?.value || '';
              let visible = 0;
              rows.forEach(row => {
                const matchesTerm = row.dataset.name?.toLowerCase().includes(term) ?? false;
                const matchesDepartment = !department || row.dataset.department === department;
                const show = matchesTerm && matchesDepartment;
                row.classList.toggle('is-hidden', !show);
                if (show) visible += 1;
              });
              root.querySelector('.toolbar')?.setAttribute('data-count', `${visible} Kontakt${visible === 1 ? '' : 'e'}`);
            };

            search?.addEventListener('input', apply);
            select?.addEventListener('change', apply);
            apply();
          }
        };
      }
    },
    network: {
      icon: 'fa-network-wired',
      async render() {
        const [settings, devices, printers] = await Promise.all([
          helpers.fetchJson('/api/network/settings', { cacheKey: 'network-settings', ttl: TTL_SLOW, allowError: true }),
          helpers.fetchJson('/api/network/devices', { cacheKey: 'network-devices', ttl: TTL_FAST, allowError: true }),
          helpers.fetchJson('/api/printers', { cacheKey: 'printers', ttl: TTL_SLOW, allowError: true })
        ]);

        const sections = [];

        if (Array.isArray(settings) && settings.length) {
          sections.push(`
            <section class="module-section">
              <header class="section-header">
                <h2><i class="fas fa-sliders-h"></i> Netzwerkeinstellungen</h2>
              </header>
              <dl class="definition-list">
                ${settings.map(entry => `
                  <div class="definition-item">
                    <dt>${helpers.escapeHtml(entry.name || entry.key || 'Eintrag')}</dt>
                    <dd>${helpers.escapeHtml(entry.value || entry.description || '')}</dd>
                  </div>
                `).join('')}
              </dl>
            </section>
          `);
        }

        if (Array.isArray(devices) && devices.length) {
          sections.push(`
            <section class="module-section">
              <header class="section-header">
                <h2><i class="fas fa-server"></i> Netzwerkgeräte</h2>
              </header>
              <div class="table-responsive">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>IP</th>
                      <th>Standort</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${devices.map(device => `
                      <tr>
                        <td>${helpers.escapeHtml(device.name || 'Unbekannt')}</td>
                        <td>${helpers.escapeHtml(device.ip || '-')}</td>
                        <td>${helpers.escapeHtml(device.location || '-')}</td>
                        <td><span class="badge ${device.status === 'online' ? 'badge-success' : 'badge-soft'}">${helpers.escapeHtml(device.status || 'unbekannt')}</span></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </section>
          `);
        }

        if (Array.isArray(printers) && printers.length) {
          sections.push(`
            <section class="module-section">
              <header class="section-header">
                <h2><i class="fas fa-print"></i> Drucker</h2>
              </header>
              <div class="card-grid compact">
                ${printers.map(printer => `
                  <article class="card printer-card">
                    <header class="card-header">
                      <h3>${helpers.escapeHtml(printer.name || 'Drucker')}</h3>
                    </header>
                    <div class="card-body">
                      ${printer.ip ? `<p><i class="fas fa-network-wired"></i> ${helpers.escapeHtml(printer.ip)}</p>` : ''}
                      ${printer.path ? `<p><i class="fas fa-folder-open"></i> ${helpers.escapeHtml(printer.path)}</p>` : ''}
                      ${printer.notes ? `<p>${helpers.escapeHtml(printer.notes)}</p>` : ''}
                    </div>
                  </article>
                `).join('')}
              </div>
            </section>
          `);
        }

        if (sections.length === 0) {
          return helpers.renderEmpty('Keine Netzwerkdaten verfügbar', 'Es wurden keine Netzwerkressourcen gefunden.', 'fa-network-wired');
        }

        return sections.join('');
      }
    },
    calendar: {
      icon: 'fa-calendar-alt',
      async render() {
        const events = await helpers.fetchJson('/api/termine', { cacheKey: 'events', ttl: TTL_FAST, allowError: true });
        if (!Array.isArray(events) || events.length === 0) {
          return helpers.renderEmpty('Keine Termine', 'Es liegen derzeit keine Termine vor oder die Kalender-API ist nicht aktiv.', 'fa-calendar-alt');
        }

        events.sort((a, b) => new Date(a.start || a.date || 0) - new Date(b.start || b.date || 0));
        const list = events.map(event => `
          <li class="event-item">
            <h3>${helpers.escapeHtml(event.title || event.name || 'Termin')}</h3>
            <p>${helpers.formatDateSpan(event.start || event.date, event.end)}</p>
            ${event.contact ? `<p><i class="fas fa-user"></i> ${helpers.escapeHtml(event.contact)}</p>` : ''}
          </li>
        `).join('');

        return `
          <section class="module-section">
            <header class="section-header">
              <h2><i class="fas fa-calendar-alt"></i> Termine</h2>
            </header>
            <ul class="event-timeline">${list}</ul>
          </section>
        `;
      }
    },
    faq: {
      icon: 'fa-question-circle',
      async render() {
        const faq = await helpers.fetchJson('/api/faq', { cacheKey: 'faq', ttl: TTL_SLOW });
        if (!Array.isArray(faq) || faq.length === 0) {
          return helpers.renderEmpty('Keine FAQ-Einträge', 'Hinterlegen Sie häufige Fragen im Backend.', 'fa-question-circle');
        }

        const items = faq.map(entry => `
          <article class="faq-item">
            <details>
              <summary><i class="fas fa-chevron-right"></i> ${helpers.escapeHtml(entry.question || 'Frage')}</summary>
              <div class="faq-answer">
                <p>${helpers.escapeHtml(entry.answer || 'Keine Antwort hinterlegt.')}</p>
                ${entry.tags?.length ? `<div class="tag-cloud">${entry.tags.map(tag => `<span class="tag">${helpers.escapeHtml(tag)}</span>`).join('')}</div>` : ''}
              </div>
            </details>
          </article>
        `).join('');

        return `
          <section class="module-section">
            <header class="section-header">
              <h2><i class="fas fa-question-circle"></i> FAQ</h2>
            </header>
            <div class="faq-list">${items}</div>
          </section>
        `;
      }
    }
  };

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    state.content = document.getElementById('module-content');
    state.overlay = document.getElementById('loading-overlay');
    state.notification = document.getElementById('notification-container');
    state.status = document.getElementById('connection-status');
    state.time = document.getElementById('current-time');

    if (!state.content) {
      console.error('Kein Container für Modulinhalt gefunden.');
      return;
    }

    setupNavigation();
    updateClock();
    setInterval(updateClock, 30 * 1000);
    checkBackend();
    setInterval(checkBackend, 20 * 1000);

    const initialModule = document.querySelector('.nav-tab.active')?.dataset.module || 'tools';
    loadModule(initialModule);
  }

  function setupNavigation() {
    state.navButtons = Array.from(document.querySelectorAll('.nav-tab'));
    state.navButtons.forEach(button => {
      button.addEventListener('click', () => {
        const moduleKey = button.dataset.module;
        if (!moduleKey || moduleKey === state.activeModule) return;
        loadModule(moduleKey);
      });
    });
  }

  async function loadModule(moduleKey) {
    const module = MODULES[moduleKey];
    if (!module) {
      state.content.innerHTML = helpers.renderEmpty('Modul nicht gefunden', 'Dieses Modul ist nicht verfügbar.', 'fa-exclamation-triangle');
      return;
    }

    state.activeModule = moduleKey;
    updateActiveNavigation();
    toggleOverlay(true);

    try {
      const result = await module.render();
      if (typeof result === 'string') {
        state.content.innerHTML = result;
      } else {
        state.content.innerHTML = result.html || helpers.renderEmpty('Keine Daten', 'Dieses Modul hat keine Inhalte geliefert.', module.icon);
        result.onMount?.(state.content);
      }
    } catch (error) {
      console.error(`Fehler beim Laden des Moduls ${moduleKey}:`, error);
      state.content.innerHTML = `
        <section class="error-state">
          <div class="error-icon"><i class="fas fa-exclamation-triangle"></i></div>
          <h2>Fehler beim Laden</h2>
          <p>${helpers.escapeHtml(error.message || 'Unbekannter Fehler')}</p>
          <button type="button" class="btn btn-secondary" id="retry-module">Erneut versuchen</button>
        </section>
      `;
      state.content.querySelector('#retry-module')?.addEventListener('click', () => loadModule(moduleKey));
      helpers.notify('Das Modul konnte nicht geladen werden.', 'error');
    } finally {
      toggleOverlay(false);
    }
  }

  function updateActiveNavigation() {
    state.navButtons.forEach(button => {
      button.classList.toggle('active', button.dataset.module === state.activeModule);
    });
  }

  function toggleOverlay(show) {
    if (!state.overlay) return;
    state.overlay.classList.toggle('hidden', !show);
  }

  function updateClock() {
    if (!state.time) return;
    const now = new Date();
    state.time.textContent = new Intl.DateTimeFormat('de-DE', {
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit'
    }).format(now);
  }

  async function checkBackend() {
    if (!state.status) return;
    try {
      const response = await fetch('/api/system/info', { cache: 'no-store' });
      if (response.ok) {
        state.status.textContent = 'Online';
        state.status.classList.remove('offline');
        state.status.classList.add('online');
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      state.status.textContent = 'Offline';
      state.status.classList.remove('online');
      state.status.classList.add('offline');
    }
  }
})();

/* Legacy implementation retained for reference only.
console.log("Script.js loaded");

// Fix: Define missing variable to prevent ReferenceError
const recentlyStartedTools = new Map();
let currentDraggedToolId = null;

// API Health Check Function
async function checkApiHealth() {
  console.log('Checking API health...');
  const apis = [
    { name: 'Tools', endpoint: '/api/tools' },
    { name: 'Workspaces', endpoint: '/api/workspaces' },
    { name: 'Contacts', endpoint: '/api/contacts' },
    { name: 'Tickets', endpoint: '/api/tickets' },
    { name: 'Network Settings', endpoint: '/api/network/settings' },
    { name: 'Printers', endpoint: '/api/printers' },
    { name: 'FAQ', endpoint: '/api/faq' }
  ];

  const results = {};
  let allHealthy = true;

  for (const api of apis) {
    try {
      const response = await fetch(api.endpoint);
      if (response.ok) {
        results[api.name] = 'OK';
        console.log(`✓ ${api.name} API: OK`);
      } else {
        results[api.name] = `HTTP ${response.status}`;
        allHealthy = false;
        console.warn(`⚠ ${api.name} API: HTTP ${response.status}`);
      }
    } catch (error) {
      results[api.name] = 'ERROR';
      allHealthy = false;
      console.error(`✗ ${api.name} API: ERROR - ${error.message}`);
    }
  }

  // Show health check results
  if (!allHealthy) {
    const healthMessage = Object.entries(results)
      .map(([name, status]) => `${name}: ${status}`)
      .join('\n');
    
    alert(`API Health Check Results:\n\n${healthMessage}\n\nSome APIs may not be available. Please check the backend server.`);
  } else {
    console.log('✓ All APIs are healthy');
  }

  return results;
}

// Run API health check when page loads
document.addEventListener('DOMContentLoaded', () => {
  checkApiHealth();
});

// Global variables for tool management
function renderPhonebook(contacts) {
  console.log("Rendering phonebook:", contacts);

  // Render phonebook and calendar side-by-side using CSS grid
  content.innerHTML = `
    <div class="module-container" style="max-width:1120px; margin-left:0; margin-right:auto;">
    <div class="module-header" style="display:flex; align-items:center; justify-content:space-between;">
      <div style="display:flex; align-items:center; gap:12px;">
        <h2>Telefonbuch</h2>
      </div>
      <div style="display:flex; align-items:center; gap:12px;">
        <div class="module-calendar-header" style="margin-left:12px;">
          <h2 style="margin:0;"><i class="fas fa-calendar-alt"></i> Kalender</h2>
        </div>
      </div>
    </div>

  <div class="phonebook-two-column">
  <div id="phonebook-container" style="padding-right:20px;">
        ${contacts.length === 0 ? 
          '<div class="empty-state">' +
            '<i class="fas fa-address-book fa-3x mb-3"></i>' +
            '<h3>Keine Kontakte vorhanden</h3>' +
            '<p>Fügen Sie Kontakte hinzu, um sie schnell zu finden.</p>' +
          '</div>' :
          '<div class="contact-cards">' +
            contacts.map(function(contact) {
              const departmentDisplay = contact.department ?
                `<div class="contact-department">${escapeHtml(contact.department)}</div>` : '';
              const pkzDisplay = contact.pkz ?
                `<div class="contact-pkz">PKZ: ${escapeHtml(contact.pkz)}</div>` : '';

              return `
                <div class="contact-card" data-id="${contact.id}">
                  ${departmentDisplay}
                  <div class="contact-name">${escapeHtml(contact.name || '')}</div>
                  <div class="contact-phone">
                    <i class="fas fa-phone-alt"></i> ${escapeHtml(contact.phone || '')}
                  </div>
                  ${pkzDisplay}
                  <div class="contact-actions">
                    <button class="btn btn-sm btn-outline-secondary edit-contact">
                      <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-contact">
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </div>`;
            }).join('') +
          '</div>'
        }
        ${contacts.length === 0 ? '' : `
          <div class="phonebook-controls" style="margin-top:12px; display:flex; gap:8px; align-items:center;">
            <input type="text" id="phonebook-search" placeholder="Suchen..." class="form-control">
            <button id="add-contact-btn" class="btn btn-primary"><i class="fas fa-plus"></i> Kontakt hinzufügen</button>
          </div>
        `}
      </div>

      <div class="vertical-divider">
        <div style="width:2px; height:80%; background:#fff; box-shadow:0 0 0 1px rgba(0,0,0,0.08); border-radius:2px;"></div>
      </div>

  <div class="phonebook-calendar">
        <div id="calendar-placeholder" style="color:#666; text-align:center; padding:20px;">Kalender wird geladen…</div>
  <div id="fc-calendar" style="max-width:100%; min-height:520px;"></div>

        <!-- Modal für neue Termine -->
        <div id="calendar-event-modal" class="modal" style="display:none; position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); background:#fff; padding:20px; box-shadow:0 4px 12px rgba(0,0,0,0.15); z-index:1000;">
          <h3>Neuen Termin</h3>
          <label>Titel</label>
          <input id="event-title" type="text" />
          <label>Kontakt</label>
          <input id="event-contact" type="text" />
          <div id="event-contact-list"></div>
          <button id="save-calendar-event-btn">Speichern</button>
          <button onclick="document.getElementById('calendar-event-modal').style.display='none'">Abbrechen</button>
        </div>
      </div>
    </div>
    </div>
  `;

  setupPhonebookEventHandlers(contacts);

  // Initialize calendar after rendering. If the initializer isn't defined yet
  // (script load order), retry a few times with small delay.
  setupTelefonbuchCalendarWithRetry();

// Debug indicator removed when preparing final layout
}

function setupPhonebookEventHandlers(contacts) {
  const addContactBtn = document.getElementById('add-contact-btn');
  if (addContactBtn) {
    addContactBtn.addEventListener('click', showAddContactModal);
  }

  document.querySelectorAll('.edit-contact').forEach(button => {
    button.addEventListener('click', function () {
      const contactId = parseInt(this.closest('.contact-card').dataset.id, 10);
      const contact = contacts.find(c => c.id === contactId);
      if (contact) {
        showEditContactModal(contact);
      }
    });
  });

  document.querySelectorAll('.delete-contact').forEach(button => {
    button.addEventListener('click', function () {
      const contactId = parseInt(this.closest('.contact-card').dataset.id, 10);
      if (confirm('Möchten Sie diesen Kontakt wirklich löschen?')) {
        deleteContact(contactId);
      }
    });
  });

  const searchInput = document.getElementById('phonebook-search');
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      const searchTerm = this.value.toLowerCase();
      filterContacts(searchTerm, contacts);
    });
  }

  const fcEl = document.getElementById('fc-calendar');
  if (fcEl) {
    console.log('renderPhonebook: fc-calendar clientHeight=', fcEl.clientHeight);
  }
}

function setupTelefonbuchCalendarWithRetry() {
  console.log('renderPhonebook: calendar container present?', !!document.getElementById('fc-calendar'));

  (function tryInit(attemptsLeft) {
    if (typeof initializeTelefonbuchCalendar === 'function') {
      try {
        console.log('renderPhonebook: calling initializeTelefonbuchCalendar()');
        initializeTelefonbuchCalendar();
        return;
      } catch (err) {
        console.error('renderPhonebook: error calling initializeTelefonbuchCalendar:', err);
      }
    }
    if (attemptsLeft > 0) {
      console.log('renderPhonebook: initializeTelefonbuchCalendar not ready, retrying in 150ms, attempts left=', attemptsLeft);
      setTimeout(() => tryInit(attemptsLeft - 1), 150);
    } else {
      console.warn('renderPhonebook: initializeTelefonbuchCalendar was not available after retries');
    }
  })(6);
}

// Function to render tickets
function renderTickets(ticketsData) {
  console.log('Rendering tickets:', ticketsData);

  if (!ticketsData || ticketsData.length === 0) {
    createSampleTickets();
    ticketsData = JSON.parse(localStorage.getItem('tickets') || '[]');
  }

  const content = document.getElementById('content');
  if (!content) {
    return;
  }

  const groupedTickets = {};
  const today = new Date().toISOString().split('T')[0];

  ticketsData.forEach((ticket, index) => {
    const ticketDate = ticket.created ? new Date(ticket.created).toISOString().split('T')[0] : today;
    if (!groupedTickets[ticketDate]) {
      groupedTickets[ticketDate] = [];
    }

    if (!ticket.id) {
      ticket.id = `ticket-${index + 1}`;
    }
    if (!ticket.ticketNumber) {
      ticket.ticketNumber = index + 1;
    }

    groupedTickets[ticketDate].push(ticket);
  });

  const sortedDates = Object.keys(groupedTickets).sort((a, b) => new Date(b) - new Date(a));

  const ticketsHtml = sortedDates.length === 0
    ? `
      <div class="empty-state">
        <i class="fas fa-ticket-alt fa-3x mb-3"></i>
        <h3>Keine Tickets vorhanden</h3>
        <p>Erstellen Sie ein neues Ticket, um zu beginnen.</p>
      </div>
    `
    : sortedDates.map(date => {
        const dateObj = new Date(date);
        const isToday = date === today;
        const dateLabel = isToday
          ? 'Heute'
          : dateObj.toLocaleDateString('de-DE', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });

        const ticketsForDate = groupedTickets[date];
        const itemsHtml = ticketsForDate.map(ticket => {
          const createdLabel = ticket.created
            ? new Date(ticket.created).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
            : 'Unbekannte Zeit';

          const priorityBadge = ticket.priority
            ? `<span class="ticket-priority priority-${ticket.priority.toLowerCase()}">${ticket.priority}</span>`
            : '';

          const assignedMarkup = ticket.assignedTo
            ? `<div class="ticket-assigned">Zugewiesen an: ${escapeHtml(ticket.assignedTo)}</div>`
            : '';

          return `
            <div class="ticket-item ${ticket.status || 'open'}" data-id="${ticket.id}">
              <div class="ticket-header">
                <div class="ticket-number">
                  <span class="ticket-number-badge">#${ticket.ticketNumber}</span>
                </div>
                <div class="ticket-title-section">
                  <span class="ticket-title">${escapeHtml(ticket.title || 'Unbenanntes Ticket')}</span>
                  <span class="ticket-status status-${ticket.status || 'open'}">${getStatusText(ticket.status || 'open')}</span>
                </div>
                <div class="ticket-actions">
                  <button class="btn-icon view-ticket" data-id="${ticket.id}" title="Ticket anzeigen">
                    <i class="fas fa-eye"></i>
                  </button>
                  <button class="btn-icon edit-ticket" data-id="${ticket.id}" title="Ticket bearbeiten">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="btn-icon delete-ticket" data-id="${ticket.id}" title="Ticket löschen">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
              <div class="ticket-body">
                <div class="ticket-info">
                  <div class="ticket-meta">
                    <span class="ticket-time">${createdLabel}</span>
                    ${priorityBadge}
                  </div>
                  <div class="ticket-description">${escapeHtml(ticket.description || '')}</div>
                  ${assignedMarkup}
                </div>
              </div>
            </div>
          `;
        }).join('');

        return `
          <div class="ticket-date-group">
            <div class="ticket-date-header ${isToday ? 'today' : ''}">
              <h3><i class="fas fa-calendar-day"></i> ${dateLabel}</h3>
              <span class="ticket-count">${ticketsForDate.length} Ticket${ticketsForDate.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="tickets-list">
              ${itemsHtml}
            </div>
          </div>
        `;
      }).join('');

  content.innerHTML = `
    <div class="module-header">
      <h2><i class="fas fa-ticket-alt"></i> Tickets</h2>
      <div class="module-actions">
        <button id="add-ticket-btn" class="btn btn-primary">
          <i class="fas fa-plus"></i> Neues Ticket
        </button>
        <button id="refresh-tickets-btn" class="btn btn-secondary">
          <i class="fas fa-sync-alt"></i> Aktualisieren
        </button>
      </div>
    </div>
    <div id="tickets-container">
      ${ticketsHtml}
    </div>
  `;
}

// Function to create sample tickets for demonstration
function createSampleTickets() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const sampleTickets = [
    {
      id: 'ticket-1',
      ticketNumber: 1,
      title: 'Drucker funktioniert nicht',
      description: 'Der Drucker im Büro 101 gibt keine Ausgabe mehr. Bitte dringend überprüfen.',
      status: 'open',
      priority: 'high',
      assignedTo: 'IT-Support',
      created: today.toISOString()
    },
    {
      id: 'ticket-2',
      ticketNumber: 2,
      title: 'Netzwerkverbindung instabil',
      description: 'Die Internetverbindung ist seit heute Morgen sehr langsam und unterbricht sich regelmäßig.',
      status: 'in-progress',
      priority: 'medium',
      assignedTo: 'Netzwerk-Team',
      created: today.toISOString()
    },
    {
      id: 'ticket-3',
      ticketNumber: 3,
      title: 'Software-Update durchführen',
      description: 'Windows-Updates müssen auf allen Arbeitsplatzrechnern installiert werden.',
      status: 'waiting',
      priority: 'low',
      assignedTo: 'System-Admin',
      created: yesterday.toISOString()
    },
    {
      id: 'ticket-4',
      ticketNumber: 4,
      title: 'Neuer Benutzer einrichten',
      description: 'Neuer Mitarbeiter muss mit E-Mail, Netzwerkzugang und Software eingerichtet werden.',
      status: 'resolved',
      priority: 'medium',
      assignedTo: 'IT-Support',
      created: yesterday.toISOString()
    }
  ];

  localStorage.setItem('tickets', JSON.stringify(sampleTickets));
  console.log('Sample tickets created');
}

// Helper function to get status text
function getStatusText(status) {
  const statusMap = {
    'open': 'Offen',
    'in-progress': 'In Bearbeitung',
    'waiting': 'Wartend',
    'closed': 'Geschlossen',
    'resolved': 'Gelöst'
  };
  return statusMap[status] || status;
}

// Function to show add ticket modal
function showAddTicketModal() {
  // Create modal for adding new ticket
  const modal = document.createElement('div');
  modal.className = 'modal-template';
  modal.innerHTML = `
    <div class="modal-content ticket-dialog">
      <div class="modal-header">
        <h2><i class="fas fa-plus"></i> Neues Ticket erstellen</h2>
        <button class="btn-close" onclick="this.closest('.modal-template').style.display='none'">&times;</button>
      </div>
      <div class="modal-body">
        <form id="ticket-form">
          <div class="form-group">
            <label for="ticket-title">Titel:</label>
            <input type="text" id="ticket-title" required>
          </div>
          <div class="form-group">
            <label for="ticket-description">Beschreibung:</label>
            <textarea id="ticket-description" rows="4"></textarea>
          </div>
          <div class="form-group">
            <label for="ticket-priority">Priorität:</label>
            <select id="ticket-priority">
              <option value="low">Niedrig</option>
              <option value="medium" selected>Mittel</option>
              <option value="high">Hoch</option>
            </select>
          </div>
          <div class="form-group">
            <label for="ticket-assigned">Zugewiesen an:</label>
            <input type="text" id="ticket-assigned">
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal-template').style.display='none'">Abbrechen</button>
        <button class="btn btn-primary" id="save-ticket-btn">Ticket erstellen</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.style.display = 'flex';

  // Save ticket handler
  document.getElementById('save-ticket-btn').addEventListener('click', () => {
    const title = document.getElementById('ticket-title').value;
    const description = document.getElementById('ticket-description').value;
    const priority = document.getElementById('ticket-priority').value;
    const assignedTo = document.getElementById('ticket-assigned').value;

    if (title.trim()) {
      createTicket({ title, description, priority, assignedTo });
      modal.remove();
    } else {
      alert('Bitte geben Sie einen Titel ein.');
    }
  });
}

// Function to view ticket details
function viewTicketDetails(ticketId) {
  // Get ticket data from localStorage or API
  const tickets = JSON.parse(localStorage.getItem('tickets') || '[]');
  const ticket = tickets.find(t => t.id === ticketId);

  if (!ticket) {
    alert('Ticket nicht gefunden.');
    return;
  }

  // Create modal for viewing ticket
  const modal = document.createElement('div');
  modal.className = 'modal-template';
  modal.innerHTML = `
    <div class="modal-content ticket-dialog">
      <div class="modal-header">
        <h2><i class="fas fa-eye"></i> Ticket #${ticket.ticketNumber || ticketId}</h2>
        <button class="btn-close" onclick="this.closest('.modal-template').style.display='none'">&times;</button>
      </div>
      <div class="modal-body">
        <div class="ticket-detail">
          <h3>${escapeHtml(ticket.title)}</h3>
          <div class="ticket-meta-detail">
            <span class="status-badge status-${ticket.status || 'open'}">${getStatusText(ticket.status || 'open')}</span>
            <span class="priority-badge priority-${ticket.priority || 'medium'}">${ticket.priority || 'Medium'}</span>
            <span class="date-info">Erstellt: ${ticket.created ? new Date(ticket.created).toLocaleString('de-DE') : 'Unbekannt'}</span>
          </div>
          ${ticket.assignedTo ? `<div class="assigned-info">Zugewiesen an: ${escapeHtml(ticket.assignedTo)}</div>` : ''}
          <div class="description-section">
            <h4>Beschreibung:</h4>
            <div class="description-content">${escapeHtml(ticket.description || 'Keine Beschreibung')}</div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal-template').style.display='none'">Schließen</button>
        <button class="btn btn-primary" onclick="editTicket('${ticketId}')">Bearbeiten</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.style.display = 'flex';
}

// Function to edit ticket
function editTicket(ticketId) {
  // Get ticket data
  const tickets = JSON.parse(localStorage.getItem('tickets') || '[]');
  const ticket = tickets.find(t => t.id === ticketId);

  if (!ticket) {
    alert('Ticket nicht gefunden.');
    return;
  }

  // Close any existing modals
  document.querySelectorAll('.modal-template').forEach(m => m.remove());

  // Create edit modal
  const modal = document.createElement('div');
  modal.className = 'modal-template';
  modal.innerHTML = `
    <div class="modal-content ticket-dialog">
      <div class="modal-header">
        <h2><i class="fas fa-edit"></i> Ticket bearbeiten</h2>
        <button class="btn-close" onclick="this.closest('.modal-template').style.display='none'">&times;</button>
      </div>
      <div class="modal-body">
        <form id="edit-ticket-form">
          <div class="form-group">
            <label for="edit-ticket-title">Titel:</label>
            <input type="text" id="edit-ticket-title" value="${escapeHtml(ticket.title)}" required>
          </div>
          <div class="form-group">
            <label for="edit-ticket-description">Beschreibung:</label>
            <textarea id="edit-ticket-description" rows="4">${escapeHtml(ticket.description || '')}</textarea>
          </div>
          <div class="form-group">
            <label for="edit-ticket-status">Status:</label>
            <select id="edit-ticket-status">
              <option value="open" ${ticket.status === 'open' ? 'selected' : ''}>Offen</option>
              <option value="in-progress" ${ticket.status === 'in-progress' ? 'selected' : ''}>In Bearbeitung</option>
              <option value="waiting" ${ticket.status === 'waiting' ? 'selected' : ''}>Wartend</option>
              <option value="resolved" ${ticket.status === 'resolved' ? 'selected' : ''}>Gelöst</option>
              <option value="closed" ${ticket.status === 'closed' ? 'selected' : ''}>Geschlossen</option>
            </select>
          </div>
          <div class="form-group">
            <label for="edit-ticket-priority">Priorität:</label>
            <select id="edit-ticket-priority">
              <option value="low" ${ticket.priority === 'low' ? 'selected' : ''}>Niedrig</option>
              <option value="medium" ${ticket.priority === 'medium' ? 'selected' : ''}>Mittel</option>
              <option value="high" ${ticket.priority === 'high' ? 'selected' : ''}>Hoch</option>
            </select>
          </div>
          <div class="form-group">
            <label for="edit-ticket-assigned">Zugewiesen an:</label>
            <input type="text" id="edit-ticket-assigned" value="${escapeHtml(ticket.assignedTo || '')}">
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal-template').style.display='none'">Abbrechen</button>
        <button class="btn btn-danger" onclick="deleteTicket('${ticketId}')">Löschen</button>
        <button class="btn btn-primary" id="update-ticket-btn">Aktualisieren</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.style.display = 'flex';

  // Update ticket handler
  document.getElementById('update-ticket-btn').addEventListener('click', () => {
    const title = document.getElementById('edit-ticket-title').value;
    const description = document.getElementById('edit-ticket-description').value;
    const status = document.getElementById('edit-ticket-status').value;
    const priority = document.getElementById('edit-ticket-priority').value;
    const assignedTo = document.getElementById('edit-ticket-assigned').value;

    if (title.trim()) {
      updateTicket(ticketId, { title, description, status, priority, assignedTo });
      modal.remove();
    } else {
      alert('Bitte geben Sie einen Titel ein.');
    }
  });
}

// Function to delete ticket
function deleteTicket(ticketId) {
  if (confirm('Sind Sie sicher, dass Sie dieses Ticket löschen möchten?')) {
    const tickets = JSON.parse(localStorage.getItem('tickets') || '[]');
    const updatedTickets = tickets.filter(t => t.id !== ticketId);
    localStorage.setItem('tickets', JSON.stringify(updatedTickets));
    loadModule('tickets'); // Refresh the tickets view
  }
}

// Function to create new ticket
function createTicket(ticketData) {
  const tickets = JSON.parse(localStorage.getItem('tickets') || '[]');
  const newTicket = {
    id: `ticket-${Date.now()}`,
    ticketNumber: tickets.length + 1,
    title: ticketData.title,
    description: ticketData.description,
    status: 'open',
    priority: ticketData.priority,
    assignedTo: ticketData.assignedTo,
    created: new Date().toISOString()
  };

  tickets.push(newTicket);
  localStorage.setItem('tickets', JSON.stringify(tickets));
  loadModule('tickets'); // Refresh the tickets view
}

// Function to update ticket
function updateTicket(ticketId, ticketData) {
  const tickets = JSON.parse(localStorage.getItem('tickets') || '[]');
  const ticketIndex = tickets.findIndex(t => t.id === ticketId);

  if (ticketIndex !== -1) {
    tickets[ticketIndex] = {
      ...tickets[ticketIndex],
      ...ticketData,
      updated: new Date().toISOString()
    };
    localStorage.setItem('tickets', JSON.stringify(tickets));
    loadModule('tickets'); // Refresh the tickets view
  }
}

// Function to set up event handlers for printer actions
function setupPrinterEventHandlers() {
  console.log('Setting up printer event handlers');

  // Add printer button
  const addPrinterBtn = document.getElementById('add-printer-btn');
  if (addPrinterBtn) {
    addPrinterBtn.addEventListener('click', () => {
      console.log('Add printer clicked');
      // TODO: Implement add printer functionality
    });
  }

  // Edit printer buttons
  document.querySelectorAll('.edit-printer').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const printerId = e.currentTarget.closest('.printer-item').dataset.id;
      console.log('Edit printer:', printerId);
      // TODO: Implement edit printer functionality
    });
  });

  // Delete printer buttons
  document.querySelectorAll('.delete-printer').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const printerId = e.currentTarget.closest('.printer-item').dataset.id;
      console.log('Delete printer:', printerId);
      // TODO: Implement delete printer functionality
    });
  });

  // Open printer buttons
  document.querySelectorAll('.open-printer').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const printerId = e.currentTarget.dataset.id;
      console.log('Open printer:', printerId);
      // TODO: Implement open printer functionality
    });
  });

  // Install printer buttons
  document.querySelectorAll('.install-printer').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const printerId = e.currentTarget.dataset.id;
      console.log('Install printer:', printerId);
      // TODO: Implement install printer functionality
    });
  });
}

if (typeof renderPrinters !== 'function') {
  function renderPrinters(printers = []) {
    console.warn('Using fallback renderPrinters()');
    const contentEl = document.getElementById('content');
    if (!contentEl) return;
    const listHtml = printers.length === 0
      ? '<div class="empty-state">Keine Drucker gefunden.</div>'
      : printers.map(p => `<div class="printer-item">${escapeHtml(p.name || p.id || '')}</div>`).join('');
    contentEl.innerHTML = `
      <div class="module-header printer-section">
        <h2><i class="fas fa-print"></i> Drucker</h2>
        <div class="module-actions"><button id="add-printer-btn" class="btn btn-primary"><i class="fas fa-plus"></i> Drucker hinzufügen</button></div>
      </div>
      <div id="printers-container">${listHtml}</div>
    `;
  }
}

if (typeof renderFAQ !== 'function') {
  function renderFAQ(items = []) {
    console.warn('Using fallback renderFAQ()');
    const contentEl = document.getElementById('content');
    if (!contentEl) return;
    const html = items.length === 0
      ? '<div class="empty-state">Keine FAQ vorhanden.</div>'
      : items.map(f => `<div class="faq-item"><h3>${escapeHtml(f.question)}</h3><p>${escapeHtml(f.answer)}</p></div>`).join('');
    contentEl.innerHTML = `
      <div class="module-header"><h2><i class="fas fa-question-circle"></i> FAQ</h2></div>
      <div class="faq-list">${html}</div>
    `;
  }
}

// Globale Cache-Variable für Module
const moduleCache = {};

// Flag, um Drag-&-Drop-Events nur einmal zu registrieren
let workspaceDnDInitialized = false;

// DOM-Elemente
const content = document.getElementById('content');
const tabs = document.getElementById('tabs');

// Utility-Funktionen
function showNotification(message, type = 'info', large = false) {
    console.log("Notification (" + type + "): " + message);  
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = "notification " + type + (large ? ' notification-large' : '');
    notification.innerHTML = message;
    
    // Remove any existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => {
        notification.remove();
    });
    
    // Add to body
    document.body.appendChild(notification);
    
    // Remove after shorter duration (3 seconds instead of 5)
    const duration = large ? 5000 : 3000;
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.5s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 500);
    }, duration);
}

function showLoading(message) {
  const loadingOverlay = document.createElement('div');
  loadingOverlay.className = 'loading-overlay';
  loadingOverlay.innerHTML = '<div class="loading-message">' + message + '</div>';
  document.body.appendChild(loadingOverlay);
}

function hideLoading() {
  const loadingOverlay = document.querySelector('.loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.remove();
  }
}

// HTML Escaping function to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Cache-Management
function invalidateCache(module) {
  delete moduleCache[module];
}

// Cleanup function to remove module-specific event handlers
function cleanupModuleHandlers() {
    // Clean up any module-specific handlers if needed
    console.log("Cleaned up module handlers");
}

// Modul-Behandlung
async function loadModule(moduleName) {
  console.log("=== loadModule called with:", moduleName);
  
  if (!moduleName) {
    console.error("No module name provided");
    return;
  }
  
  // Cleanup previous module handlers
  cleanupModuleHandlers();
  
  // Speichere den aktiven Tab in localStorage
  localStorage.setItem('activeTab', moduleName);
  console.log("Active tab saved to localStorage:", moduleName);
  
  // Aktiviere den ausgewählten Tab
  const tabs = document.getElementById('tabs');
  if (tabs) {
    const allTabs = tabs.querySelectorAll('button');
    allTabs.forEach(tab => {
      if (tab.dataset.module === moduleName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
  }
  
  // Versuche, Daten aus dem Cache zu holen
  if (moduleCache[moduleName]) {
    renderModule(moduleName, moduleCache[moduleName]);
    return;
  }
  
  // Zeige Ladeanimation
  content.innerHTML = '<div class="loading">Lade...</div>';
  
  // Spezielle Behandlung für Module ohne API-Endpunkte
  if (moduleName === 'tickets') {
    // Tickets werden aus localStorage geladen
    try {
      const ticketsData = JSON.parse(localStorage.getItem('tickets') || '[]');
      moduleCache[moduleName] = ticketsData;
      renderModule(moduleName, ticketsData);
      return;
    } catch (error) {
      console.error("Fehler beim Laden der Tickets aus localStorage:", error);
      content.innerHTML = `
        <div class="module-header">
          <h2><i class="fas fa-ticket-alt"></i> Tickets</h2>
        </div>
        <div class="error-message">
          <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
          <h3>Fehler beim Laden der Tickets</h3>
          <p>${error.message}</p>
        </div>
      `;
      return;
    }
  }
  
  if (moduleName === 'drucker') {
    // Drucker werden als leere Liste initialisiert (können später hinzugefügt werden)
    const printersData = [];
    moduleCache[moduleName] = printersData;
    renderModule(moduleName, printersData);
    return;
  }
  
  // Spezielle Behandlung für worksets Modul
  if (moduleName === 'worksets') {
    try {
      const response = await fetch('/api/tools');
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Tools: " + response.status);
      }
      
      const data = await response.json();
      moduleCache[moduleName] = data;
      renderModule(moduleName, data);
      return;
    } catch (error) {
      console.error("Fehler beim Laden der Worksets:", error);
      content.innerHTML = `
        <div class="module-header">
          <h2><i class="fas fa-layer-group"></i> Worksets</h2>
        </div>
        <div class="error-message">
          <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
          <h3>Fehler beim Laden der Worksets</h3>
          <p>${error.message}</p>
        </div>
      `;
      return;
    }
  }
  
  try {
    const response = await fetch('/api/' + moduleName);
    if (!response.ok) {
      throw new Error("Fehler beim Laden: " + response.status);
    }
    
    const data = await response.json();
    moduleCache[moduleName] = data;
    renderModule(moduleName, data);
    
  } catch (error) {
    console.error("Fehler beim Laden von " + moduleName + ":", error);
    
    content.innerHTML = '<div class="error-message">Fehler beim Laden von ' + moduleName + ': ' + error.message + '</div>';
  }
}

// Kontakte filtern basierend auf dem Suchbegriff
function filterContacts(searchTerm, contacts) {
    const contactCards = document.querySelectorAll('.contact-card');
    contactCards.forEach(card => {
        const contactId = parseInt(card.dataset.id);
        const contact = contacts.find(c => c.id === contactId);
        
        if (contact) {
            const matchesSearch = 
                (contact.name && contact.name.toLowerCase().includes(searchTerm)) ||
                (contact.phone && contact.phone.toLowerCase().includes(searchTerm)) ||
                (contact.department && contact.department.toLowerCase().includes(searchTerm)) ||
                (contact.pkz && contact.pkz.toLowerCase().includes(searchTerm));
                
            card.style.display = matchesSearch ? 'flex' : 'none';
        }
    });
}

// Modal für das Hinzufügen eines neuen Kontakts anzeigen
function showAddContactModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Kontakt hinzufügen</h3>
                <button class="close-button">&times;</button>
            </div>
            <div class="modal-body">
                <form id="add-contact-form">
                    <div class="form-group">
                        <label for="contact-name">Name *</label>
                        <input type="text" id="contact-name" required class="form-control" placeholder="Name eingeben">
                    </div>
                    <div class="form-group">
                        <label for="contact-phone">Telefon *</label>
                        <input type="text" id="contact-phone" required class="form-control" placeholder="Telefonnummer eingeben">
                    </div>
                    <div class="form-group">
                        <label for="contact-department">Abteilung</label>
                        <input type="text" id="contact-department" class="form-control" placeholder="Abteilung eingeben">
                    </div>
                    <div class="form-group">
                        <label for="contact-pkz">PKZ</label>
                        <input type="text" id="contact-pkz" class="form-control" placeholder="PKZ eingeben">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary cancel-btn">Abbrechen</button>
                        <button type="submit" class="btn btn-primary">Speichern</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    
    // Schließen-Button
    const closeBtn = modal.querySelector('.close-button');
    const cancelBtn = modal.querySelector('.cancel-btn');
    
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    cancelBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    // Formular-Submit
    const form = modal.querySelector('#add-contact-form');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Pflichtfelder prüfen
        const nameInput = document.getElementById('contact-name');
        const phoneInput = document.getElementById('contact-phone');
        
        if (!nameInput.value.trim() || !phoneInput.value.trim()) {
            showNotification("Name und Telefonnummer sind Pflichtfelder", "error");
            return;
        }
        
        // Kontakt-Objekt erstellen
        const newContact = {
            name: nameInput.value.trim(),
            phone: phoneInput.value.trim(),
            department: document.getElementById('contact-department').value.trim() || null,
            pkz: document.getElementById('contact-pkz').value.trim() || null
        };
        
        saveContact(newContact);
        modal.remove();
    });
}

// Modal für das Bearbeiten eines Kontakts anzeigen
function showEditContactModal(contact) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Kontakt bearbeiten</h3>
                <button class="close-button">&times;</button>
            </div>
            <div class="modal-body">
                <form id="edit-contact-form">
                    <input type="hidden" id="contact-id" value="${contact.id}">
                    <div class="form-group">
                        <label for="contact-name">Name *</label>
                        <input type="text" id="contact-name" required class="form-control" value="${escapeHtml(contact.name || '')}" placeholder="Name eingeben">
                    </div>
                    <div class="form-group">
                        <label for="contact-phone">Telefon *</label>
                        <input type="text" id="contact-phone" required class="form-control" value="${escapeHtml(contact.phone || '')}" placeholder="Telefonnummer eingeben">
                    </div>
                    <div class="form-group">
                        <label for="contact-department">Abteilung</label>
                        <input type="text" id="contact-department" class="form-control" value="${escapeHtml(contact.department || '')}" placeholder="Abteilung eingeben">
                    </div>
                    <div class="form-group">
                        <label for="contact-pkz">PKZ</label>
                        <input type="text" id="contact-pkz" class="form-control" value="${escapeHtml(contact.pkz || '')}" placeholder="PKZ eingeben">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary cancel-btn">Abbrechen</button>
                        <button type="submit" class="btn btn-primary">Speichern</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Schließen-Button
    const closeBtn = modal.querySelector('.close-button');
    const cancelBtn = modal.querySelector('.cancel-btn');
    
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    cancelBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    // Formular-Submit
    const form = modal.querySelector('#edit-contact-form');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Pflichtfelder prüfen
        const nameInput = document.getElementById('contact-name');
        const phoneInput = document.getElementById('contact-phone');
        
        if (!nameInput.value.trim() || !phoneInput.value.trim()) {
            showNotification("Name und Telefonnummer sind Pflichtfelder", "error");
            return;
        }
        
        // Kontakt-Objekt erstellen
        const updatedContact = {
            id: parseInt(document.getElementById('contact-id').value),
            name: nameInput.value.trim(),
            phone: phoneInput.value.trim(),
            department: document.getElementById('contact-department').value.trim() || null,
            pkz: document.getElementById('contact-pkz').value.trim() || null
        };
        
        updateContact(updatedContact);
        modal.remove();
    });
}

// Kontakt speichern (neu)
async function saveContact(contact) {
    try {
        showLoading("Kontakt wird gespeichert...");
        
        const response = await fetch('/api/telefonbuch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(contact)
        });
        
        hideLoading();
        
        if (response.ok) {
            const result = await response.json();
            showNotification("Kontakt erfolgreich gespeichert", "success");
            
            // Cache aktualisieren und neu rendern
            invalidateCache('telefonbuch');
            loadModule('telefonbuch');
        } else {
            const error = await response.json();
            throw new Error(error.message || "Fehler beim Speichern des Kontakts");
        }
    } catch (error) {
        hideLoading();
        console.error("Fehler beim Speichern des Kontakts:", error);
        showNotification("Fehler: " + error.message, "error");
    }
}

// Kontakt aktualisieren
async function updateContact(contact) {
    try {
        showLoading("Kontakt wird aktualisiert...");
        
        const response = await fetch(`/api/telefonbuch/${contact.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(contact)
        });
        
        hideLoading();
        
        if (response.ok) {
            showNotification("Kontakt erfolgreich aktualisiert", "success");
            
            // Cache aktualisieren und neu rendern
            invalidateCache('telefonbuch');
            loadModule('telefonbuch');
        } else {
            const error = await response.json();
            throw new Error(error.message || "Fehler beim Aktualisieren des Kontakts");
        }
    } catch (error) {
        hideLoading();
        console.error("Fehler beim Aktualisieren des Kontakts:", error);
        showNotification("Fehler: " + error.message, "error");
    }
}

// Kontakt löschen
async function deleteContact(contactId) {
    try {
        showLoading("Kontakt wird gelöscht...");
        
        const response = await fetch(`/api/telefonbuch/${contactId}`, {
            method: 'DELETE'
        });
        
        hideLoading();
        
        if (response.ok) {
            showNotification("Kontakt erfolgreich gelöscht", "success");
            
            // Cache aktualisieren und neu rendern
            invalidateCache('telefonbuch');
            loadModule('telefonbuch');
        } else {
            const error = await response.json();
            throw new Error(error.message || "Fehler beim Löschen des Kontakts");
        }
    } catch (error) {
        hideLoading();
        console.error("Fehler beim Löschen des Kontakts:", error);
        showNotification("Fehler: " + error.message, "error");
    }
}

// Modul-Rendering basierend auf dem Modulnamen
function renderModule(moduleName, items) {
  console.log(`Rendering module: ${moduleName} with items:`, items);
  
  if (moduleName === 'tools') {
    content.innerHTML = `
      <div class="module-header"><h2><i class="fas fa-tools"></i> Tools</h2></div>
      <div id="tools-container" class="tools-content">
        <div class="loading">Lade Tools...</div>
      </div>
    `;
    loadTools();
  } else if (moduleName === 'tickets') {
    // Für Tickets immer die aktuelle Version aus localStorage laden
    const ticketsData = JSON.parse(localStorage.getItem('tickets') || '[]');
    moduleCache['tickets'] = ticketsData;
    renderTickets(ticketsData);
  } else if (moduleName === 'drucker') {
    // Verwende die items vom Backend oder fallback zu leerer Liste
    const printers = items || [];
    console.log("Rendering drucker with data:", printers);
    renderPrinters(printers);
  } else if (moduleName === 'netzwerk') {
    // Lade Netzwerk-Interface
    console.log("Rendering netzwerk");
    renderNetwork();
  } else if (moduleName === 'telefonbuch') {
    // Verwende die items vom Backend oder fallback zu leerer Liste
    const contacts = items || [];
    console.log("Rendering telefonbuch with data:", contacts);
    renderPhonebook(contacts);
  } else if (moduleName === 'faq') {
    // Verwende die items vom Backend oder fallback zu leerer Liste
    const faqItems = items || [];
    console.log("Rendering faq with data:", faqItems);
    renderFAQ(faqItems);
  } else if (moduleName === 'worksets') {
    // Worksets werden asynchron geladen
    console.log("Rendering worksets");
    content.innerHTML = `
      <div class="module-header">
        <h2><i class="fas fa-layer-group"></i> Worksets</h2>
      </div>
      <div class="loading">Lade Worksets...</div>
    `;
    loadWorksets();
  } else {
    console.warn(`Unknown module: ${moduleName}`);
    // Fallback für unbekannte Module
    const content = document.getElementById('content');
    if (content) {
      content.innerHTML = `
        <div class="module-header">
          <h2><i class="fas fa-question-circle"></i> ${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}</h2>
        </div>
        <div class="empty-state">
          <i class="fas fa-info-circle fa-3x"></i>
          <h3>Modul wird geladen...</h3>
          <p>Das ${moduleName}-Modul wird noch entwickelt.</p>
        </div>
      `;
    }
  }
}

// Hilfsfunktion, um das passende Icon für eine Kategorie zu bestimmen
function getIconForCategory(category) {
  // Standardisiere die Kategorie (Kleinbuchstaben, keine Sonderzeichen)
  const normalizedCategory = category.toLowerCase().trim();
  
  // Icons für bekannte Kategorien
  const iconMap = {
    'drucker': 'fas fa-print',
    'netzwerk': 'fas fa-network-wired',
    'ticket': 'fas fa-ticket-alt',
    'text': 'fas fa-font',
    'allgemein': 'fas fa-info-circle',
    'teams': 'fas fa-users',
    'outlook': 'far fa-envelope',
    'lock': 'fas fa-lock',
    'windows': 'fab fa-windows',
    'office': 'far fa-file-word',
    'software': 'fas fa-download',
    'hardware': 'fas fa-desktop',
    'support': 'fas fa-headset',
    'anleitung': 'fas fa-book'
  };
  
  // Durchsuche den Kategorienamen nach Schlüsselwörtern
  for (const [keyword, icon] of Object.entries(iconMap)) {
    if (normalizedCategory.includes(keyword)) {
      return icon;
    }
  }
  
  // Fallback für unbekannte Kategorien
  return 'fas fa-question-circle';
}

// Function to close the modal
function closeToolModal() {
    const modal = document.getElementById('add-tool-modal');
    if (modal) {
        modal.remove();
    }
}

// Toggle autostart mode for a tool
async function toggleToolAutostart(toolId, enable) {
    try {
        console.log(`Toggling autostart for tool ${toolId} to ${enable}`);
        showLoading("Aktualisiere Tool...");
        
        const response = await fetch(`/api/tools/${toolId}/autostart`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ autostart: enable })
        });
        
        hideLoading();
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        // Update UI to reflect the change
        const toggleBtn = document.querySelector(`.tool-item[data-id="${toolId}"] .toggle-autostart`);
        const toolItem = document.querySelector(`.tool-item[data-id="${toolId}"]`);
        const toolName = toolItem ? toolItem.querySelector('.tool-name')?.textContent || 'Tool' : 'Tool';
        
        if (toggleBtn) {
            if (enable) {
                toggleBtn.classList.add('active');
                toggleBtn.title = 'Autostart deaktivieren';
                toggleBtn.querySelector('i').className = 'fas fa-toggle-on';
            } else {
                toggleBtn.classList.remove('active');
                toggleBtn.title = 'Autostart aktivieren';
                toggleBtn.querySelector('i').className = 'fas fa-toggle-off';
            }
        }
        
        // Show notification with tool name and checkmark
        const statusText = enable ? 'aktiviert' : 'deaktiviert';
        const icon = enable ? '✅' : '⏸️';
        showNotification(`${icon} Autostart für "${toolName}" ${statusText}`, 'success', true);
        
    } catch (error) {
        hideLoading();
        console.error("Error toggling autostart:", error);
        showNotification(`Fehler: ${error.message}`, 'error');
    }
}

// Toggle admin mode for a tool
async function toggleToolAdmin(toolId, enable) {
    try {
        console.log(`Toggling admin mode for tool ${toolId} to ${enable}`);
        showLoading("Aktualisiere Tool...");
        
        const response = await fetch(`/api/tools/${toolId}/admin`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin: enable })
        });
        
        hideLoading();
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        // Update UI to reflect the change
        const toggleBtn = document.querySelector(`.tool-item[data-id="${toolId}"] .toggle-admin`);
        if (toggleBtn) {
            if (enable) {
                toggleBtn.classList.add('active');
                toggleBtn.title = 'Admin-Modus deaktivieren';
                toggleBtn.querySelector('i').className = 'fas fa-user-shield';
            } else {
                toggleBtn.classList.remove('active');
                toggleBtn.title = 'Als Administrator starten';
                toggleBtn.querySelector('i').className = 'fas fa-user';
            }
        }
        
        // Show notification
        showNotification(`Administrator-Modus ${enable ? 'aktiviert' : 'deaktiviert'}`, 'info');
        
    } catch (error) {
        hideLoading();
        console.error("Error toggling admin mode:", error);
        showNotification(`Fehler: ${error.message}`, 'error');
    }
}

// Delete a tool
async function deleteTool(toolId) {
    try {
        if (!confirm("Sind Sie sicher, dass Sie dieses Tool löschen möchten?")) {
            return;
        }
        
        console.log("Deleting tool:", toolId);
        showLoading("Lösche Tool...");
        
        const response = await fetch(`/api/tools/${toolId}`, {
            method: 'DELETE'
        });
        
        hideLoading();
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        // Show notification
        showNotification("Tool wurde gelöscht", 'info');
        
        // Invalidate cache and reload tools
        invalidateCache('tools');
        await loadModule('tools');
        
    } catch (error) {
        hideLoading();
        console.error("Error deleting tool:", error);
        showNotification("Fehler beim Löschen: " + error.message, 'error');
    }
}

// (duplicate renderPhonebook removed — calendar-aware version at top remains)

// Modal close function
function closeModal() {
    const modalOverlay = document.querySelector('.modal-overlay');
    if (modalOverlay) {
        modalOverlay.remove();
    }
}

// Show Tool Type Selection Dialog
function showToolTypeDialog() {
    const modal = document.createElement('div');
    modal.className = 'tool-type-modal';
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
            <div class="modal-header" style="padding: 20px; border-bottom: 1px solid #4a5568; display: flex; justify-content: space-between; align-items: center; background-color: #1a202c;">
                <h2 id="tool-type-title" style="margin: 0; color: #ffffff;"><i class="fas fa-plus"></i> Tool hinzufügen</h2>
                <button class="close-btn" style="background: none; border: none; color: #cbd5e0; font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            <div class="modal-body" style="padding: 20px;">
                <p style="color: #e2e8f0; margin-bottom: 20px;">Welchen Typ von Tool möchten Sie hinzufügen?</p>
                <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                    <div class="tool-type-option" data-type="application">
                        <i class="fas fa-desktop"></i>
                        <h4>Anwendung</h4>
                        <p>Programm oder .exe-Datei</p>
                    </div>
                    <div class="tool-type-option" data-type="link">
                        <i class="fas fa-link"></i>
                        <h4>Link</h4>
                        <p>Webseite oder URL</p>
                    </div>
                    <div class="tool-type-option" data-type="network">
                        <i class="fas fa-network-wired"></i>
                        <h4>Netzwerkpfad</h4>
                        <p>UNC-Pfad oder Netzlaufwerk</p>
                    </div>
                    <div class="tool-type-option" data-type="workspace">
                        <i class="fas fa-folder"></i>
                        <h4>Arbeitsumgebung</h4>
                        <p>Ordner oder Workspace</p>
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="padding: 20px; border-top: 1px solid #4a5568; display: flex; justify-content: flex-end; gap: 10px;">
                <button class="cancel-btn btn btn-secondary" style="padding: 10px 20px; background: #718096; border: none; color: white; cursor: pointer; border-radius: 4px;">Abbrechen</button>
                <button class="continue-btn btn btn-primary" style="padding: 10px 20px; background: #3182ce; border: none; color: white; cursor: pointer; border-radius: 4px;" disabled>
                    <i class="fas fa-arrow-right"></i> Weiter
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    let selectedType = null;

    // Event listeners
    const closeBtn = modal.querySelector('.close-btn');
    const cancelBtn = modal.querySelector('.cancel-btn');
    const continueBtn = modal.querySelector('.continue-btn');
    const typeOptions = modal.querySelectorAll('.tool-type-option');

    const closeModal = () => {
        document.body.removeChild(modal);
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Type selection
    typeOptions.forEach(option => {
        option.addEventListener('click', () => {
            typeOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            selectedType = option.dataset.type;
            continueBtn.disabled = false;
            
            // Shimmer-Effekt beim Klick
            option.classList.add('shimmer');
            setTimeout(() => {
                option.classList.remove('shimmer');
            }, 800);
            
            // Überschrift dauerhaft ändern bei Klick
            const titleElement = modal.querySelector('#tool-type-title');
            if (selectedType === 'application') {
                titleElement.innerHTML = '<i class="fas fa-desktop"></i> Anwendung';
            } else if (selectedType === 'link') {
                titleElement.innerHTML = '<i class="fas fa-link"></i> Link';
            } else if (selectedType === 'network') {
                titleElement.innerHTML = '<i class="fas fa-network-wired"></i> Netzwerkpfad';
            } else if (selectedType === 'workspace') {
                titleElement.innerHTML = '<i class="fas fa-folder"></i> Arbeitsumgebung';
            }
        });
        
        // Hover-Effekt für Überschrift
        option.addEventListener('mouseenter', () => {
            const titleElement = modal.querySelector('#tool-type-title');
            const type = option.dataset.type;
            
            // Subtiler Shimmer-Effekt beim Hover
            if (!option.classList.contains('selected')) {
                option.classList.add('shimmer');
                setTimeout(() => {
                    option.classList.remove('shimmer');
                }, 600);
            }
            
            if (type === 'application') {
                titleElement.innerHTML = '<i class="fas fa-desktop"></i> Anwendung';
            } else if (type === 'link') {
                titleElement.innerHTML = '<i class="fas fa-link"></i> Link';
            } else if (type === 'network') {
                titleElement.innerHTML = '<i class="fas fa-network-wired"></i> Netzwerkpfad';
            } else if (type === 'workspace') {
                titleElement.innerHTML = '<i class="fas fa-folder"></i> Arbeitsumgebung';
            }
        });
        
        option.addEventListener('mouseleave', () => {
            const titleElement = modal.querySelector('#tool-type-title');
            // Nur zur Standard-Überschrift zurückkehren, wenn keine Option ausgewählt ist
            if (!option.classList.contains('selected') && selectedType === null) {
                titleElement.innerHTML = '<i class="fas fa-plus"></i> Tool hinzufügen';
            } else if (option.classList.contains('selected')) {
                // Bei einer ausgewählten Option die entsprechende Überschrift beibehalten
                if (selectedType === 'application') {
                    titleElement.innerHTML = '<i class="fas fa-desktop"></i> Anwendung';
                } else if (selectedType === 'link') {
                    titleElement.innerHTML = '<i class="fas fa-link"></i> Link';
                } else if (selectedType === 'network') {
                    titleElement.innerHTML = '<i class="fas fa-network-wired"></i> Netzwerkpfad';
                } else if (selectedType === 'workspace') {
                    titleElement.innerHTML = '<i class="fas fa-folder"></i> Arbeitsumgebung';
                }
            }
        });
    });

    continueBtn.addEventListener('click', () => {
        closeModal();
        
        if (selectedType === 'application') {
            showAddApplicationDialog();
        } else if (selectedType === 'link') {
            showAddLinkDialog();
        } else if (selectedType === 'network') {
            showAddNetworkPathDialog();
        } else if (selectedType === 'workspace') {
            showAddWorkspaceDialog();
        }
    });
}

// Show dialog to add Link
function showAddLinkDialog() {
    const modal = document.createElement('div');
    modal.className = 'infoboard-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
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
            <div class="modal-header" style="padding: 20px; border-bottom: 1px solid #4a5568; display: flex; justify-content: space-between; align-items: center; background-color: #1a202c;">
                <h2 style="margin: 0; color: #ffffff;"><i class="fas fa-link"></i> Link</h2>
                <button class="close-btn" style="background: none; border: none; color: #cbd5e0; font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            <div class="modal-body" style="padding: 20px;">
                <form id="link-form">
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; color: #e2e8f0; font-weight: bold;">Name:</label>
                        <input type="text" id="link-name" class="form-control" placeholder="z.B. Intranet Portal" 
                               style="width: 100%; background: #1a202c; border: 1px solid #4a5568; color: white; padding: 8px; border-radius: 4px;" required>
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; color: #e2e8f0; font-weight: bold;">URL:</label>
                        <input type="url" id="link-url" class="form-control" placeholder="https://..." 
                               style="width: 100%; background: #1a202c; border: 1px solid #4a5568; color: white; padding: 8px; border-radius: 4px;" required>
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; color: #e2e8f0; font-weight: bold;">Browser:</label>
                        <select id="link-browser" class="form-control" style="width: 100%; background: #1a202c; border: 1px solid #4a5568; color: white; padding: 8px; border-radius: 4px;">
                            <option value="default">Standard Browser</option>
                            <option value="firefox-intranet">Firefox (Intranet Profil)</option>
                            <option value="firefox-remote">Firefox (Remote Profil)</option>
                            <option value="firefox">Firefox</option>
                            <option value="chrome">Google Chrome</option>
                            <option value="edge">Microsoft Edge</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: flex; align-items: center; color: #e2e8f0; cursor: pointer;">
                            <input type="checkbox" id="link-autostart" style="margin-right: 8px;">
                            <span>Beim Start automatisch öffnen</span>
                        </label>
                    </div>
                </form>
            </div>
            <div class="modal-footer" style="padding: 20px; border-top: 1px solid #4a5568; display: flex; justify-content: flex-end; gap: 10px;">
                <button class="cancel-btn btn btn-secondary" style="padding: 10px 20px; background: #718096; border: none; color: white; cursor: pointer; border-radius: 4px;">Abbrechen</button>
                <button class="save-btn btn btn-success" style="padding: 10px 20px; background: #48bb78; border: none; color: white; cursor: pointer; border-radius: 4px;">
                    <i class="fas fa-save"></i> Hinzufügen
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    const closeBtn = modal.querySelector('.close-btn');
    const cancelBtn = modal.querySelector('.cancel-btn');
    const saveBtn = modal.querySelector('.save-btn');
    const nameInput = modal.querySelector('#link-name');
    const urlInput = modal.querySelector('#link-url');
    const browserSelect = modal.querySelector('#link-browser');
    const autostartCheckbox = modal.querySelector('#link-autostart');

    const closeModal = () => {
        document.body.removeChild(modal);
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    saveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const name = nameInput.value.trim();
        const url = urlInput.value.trim();
        const browser = browserSelect.value;
        const autostart = autostartCheckbox.checked;

        if (!name || !url) {
            alert('Bitte Name und URL eingeben!');
            return;
        }

        try {
            showLoading("Link wird hinzugefügt...");
            
            const newLink = {
                name: name,
                path: url,
                type: 'link',
                browser: browser,
                admin: false,
                autostart: autostart,
                favorite: false,
                tags: ['link'],
                created_at: new Date().toISOString()
            };

            const response = await fetch('/api/tools', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newLink)
            });

            hideLoading();

            if (response.ok) {
                const savedTool = await response.json();
                console.log("Link saved:", savedTool);
                showNotification(`✅ Link "${name}" wurde erfolgreich hinzugefügt`, "success", true);
                closeModal();
                loadTools(); // Refresh the tools list
            } else {
                const error = await response.json();
                throw new Error(error.error || "Fehler beim Speichern");
            }
        } catch (error) {
            hideLoading();
            console.error("Error saving link:", error);
            showNotification("Fehler beim Speichern: " + error.message, "error");
        }
    });

    // Focus name input
    nameInput.focus();
}

// Show dialog to add Network Path
function showAddNetworkPathDialog() {
    const modal = document.createElement('div');
    modal.className = 'infoboard-modal';
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
            <div class="modal-header" style="padding: 20px; border-bottom: 1px solid #4a5568; display: flex; justify-content: space-between; align-items: center; background-color: #1a202c;">
                <h2 style="margin: 0; color: #ffffff;"><i class="fas fa-network-wired"></i> Netzwerkpfad</h2>
                <button class="close-btn" style="background: none; border: none; color: #cbd5e0; font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            <div class="modal-body" style="padding: 20px;">
                <form id="network-form">
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; color: #e2e8f0; font-weight: bold;">Name:</label>
                        <input type="text" id="network-name" class="form-control" placeholder="z.B. Netzlaufwerk H" 
                               style="width: 100%; background: #1a202c; border: 1px solid #4a5568; color: white; padding: 8px; border-radius: 4px;" required>
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; color: #e2e8f0; font-weight: bold;">Netzwerkpfad:</label>
                        <input type="text" id="network-path" class="form-control" placeholder="\\\\server\\share oder H:" 
                               style="width: 100%; background: #1a202c; border: 1px solid #4a5568; color: white; padding: 8px; border-radius: 4px;" required>
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: flex; align-items: center; color: #e2e8f0; cursor: pointer;">
                            <input type="checkbox" id="network-admin" style="margin-right: 8px;">
                            <span>Als Administrator öffnen</span>
                        </label>
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: flex; align-items: center; color: #e2e8f0; cursor: pointer;">
                            <input type="checkbox" id="network-autostart" style="margin-right: 8px;">
                            <span>Beim Start automatisch öffnen</span>
                        </label>
                    </div>
                </form>
            </div>
            <div class="modal-footer" style="padding: 20px; border-top: 1px solid #4a5568; display: flex; justify-content: flex-end; gap: 10px;">
                <button class="cancel-btn btn btn-secondary" style="padding: 10px 20px; background: #718096; border: none; color: white; cursor: pointer; border-radius: 4px;">Abbrechen</button>
                <button class="save-btn btn btn-success" style="padding: 10px 20px; background: #48bb78; border: none; color: white; cursor: pointer; border-radius: 4px;">
                    <i class="fas fa-save"></i> Hinzufügen
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    const closeBtn = modal.querySelector('.close-btn');
    const cancelBtn = modal.querySelector('.cancel-btn');
    const saveBtn = modal.querySelector('.save-btn');
    const nameInput = modal.querySelector('#network-name');
    const pathInput = modal.querySelector('#network-path');
    const adminCheckbox = modal.querySelector('#network-admin');
    const autostartCheckbox = modal.querySelector('#network-autostart');

    const closeModal = () => {
        document.body.removeChild(modal);
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    saveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const name = nameInput.value.trim();
        const path = pathInput.value.trim();
        const admin = adminCheckbox.checked;
        const autostart = autostartCheckbox.checked;

        if (!name || !path) {
            alert('Bitte Name und Pfad eingeben!');
            return;
        }

        try {
            showLoading("Netzwerkpfad wird hinzugefügt...");
            
            const newNetworkPath = {
                name: name,
                path: path,
                type: 'network',
                admin: admin,
                autostart: autostart,
                favorite: false,
                tags: ['network'],
                created_at: new Date().toISOString()
            };

            const response = await fetch('/api/tools', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newNetworkPath)
            });

            hideLoading();

            if (response.ok) {
                const savedTool = await response.json();
                console.log("Network path saved:", savedTool);
                showNotification(`✅ Netzwerkpfad "${name}" wurde erfolgreich hinzugefügt`, "success", true);
                closeModal();
                loadTools(); // Refresh the tools list
            } else {
                const error = await response.json();
                throw new Error(error.error || "Fehler beim Speichern");
            }
        } catch (error) {
            hideLoading();
            console.error("Error saving network path:", error);
            showNotification("Fehler beim Speichern: " + error.message, "error");
        }
    });

    // Focus name input
    nameInput.focus();
}

// Show dialog to add Workspace
function showAddWorkspaceDialog() {
    const modal = document.createElement('div');
    modal.className = 'infoboard-modal';
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
            <div class="modal-header" style="padding: 20px; border-bottom: 1px solid #4a5568; display: flex; justify-content: space-between; align-items: center; background-color: #1a202c;">
                <h2 style="margin: 0; color: #ffffff;"><i class="fas fa-folder"></i> Arbeitsumgebung</h2>
                <button class="close-btn" style="background: none; border: none; color: #cbd5e0; font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            <div class="modal-body" style="padding: 20px;">
                <form id="workspace-form">
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; color: #e2e8f0; font-weight: bold;">Name:</label>
                        <input type="text" id="workspace-name" class="form-control" placeholder="z.B. Projekt ABC" 
                               style="width: 100%; background: #1a202c; border: 1px solid #4a5568; color: white; padding: 8px; border-radius: 4px;" required>
                    </div>
                    <div class="form-group" style="margin-bottom: 15px; color: #a0aec0; font-size: 0.9em;">
                        <i class="fas fa-info-circle"></i> Ein Ordner wird automatisch in Ihren Dokumenten erstellt, in dem Sie Verknüpfungsdateien (.lnk) ablegen können.
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: flex; align-items: center; color: #e2e8f0; cursor: pointer;">
                            <input type="checkbox" id="workspace-autostart" style="margin-right: 8px;">
                            <span>Beim Start automatisch öffnen</span>
                        </label>
                    </div>
                </form>
            </div>
            <div class="modal-footer" style="padding: 20px; border-top: 1px solid #4a5568; display: flex; justify-content: flex-end; gap: 10px;">
                <button class="cancel-btn btn btn-secondary" style="padding: 10px 20px; background: #718096; border: none; color: white; cursor: pointer; border-radius: 4px;">Abbrechen</button>
                <button class="save-btn btn btn-success" style="padding: 10px 20px; background: #48bb78; border: none; color: white; cursor: pointer; border-radius: 4px;">
                    <i class="fas fa-save"></i> Hinzufügen
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    const closeBtn = modal.querySelector('.close-btn');
    const cancelBtn = modal.querySelector('.cancel-btn');
    const saveBtn = modal.querySelector('.save-btn');
    const nameInput = modal.querySelector('#workspace-name');
    const autostartCheckbox = modal.querySelector('#workspace-autostart');

    const closeModal = () => {
        document.body.removeChild(modal);
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    saveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const name = nameInput.value.trim();
        const autostart = autostartCheckbox.checked;

        if (!name) {
            alert('Bitte geben Sie einen Namen ein!');
            return;
        }

        try {
            showLoading("Arbeitsumgebung wird hinzugefügt...");
            
            const newWorkspace = {
                name: name,
                path: path,
                type: 'workspace',
                admin: false,
                autostart: autostart,
                favorite: false,
                tags: ['workspace'],
                created_at: new Date().toISOString()
            };

            const response = await fetch('/api/tools', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newWorkspace)
            });

            hideLoading();

            if (response.ok) {
                const savedTool = await response.json();
                console.log("Workspace saved:", savedTool);
                showNotification(`✅ Arbeitsumgebung "${name}" wurde erfolgreich hinzugefügt`, "success", true);
                closeModal();
                loadTools(); // Refresh the tools list
            } else {
                const error = await response.json();
                throw new Error(error.error || "Fehler beim Speichern");
            }
        } catch (error) {
            hideLoading();
            console.error("Error saving workspace:", error);
            showNotification("Fehler beim Speichern: " + error.message, "error");
        }
    });

    // Focus name input
    nameInput.focus();
}

// Show dialog to add Application
function showAddApplicationDialog() {
    const modal = document.createElement('div');
    modal.className = 'infoboard-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
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
            <div class="modal-header" style="padding: 20px; border-bottom: 1px solid #4a5568; display: flex; justify-content: space-between; align-items: center; background-color: #1a202c;">
                <h2 style="margin: 0; color: #ffffff;"><i class="fas fa-desktop"></i> Anwendung</h2>
                <button class="close-btn" style="background: none; border: none; color: #cbd5e0; font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            <div class="modal-body" style="padding: 20px; text-align: center;">
                <p style="color: #e2e8f0; margin-bottom: 20px;">Wählen Sie eine Anwendung aus:</p>
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button class="browse-btn btn btn-primary" style="padding: 15px 25px; background: #3182ce; border: none; color: white; cursor: pointer; border-radius: 4px; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-folder-open"></i> Durchsuchen
                    </button>
                </div>
            </div>
            <div class="modal-footer" style="padding: 20px; border-top: 1px solid #4a5568; display: flex; justify-content: flex-end;">
                <button class="close-modal-btn btn btn-secondary" style="padding: 10px 20px; background: #718096; border: none; color: white; cursor: pointer; border-radius: 4px;">Abbrechen</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    const closeBtn = modal.querySelector('.close-btn');
    const closeModalBtn = modal.querySelector('.close-modal-btn');
    const browseBtn = modal.querySelector('.browse-btn');

    const closeModal = () => {
        document.body.removeChild(modal);
    };

    closeBtn.addEventListener('click', closeModal);
    closeModalBtn.addEventListener('click', closeModal);

    browseBtn.addEventListener('click', () => {
        closeModal();
        browseTool();
    });
}

// Show dialog to manually enter application
function showManualApplicationDialog() {
    const modal = document.createElement('div');
    modal.className = 'infoboard-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
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
            <div class="modal-header" style="padding: 20px; border-bottom: 1px solid #4a5568; display: flex; justify-content: space-between; align-items: center; background-color: #1a202c;">
                <h2 style="margin: 0; color: #ffffff;"><i class="fas fa-desktop"></i> Anwendung</h2>
                <button class="close-btn" style="background: none; border: none; color: #cbd5e0; font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            <div class="modal-body" style="padding: 20px;">
                <form id="app-form">
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; color: #e2e8f0; font-weight: bold;">Name:</label>
                        <input type="text" id="app-name" class="form-control" placeholder="z.B. Notepad" 
                               style="width: 100%; background: #1a202c; border: 1px solid #4a5568; color: white; padding: 8px; border-radius: 4px;" required>
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; color: #e2e8f0; font-weight: bold;">Pfad:</label>
                        <input type="text" id="app-path" class="form-control" placeholder="z.B. C:\\Windows\\System32\\notepad.exe" 
                               style="width: 100%; background: #1a202c; border: 1px solid #4a5568; color: white; padding: 8px; border-radius: 4px;" required>
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; color: #e2e8f0; font-weight: bold;">Beschreibung (optional):</label>
                        <input type="text" id="app-description" class="form-control" placeholder="z.B. Texteditor" 
                               style="width: 100%; background: #1a202c; border: 1px solid #4a5568; color: white; padding: 8px; border-radius: 4px;">
                    </div>
                </form>
            </div>
            <div class="modal-footer" style="padding: 20px; border-top: 1px solid #4a5568; display: flex; justify-content: flex-end; gap: 10px;">
                <button class="close-modal-btn btn btn-secondary" style="padding: 10px 20px; background: #718096; border: none; color: white; cursor: pointer; border-radius: 4px;">Abbrechen</button>
                <button class="save-btn btn btn-success" style="padding: 10px 20px; background: #38a169; border: none; color: white; cursor: pointer; border-radius: 4px;">
                    <i class="fas fa-save"></i> Speichern
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    const closeBtn = modal.querySelector('.close-btn');
    const closeModalBtn = modal.querySelector('.close-modal-btn');
    const saveBtn = modal.querySelector('.save-btn');
    const nameInput = modal.querySelector('#app-name');
    const pathInput = modal.querySelector('#app-path');
    const descriptionInput = modal.querySelector('#app-description');

    const closeModal = () => {
        document.body.removeChild(modal);
    };

    closeBtn.addEventListener('click', closeModal);
    closeModalBtn.addEventListener('click', closeModal);

    saveBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        const path = pathInput.value.trim();
        const description = descriptionInput.value.trim();

        if (!name || !path) {
            showNotification("Name und Pfad sind erforderlich", "error");
            return;
        }

        try {
            showLoading("Speichere Anwendung...");
            closeModal();

            const newTool = {
                id: Date.now(),
                name: name,
                path: path,
                description: description || null,
                type: 'application'
            };

            const response = await fetch('/api/tools', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTool)
            });

            hideLoading();

            if (response.ok) {
                showNotification("✅ Anwendung wurde erfolgreich hinzugefügt", "success", true);
                loadTools(); // Reload tools
            } else {
                const error = await response.json();
                showNotification("Fehler beim Speichern: " + (error.message || "Unbekannter Fehler"), "error");
            }
        } catch (error) {
            hideLoading();
            console.error("Error saving application:", error);
            showNotification("Fehler beim Speichern: " + error.message, "error");
        }
    });

    // Focus name input
    nameInput.focus();
}

// Add optimistic UI helpers for workspace imports
function addWorkspaceChipToDOM(workspaceId, tool) {
  try {
    const workspaceCard = document.querySelector(`.workspace-card[data-id="${workspaceId}"]`);
    if (!workspaceCard) return false;
    const chipList = workspaceCard.querySelector('.workspace-chip-list');
    if (!chipList) return false;

    // Remove hint if present
    const hint = workspaceCard.querySelector('.workspace-drop-hint');
    if (hint) hint.remove();

    // Create chip element
    const btn = document.createElement('button');
    btn.className = 'workspace-chip start-tool';
    btn.setAttribute('data-id', tool.id || '');
    btn.title = tool.name || 'Tool';
    btn.innerHTML = `<i class="fas fa-folder"></i>`;

    // Attach click handler to start the workspace tool when clicked
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await startTool({ id: parseInt(btn.dataset.id), is_workspace_tool: true, path: tool.path });
    });

    chipList.appendChild(btn);
    chipList.classList.remove('is-empty');
    return true;
  } catch (err) {
    console.error('addWorkspaceChipToDOM error', err);
    return false;
  }
}

// Show a temporary loading indicator on the workspace card
function showWorkspaceLoading(workspaceId) {
  const workspaceCard = document.querySelector(`.workspace-card[data-id="${workspaceId}"]`);
  if (!workspaceCard) return null;
  let loader = workspaceCard.querySelector('.workspace-loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.className = 'workspace-loader';
    loader.innerHTML = '<span class="loader-dot"></span> Importiere...';
    loader.style.marginTop = '8px';
    workspaceCard.querySelector('.workspace-drop-zone').appendChild(loader);
  }
  return loader;
}

function hideWorkspaceLoading(workspaceId) {
  const workspaceCard = document.querySelector(`.workspace-card[data-id="${workspaceId}"]`);
  if (!workspaceCard) return;
  const loader = workspaceCard.querySelector('.workspace-loader');
  if (loader) loader.remove();
}

async function importToolToWorkspace(workspaceId, toolId) {
  // Show optimistic UI: add a temporary chip immediately and show loader
  const tempTool = { id: toolId, name: 'Import...' , path: '' };
  const added = addWorkspaceChipToDOM(workspaceId, tempTool);
  const loader = showWorkspaceLoading(workspaceId);

  const payload = {
    workspace_id: workspaceId,
    tool_id: toolId,
  };

  const endpoints = ['/api/workspaces/import', '/api/workspace-import'];
  let lastError = null;

  for (const url of endpoints) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data && data.success) {
          // Replace temporary chip with final info (if present)
          hideWorkspaceLoading(workspaceId);
          // Update the last chip we added with real data
          try {
            const workspaceCard = document.querySelector(`.workspace-card[data-id="${workspaceId}"]`);
            if (workspaceCard) {
              const chips = workspaceCard.querySelectorAll('.workspace-chip');
              const lastChip = chips[chips.length - 1];
              if (lastChip) {
                lastChip.setAttribute('data-id', data.tool_id || toolId);
                lastChip.title = data.shortcut_path || (data.name || 'Tool');
                // store path so startTool can use it
                lastChip.dataset.path = data.shortcut_path || '';
              }
            }
          } catch (e) {
            console.warn('Could not update temp chip with response data', e);
          }

          return { success: true, data };
        }
        lastError = data && data.error ? data.error : 'Unbekannter Fehler';
        hideWorkspaceLoading(workspaceId);
        return { success: false, error: lastError };
      }

      if (resp.status === 404 || resp.status === 405) {
        lastError = `Endpoint ${url} nicht verfügbar (${resp.status})`;
        continue;
      }

      const errorData = await resp.json().catch(() => null);
      lastError = errorData && errorData.error ? errorData.error : `HTTP ${resp.status}`;
      hideWorkspaceLoading(workspaceId);
      return { success: false, error: lastError };
    } catch (err) {
      lastError = err.message || 'Netzwerkfehler';
    }
  }

  // If we get here, all endpoints failed
  hideWorkspaceLoading(workspaceId);
  // Remove the optimistic chip we added earlier (cleanup)
  try {
    const workspaceCard = document.querySelector(`.workspace-card[data-id="${workspaceId}"]`);
    if (workspaceCard) {
      const chips = workspaceCard.querySelectorAll('.workspace-chip');
      const lastChip = chips[chips.length - 1];
      if (lastChip && lastChip.title === 'Import...') lastChip.remove();
    }
  } catch (e) {
    console.warn('Error cleaning up temp chip', e);
  }

  return { success: false, error: lastError || 'Unbekannter Fehler beim Workspace-Import' };
}

// Kontakte filtern basierend auf dem Suchbegriff
function filterContacts(searchTerm, contacts) {
    const contactCards = document.querySelectorAll('.contact-card');
    contactCards.forEach(card => {
        const contactId = parseInt(card.dataset.id);
        const contact = contacts.find(c => c.id === contactId);
        
        if (contact) {
            const matchesSearch = 
                (contact.name && contact.name.toLowerCase().includes(searchTerm)) ||
                (contact.phone && contact.phone.toLowerCase().includes(searchTerm)) ||
                (contact.department && contact.department.toLowerCase().includes(searchTerm)) ||
                (contact.pkz && contact.pkz.toLowerCase().includes(searchTerm));
                
            card.style.display = matchesSearch ? 'flex' : 'none';
        }
    });
}

// Modal für das Hinzufügen eines neuen Kontakts anzeigen
function showAddContactModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Kontakt hinzufügen</h3>
                <button class="close-button">&times;</button>
            </div>
            <div class="modal-body">
                <form id="add-contact-form">
                    <div class="form-group">
                        <label for="contact-name">Name *</label>
                        <input type="text" id="contact-name" required class="form-control" placeholder="Name eingeben">
                    </div>
                    <div class="form-group">
                        <label for="contact-phone">Telefon *</label>
                        <input type="text" id="contact-phone" required class="form-control" placeholder="Telefonnummer eingeben">
                    </div>
                    <div class="form-group">
                        <label for="contact-department">Abteilung</label>
                        <input type="text" id="contact-department" class="form-control" placeholder="Abteilung eingeben">
                    </div>
                    <div class="form-group">
                        <label for="contact-pkz">PKZ</label>
                        <input type="text" id="contact-pkz" class="form-control" placeholder="PKZ eingeben">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary cancel-btn">Abbrechen</button>
                        <button type="submit" class="btn btn-primary">Speichern</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Schließen-Button
    const closeBtn = modal.querySelector('.close-button');
    const cancelBtn = modal.querySelector('.cancel-btn');
    
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    cancelBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    // Formular-Submit
    const form = modal.querySelector('#add-contact-form');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Pflichtfelder prüfen
        const nameInput = document.getElementById('contact-name');
        const phoneInput = document.getElementById('contact-phone');
        
        if (!nameInput.value.trim() || !phoneInput.value.trim()) {
            showNotification("Name und Telefonnummer sind Pflichtfelder", "error");
            return;
        }
        
        // Kontakt-Objekt erstellen
        const newContact = {
            name: nameInput.value.trim(),
            phone: phoneInput.value.trim(),
            department: document.getElementById('contact-department').value.trim() || null,
            pkz: document.getElementById('contact-pkz').value.trim() || null
        };
        
        saveContact(newContact);
        modal.remove();
    });
}

// Modal für das Bearbeiten eines Kontakts anzeigen
function showEditContactModal(contact) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Kontakt bearbeiten</h3>
                <button class="close-button">&times;</button>
            </div>
            <div class="modal-body">
                <form id="edit-contact-form">
                    <input type="hidden" id="contact-id" value="${contact.id}">
                    <div class="form-group">
                        <label for="contact-name">Name *</label>
                        <input type="text" id="contact-name" required class="form-control" value="${escapeHtml(contact.name || '')}" placeholder="Name eingeben">
                    </div>
                    <div class="form-group">
                        <label for="contact-phone">Telefon *</label>
                        <input type="text" id="contact-phone" required class="form-control" value="${escapeHtml(contact.phone || '')}" placeholder="Telefonnummer eingeben">
                    </div>
                    <div class="form-group">
                        <label for="contact-department">Abteilung</label>
                        <input type="text" id="contact-department" class="form-control" value="${escapeHtml(contact.department || '')}" placeholder="Abteilung eingeben">
                    </div>
                    <div class="form-group">
                        <label for="contact-pkz">PKZ</label>
                        <input type="text" id="contact-pkz" class="form-control" value="${escapeHtml(contact.pkz || '')}" placeholder="PKZ eingeben">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary cancel-btn">Abbrechen</button>
                        <button type="submit" class="btn btn-primary">Speichern</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Schließen-Button
    const closeBtn = modal.querySelector('.close-button');
    const cancelBtn = modal.querySelector('.cancel-btn');
    
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    cancelBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    // Formular-Submit
    const form = modal.querySelector('#edit-contact-form');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Pflichtfelder prüfen
        const nameInput = document.getElementById('contact-name');
        const phoneInput = document.getElementById('contact-phone');
        
        if (!nameInput.value.trim() || !phoneInput.value.trim()) {
            showNotification("Name und Telefonnummer sind Pflichtfelder", "error");
            return;
        }
        
        // Kontakt-Objekt erstellen
        const updatedContact = {
            id: parseInt(document.getElementById('contact-id').value),
            name: nameInput.value.trim(),
            phone: phoneInput.value.trim(),
            department: document.getElementById('contact-department').value.trim() || null,
            pkz: document.getElementById('contact-pkz').value.trim() || null
        };
        
        updateContact(updatedContact);
        modal.remove();
    });
}

// Kontakt speichern (neu)
async function saveContact(contact) {
    try {
        showLoading("Kontakt wird gespeichert...");
        
        const response = await fetch('/api/telefonbuch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(contact)
        });
        
        hideLoading();
        
        if (response.ok) {
            const result = await response.json();
            showNotification("Kontakt erfolgreich gespeichert", "success");
            
            // Cache aktualisieren und neu rendern
            invalidateCache('telefonbuch');
            loadModule('telefonbuch');
        } else {
            const error = await response.json();
            throw new Error(error.message || "Fehler beim Speichern des Kontakts");
        }
    } catch (error) {
        hideLoading();
        console.error("Fehler beim Speichern des Kontakts:", error);
        showNotification("Fehler: " + error.message, "error");
    }
}

// Kontakt aktualisieren
async function updateContact(contact) {
    try {
        showLoading("Kontakt wird aktualisiert...");
        
        const response = await fetch(`/api/telefonbuch/${contact.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(contact)
        });
        
        hideLoading();
        
        if (response.ok) {
            showNotification("Kontakt erfolgreich aktualisiert", "success");
            
            // Cache aktualisieren und neu rendern
            invalidateCache('telefonbuch');
            loadModule('telefonbuch');
        } else {
            const error = await response.json();
            throw new Error(error.message || "Fehler beim Aktualisieren des Kontakts");
        }
    } catch (error) {
        hideLoading();
        console.error("Fehler beim Aktualisieren des Kontakts:", error);
        showNotification("Fehler: " + error.message, "error");
    }
}

// Kontakt löschen
async function deleteContact(contactId) {
    try {
        showLoading("Kontakt wird gelöscht...");
        
        const response = await fetch(`/api/telefonbuch/${contactId}`, {
            method: 'DELETE'
        });
        
        hideLoading();
        
        if (response.ok) {
            showNotification("Kontakt erfolgreich gelöscht", "success");
            
            // Cache aktualisieren und neu rendern
            invalidateCache('telefonbuch');
            loadModule('telefonbuch');
        } else {
            const error = await response.json();
            throw new Error(error.message || "Fehler beim Löschen des Kontakts");
        }
    } catch (error) {
        hideLoading();
        console.error("Fehler beim Löschen des Kontakts:", error);
        showNotification("Fehler: " + error.message, "error");
    }
}

// Modul-Rendering basierend auf dem Modulnamen
function renderModule(moduleName, items) {
  console.log(`Rendering module: ${moduleName} with items:`, items);
  
  if (moduleName === 'tools') {
    content.innerHTML = `
      <div class="module-header"><h2><i class="fas fa-tools"></i> Tools</h2></div>
      <div id="tools-container" class="tools-content">
        <div class="loading">Lade Tools...</div>
      </div>
    `;
    loadTools();
  } else if (moduleName === 'tickets') {
    // Für Tickets immer die aktuelle Version aus localStorage laden
    const ticketsData = JSON.parse(localStorage.getItem('tickets') || '[]');
    moduleCache['tickets'] = ticketsData;
    renderTickets(ticketsData);
  } else if (moduleName === 'drucker') {
    // Verwende die items vom Backend oder fallback zu leerer Liste
    const printers = items || [];
    console.log("Rendering drucker with data:", printers);
    renderPrinters(printers);
  } else if (moduleName === 'netzwerk') {
    // Lade Netzwerk-Interface
    console.log("Rendering netzwerk");
    renderNetwork();
  } else if (moduleName === 'telefonbuch') {
    // Verwende die items vom Backend oder fallback zu leerer Liste
    const contacts = items || [];
    console.log("Rendering telefonbuch with data:", contacts);
    renderPhonebook(contacts);
  } else if (moduleName === 'faq') {
    // Verwende die items vom Backend oder fallback zu leerer Liste
    const faqItems = items || [];
    console.log("Rendering faq with data:", faqItems);
    renderFAQ(faqItems);
  } else if (moduleName === 'worksets') {
    // Worksets werden asynchron geladen
    console.log("Rendering worksets");
    content.innerHTML = `
      <div class="module-header">
        <h2><i class="fas fa-layer-group"></i> Worksets</h2>
      </div>
      <div class="loading">Lade Worksets...</div>
    `;
    loadWorksets();
  } else {
    console.warn(`Unknown module: ${moduleName}`);
    // Fallback für unbekannte Module
    const content = document.getElementById('content');
    if (content) {
      content.innerHTML = `
        <div class="module-header">
          <h2><i class="fas fa-question-circle"></i> ${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}</h2>
        </div>
        <div class="empty-state">
          <i class="fas fa-info-circle fa-3x"></i>
          <h3>Modul wird geladen...</h3>
          <p>Das ${moduleName}-Modul wird noch entwickelt.</p>
        </div>
      `;
    }
  }
}

// Hilfsfunktion, um das passende Icon für eine Kategorie zu bestimmen
function getIconForCategory(category) {
  // Standardisiere die Kategorie (Kleinbuchstaben, keine Sonderzeichen)
  const normalizedCategory = category.toLowerCase().trim();
  
  // Icons für bekannte Kategorien
  const iconMap = {
    'drucker': 'fas fa-print',
    'netzwerk': 'fas fa-network-wired',
    'ticket': 'fas fa-ticket-alt',
    'text': 'fas fa-font',
    'allgemein': 'fas fa-info-circle',
    'teams': 'fas fa-users',
    'outlook': 'far fa-envelope',
    'lock': 'fas fa-lock',
    'windows': 'fab fa-windows',
    'office': 'far fa-file-word',
    'software': 'fas fa-download',
    'hardware': 'fas fa-desktop',
    'support': 'fas fa-headset',
    'anleitung': 'fas fa-book'
  };
  
  // Durchsuche den Kategorienamen nach Schlüsselwörtern
  for (const [keyword, icon] of Object.entries(iconMap)) {
    if (normalizedCategory.includes(keyword)) {
      return icon;
    }
  }
  
  // Fallback für unbekannte Kategorien
  return 'fas fa-question-circle';
}

// Function to close the modal
function closeToolModal() {
    const modal = document.getElementById('add-tool-modal');
    if (modal) {
        modal.remove();
    }
}

// Toggle autostart mode for a tool
async function toggleToolAutostart(toolId, enable) {
    try {
        console.log(`Toggling autostart for tool ${toolId} to ${enable}`);
        showLoading("Aktualisiere Tool...");
        
        const response = await fetch(`/api/tools/${toolId}/autostart`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ autostart: enable })
        });
        
        hideLoading();
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        // Update UI to reflect the change
        const toggleBtn = document.querySelector(`.tool-item[data-id="${toolId}"] .toggle-autostart`);
        const toolItem = document.querySelector(`.tool-item[data-id="${toolId}"]`);
        const toolName = toolItem ? toolItem.querySelector('.tool-name')?.textContent || 'Tool' : 'Tool';
        
        if (toggleBtn) {
            if (enable) {
                toggleBtn.classList.add('active');
                toggleBtn.title = 'Autostart deaktivieren';
                toggleBtn.querySelector('i').className = 'fas fa-toggle-on';
            } else {
                toggleBtn.classList.remove('active');
                toggleBtn.title = 'Autostart aktivieren';
                toggleBtn.querySelector('i').className = 'fas fa-toggle-off';
            }
        }
        
        // Show notification with tool name and checkmark
        const statusText = enable ? 'aktiviert' : 'deaktiviert';
        const icon = enable ? '✅' : '⏸️';
        showNotification(`${icon} Autostart für "${toolName}" ${statusText}`, 'success', true);
        
    } catch (error) {
        hideLoading();
        console.error("Error toggling autostart:", error);
        showNotification(`Fehler: ${error.message}`, 'error');
    }
}

// Toggle admin mode for a tool
async function toggleToolAdmin(toolId, enable) {
    try {
        console.log(`Toggling admin mode for tool ${toolId} to ${enable}`);
        showLoading("Aktualisiere Tool...");
        
        const response = await fetch(`/api/tools/${toolId}/admin`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin: enable })
        });
        
        hideLoading();
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        // Update UI to reflect the change
        const toggleBtn = document.querySelector(`.tool-item[data-id="${toolId}"] .toggle-admin`);
        if (toggleBtn) {
            if (enable) {
                toggleBtn.classList.add('active');
                toggleBtn.title = 'Admin-Modus deaktivieren';
                toggleBtn.querySelector('i').className = 'fas fa-user-shield';
            } else {
                toggleBtn.classList.remove('active');
                toggleBtn.title = 'Als Administrator starten';
                toggleBtn.querySelector('i').className = 'fas fa-user';
            }
        }
        
        // Show notification
        showNotification(`Administrator-Modus ${enable ? 'aktiviert' : 'deaktiviert'}`, 'info');
        
    } catch (error) {
        hideLoading();
        console.error("Error toggling admin mode:", error);
        showNotification(`Fehler: ${error.message}`, 'error');
    }
}

// Delete a tool
async function deleteTool(toolId) {
    try {
        if (!confirm("Sind Sie sicher, dass Sie dieses Tool löschen möchten?")) {
            return;
        }
        
        console.log("Deleting tool:", toolId);
        showLoading("Lösche Tool...");
        
        const response = await fetch(`/api/tools/${toolId}`, {
            method: 'DELETE'
        });
        
        hideLoading();
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        // Show notification
        showNotification("Tool wurde gelöscht", 'info');
        
        // Invalidate cache and reload tools
        invalidateCache('tools');
        await loadModule('tools');
        
    } catch (error) {
        hideLoading();
        console.error("Error deleting tool:", error);
        showNotification("Fehler beim Löschen: " + error.message, 'error');
    }
}

// (duplicate renderPhonebook removed — calendar-aware version at top remains)

// Modal close function
function closeModal() {
    const modalOverlay = document.querySelector('.modal-overlay');
    if (modalOverlay) {
        modalOverlay.remove();
    }
}

// Show Tool Type Selection Dialog
function showToolTypeDialog() {
    const modal = document.createElement('div');
    modal.className = 'tool-type-modal';
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
            <div class="modal-header" style="padding: 20px; border-bottom: 1px solid #4a5568; display: flex; justify-content: space-between; align-items: center; background-color: #1a202c;">
                <h2 id="tool-type-title" style="margin: 0; color: #ffffff;"><i class="fas fa-plus"></i> Tool hinzufügen</h2>
                <button class="close-btn" style="background: none; border: none; color: #cbd5e0; font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            <div class="modal-body" style="padding: 20px;">
                <p style="color: #e2e8f0; margin-bottom: 20px;">Welchen Typ von Tool möchten Sie hinzufügen?</p>
                <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                    <div class="tool-type-option" data-type="application">
                        <i class="fas fa-desktop"></i>
                        <h4>Anwendung</h4>
                        <p>Programm oder .exe-Datei</p>
                    </div>
                    <div class="tool-type-option" data-type="link">
                        <i class="fas fa-link"></i>
                        <h4>Link</h4>
                        <p>Webseite oder URL</p>
                    </div>
                    <div class="tool-type-option" data-type="network">
                        <i class="fas fa-network-wired"></i>
                        <h4>Netzwerkpfad</h4>
                        <p>UNC-Pfad oder Netzlaufwerk</p>
                    </div>
                    <div class="tool-type-option" data-type="workspace">
                        <i class="fas fa-folder"></i>
                        <h4>Arbeitsumgebung</h4>
                        <p>Ordner oder Workspace</p>
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="padding: 20px; border-top: 1px solid #4a5568; display: flex; justify-content: flex-end; gap: 10px;">
                <button class="cancel-btn btn btn-secondary" style="padding: 10px 20px; background: #718096; border: none; color: white; cursor: pointer; border-radius: 4px;">Abbrechen</button>
                <button class="continue-btn btn btn-primary" style="padding: 10px 20px; background: #3182ce; border: none; color: white; cursor: pointer; border-radius: 4px;" disabled>
                    <i class="fas fa-arrow-right"></i> Weiter
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    let selectedType = null;

    // Event listeners
    const closeBtn = modal.querySelector('.close-btn');
    const cancelBtn = modal.querySelector('.cancel-btn');
    const continueBtn = modal.querySelector('.continue-btn');
    const typeOptions = modal.querySelectorAll('.tool-type-option');

    const closeModal = () => {
        document.body.removeChild(modal);
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Type selection
    typeOptions.forEach(option => {
        option.addEventListener('click', () => {
            typeOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            selectedType = option.dataset.type;
            continueBtn.disabled = false;
            
            // Shimmer-Effekt beim Klick
            option.classList.add('shimmer');
            setTimeout(() => {
                option.classList.remove('shimmer');
            }, 800);
            
            // Überschrift dauerhaft ändern bei Klick
            const titleElement = modal.querySelector('#tool-type-title');
            if (selectedType === 'application') {
                titleElement.innerHTML = '<i class="fas fa-desktop"></i> Anwendung';
            } else if (selectedType === 'link') {
                titleElement.innerHTML = '<i class="fas fa-link"></i> Link';
            } else if (selectedType === 'network') {
                titleElement.innerHTML = '<i class="fas fa-network-wired"></i> Netzwerkpfad';
            } else if (selectedType === 'workspace') {
                titleElement.innerHTML = '<i class="fas fa-folder"></i> Arbeitsumgebung';
            }
        });
        
        // Hover-Effekt für Überschrift
        option.addEventListener('mouseenter', () => {
            const titleElement = modal.querySelector('#tool-type-title');
            const type = option.dataset.type;
            
            // Subtiler Shimmer-Effekt beim Hover
            if (!option.classList.contains('selected')) {
                option.classList.add('shimmer');
                setTimeout(() => {
                    option.classList.remove('shimmer');
                }, 600);
            }
            
            if (type === 'application') {
                titleElement.innerHTML = '<i class="fas fa-desktop"></i> Anwendung';
            } else if (type === 'link') {
                titleElement.innerHTML = '<i class="fas fa-link"></i> Link';
            } else if (type === 'network') {
                titleElement.innerHTML = '<i class="fas fa-network-wired"></i> Netzwerkpfad';
            } else if (type === 'workspace') {
                titleElement.innerHTML = '<i class="fas fa-folder"></i> Arbeitsumgebung';
            }
        });
        
        option.addEventListener('mouseleave', () => {
            const titleElement = modal.querySelector('#tool-type-title');
            // Nur zur Standard-Überschrift zurückkehren, wenn keine Option ausgewählt ist
            if (!option.classList.contains('selected') && selectedType === null) {
                titleElement.innerHTML = '<i class="fas fa-plus"></i> Tool hinzufügen';
            } else if (option.classList.contains('selected')) {
                // Bei einer ausgewählten Option die entsprechende Überschrift beibehalten
                if (selectedType === 'application') {
                    titleElement.innerHTML = '<i class="fas fa-desktop"></i> Anwendung';
                } else if (selectedType === 'link') {
                    titleElement.innerHTML = '<i class="fas fa-link"></i> Link';
                } else if (selectedType === 'network') {
                    titleElement.innerHTML = '<i class="fas fa-network-wired"></i> Netzwerkpfad';
                } else if (selectedType === 'workspace') {
                    titleElement.innerHTML = '<i class="fas fa-folder"></i> Arbeitsumgebung';
                }
            }
        });
    });

    continueBtn.addEventListener('click', () => {
        closeModal();
        
        if (selectedType === 'application') {
            showAddApplicationDialog();
        } else if (selectedType === 'link') {
            showAddLinkDialog();
        } else if (selectedType === 'network') {
            showAddNetworkPathDialog();
        } else if (selectedType === 'workspace') {
            showAddWorkspaceDialog();
        }
    });
}

// Show dialog to add Link
function showAddLinkDialog() {
    const modal = document.createElement('div');
    modal.className = 'infoboard-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
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
            <div class="modal-header" style="padding: 20px; border-bottom: 1px solid #4a5568; display: flex; justify-content: space-between; align-items: center; background-color: #1a202c;">
                <h2 style="margin: 0; color: #ffffff;"><i class="fas fa-link"></i> Link</h2>
                <button class="close-btn" style="background: none; border: none; color: #cbd5e0; font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            <div class="modal-body" style="padding: 20px;">
                <form id="link-form">
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; color: #e2e8f0; font-weight: bold;">Name:</label>
                        <input type="text" id="link-name" class="form-control" placeholder="z.B. Intranet Portal" 
                               style="width: 100%; background: #1a202c; border: 1px solid #4a5568; color: white; padding: 8px; border-radius: 4px;" required>
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; color: #e2e8f0; font-weight: bold;">URL:</label>
                        <input type="url" id="link-url" class="form-control" placeholder="https://..." 
                               style="width: 100%; background: #1a202c; border: 1px solid #4a5568; color: white; padding: 8px; border-radius: 4px;" required>
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; color: #e2e8f0; font-weight: bold;">Browser:</label>
                        <select id="link-browser" class="form-control" style="width: 100%; background: #1a202c; border: 1px solid #4a5568; color: white; padding: 8px; border-radius: 4px;">
                            <option value="default">Standard Browser</option>
                            <option value="firefox-intranet">Firefox (Intranet Profil)</option>
                            <option value="firefox-remote">Firefox (Remote Profil)</option>
                            <option value="firefox">Firefox</option>
                            <option value="chrome">Google Chrome</option>
                            <option value="edge">Microsoft Edge</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: flex; align-items: center; color: #e2e8f0; cursor: pointer;">
                            <input type="checkbox" id="link-autostart" style="margin-right: 8px;">
                            <span>Beim Start automatisch öffnen</span>
                        </label>
                    </div>
                </form>
            </div>
            <div class="modal-footer" style="padding: 20px; border-top: 1px solid #4a5568; display: flex; justify-content: flex-end; gap: 10px;">
                <button class="cancel-btn btn btn-secondary" style="padding: 10px 20px; background: #718096; border: none; color: white; cursor: pointer; border-radius: 4px;">Abbrechen</button>
                <button class="save-btn btn btn-success" style="padding: 10px 20px; background: #48bb78; border: none; color: white; cursor: pointer; border-radius: 4px;">
                    <i class="fas fa-save"></i> Hinzufügen
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    const closeBtn = modal.querySelector('.close-btn');
    const cancelBtn = modal.querySelector('.cancel-btn');
    const saveBtn = modal.querySelector('.save-btn');
    const nameInput = modal.querySelector('#link-name');
    const urlInput = modal.querySelector('#link-url');
    const browserSelect = modal.querySelector('#link-browser');
    const autostartCheckbox = modal.querySelector('#link-autostart');

    const closeModal = () => {
        document.body.removeChild(modal);
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    saveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const name = nameInput.value.trim();
        const url = urlInput.value.trim();
        const browser = browserSelect.value;
        const autostart = autostartCheckbox.checked;

        if (!name || !url) {
            alert('Bitte Name und URL eingeben!');
            return;
        }

        try {
            showLoading("Link wird hinzugefügt...");
            
            const newLink = {
                name: name,
                path: url,
                type: 'link',
                browser: browser,
                admin: false,
                autostart: autostart,
                favorite: false,
                tags: ['link'],
                created_at: new Date().toISOString()
            };

            const response = await fetch('/api/tools', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newLink)
            });

            hideLoading();

            if (response.ok) {
                const savedTool = await response.json();
                console.log("Link saved:", savedTool);
                showNotification(`✅ Link "${name}" wurde erfolgreich hinzugefügt`, "success", true);
                closeModal();
                loadTools(); // Refresh the tools list
            } else {
                const error = await response.json();
                throw new Error(error.error || "Fehler beim Speichern");
            }
        } catch (error) {
            hideLoading();
            console.error("Error saving link:", error);
            showNotification("Fehler beim Speichern: " + error.message, "error");
        }
    });

    // Focus name input
    nameInput.focus();
}

// Show dialog to add Network Path
function showAddNetworkPathDialog() {
    const modal = document.createElement('div');
    modal.className = 'infoboard-modal';
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
            <div class="modal-header" style="padding: 20px; border-bottom: 1px solid #4a5568; display: flex; justify-content: space-between; align-items: center; background-color: #1a202c;">
                <h2 style="margin: 0; color: #ffffff;"><i class="fas fa-network-wired"></i> Netzwerkpfad</h2>
                <button class="close-btn" style="background: none; border: none; color: #cbd5e0; font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            <div class="modal-body" style="padding: 20px;">
                <form id="network-form">
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; color: #e2e8f0; font-weight: bold;">Name:</label>
                        <input type="text" id="network-name" class="form-control" placeholder="z.B. Netzlaufwerk H" 
                               style="width: 100%; background: #1a202c; border: 1px solid #4a5568; color: white; padding: 8px; border-radius: 4px;" required>
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; color: #e2e8f0; font-weight: bold;">Netzwerkpfad:</label>
                        <input type="text" id="network-path" class="form-control" placeholder="\\\\server\\share oder H:" 
                               style="width: 100%; background: #1a202c; border: 1px solid #4a5568; color: white; padding: 8px; border-radius: 4px;" required>
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: flex; align-items: center; color: #e2e8f0; cursor: pointer;">
                            <input type="checkbox" id="network-admin" style="margin-right: 8px;">
                            <span>Als Administrator öffnen</span>
                        </label>
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: flex; align-items: center; color: #e2e8f0; cursor: pointer;">
                            <input type="checkbox" id="network-autostart" style="margin-right: 8px;">
                            <span>Beim Start automatisch öffnen</span>
                        </label>
                    </div>
                </form>
            </div>
            <div class="modal-footer" style="padding: 20px; border-top: 1px solid #4a5568; display: flex; justify-content: flex-end; gap: 10px;">
                <button class="cancel-btn btn btn-secondary" style="padding: 10px 20px; background: #718096; border: none; color: white; cursor: pointer; border-radius: 4px;">Abbrechen</button>
                <button class="save-btn btn btn-success" style="padding: 10px 20px; background: #48bb78; border: none; color: white; cursor: pointer; border-radius: 4px;">
                    <i class="fas fa-save"></i> Hinzufügen
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    const closeBtn = modal.querySelector('.close-btn');
    const cancelBtn = modal.querySelector('.cancel-btn');
    const saveBtn = modal.querySelector('.save-btn');
    const nameInput = modal.querySelector('#network-name');
    const pathInput = modal.querySelector('#network-path');
    const adminCheckbox = modal.querySelector('#network-admin');
    const autostartCheckbox = modal.querySelector('#network-autostart');

    const closeModal = () => {
        document.body.removeChild(modal);
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    saveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const name = nameInput.value.trim();
        const path = pathInput.value.trim();
        const admin = adminCheckbox.checked;
        const autostart = autostartCheckbox.checked;

        if (!name || !path) {
            alert('Bitte Name und Pfad eingeben!');
            return;
        }

        try {
            showLoading("Netzwerkpfad wird hinzugefügt...");
            
            const newNetworkPath = {
                name: name,
                path: path,
                type: 'network',
                admin: admin,
                autostart: autostart,
                favorite: false,
                tags: ['network'],
                created_at: new Date().toISOString()
            };

            const response = await fetch('/api/tools', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newNetworkPath)
            });

            hideLoading();

            if (response.ok) {
                const savedTool = await response.json();
                console.log("Network path saved:", savedTool);
                showNotification(`✅ Netzwerkpfad "${name}" wurde erfolgreich hinzugefügt`, "success", true);
                closeModal();
                loadTools(); // Refresh the tools list
            } else {
                const error = await response.json();
                throw new Error(error.error || "Fehler beim Speichern");
            }
        } catch (error) {
            hideLoading();
            console.error("Error saving network path:", error);
            showNotification("Fehler beim Speichern: " + error.message, "error");
        }
    });

    // Focus name input
    nameInput.focus();
}

// Show dialog to add Workspace
function showAddWorkspaceDialog() {
    const modal = document.createElement('div');
    modal.className = 'infoboard-modal';
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
            <div class="modal-header" style="padding: 20px; border-bottom: 1px solid #4a5568; display: flex; justify-content: space-between; align-items: center; background-color: #1a202c;">
                <h2 style="margin: 0; color: #ffffff;"><i class="fas fa-folder"></i> Arbeitsumgebung</h2>
                <button class="close-btn" style="background: none; border: none; color: #cbd5e0; font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            <div class="modal-body" style="padding: 20px;">
                <form id="workspace-form">
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; color: #e2e8f0; font-weight: bold;">Name:</label>
                        <input type="text" id="workspace-name" class="form-control" placeholder="z.B. Projekt ABC" 
                               style="width: 100%; background: #1a202c; border: 1px solid #4a5568; color: white; padding: 8px; border-radius: 4px;" required>
                    </div>
                    <div class="form-group" style="margin-bottom: 15px; color: #a0aec0; font-size: 0.9em;">
                        <i class="fas fa-info-circle"></i> Ein Ordner wird automatisch in Ihren Dokumenten erstellt, in dem Sie Verknüpfungsdateien (.lnk) ablegen können.
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: flex; align-items: center; color: #e2e8f0; cursor: pointer;">
                            <input type="checkbox" id="workspace-autostart" style="margin-right: 8px;">
                            <span>Beim Start automatisch öffnen</span>
                        </label>
                    </div>
                </form>
            </div>
            <div class="modal-footer" style="padding: 20px; border-top: 1px solid #4a5568; display: flex; justify-content: flex-end; gap: 10px;">
                <button class="cancel-btn btn btn-secondary" style="padding: 10px 20px; background: #718096; border: none; color: white; cursor: pointer; border-radius: 4px;">Abbrechen</button>
                <button class="save-btn btn btn-success" style="padding: 10px 20px; background: #48bb78; border: none; color: white; cursor: pointer; border-radius: 4px;">
                    <i class="fas fa-save"></i> Hinzufügen
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    const closeBtn = modal.querySelector('.close-btn');
    const cancelBtn = modal.querySelector('.cancel-btn');
    const saveBtn = modal.querySelector('.save-btn');
    const nameInput = modal.querySelector('#workspace-name');
    const autostartCheckbox = modal.querySelector('#workspace-autostart');

    const closeModal = () => {
        document.body.removeChild(modal);
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    saveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const name = nameInput.value.trim();
        const autostart = autostartCheckbox.checked;

        if (!name) {
            alert('Bitte geben Sie einen Namen ein!');
            return;
        }

        try {
            showLoading("Arbeitsumgebung wird hinzugefügt...");
            
            const newWorkspace = {
                name: name,
                path: path,
                type: 'workspace',
                admin: false,
                autostart: autostart,
                favorite: false,
                tags: ['workspace'],
                created_at: new Date().toISOString()
            };

            const response = await fetch('/api/tools', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newWorkspace)
            });

            hideLoading();

            if (response.ok) {
                const savedTool = await response.json();
                console.log("Workspace saved:", savedTool);
                showNotification(`✅ Arbeitsumgebung "${name}" wurde erfolgreich hinzugefügt`, "success", true);
                closeModal();
                loadTools(); // Refresh the tools list
            } else {
                const error = await response.json();
                throw new Error(error.error || "Fehler beim Speichern");
            }
        } catch (error) {
            hideLoading();
            console.error("Error saving workspace:", error);
            showNotification("Fehler beim Speichern: " + error.message, "error");
        }
    });

    // Focus name input
    nameInput.focus();
}

// Show dialog to add Application
function showAddApplicationDialog() {
    const modal = document.createElement('div');
    modal.className = 'infoboard-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
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
            <div class="modal-header" style="padding: 20px; border-bottom: 1px solid #4a5568; display: flex; justify-content: space-between; align-items: center; background-color: #1a202c;">
                <h2 style="margin: 0; color: #ffffff;"><i class="fas fa-desktop"></i> Anwendung</h2>
                <button class="close-btn" style="background: none; border: none; color: #cbd5e0; font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            <div class="modal-body" style="padding: 20px; text-align: center;">
                <p style="color: #e2e8f0; margin-bottom: 20px;">Wählen Sie eine Anwendung aus:</p>
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button class="browse-btn btn btn-primary" style="padding: 15px 25px; background: #3182ce; border: none; color: white; cursor: pointer; border-radius: 4px; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-folder-open"></i> Durchsuchen
                    </button>
                </div>
            </div>
            <div class="modal-footer" style="padding: 20px; border-top: 1px solid #4a5568; display: flex; justify-content: flex-end;">
                <button class="close-modal-btn btn btn-secondary" style="padding: 10px 20px; background: #718096; border: none; color: white; cursor: pointer; border-radius: 4px;">Abbrechen</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    const closeBtn = modal.querySelector('.close-btn');
    const closeModalBtn = modal.querySelector('.close-modal-btn');
    const browseBtn = modal.querySelector('.browse-btn');

    const closeModal = () => {
        document.body.removeChild(modal);
    };

    closeBtn.addEventListener('click', closeModal);
    closeModalBtn.addEventListener('click', closeModal);

    browseBtn.addEventListener('click', () => {
        closeModal();
        browseTool();
    });
}

// Show dialog to manually enter application
function showManualApplicationDialog() {
    const modal = document.createElement('div');
    modal.className = 'infoboard-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
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
            <div class="modal-header" style="padding: 20px; border-bottom: 1px solid #4a5568; display: flex; justify-content: space-between; align-items: center; background-color: #1a202c;">
                <h2 style="margin: 0; color: #ffffff;"><i class="fas fa-desktop"></i> Anwendung</h2>
                <button class="close-btn" style="background: none; border: none; color: #cbd5e0; font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            <div class="modal-body" style="padding: 20px;">
                <form id="app-form">
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; color: #e2e8f0; font-weight: bold;">Name:</label>
                        <input type="text" id="app-name" class="form-control" placeholder="z.B. Notepad" 
                               style="width: 100%; background: #1a202c; border: 1px solid #4a5568; color: white; padding: 8px; border-radius: 4px;" required>
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; color: #e2e8f0; font-weight: bold;">Pfad:</label>
                        <input type="text" id="app-path" class="form-control" placeholder="z.B. C:\\Windows\\System32\\notepad.exe" 
                               style="width: 100%; background: #1a202c; border: 1px solid #4a5568; color: white; padding: 8px; border-radius: 4px;" required>
                    </div>
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; color: #e2e8f0; font-weight: bold;">Beschreibung (optional):</label>
                        <input type="text" id="app-description" class="form-control" placeholder="z.B. Texteditor" 
                               style="width: 100%; background: #1a202c; border: 1px solid #4a5568; color: white; padding: 8px; border-radius: 4px;">
                    </div>
                </form>
            </div>
            <div class="modal-footer" style="padding: 20px; border-top: 1px solid #4a5568; display: flex; justify-content: flex-end; gap: 10px;">
                <button class="close-modal-btn btn btn-secondary" style="padding: 10px 20px; background: #718096; border: none; color: white; cursor: pointer; border-radius: 4px;">Abbrechen</button>
                <button class="save-btn btn btn-success" style="padding: 10px 20px; background: #38a169; border: none; color: white; cursor: pointer; border-radius: 4px;">
                    <i class="fas fa-save"></i> Speichern
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    const closeBtn = modal.querySelector('.close-btn');
    const closeModalBtn = modal.querySelector('.close-modal-btn');
    const saveBtn = modal.querySelector('.save-btn');
    const nameInput = modal.querySelector('#app-name');
    const pathInput = modal.querySelector('#app-path');
    const descriptionInput = modal.querySelector('#app-description');

    const closeModal = () => {
        document.body.removeChild(modal);
    };

    closeBtn.addEventListener('click', closeModal);
    closeModalBtn.addEventListener('click', closeModal);

    saveBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        const path = pathInput.value.trim();
        const description = descriptionInput.value.trim();

        if (!name || !path) {
            showNotification("Name und Pfad sind erforderlich", "error");
            return;
        }

        try {
            showLoading("Speichere Anwendung...");
            closeModal();

            const newTool = {
                id: Date.now(),
                name: name,
                path: path,
                description: description || null,
                type: 'application'
            };

            const response = await fetch('/api/tools', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTool)
            });

            hideLoading();

            if (response.ok) {
                showNotification("✅ Anwendung wurde erfolgreich hinzugefügt", "success", true);
                loadTools(); // Reload tools
            } else {
                const error = await response.json();
                showNotification("Fehler beim Speichern: " + (error.message || "Unbekannter Fehler"), "error");
            }
        } catch (error) {
            hideLoading();
            console.error("Error saving application:", error);
            showNotification("Fehler beim Speichern: " + error.message, "error");
        }
    });

    // Focus name input
    nameInput.focus();
}

// Add optimistic UI helpers for workspace imports
function addWorkspaceChipToDOM(workspaceId, tool) {
  try {
    const workspaceCard = document.querySelector(`.workspace-card[data-id="${workspaceId}"]`);
    if (!workspaceCard) return false;
    const chipList = workspaceCard.querySelector('.workspace-chip-list');
    if (!chipList) return false;

    // Remove hint if present
    const hint = workspaceCard.querySelector('.workspace-drop-hint');
    if (hint) hint.remove();

    // Create chip element
    const btn = document.createElement('button');
    btn.className = 'workspace-chip start-tool';
    btn.setAttribute('data-id', tool.id || '');
    btn.title = tool.name || 'Tool';
    btn.innerHTML = `<i class="fas fa-folder"></i>`;

    // Attach click handler to start the workspace tool when clicked
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await startTool({ id: parseInt(btn.dataset.id), is_workspace_tool: true, path: tool.path });
    });

    chipList.appendChild(btn);
    chipList.classList.remove('is-empty');
    return true;
  } catch (err) {
    console.error('addWorkspaceChipToDOM error', err);
    return false;
  }
}

// Show a temporary loading indicator on the workspace card
function showWorkspaceLoading(workspaceId) {
  const workspaceCard = document.querySelector(`.workspace-card[data-id="${workspaceId}"]`);
  if (!workspaceCard) return null;
  let loader = workspaceCard.querySelector('.workspace-loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.className = 'workspace-loader';
    loader.innerHTML = '<span class="loader-dot"></span> Importiere...';
    loader.style.marginTop = '8px';
    workspaceCard.querySelector('.workspace-drop-zone').appendChild(loader);
  }
  return loader;
}

function hideWorkspaceLoading(workspaceId) {
  const workspaceCard = document.querySelector(`.workspace-card[data-id="${workspaceId}"]`);
  if (!workspaceCard) return;
  const loader = workspaceCard.querySelector('.workspace-loader');
  if (loader) loader.remove();
}

async function importToolToWorkspace(workspaceId, toolId) {
  // Show optimistic UI: add a temporary chip immediately and show loader
  const tempTool = { id: toolId, name: 'Import...' , path: '' };
  const added = addWorkspaceChipToDOM(workspaceId, tempTool);
  const loader = showWorkspaceLoading(workspaceId);

  const payload = {
    workspace_id: workspaceId,
    tool_id: toolId,
  };

  const endpoints = ['/api/workspaces/import', '/api/workspace-import'];
  let lastError = null;

  for (const url of endpoints) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data && data.success) {
          // Replace temporary chip with final info (if present)
          hideWorkspaceLoading(workspaceId);
          // Update the last chip we added with real data
          try {
            const workspaceCard = document.querySelector(`.workspace-card[data-id="${workspaceId}"]`);
            if (workspaceCard) {
              const chips = workspaceCard.querySelectorAll('.workspace-chip');
              const lastChip = chips[chips.length - 1];
              if (lastChip) {
                lastChip.setAttribute('data-id', data.tool_id || toolId);
                lastChip.title = data.shortcut_path || (data.name || 'Tool');
                // store path so startTool can use it
                lastChip.dataset.path = data.shortcut_path || '';
              }
            }
          } catch (e) {
            console.warn('Could not update temp chip with response data', e);
          }

          return { success: true, data };
        }
        lastError = data && data.error ? data.error : 'Unbekannter Fehler';
        hideWorkspaceLoading(workspaceId);
        return { success: false, error: lastError };
      }

      if (resp.status === 404 || resp.status === 405) {
        lastError = `Endpoint ${url} nicht verfügbar (${resp.status})`;
        continue;
      }

      const errorData = await resp.json().catch(() => null);
      lastError = errorData && errorData.error ? errorData.error : `HTTP ${resp.status}`;
      hideWorkspaceLoading(workspaceId);
      return { success: false, error: lastError };
    } catch (err) {
      lastError = err.message || 'Netzwerkfehler';
    }
  }

  // If we get here, all endpoints failed
  hideWorkspaceLoading(workspaceId);
  // Remove the optimistic chip we added earlier (cleanup)
  try {
    const workspaceCard = document.querySelector(`.workspace-card[data-id="${workspaceId}"]`);
    if (workspaceCard) {
      const chips = workspaceCard.querySelectorAll('.workspace-chip');
      const lastChip = chips[chips.length - 1];
      if (lastChip && lastChip.title === 'Import...') lastChip.remove();
    }
  } catch (e) {
    console.warn('Error cleaning up temp chip', e);
  }

  return { success: false, error: lastError || 'Unbekannter Fehler beim Workspace-Import' };
}

// Kontakte filtern basierend auf dem Suchbegriff
function filterContacts(searchTerm, contacts) {
    const contactCards = document.querySelectorAll('.contact-card');
    contactCards.forEach(card => {
        const contactId = parseInt(card.dataset.id);
        const contact = contacts.find(c => c.id === contactId);
        
        if (contact) {
            const matchesSearch = 
                (contact.name && contact.name.toLowerCase().includes(searchTerm)) ||
                (contact.phone && contact.phone.toLowerCase().includes(searchTerm)) ||
                (contact.department && contact.department.toLowerCase().includes(searchTerm)) ||
                (contact.pkz && contact.pkz.toLowerCase().includes(searchTerm));
                
            card.style.display = matchesSearch ? 'flex' : 'none';
        }
    });
}

// Modal für das Hinzufügen eines neuen Kontakts anzeigen
function showAddContactModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Kontakt hinzufügen</h3>
                <button class="close-button">&times;</button>
            </div>
            <div class="modal-body">
                <form id="add-contact-form">
                    <div class="form-group">
                        <label for="contact-name">Name *</label>
                        <input type="text" id="contact-name" required class="form-control" placeholder="Name eingeben">
                    </div>
                    <div class="form-group">
                        <label for="contact-phone">Telefon *</label>
                        <input type="text" id="contact-phone" required class="form-control" placeholder="Telefonnummer eingeben">
                    </div>
                    <div class="form-group">
                        <label for="contact-department">Abteilung</label>
                        <input type="text" id="contact-department" class="form-control" placeholder="Abteilung eingeben">
                    </div>
                    <div class="form-group">
                        <label for="contact-pkz">PKZ</label>
                        <input type="text" id="contact-pkz" class="form-control" placeholder="PKZ eingeben">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary cancel-btn">Abbrechen</button>
                        <button type="submit" class="btn btn-primary">Speichern</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Schließen-Button
    const closeBtn = modal.querySelector('.close-button');
    const cancelBtn = modal.querySelector('.cancel-btn');
    
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    cancelBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    // Formular-Submit
    const form = modal.querySelector('#add-contact-form');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Pflichtfelder prüfen
        const nameInput = document.getElementById('contact-name');
        const phoneInput = document.getElementById('contact-phone');
        
        if (!nameInput.value.trim() || !phoneInput.value.trim()) {
            showNotification("Name und Telefonnummer sind Pflichtfelder", "error");
            return;
        }
        
        // Kontakt-Objekt erstellen
        const newContact = {
            name: nameInput.value.trim(),
            phone: phoneInput.value.trim(),
            department: document.getElementById('contact-department').value.trim() || null,
            pkz: document.getElementById('contact-pkz').value.trim() || null
        };
        
        saveContact(newContact);
        modal.remove();
    });
}

// Modal für das Bearbeiten eines Kontakts anzeigen
function showEditContactModal(contact) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Kontakt bearbeiten</h3>
                <button class="close-button">&times;</button>
            </div>
            <div class="modal-body">
                <form id="edit-contact-form">
                    <input type="hidden" id="contact-id" value="${contact.id}">
                    <div class="form-group">
                        <label for="contact-name">Name *</label>
                        <input type="text" id="contact-name" required class="form-control" value="${escapeHtml(contact.name || '')}" placeholder="Name eingeben">
                    </div>
                    <div class="form-group">
                        <label for="contact-phone">Telefon *</label>
                        <input type="text" id="contact-phone" required class="form-control" value="${escapeHtml(contact.phone || '')}" placeholder="Telefonnummer eingeben">
                    </div>
                    <div class="form-group">
                        <label for="contact-department">Abteilung</label>
                        <input type="text" id="contact-department" class="form-control" value="${escapeHtml(contact.department || '')}" placeholder="Abteilung eingeben">
                    </div>
                    <div class="form-group">
                        <label for="contact-pkz">PKZ</label>
                        <input type="text" id="contact-pkz" class="form-control" value="${escapeHtml(contact.pkz || '')}" placeholder="PKZ eingeben">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary cancel-btn">Abbrechen</button>
                        <button type="submit" class="btn btn-primary">Speichern</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Schließen-Button
    const closeBtn = modal.querySelector('.close-button');
    const cancelBtn = modal.querySelector('.cancel-btn');
    
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    cancelBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    // Formular-Submit
    const form = modal.querySelector('#edit-contact-form');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Pflichtfelder prüfen
        const nameInput = document.getElementById('contact-name');
        const phoneInput = document.getElementById('contact-phone');
        
        if (!nameInput.value.trim() || !phoneInput.value.trim()) {
            showNotification("Name und Telefonnummer sind Pflichtfelder", "error");
            return;
        }
        
        // Kontakt-Objekt erstellen
        const updatedContact = {
            id: parseInt(document.getElementById('contact-id').value),
            name: nameInput.value.trim(),
            phone: phoneInput.value.trim(),
            department: document.getElementById('contact-department').value.trim() || null,
            pkz: document.getElementById('contact-pkz').value.trim() || null
        };
        
        updateContact(updatedContact);
        modal.remove();
    });
}

// Kontakt speichern (neu)
async function saveContact(contact) {
    try {
        showLoading("Kontakt wird gespeichert...");
        
        const response = await fetch('/api/telefonbuch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(contact)
        });
        
        hideLoading();
        
        if (response.ok) {
            const result = await response.json();
            showNotification("Kontakt erfolgreich gespeichert", "success");
            
            // Cache aktualisieren und neu rendern
            invalidateCache('telefonbuch');
            loadModule('telefonbuch');
        } else {
            const error = await response.json();
            throw new Error(error.message || "Fehler beim Speichern des Kontakts");
        }
    } catch (error) {
        hideLoading();
        console.error("Fehler beim Speichern des Kontakts:", error);
        showNotification("Fehler: " + error.message, "error");
    }
}

// Kontakt aktualisieren
async function updateContact(contact) {
    try {
        showLoading("Kontakt wird aktualisiert...");
        
        const response = await fetch(`/api/telefonbuch/${contact.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(contact)
        });
        
        hideLoading();
        
        if (response.ok) {
            showNotification("Kontakt erfolgreich aktualisiert", "success");
            
            // Cache aktualisieren und neu rendern
            invalidateCache('telefonbuch');
            loadModule('telefonbuch');
        } else {
            const error = await response.json();
            throw new Error(error.message || "Fehler beim Aktualisieren des Kontakts");
        }
    } catch (error) {
        hideLoading();
        console.error("Fehler beim Aktualisieren des Kontakts:", error);
        showNotification("Fehler: " + error.message, "error");
    }
}

// Kontakt löschen
async function deleteContact(contactId) {
    try {
        showLoading("Kontakt wird gelöscht...");
        
        const response = await fetch(`/api/telefonbuch/${contactId}`, {
            method: 'DELETE'
        });
        
        hideLoading();
        
        if (response.ok) {
            showNotification("Kontakt erfolgreich gelöscht", "success");
            
            // Cache aktualisieren und neu rendern
            invalidateCache('telefonbuch');
            loadModule('telefonbuch');
        } else {
            const error = await response.json();
            throw new Error(error.message || "Fehler beim Löschen des Kontakts");
        }
    } catch (error) {
        hideLoading();
        console.error("Fehler beim Löschen des Kontakts:", error);
        showNotification("Fehler: " + error.message, "error");
    }
}

// Modul-Rendering basierend auf dem Modulnamen
function renderModule(moduleName, items) {
  console.log(`Rendering module: ${moduleName} with items:`, items);
  
  if (moduleName === 'tools') {
    content.innerHTML = `
      <div class="module-header"><h2><i class="fas fa-tools"></i> Tools</h2></div>
      <div id="tools-container" class="tools-content">
        <div class="loading">Lade Tools...</div>
      </div>
    `;
    loadTools();
  } else if (moduleName === 'tickets') {
    // Für Tickets immer die aktuelle Version aus localStorage laden
    const ticketsData = JSON.parse(localStorage.getItem('tickets') || '[]');
    moduleCache['tickets'] = ticketsData;
    renderTickets(ticketsData);
  } else if (moduleName === 'drucker') {
    // Verwende die items vom Backend oder fallback zu leerer Liste
    const printers = items || [];
    console.log("Rendering drucker with data:", printers);
    renderPrinters(printers);
  } else if (moduleName === 'netzwerk') {
    // Lade Netzwerk-Interface
    console.log("Rendering netzwerk");
    renderNetwork();
  } else if (moduleName === 'telefonbuch') {
    // Verwende die items vom Backend oder fallback zu leerer Liste
    const contacts = items || [];
    console.log("Rendering telefonbuch with data:", contacts);
    renderPhonebook(contacts);
  } else if (moduleName === 'faq') {
    // Verwende die items vom Backend oder fallback zu leerer Liste
    const faqItems = items || [];
    console.log("Rendering faq with data:", faqItems);
    renderFAQ(faqItems);
  } else if (moduleName === 'worksets') {
    // Worksets werden asynchron geladen
    console.log("Rendering worksets");
    content.innerHTML = `
      <div class="module-header">
        <h2><i class="fas fa-layer-group"></i> Worksets</h2>
      </div>
      <div class="loading">Lade Worksets...</div>
    `;
    loadWorksets();
  } else {
    console.warn(`Unknown module: ${moduleName}`);
    // Fallback für unbekannte Module
    const content = document.getElementById('content');
    if (content) {
      content.innerHTML = `
        <div class="module-header">
          <h2><i class="fas fa-question-circle"></i> ${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}</h2>
        </div>
        <div class="empty-state">
          <i class="fas fa-info-circle fa-3x"></i>
          <h3>Modul wird geladen...</h3>
          <p>Das ${moduleName}-Modul wird noch entwickelt.</p>
        </div>
      `;
    }
  }
}

// Hilfsfunktion, um das passende Icon für eine Kategorie zu bestimmen
function getIconForCategory(category) {
  // Standardisiere die Kategorie (Kleinbuchstaben, keine Sonderzeichen)
  const normalizedCategory = category.toLowerCase().trim();
  
  // Icons für bekannte Kategorien
  const iconMap = {
    'drucker': 'fas fa-print',
    'netzwerk': 'fas fa-network-wired',
    'ticket': 'fas fa-ticket-alt',
    'text': 'fas fa-font',
    'allgemein': 'fas fa-info-circle',
    'teams': 'fas fa-users',
    'outlook': 'far fa-envelope',
    'lock': 'fas fa-lock',
    'windows': 'fab fa-windows',
  };
  
  // Durchsuche den Kategorienamen nach Schlüsselwörtern
  for (const [keyword, icon] of Object.entries(iconMap)) {
    if (normalizedCategory.includes(keyword)) {
      return icon;
    }
  }
  
  // Fallback für unbekannte Kategorien
  return 'fas fa-question-circle';
}

// Function to close the modal
function closeToolModal() {
    const modal = document.getElementById('add-tool-modal');
    if (modal) {
        modal.remove();
    }
}

// Toggle autostart mode for a tool
async function toggleToolAutostart(toolId, enable) {
    try {
        console.log(`Toggling autostart for tool ${toolId} to ${enable}`);
        showLoading("Aktualisiere Tool...");
        
        const response = await fetch(`/api/tools/${toolId}/autostart`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ autostart: enable })
        });
        
        hideLoading();
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        // Update UI to reflect the change
        const toggleBtn = document.querySelector(`.tool-item[data-id="${toolId}"] .toggle-autostart`);
        const toolItem = document.querySelector(`.tool-item[data-id="${toolId}"]`);
        const toolName = toolItem ? toolItem.querySelector('.tool-name')?.textContent || 'Tool' : 'Tool';
        
        if (toggleBtn) {
            if (enable) {
                toggleBtn.classList.add('active');
                toggleBtn.title = 'Autostart deaktivieren';
                toggleBtn.querySelector('i').className = 'fas fa-toggle-on';
            } else {
                toggleBtn.classList.remove('active');
                toggleBtn.title = 'Autostart aktivieren';
                toggleBtn.querySelector('i').className = 'fas fa-toggle-off';
            }
        }
        
        // Show notification with tool name and checkmark
        const statusText = enable ? 'aktiviert' : 'deaktiviert';
        const icon = enable ? '✅' : '⏸️';
        showNotification(`${icon} Autostart für "${toolName}" ${statusText}`, 'success', true);
        
    } catch (error) {
        hideLoading();
        console.error("Error toggling autostart:", error);
        showNotification(`Fehler: ${error.message}`, 'error');
    }
}

// Toggle admin mode for a tool
async function toggleToolAdmin(toolId, enable) {
    try {
        console.log(`Toggling admin mode for tool ${toolId} to ${enable}`);
        showLoading("Aktualisiere Tool...");
        
        const response = await fetch(`/api/tools/${toolId}/admin`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin: enable })
        });
        
        hideLoading();
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        // Update UI to reflect the change
        const toggleBtn = document.querySelector(`.tool-item[data-id="${toolId}"] .toggle-admin`);
        if (toggleBtn) {
            if (enable) {
                toggleBtn.classList.add('active');
                toggleBtn.title = 'Admin-Modus deaktivieren';
                toggleBtn.querySelector('i').className = 'fas fa-user-shield';
            } else {
                toggleBtn.classList.remove('active');
                toggleBtn.title = 'Als Administrator starten';
                toggleBtn.querySelector('i').className = 'fas fa-user';
            }
        }
        
        // Show notification
        showNotification(`Administrator-Modus ${enable ? 'aktiviert' : 'deaktiviert'}`, 'info');
        
    } catch (error) {
        hideLoading();
        console.error("Error toggling admin mode:", error);
        showNotification(`Fehler: ${error.message}`, 'error');
    }
}

// Vorlage löschen
function deleteTemplate(templateId) {
  let templates = JSON.parse(localStorage.getItem('ticket-templates') || '[]');
  const templateToDelete = templates.find(t => t.id == templateId);
  
  // Schütze System-Vorlagen vor Löschung
  if (templateToDelete && (templateToDelete.undeletable || templateToDelete.name === 'Anwenderunterstützung')) {
    showNotification('System-Vorlagen können nicht gelöscht werden.', 'error');
    return;
  }
  
  if (!confirm('Möchten Sie diese Vorlage wirklich löschen?')) return;
  
  // Überprüfe, ob es die letzte nicht-System Vorlage ist
  const nonSystemTemplates = templates.filter(t => !t.undeletable && t.name !== 'Anwenderunterstützung');
  if (nonSystemTemplates.length <= 1 && nonSystemTemplates.some(t => t.id == templateId)) {
    showNotification('Mindestens eine benutzerdefinierte Vorlage muss vorhanden bleiben.', 'error');
    return;
  }
  
  templates = templates.filter(t => t.id != templateId);
  localStorage.setItem('ticket-templates', JSON.stringify(templates));
  
  showNotification('Vorlage wurde gelöscht.', 'success');
  loadTicketTemplates();
}

// Neue Vorlage hinzufügen
function showAddTemplateDialog() {
  // Erstelle ein Modal für das Hinzufügen einer Vorlage
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content ticket-dialog template-dialog">
      <div class="modal-header">
        <h2>Neue Vorlage hinzufügen</h2>
        <button class="close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="template-name">Name:</label>
          <input type="text" id="template-name" class="form-control" placeholder="Name der Vorlage">
          <small class="form-text text-muted">Der Name wird als Überschrift mit Strichen formatiert (z.B. ---- Name ----)</small>
        </div>
        <div class="form-group">
          <label for="template-content">Inhalt:</label>
          <textarea id="template-content" class="form-control template-textarea" rows="10" placeholder="hier Alle Infos Außerhalb VON PKZ & TElefonummer diese werden bereits abgefragt."></textarea>
          <small class="form-text text-muted">Achten Sie auf Leerzeichen nach den Doppelpunkten für eine bessere Formatierung beim Kopieren.</small>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary cancel-btn">Abbrechen</button>
        <button class="btn btn-primary save-btn">Speichern</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Event-Listener für Aktionen
  const closeBtn = modal.querySelector('.close-btn');
  const cancelBtn = modal.querySelector('.cancel-btn');
  const saveBtn = modal.querySelector('.save-btn');
  const nameInput = modal.querySelector('#template-name');
  const contentTextarea = modal.querySelector('#template-content');
  
  // Inhalt-Feld leer lassen, damit Benutzer eigene Vorlagen-Inhalte eingeben können
  contentTextarea.value = '';
  
  const closeModal = () => {
    document.body.removeChild(modal);
  };
  
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  
  saveBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    let content = contentTextarea.value;
    
    if (!name) {
      showNotification('Bitte geben Sie einen Namen für die Vorlage ein.', 'error');
      return;
    }
    
    // Lade bestehende Vorlagen
    const templates = JSON.parse(localStorage.getItem('ticket-templates') || '[]');
    
    // Erstelle neue Vorlage - ohne automatisches Hinzufügen von "Beschreibung:"
    const newTemplate = {
      id: Date.now(), // Eindeutige ID basierend auf Zeitstempel
      name: name,
      content: content
    };
    
    // Füge neue Vorlage hinzu und speichere
    templates.push(newTemplate);
    localStorage.setItem('ticket-templates', JSON.stringify(templates));
    
    closeModal();
    showNotification('Vorlage wurde hinzugefügt.', 'success');
    loadTicketTemplates();
  });
}

// Zeige Dialog zum Hinzufügen eines Tickets
function showAddTicketDialog(template) {
  console.log("showAddTicketDialog called with template:", template);
  
  // Alle Vorlagen laden (Templates werden jetzt beim Start initialisiert)
  let templates = JSON.parse(localStorage.getItem('ticket-templates') || '[]');
  console.log("Loaded templates from localStorage:", templates);
  
  // Wenn keine spezifische Vorlage angegeben wurde, nehme die erste
  if (!template) {
    // Suche explizit nach "Anwenderunterstützung" als Standard
    const anwenderTemplate = templates.find(t => t.name === 'Anwenderunterstützung');
    
    // Anwenderunterstützung als Vorauswahl, falls vorhanden, sonst die erste Vorlage
    template = anwenderTemplate || templates[0];
  }
  
  console.log("Selected template for dialog:", template);
  
  // Template-Dropdown HTML generieren
  let templateOptionsHtml = '';
  templates.forEach(t => {
    templateOptionsHtml += `<option value="${t.id}" ${t.id == template.id ? 'selected' : ''}>${t.name}</option>`;
  });
  
  // Template-Auswahlbereich immer anzeigen, unabhängig von der Anzahl der Vorlagen
  const templateSelectorHtml = 
    `<div class="template-selector">
      <label for="template-select">Vorlage:</label>
      <select id="template-select" class="form-control">
        ${templateOptionsHtml}
      </select>
    </div>`;
  
  // Erstelle ein Modal für das Ticket-Formular
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content ticket-dialog">
      <div class="modal-header">
        <div class="ticket-header-flex">
          <h2>Ticket hinzufügen</h2>
          ${templateSelectorHtml}
        </div>
        <button class="close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div class="template-header-banner" id="template-header-display">
          TEMPLATE_HEADER_PLACEHOLDER
        </div>
        <div class="form-group">
          <label for="ticket-phone">Telefon:</label>
          <input type="text" id="ticket-phone" class="form-control" placeholder="Telefonnummer" autofocus>
        </div>
        <div class="form-group">
          <label for="ticket-pkz">PKZ:</label>
          <input type="text" id="ticket-pkz" class="form-control" placeholder="PKZ">
        </div>
        <div class="form-group">
          <label for="ticket-description">Beschreibung:</label>
          <div class="rich-text-toolbar">
            <button type="button" data-command="bold" title="Fett"><i class="fas fa-bold"></i></button>
            <button type="button" data-command="italic" title="Kursiv"><i class="fas fa-italic"></i></button>
            <button type="button" data-command="insertUnorderedList" title="Liste"><i class="fas fa-list"></i></button>
            <button type="button" data-command="createLink" title="Link einfügen"><i class="fas fa-link"></i></button>
            <select data-command="fontSize" title="Schriftgröße">
              <option value="1">Sehr klein</option>
              <option value="2">Klein</option>
              <option value="3" selected>Normal</option>
              <option value="4">Groß</option>
              <option value="5">Sehr groß</option>
            </select>
          </div>
          <div id="ticket-description" class="rich-text-editor" contenteditable="true"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary cancel-btn">Abbrechen</button>
        <button class="btn btn-primary save-btn">Speichern</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Event-Listener für Aktionen
  const closeBtn = modal.querySelector('.close-btn');
  const cancelBtn = modal.querySelector('.cancel-btn');
  const saveBtn = modal.querySelector('.save-btn');
  
  const phoneInput = modal.querySelector('#ticket-phone');
  const pkzInput = modal.querySelector('#ticket-pkz');
  const descriptionTextarea = modal.querySelector('#ticket-description');
  const headerDisplay = modal.querySelector('#template-header-display');
  
  // Verhindere versehentliche Aktionen bei Doppelklick
  modal.querySelector('.modal-content').addEventListener('dblclick', function(e) {
    // Verhindern Sie, dass der Doppelklick zu unerwünschten Aktionen führt
    e.stopPropagation();
  });
  
  // Make sure header display is always visible with the correct content
  console.log("Found header display element:", headerDisplay);
  console.log("Template for header:", template);
  
  if (headerDisplay) {
    let headerText = '';
    
    if (template && template.name) {
      headerText = formatTemplateHeader(template);
    } else {
      // Fallback: show default header
      headerText = '--------- Anwenderunterstützung ---------';
    }
    
    console.log("Generated header text:", headerText);
    headerDisplay.innerHTML = headerText;
    headerDisplay.style.display = 'block';
    headerDisplay.style.visibility = 'visible';
    console.log("Final header display innerHTML:", headerDisplay.innerHTML);
    
    // Force a repaint to ensure the header shows
    headerDisplay.offsetHeight;
  } else {
    console.error("Header display element not found!");
  }
  
  // Vorlage initial anwenden
  console.log("Applying initial template:", template);
  applyTemplateToTicket(template, phoneInput, pkzInput, descriptionTextarea);
  
  // Template dropdown event listener - immer einrichten
  const templateSelect = modal.querySelector('#template-select');
  if (templateSelect) {
    templateSelect.addEventListener('change', function() {
      const templateId = this.value;
      const selectedTemplate = templates.find(t => t.id == templateId);
      if (selectedTemplate) {
        console.log("Template selected:", selectedTemplate);
        // Ensure we clear fields before applying new template
        phoneInput.value = '';
        pkzInput.value = '';
        if (descriptionTextarea.tagName === 'TEXTAREA') {
          descriptionTextarea.value = '';
        } else {
          descriptionTextarea.innerHTML = '';
        }
        
        // Apply the newly selected template
        applyTemplateToTicket(selectedTemplate, phoneInput, pkzInput, descriptionTextarea);
        
        // Update header display
        headerDisplay.innerHTML = formatTemplateHeader(selectedTemplate);
        headerDisplay.style.display = 'block';
      }
    });
  }
  
  // Rich text editor toolbar setup
  const toolbar = modal.querySelector('.rich-text-toolbar');
  toolbar.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', function() {
      const command = this.dataset.command;
      if (command === 'createLink') {
        const url = prompt('URL eingeben:', 'https://');
        if (url) document.execCommand('createLink', false, url);
      } else {
        document.execCommand(command, false, null);
      }
      descriptionTextarea.focus();
    });
  });
  
  toolbar.querySelector('select[data-command="fontSize"]').addEventListener('change', function() {
    document.execCommand('fontSize', false, this.value);
    descriptionTextarea.focus();
  });
  
  // Close modal function
  const modalCloseHandler = () => {
    document.body.removeChild(modal);
  };
  
  closeBtn.addEventListener('click', modalCloseHandler);
  cancelBtn.addEventListener('click', modalCloseHandler);
  
  // Save ticket event handler
  saveBtn.addEventListener('click', () => {
    const phone = phoneInput.value.trim();
    const pkz = pkzInput.value.trim();
    
    // Stellen Sie sicher, dass die Beschreibung korrekt extrahiert wird, ob TEXTAREA oder contenteditable DIV
    let description = '';
    if (descriptionTextarea.tagName === 'TEXTAREA') {
      description = descriptionTextarea.value.trim();
    } else {
      // Für contenteditable DIVs - den HTML-Inhalt nehmen
      description = descriptionTextarea.innerHTML.trim();
    }
    
    console.log("Saving description:", description);
    
    // Extract header text from selected template
    let headerText = '';
    const templateSelect = modal.querySelector('#template-select');
    if (templateSelect) {
      const selectedTemplateId = templateSelect.value;
      const selectedTemplate = templates.find(t => t.id == selectedTemplateId);
      if (selectedTemplate) {
        headerText = selectedTemplate.name || '';
      }
    }
    
    // Fallback: try to get from header display if no template selected
    if (!headerText) {
      const headerContent = headerDisplay.innerText || '';
      if (headerContent) {
        // Remove the dashes and trim
        headerText = headerContent.replace(/^-+\s*|\s*-+$/g, '').trim();
      }
    }

    if (!description) {
      alert('Bitte geben Sie eine Beschreibung ein.');
      return;
    }

    const newTicket = {
      phone: phone,
      pkz: pkz,
      headerText: headerText, // Store the plain header text
      description: description,
      created_at: new Date().toISOString()
    };    saveTicket(newTicket);
    modalCloseHandler();
  });
}

// Funktion zum Anwenden einer Vorlage auf die Ticket-Felder
function applyTemplateToTicket(template, phoneInput, pkzInput, descriptionTextarea) {
  console.log("Applying template:", template);
  
  if (!template || !phoneInput || !pkzInput || !descriptionTextarea) {
    console.error("Missing parameters for applyTemplateToTicket");
    return;
  }
  
  // Debug: Was für ein Element ist descriptionTextarea?
  console.log("Description element type:", descriptionTextarea.tagName);
  console.log("Is contentEditable:", descriptionTextarea.contentEditable);
  
  // Extrahiere Telefon und PKZ aus der Vorlage
  const content = template.content || '';
  
  // Debug-Ausgabe des Inhalts
  console.log("Template content:", content);
  
  // Verbesserte Regex-Muster für die Extraktion von Tel und PKZ
  const phoneMatch = content.match(/(?:Tel(?:efon)?|TELEFON|Telefon):[ \t]*([^\n]*)/i);
  const pkzMatch = content.match(/(?:PKZ|PERSONALKENNZEICHEN|Personalkennzeichen):[ \t]*([^\n]*)/i);
  
  // Werte in Felder eintragen
  phoneInput.value = phoneMatch && phoneMatch[1] ? phoneMatch[1].trim() : '';
  pkzInput.value = pkzMatch && pkzMatch[1] ? pkzMatch[1].trim() : '';
  
  // Spezialbehandlung für "Anwenderunterstützung" - nur Informationstext, nicht in Beschreibung übertragen
  if (template.name === 'Anwenderunterstützung') {
    console.log("Anwenderunterstützung template selected - clearing description field (info only)");
    if (descriptionTextarea.tagName === 'TEXTAREA') {
      descriptionTextarea.value = '';
    } else if (descriptionTextarea.contentEditable === 'true') {
      descriptionTextarea.innerHTML = '';
    }
    return; // Früher Ausstieg für Anwenderunterstützung
  }
  
  // Den gesamten Template-Inhalt in die Beschreibung setzen (für alle anderen Vorlagen)
  if (content) {
    console.log("Inserting full template content into description:", content);
    
    if (descriptionTextarea.tagName === 'TEXTAREA') {
      descriptionTextarea.value = content;
      console.log("Set TEXTAREA value to:", content);
    } else if (descriptionTextarea.contentEditable === 'true') {
      // Direkte DOM-Manipulation für contenteditable DIVs
      try {
        // HTML-sicheres Format erstellen
        const formattedHTML = content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>')
          .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
        
        // Content setzen
        descriptionTextarea.innerHTML = formattedHTML;
        console.log("Set contentEditable HTML to:", formattedHTML);
        console.log("Actual innerHTML after setting:", descriptionTextarea.innerHTML);
        
        // Cursor ans Ende setzen
        setTimeout(() => {
          try {
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(descriptionTextarea);
            range.collapse(false); // false = Ende des Inhalts
            sel.removeAllRanges();
            sel.addRange(range);
            descriptionTextarea.focus();
          } catch (focusError) {
            console.warn("Could not set focus/cursor:", focusError);
          }
        }, 100);
      } catch (e) {
        console.error("Error setting description:", e);
        // Fallback to text content
        descriptionTextarea.textContent = content;
      }
    } else {
      console.warn("Unknown element type for description:", descriptionTextarea);
    }
  } else {
    console.warn("No content found in template to insert - template:", template);
  }
}

// Funktion zum Speichern eines Tickets
async function saveTicket(ticket) {
  try {
    console.log("Saving ticket:", ticket);
    showLoading("Ticket wird gespeichert...");
    
    // Lade bestehende Tickets
    let tickets = JSON.parse(localStorage.getItem('tickets') || '[]');
    
    // Einfacher numerischer Index als ID (Position in der Liste + 1)
    ticket.id = tickets.length + 1;
    
    // Aktuelles Datum und Uhrzeit setzen
    ticket.created_at = new Date().toISOString();
    
    // Füge neues Ticket hinzu
    tickets.push(ticket);
    
    // Speichere aktualisierte Tickets
    localStorage.setItem('tickets', JSON.stringify(tickets));
    
    // Optional: API-Aufruf, wenn Server-Persistenz gewünscht ist
    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticket)
      });
      
      if (!response.ok) {
        console.warn("Server-Speicherung fehlgeschlagen, nur lokale Speicherung wurde durchgeführt");
      }
    } catch (apiError) {
      console.warn("API-Fehler, Ticket wurde nur lokal gespeichert:", apiError);
    }
    
    hideLoading();
    showNotification("Ticket wurde erfolgreich erstellt", "success");
    
    // Tickets neu laden
    invalidateCache('tickets');
    loadModule('tickets');
    
  } catch (error) {
    hideLoading();
    console.error("Fehler beim Speichern des Tickets:", error);
    showNotification(`Fehler beim Speichern: ${error.message}`, "error");
  }
}

// Funktion zum Anzeigen eines Tickets
function copyTicketDescription(ticketId) {
  if (!ticketId) return;
  
  try {
    // Ticket aus dem Cache holen
    const tickets = moduleCache['tickets'] || [];
    const ticket = tickets.find(t => t.id == ticketId);
    
    if (!ticket) {
      throw new Error('Ticket nicht gefunden.');
    }
    
    // Formatiere den Text in Ticket-Struktur
    let textToCopy = '';
    
    // Header mit Strichen formatieren
    if (ticket.headerText) {
      textToCopy += `--------- ${ticket.headerText} ---------\n\n`;
    }
    
    // Telefon und PKZ hinzufügen
    textToCopy += `Tel: ${ticket.phone || ''}\n`;
    textToCopy += `PKZ: ${ticket.pkz || ''}\n\n`;
    
    // Beschreibung hinzufügen
    textToCopy += `Beschreibung:\n`;
    
    // HTML-Tags entfernen und Zeilenumbrüche erhalten
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = ticket.description || '';
    textToCopy += tempDiv.textContent || tempDiv.innerText || '';
    
    // In die Zwischenablage kopieren
    navigator.clipboard.writeText(textToCopy)
      .then(() => showNotification('Ticket wurde in die Zwischenablage kopiert', 'success'))
      .catch(err => {
        console.error('Fehler beim Kopieren:', err);
        showNotification('Fehler beim Kopieren in die Zwischenablage', 'error');
      });
    
  } catch (error) {
    console.error('Fehler beim Kopieren der Ticket-Beschreibung:', error);
    showNotification('Fehler: ' + error.message, 'error');
  }
}

function viewTicket(ticketId) {
  if (!ticketId) return;
  
  try {
    showLoading('Ticket wird geladen...');
    
    // Ticket aus dem Cache holen
    const tickets = moduleCache['tickets'] || [];
    const ticket = tickets.find(t => t.id == ticketId);
    
    if (!ticket) {
      throw new Error('Ticket nicht gefunden.');
    }
    
    hideLoading();
    
    // Modal zum Anzeigen des Tickets erstellen
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content ticket-view">
        <div class="modal-header">
          <h2>${ticket.headerText ? escapeHtml(ticket.headerText) : 'Ticket'}</h2>
          <button class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="ticket-details">
            <div class="ticket-info-group">
              <div class="ticket-info">
                <span class="ticket-label">Telefon:</span>
                <span class="ticket-value">${escapeHtml(ticket.phone || '-')}</span>
              </div>
              <div class="ticket-info">
                <span class="ticket-label">PKZ:</span>
                <span class="ticket-value">${escapeHtml(ticket.pkz || '-')}</span>
              </div>
              <div class="ticket-info">
                <span class="ticket-label">Erstellt am:</span>
                <span class="ticket-value">${ticket.created_at ? new Date(ticket.created_at).toLocaleString() : '-'}</span>
              </div>
            </div>
            <div class="ticket-description-box">
              ${ticket.headerText ? `<div class="ticket-header-banner">--------- ${escapeHtml(ticket.headerText)} ---------</div>` : ''}
              <h3>Beschreibung:</h3>
              <div class="ticket-description-content">
                ${escapeHtml(ticket.description || ticket.title || '').replace(/\n/g, '<br>')}
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-ticket-btn">Schließen</button>
          <button class="btn btn-primary copy-ticket-content-btn">Ticket kopieren</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event-Listener für Aktionen
    const closeBtn = modal.querySelector('.close-btn');
    const closeTicketBtn = modal.querySelector('.close-ticket-btn');
    const copyContentBtn = modal.querySelector('.copy-ticket-content-btn');
    
    const closeModal = () => {
      document.body.removeChild(modal);
    };
    
    closeBtn.addEventListener('click', closeModal);
    closeTicketBtn.addEventListener('click', closeModal);
    
    // Event-Listener für "Beschreibung kopieren" Button
    copyContentBtn.addEventListener('click', () => {
      copyTicketDescription(ticketId);
    });
    
    // Doppelklick auf den Inhalt zum Bearbeiten
    modal.querySelector('.modal-content').addEventListener('dblclick', () => {
      closeModal();
      editTicket(ticketId);
    });
    
  } catch (error) {
    hideLoading();
    console.error('Fehler beim Anzeigen des Tickets:', error);
    showNotification(`Fehler: ${error.message}`, 'error');
  }
}

// Funktion zum Bearbeiten eines Tickets
function editTicket(ticketId) {
  if (!ticketId) return;
  
  try {
    showLoading('Ticket wird geladen...');
    
    // Ticket aus dem Cache holen
    const tickets = moduleCache['tickets'] || [];
    const ticket = tickets.find(t => t.id == ticketId);
    
    if (!ticket) {
      throw new Error('Ticket nicht gefunden.');
    }
    
    hideLoading();
    
    // Modal zum Bearbeiten des Tickets erstellen
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content ticket-dialog">
        <div class="modal-header">
          <h2>${ticket.headerText ? escapeHtml(ticket.headerText) : 'Ticket bearbeiten'}</h2>
          <button class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="ticket-phone">Telefon:</label>
            <input type="text" id="ticket-phone" class="form-control" value="${escapeHtml(ticket.phone || '')}">
          </div>
          <div class="form-group">
            <label for="ticket-pkz">PKZ:</label>
            <input type="text" id="ticket-pkz" class="form-control" value="${escapeHtml(ticket.pkz || '')}">
          </div>
          <div class="form-group">
            <label for="ticket-description">Beschreibung:</label>
            <textarea id="ticket-description" class="form-control" rows="5">${escapeHtml(ticket.description || ticket.title || '')}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary cancel-btn">Abbrechen</button>
          <button class="btn btn-primary save-btn">Speichern</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event-Listener für Aktionen
    const closeBtn = modal.querySelector('.close-btn');
    const cancelBtn = modal.querySelector('.cancel-btn');
    const saveBtn = modal.querySelector('.save-btn');
    
    const phoneInput = modal.querySelector('#ticket-phone');
    const pkzInput = modal.querySelector('#ticket-pkz');
    const descriptionTextarea = modal.querySelector('#ticket-description');
    
    const closeModal = () => {
      document.body.removeChild(modal);
    };
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    saveBtn.addEventListener('click', async () => {
      const phone = phoneInput.value.trim();
      const pkz = pkzInput.value.trim();
      const description = descriptionTextarea.value.trim();
      
      if (!description) {
        showNotification('Bitte geben Sie eine Beschreibung ein.', 'error');
        return;
      }
      
      // Aktualisiere Ticket
      const updatedTicket = {
        ...ticket,
        phone: phone,
        pkz: pkz,
        description: description
      };
      
      try {
        showLoading('Ticket wird aktualisiert...');
        
        // Tickets aus dem lokalen Speicher laden
        let tickets = JSON.parse(localStorage.getItem('tickets') || '[]');
        
        // Ticket aktualisieren
        const index = tickets.findIndex(t => t.id == ticketId);
        if (index !== -1) {
          tickets[index] = updatedTicket;
          localStorage.setItem('tickets', JSON.stringify(tickets));
        }
        
        // Optional: API-Aufruf, wenn Server-Persistenz gewünscht ist
        try {
          const response = await fetch(`/api/tickets/${ticketId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedTicket)
          });
          
          if (!response.ok) {
            console.warn("Server-Aktualisierung fehlgeschlagen, nur lokale Aktualisierung wurde durchgeführt");
          }
        } catch (apiError) {
          console.warn("API-Fehler, Ticket wurde nur lokal aktualisiert:", apiError);
        }
        
        hideLoading();
        closeModal();
        
        // Cache invalidieren und Tickets neu laden
        invalidateCache('tickets');
        await loadModule('tickets');
        
        showNotification('Ticket wurde erfolgreich aktualisiert.', 'success');
        
      } catch (error) {
        hideLoading();
        console.error('Fehler beim Aktualisieren des Tickets:', error);
        showNotification(`Fehler: ${error.message}`, 'error');
      }
    });
  } catch (error) {
    hideLoading();
    console.error('Fehler beim Laden des Tickets:', error);
    showNotification(`Fehler: ${error.message}`, 'error');
  }
}

// Funktion zum Löschen eines Tickets
async function deleteTicket(ticketId) {
  if (!ticketId) return;
  
  try {
    showLoading('Ticket wird gelöscht...');
    
    // Tickets aus dem lokalen Speicher laden
    let tickets = JSON.parse(localStorage.getItem('tickets') || '[]');
    
    // Ticket mit der angegebenen ID entfernen
    tickets = tickets.filter(ticket => ticket.id != ticketId);
    
    // Neu nummerieren (optional)
    tickets.forEach((ticket, index) => {
      ticket.id = index + 1;
    });
    
    // Aktualisierte Tickets speichern
    localStorage.setItem('tickets', JSON.stringify(tickets));
    
    // Optional: API-Aufruf, wenn Server-Persistenz gewünscht ist
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        console.warn("Server-Löschung fehlgeschlagen, nur lokale Löschung wurde durchgeführt");
      }
    } catch (apiError) {
      console.warn("API-Fehler, Ticket wurde nur lokal gelöscht:", apiError);
    }
    
    hideLoading();
    
    // Cache invalidieren und Tickets neu laden
    invalidateCache('tickets');
    await loadModule('tickets');
    
    showNotification('Ticket wurde erfolgreich gelöscht.', 'success');
    
  } catch (error) {
    hideLoading();
    console.error('Fehler beim Löschen des Tickets:', error);
    showNotification(`Fehler: ${error.message}`, 'error');
  }
}

function renderPrinters(printers) {
  console.log("Rendering printers:", printers);
  
  // Simple HTML for printers
  content.innerHTML = `
    <div class="module-header printer-section">
      <h2><i class="fas fa-print"></i> Drucker</h2>
      <div class="module-actions">
        <button id="add-printer-btn" class="btn btn-primary">
          <i class="fas fa-plus"></i> Drucker hinzufügen
        </button>
      </div>
    </div>
    <div id="printers-container">
      ${printers.length === 0 ? 
        `<div class="empty-state">
          <i class="fas fa-print fa-3x mb-3"></i>
          <h3>Keine Drucker vorhanden</h3>
          <p>Fügen Sie Drucker hinzu, um sie zu verwalten.</p>
        </div>` :
        `<div class="printers-grid">
          ${printers.map(printer => `
            <div class="printer-item" data-id="${printer.id}">
              <div class="printer-header">
                <h3 class="printer-name">${escapeHtml(printer.name || 'Unbenannter Drucker')}</h3>
                <div class="printer-actions">
                  <button class="btn-icon edit-printer" title="Drucker bearbeiten">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="btn-icon delete-printer" title="Drucker entfernen">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
              <div class="printer-body">
                <div class="printer-info">
                  <div class="printer-ip">${escapeHtml(printer.ip || 'Keine IP')}</div>
                  <div class="printer-location">${escapeHtml(printer.location || 'Kein Standort')}</div>
                </div>
                <div class="printer-buttons">
                  <button class="btn-primary open-printer" data-id="${printer.id}">Öffnen</button>
                  <button class="btn-secondary install-printer" data-id="${printer.id}">Installieren</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>`
      }
    </div>
  `;
  
  // Set up event handlers for printer actions
  setupPrinterEventHandlers();
}

function renderFAQ(faqs) {
  console.log("Rendering FAQ:", faqs);
  
  // Generate category tree structure
  const categories = {};
  
  // Erstelle eine Kategorie aus den Tags, wenn keine Kategorie vorhanden ist
  faqs.forEach(faq => {
    // Verwende den ersten Tag als Kategorie, wenn keine Kategorie definiert ist
    const category = faq.category || (faq.tags && faq.tags.length > 0 ? faq.tags[0] : "Allgemein");
    
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push({...faq, category: category}); // Stellt sicher, dass jede FAQ eine Kategorie hat
  });

  // Erstelle visuelle Buttons für die Kategorien (wie bei Drucker, Teams, usw.)
  let categoryButtonsHtml = '<div class="faq-category-buttons">';
  
  // "Alle" Button als ersten Button hinzufügen
  categoryButtonsHtml += `
    <button class="category-button active" data-category="all">
      <i class="fas fa-th-large"></i>
      <span>Alle</span>
    </button>
  `;
  
  // Buttons für jede Kategorie hinzufügen
  Object.keys(categories).forEach(cat => {
    const iconClass = getIconForCategory(cat); // Funktion für passende Icons
    categoryButtonsHtml += `
      <button class="category-button" data-category="${escapeHtml(cat)}">
        <i class="${iconClass}"></i>
        <span>${escapeHtml(cat)}</span>
      </button>
    `;
  });
  categoryButtonsHtml += '</div>';

  // Create tree view HTML (als Alternative zu den Buttons)
  let treeHtml = '<div class="faq-tree"><div class="faq-category">Kategorien</div><ul class="faq-tree-list">';
  Object.keys(categories).forEach(cat => {
    treeHtml += `<li><strong>${escapeHtml(cat)}</strong><ul>`;
    categories[cat].forEach(faq => {
      treeHtml += `<li><a href="#faq-${faq.id}">${escapeHtml(faq.question)}</a></li>`;
    });
    treeHtml += '</ul></li>';
  });
  treeHtml += '</ul></div>';

  // Create FAQ cards HTML with upvote/downvote
  let faqHtml = '';
  if (faqs.length === 0) {
    faqHtml = `
      <div class="empty-state">
        <i class="fas fa-question-circle fa-3x mb-3"></i>
        <h3>Keine FAQs vorhanden</h3>
        <p>Fügen Sie häufig gestellte Fragen hinzu, um Benutzern zu helfen.</p>
      </div>
    `;
  } else {
    faqHtml = faqs.map((faq, index) => {
      // Stelle sicher, dass die Kategorie definiert ist (wir haben sie oben gesetzt)
      const category = faq.category || "Allgemein";
      
      return `
      <div class="card" id="faq-${faq.id}" data-category="${escapeHtml(category)}">
        <div class="card-header" id="faq-heading-${faq.id}">
          <h2 class="mb-0">
            <button class="btn btn-link btn-block text-left faq-question" type="button" 
                    data-toggle="collapse" data-target="#faq-collapse-${faq.id}" 
                    aria-expanded="${index === 0 ? 'true' : 'false'}" 
                    aria-controls="faq-collapse-${faq.id}">
              ${escapeHtml(faq.question || '')}
            </button>
          </h2>
        </div>
        <div id="faq-collapse-${faq.id}" class="collapse ${index === 0 ? 'show' : ''}" 
             aria-labelledby="faq-heading-${faq.id}">
          <div class="card-body faq-answer">
            <div class="faq-vote">
              <button class="faq-vote-btn upvote" data-id="${faq.id}" title="Upvote"><i class="fas fa-thumbs-up"></i></button>
              <span class="faq-vote-count" id="faq-vote-count-${faq.id}">${faq.votes || 0}</span>
              <button class="faq-vote-btn downvote" data-id="${faq.id}" title="Downvote"><i class="fas fa-thumbs-down"></i></button>
            </div>
            <div class="faq-answer-text">${faq.answer || ''}</div>
          </div>
        </div>
      </div>
    `;
    }).join('');
  }

  // Set content
  content.innerHTML = `
    <div class="module-header">
      <h2><i class="fas fa-question-circle"></i> FAQ</h2>
      <div class="module-actions">
        <button id="add-faq-btn" class="btn btn-primary">
          <i class="fas fa-plus"></i> FAQ hinzufügen
        </button>
      </div>
    </div>
    
    <!-- Visuelle Kategorie-Buttons oben anzeigen -->
    ${categoryButtonsHtml}
    
    <!-- Traditionelle Kategoriebaum-Ansicht (optional ausblenden) -->
    <div class="faq-tree-container" style="display: none;">
      ${treeHtml}
    </div>
    
    <div id="faq-container" class="accordion">
      ${faqHtml}
    </div>
  `;

  // Set up event handlers
  document.querySelectorAll('.faq-question').forEach(function(button) {
    button.addEventListener('click', function() {
      const target = document.querySelector(this.dataset.target);
      if (target) {
        target.classList.toggle('show');
      }
    });
  });
  
  // Event-Handler für die Kategorie-Buttons
  document.querySelectorAll('.category-button').forEach(button => {
    button.addEventListener('click', function() {
      const selectedCategory = this.dataset.category;
      
      // Aktiven Button hervorheben
      document.querySelectorAll('.category-button').forEach(btn => {
        btn.classList.remove('active');
      });
      this.classList.add('active');
      
      if (selectedCategory === 'all') {
        // Alle FAQs anzeigen
        document.querySelectorAll('#faq-container .card').forEach(card => {
          card.style.display = 'block';
        });
      } else {
        // Nur FAQs der ausgewählten Kategorie anzeigen
        document.querySelectorAll('#faq-container .card').forEach(card => {
          const cardCategory = card.dataset.category;
          card.style.display = (cardCategory === selectedCategory) ? 'block' : 'none';
        });
      }
    });
  });

  // Add FAQ Button Event Handler
  const addFaqBtn = document.getElementById('add-faq-btn');
  if (addFaqBtn) {
    addFaqBtn.addEventListener('click', function() {
      showAddFAQDialog();
    });
  }

  // Set up vote handlers
  document.querySelectorAll('.faq-vote-btn.upvote').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const faqId = this.dataset.id;
      updateFAQVote(faqId, 1);
    });
  });

  document.querySelectorAll('.faq-vote-btn.downvote').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const faqId = this.dataset.id;
      updateFAQVote(faqId, -1);
    });
  });
}
function updateFAQVote(faqId, vote) {
  // Implementation for voting on FAQ items
  console.log("Voting on FAQ:", faqId, "with vote:", vote);
  var countSpan = document.getElementById('faq-vote-count-' + faqId);
  if (countSpan) {
    var count = parseInt(countSpan.textContent) || 0;
    count += vote;
    countSpan.textContent = count;
    
    if (vote > 0) {
      // Handle upvote
      document.querySelector('.faq-vote-btn.upvote[data-id="' + faqId + '"]').classList.add('upvoted');
      document.querySelector('.faq-vote-btn.downvote[data-id="' + faqId + '"]').classList.remove('downvoted');
    } else {
      // Handle downvote
      document.querySelector('.faq-vote-btn.downvote[data-id="' + faqId + '"]').classList.add('downvoted');
      document.querySelector('.faq-vote-btn.upvote[data-id="' + faqId + '"]').classList.remove('upvoted');
    }
  }
}

// Function to show the Add FAQ dialog
function showAddFAQDialog() {
  // Create modal dialog HTML
  const modalHtml = `
    <div class="modal-overlay" id="add-faq-modal">
      <div class="modal-content dark-theme">
        <div class="modal-header">
          <h3>FAQ hinzufügen</h3>
          <button class="modal-close" id="close-add-faq-modal">&times;</button>
        </div>
        <div class="modal-body">
          <form id="add-faq-form">
            <div class="form-group">
              <label for="faq-category">Kategorie:</label>
              <input type="text" id="faq-category" class="form-control" placeholder="z.B. Netzwerk, Drucker, etc." required>
            </div>
            <div class="form-group">
              <label for="faq-question">Frage:</label>
              <input type="text" id="faq-question" class="form-control" placeholder="Geben Sie die Frage ein" required>
            </div>
            <div class="form-group">
              <label for="faq-answer">Antwort:</label>
              <textarea id="faq-answer" class="form-control" rows="6" placeholder="Geben Sie die Antwort ein" required></textarea>
            </div>
            <div class="form-group">
              <label>Anhänge (PDF, Bilder):</label>
              <div class="attachment-controls">
                <input type="file" id="faq-attachments" class="form-control-file" multiple accept=".pdf,.jpg,.jpeg,.png,.gif">
                <small class="text-muted">Unterstützte Formate: PDF, JPG, PNG, GIF</small>
              </div>
              <div id="attachment-preview" class="attachment-preview"></div>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">Speichern</button>
              <button type="button" class="btn btn-secondary" id="cancel-add-faq">Abbrechen</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  // Add modal to DOM
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Show the modal
  document.getElementById('add-faq-modal').classList.add('active');

  // Handle file input change to show previews
  const attachmentInput = document.getElementById('faq-attachments');
  const previewContainer = document.getElementById('attachment-preview');

  attachmentInput.addEventListener('change', function() {
    previewContainer.innerHTML = '';
    
    for (const file of this.files) {
      const fileExt = file.name.split('.').pop().toLowerCase();
      const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(fileExt);
      const isPdf = fileExt === 'pdf';
      
      const previewItem = document.createElement('div');
      previewItem.className = 'attachment-item';
      
      if (isImage) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.className = 'attachment-thumbnail';
        previewItem.appendChild(img);
      } else if (isPdf) {
        const pdfIcon = document.createElement('div');
        pdfIcon.className = 'pdf-icon';
        pdfIcon.innerHTML = '<i class="fas fa-file-pdf"></i>';
        previewItem.appendChild(pdfIcon);
      }
      
      const fileInfo = document.createElement('div');
      fileInfo.className = 'file-info';
      fileInfo.textContent = file.name;
      previewItem.appendChild(fileInfo);
      
      previewContainer.appendChild(previewItem);
    }
  });

  // Handle form submission
  document.getElementById('add-faq-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const category = document.getElementById('faq-category').value;
    const question = document.getElementById('faq-question').value;
    const answer = document.getElementById('faq-answer').value;
    const files = document.getElementById('faq-attachments').files;
    
    // Create FormData to handle file uploads
    const formData = new FormData();
    formData.append('category', category);
    formData.append('question', question);
    formData.append('answer', answer);
    
    for (let i = 0; i < files.length; i++) {
      formData.append('attachments', files[i]);
    }
    
    // Submit the form data to the server
    saveFAQ(formData);
  });

  // Close modal handlers
  document.getElementById('close-add-faq-modal').addEventListener('click', closeAddFAQModal);
  document.getElementById('cancel-add-faq').addEventListener('click', closeAddFAQModal);
}

// Function to close the Add FAQ modal
function closeAddFAQModal() {
  const modal = document.getElementById('add-faq-modal');
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => {
      modal.remove();
    }, 300);
  }
}

// Function to save the FAQ
function saveFAQ(formData) {
  // Show loading indicator
  showNotification('Speichere FAQ...', 'info');
  
  fetch('/api/faq', {
    method: 'POST',
    body: formData
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Fehler beim Speichern des FAQ');
    }
    return response.json();
  })
  .then(data => {
    showNotification('FAQ erfolgreich gespeichert', 'success');
    closeAddFAQModal();
    
    // Reload FAQs to show the new entry
    loadModule('faq');
  })
  .catch(error => {
    console.error('Error saving FAQ:', error);
    showNotification('Fehler beim Speichern: ' + error.message, 'error');
  });
}

function renderNetwork() {
  console.log("Rendering network module");
  
  // Load the netzwerk.html template content
  fetch('netzwerk.html')
    .then(response => {
      if (!response.ok) {
        throw new Error("HTTP error! Status: " + response.status);
      }
      return response.text();
    })
    .then(html => {
      // Set the HTML content
      content.innerHTML = html;
      
      // Initialize network functions now that the HTML is loaded
      initNetworkFunctions();
    })
    .catch(error => {
      console.error("Error loading network template:", error);
      content.innerHTML = "<div class=\"error-message\">Fehler beim Laden des Netzwerk-Moduls: " + error.message + "</div>";
    });

}

// Function to render tools
function renderTools(tools, workspaceContents = {}) {
  console.log("Rendering tools:", tools);
  
  // Helper function to determine tool type based on path
  function getToolType(tool) {
    const path = tool.path || '';
    if (tool.type) return tool.type; // If type is already set, use it
    
    // Determine type based on path patterns
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('ftp://')) {
      return 'link';
    }
    if (path.startsWith('\\\\') || path.startsWith('//')) {
      return 'network';
    }
    if (path.toLowerCase().endsWith('.exe') || path.toLowerCase().endsWith('.bat') || path.toLowerCase().endsWith('.cmd')) {
      return 'executable';
    }
    // Default to executable for other paths
    return 'executable';
  }
  
  // Group tools by type
  const worksets = tools.filter(tool => getToolType(tool) === 'workspace');
  const applications = tools.filter(tool => getToolType(tool) === 'executable');
  const networkPaths = tools.filter(tool => getToolType(tool) === 'network');
  const links = tools.filter(tool => getToolType(tool) === 'link');
  
  content.innerHTML = `
    <div class="module-header">
      <h2><i class="fas fa-tools"></i> Tools</h2>
      <div class="module-actions">
        <button id="add-tool-btn" class="btn btn-primary">
          <i class="fas fa-plus"></i> Tool hinzufügen
        </button>
      </div>
    </div>
    <div id="tools-container">
      ${worksets.length === 0 && applications.length === 0 && networkPaths.length === 0 && links.length === 0 ? 
        `<div class="empty-state">
          <i class="fas fa-tools fa-3x mb-3"></i>
          <h3>Keine Tools vorhanden</h3>
          <p>Fügen Sie Tools hinzu, um sie zu verwalten.</p>
        </div>` :
        `
        ${worksets.length > 0 ? `
          <div class="category-section">
            <h3 class="category-title"><i class="fas fa-folder"></i> Workspaces</h3>
            <div class="workspaces-grid">
              ${worksets.map(workspace => {
                const workspaceTools = workspaceContents[workspace.id] || [];
                return `
                <div class="workspace-tab droppable-workspace" data-id="${workspace.id}" data-type="workspace">
                  <div class="workspace-tab-header">
                    <h4 class="workspace-tab-name">${escapeHtml(workspace.name || 'Unbenannter Workspace')}</h4>
                    <div class="workspace-tab-actions">
                      <button class="btn-icon toggle-autostart ${workspace.autostart ? 'active' : ''}" title="${workspace.autostart ? 'Autostart deaktivieren' : 'Autostart aktivieren'}">
                        <i class="fas fa-${workspace.autostart ? 'toggle-on' : 'toggle-off'}"></i>
                      </button>
                      <button class="btn-icon edit-workset" title="Workset bearbeiten">
                        <i class="fas fa-edit"></i>
                      </button>
                      <button class="btn-icon delete-workset" title="Workset entfernen">
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                  <div class="workspace-tab-content">
                    <div class="workspace-tool-count">${workspaceTools.length} Tools</div>
                    ${workspaceTools.length > 0 ? `
                    <div class="workspace-tools-list">
                      ${workspaceTools.map(tool => `
                        <div class="workspace-tool-button" data-workspace-id="${workspace.id}" data-tool-id="${tool.id}">
                          <span class="tool-name">${escapeHtml(tool.name)}</span>
                          <button class="btn-icon remove-tool-from-workspace" data-workspace-id="${workspace.id}" data-tool-id="${tool.id}" title="Tool aus Workspace entfernen">
                            <i class="fas fa-times"></i>
                          </button>
                        </div>
                      `).join('')}
                    </div>
                    ` : ''}
                    <button class="btn-primary open-workset" data-id="${workspace.id}">Öffnen</button>
                  </div>
                </div>
              `}).join('')}

            </div>
          </div>
        ` : ''}
        
        ${applications.length > 0 ? `
          <div class="category-section">
            <h3 class="category-title"><i class="fas fa-desktop"></i> Anwendungen</h3>
            <div class="tools-grid">
              ${applications.map(tool => `
                <div class="tool-item draggable-tool" data-id="${tool.id}" data-type="${getToolType(tool)}" draggable="true">
                  <div class="tool-header">
                    <h3 class="tool-name">${escapeHtml(tool.name || 'Unbenanntes Tool')}</h3>
                    <div class="tool-actions">
                      <button class="btn-icon toggle-autostart ${tool.autostart ? 'active' : ''}" title="${tool.autostart ? 'Autostart deaktivieren' : 'Autostart aktivieren'}">
                        <i class="fas fa-${tool.autostart ? 'toggle-on' : 'toggle-off'}"></i>
                      </button>
                      <button class="btn-icon toggle-admin ${tool.admin ? 'active' : ''}" title="${tool.admin ? 'Admin-Modus deaktivieren' : 'Als Administrator starten'}">
                        <i class="fas fa-${tool.admin ? 'user-shield' : 'user'}"></i>
                      </button>
                      <button class="btn-icon edit-tool" title="Tool bearbeiten">
                        <i class="fas fa-edit"></i>
                      </button>
                      <button class="btn-icon delete-tool" title="Tool entfernen">
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                  <div class="tool-body">
                    <div class="tool-info">
                      <div class="tool-path">${escapeHtml(tool.path || 'Kein Pfad')}</div>
                      ${tool.args ? `<div class="tool-args">Args: ${escapeHtml(tool.args)}</div>` : ''}
                      ${tool.tags && tool.tags.length > 0 ? `<div class="tool-tags">Tags: ${tool.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
                    </div>
                    <div class="tool-buttons">
                      <button class="btn-primary start-tool" data-id="${tool.id}">Starten</button>
                      ${tool.favorite ? '<button class="btn-secondary favorite-tool active" data-id="' + tool.id + '"><i class="fas fa-star"></i></button>' : '<button class="btn-secondary favorite-tool" data-id="' + tool.id + '"><i class="far fa-star"></i></button>'}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        ${networkPaths.length > 0 ? `
          <div class="category-section">
            <h3 class="category-title"><i class="fas fa-network-wired"></i> Netzwerkpfade</h3>
            <div class="tools-grid">
              ${networkPaths.map(tool => `
                <div class="tool-item draggable-tool" data-id="${tool.id}" data-type="${getToolType(tool)}" draggable="true">
                  <div class="tool-header">
                    <h3 class="tool-name">${escapeHtml(tool.name || 'Unbenannter Netzwerkpfad')}</h3>
                    <div class="tool-actions">
                      <button class="btn-icon toggle-autostart ${tool.autostart ? 'active' : ''}" title="${tool.autostart ? 'Autostart deaktivieren' : 'Autostart aktivieren'}">
                        <i class="fas fa-${tool.autostart ? 'toggle-on' : 'toggle-off'}"></i>
                      </button>
                      <button class="btn-icon edit-tool" title="Tool bearbeiten">
                        <i class="fas fa-edit"></i>
                      </button>
                      <button class="btn-icon delete-tool" title="Tool entfernen">
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                  <div class="tool-body">
                    <div class="tool-info">
                      <div class="tool-path">${escapeHtml(tool.path || 'Kein Pfad')}</div>
                      ${tool.args ? `<div class="tool-args">Args: ${escapeHtml(tool.args)}</div>` : ''}
                      ${tool.tags && tool.tags.length > 0 ? `<div class="tool-tags">Tags: ${tool.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
                    </div>
                    <div class="tool-buttons">
                      <button class="btn-primary start-tool" data-id="${tool.id}">Öffnen</button>
                      ${tool.favorite ? '<button class="btn-secondary favorite-tool active" data-id="' + tool.id + '"><i class="fas fa-star"></i></button>' : '<button class="btn-secondary favorite-tool" data-id="' + tool.id + '"><i class="far fa-star"></i></button>'}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        ${links.length > 0 ? `
          <div class="category-section">
            <h3 class="category-title"><i class="fas fa-link"></i> Links</h3>
            <div class="tools-grid">
              ${links.map(tool => `
                <div class="tool-item draggable-tool" data-id="${tool.id}" data-type="${getToolType(tool)}" draggable="true">
                  <div class="tool-header">
                    <h3 class="tool-name">${escapeHtml(tool.name || 'Unbenannter Link')}</h3>
                    <div class="tool-actions">
                      <button class="btn-icon toggle-autostart ${tool.autostart ? 'active' : ''}" title="${tool.autostart ? 'Autostart deaktivieren' : 'Autostart aktivieren'}">
                        <i class="fas fa-${tool.autostart ? 'toggle-on' : 'toggle-off'}"></i>
                      </button>
                      <button class="btn-icon edit-tool" title="Tool bearbeiten">
                        <i class="fas fa-edit"></i>
                      </button>
                      <button class="btn-icon delete-tool" title="Tool entfernen">
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                  <div class="tool-body">
                    <div class="tool-info">
                      <div class="tool-path">${escapeHtml(tool.path || 'Kein Pfad')}</div>
                      ${tool.args ? `<div class="tool-args">Args: ${escapeHtml(tool.args)}</div>` : ''}
                      ${tool.tags && tool.tags.length > 0 ? `<div class="tool-tags">Tags: ${tool.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
                    </div>
                    <div class="tool-buttons">
                      <button class="btn-primary start-tool" data-id="${tool.id}">Öffnen</button>
                      ${tool.favorite ? '<button class="btn-secondary favorite-tool active" data-id="' + tool.id + '"><i class="fas fa-star"></i></button>' : '<button class="btn-secondary favorite-tool" data-id="' + tool.id + '"><i class="far fa-star"></i></button>'}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        `
      }
    </div>
  `;
  
  // Set up event handlers for tool actions
  setupToolEventHandlers();
  setupWorksetEventHandlers();
  setupDragAndDropEventHandlers();
}

// Function to render worksets (combined view of all tool types)
function renderWorksets(allTools, workspaceContents = {}) {
  console.log("Rendering worksets (all tools):", allTools);
  
  // Helper function to determine tool type based on path
  function getToolType(tool) {
    const path = tool.path || '';
    if (tool.type) return tool.type; // If type is already set, use it
    
    // Determine type based on path patterns
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('ftp://')) {
      return 'link';
    }
    if (path.startsWith('\\\\') || path.startsWith('//')) {
      return 'network';
    }
    if (path.toLowerCase().endsWith('.exe') || path.toLowerCase().endsWith('.bat') || path.toLowerCase().endsWith('.cmd')) {
      return 'executable';
    }
    // Default to executable for other paths
    return 'executable';
  }
  
  // Group tools by type
  const worksets = allTools.filter(tool => getToolType(tool) === 'workspace');
  const applications = allTools.filter(tool => getToolType(tool) === 'executable');
  const networkPaths = allTools.filter(tool => getToolType(tool) === 'network');
  const links = allTools.filter(tool => getToolType(tool) === 'link');
  
  content.innerHTML = `
    <div class="module-header">
      <h2><i class="fas fa-layer-group"></i> Worksets</h2>
      <div class="module-actions">
        <button id="add-workset-btn" class="btn btn-primary">
          <i class="fas fa-plus"></i> Workset hinzufügen
        </button>
      </div>
    </div>
    <div id="worksets-container">
      ${worksets.length === 0 && applications.length === 0 && networkPaths.length === 0 && links.length === 0 ? 
        `<div class="empty-state">
          <i class="fas fa-layer-group fa-3x mb-3"></i>
          <h3>Keine Worksets oder Tools vorhanden</h3>
          <p>Erstellen Sie Worksets und fügen Sie Tools hinzu, um Ihre Arbeitsumgebung zu organisieren.</p>
        </div>` :
        `
        ${worksets.length > 0 ? `
          <div class="category-section">
            <h3 class="category-title"><i class="fas fa-folder"></i> Worksets</h3>
            <div class="tools-grid">
              ${worksets.map(workspace => {
                const workspaceTools = workspaceContents[workspace.id] || [];
                const toolNames = workspaceTools.map(tool => tool.name).join(', ');
                return `
                <div class="tool-item workspace-card droppable-workspace" data-id="${workspace.id}" data-type="workspace">
                  <div class="tool-header">
                    <h4 class="tool-name">${escapeHtml(workspace.name || 'Unbenannter Workspace')}</h4>
                    <div class="tool-actions">
                      <button class="btn-icon toggle-autostart ${workspace.autostart ? 'active' : ''}" title="${workspace.autostart ? 'Autostart deaktivieren' : 'Autostart aktivieren'}">
                        <i class="fas fa-${workspace.autostart ? 'toggle-on' : 'toggle-off'}"></i>
                      </button>
                      <button class="btn-icon edit-workset" title="Workset bearbeiten">
                        <i class="fas fa-edit"></i>
                      </button>
                      <button class="btn-icon delete-workset" title="Workset entfernen">
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                  <div class="tool-body">
                    <div class="workspace-info">
                      ${workspaceTools.length > 0 ? `<div class="workspace-path">${escapeHtml(workspace.path || '')}</div>` : ''}
                      ${workspace.tags && workspace.tags.length > 0 ? `<div class="tool-tags">Tags: ${workspace.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
                      <div class="workspace-tools-list">
                        ${workspaceTools.map(tool => `
                          <div class="workspace-tool-button" data-workspace-id="${workspace.id}" data-tool-id="${tool.id}">
                            <span class="tool-name">${escapeHtml(tool.name)}</span>
                            <button class="btn-icon remove-tool-from-workspace" data-workspace-id="${workspace.id}" data-tool-id="${tool.id}" title="Tool aus Workspace entfernen">
                              <i class="fas fa-times"></i>
                            </button>
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  </div>
                </div>
              `}).join('')}
            </div>
          </div>
        ` : ''}
        
        ${applications.length > 0 ? `
          <div class="category-section">
            <h3 class="category-title"><i class="fas fa-cogs"></i> Anwendungen</h3>
            <div class="tools-grid">
              ${applications.map(app => `
                <div class="tool-item draggable-tool" data-id="${app.id}" data-type="executable" draggable="true">
                  <div class="tool-header">
                    <h4 class="tool-name">${escapeHtml(app.name || 'Unbenannte Anwendung')}</h4>
                    <div class="tool-actions">
                      <button class="btn-icon toggle-autostart ${app.autostart ? 'active' : ''}" title="${app.autostart ? 'Autostart deaktivieren' : 'Autostart aktivieren'}">
                        <i class="fas fa-${app.autostart ? 'toggle-on' : 'toggle-off'}"></i>
                      </button>
                      <button class="btn-icon toggle-admin ${app.admin ? 'active' : ''}" title="${app.admin ? 'Admin-Modus deaktivieren' : 'Als Administrator starten'}">
                        <i class="fas fa-${app.admin ? 'user-shield' : 'user'}"></i>
                      </button>
                      <button class="btn-icon edit-application" title="Anwendung bearbeiten">
                        <i class="fas fa-edit"></i>
                      </button>
                      <button class="btn-icon delete-application" title="Anwendung entfernen">
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                  <div class="tool-body">
                    <div class="tool-info">
                      <div class="tool-path">${escapeHtml(app.path || 'Kein Pfad')}</div>
                      ${app.args ? `<div class="tool-args">Args: ${escapeHtml(app.args)}</div>` : ''}
                      ${app.tags && app.tags.length > 0 ? `<div class="tool-tags">Tags: ${app.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
                    </div>
                    <div class="tool-buttons">
                      <button class="btn-primary start-application" data-id="${app.id}">Starten</button>
                      ${app.favorite ? '<button class="btn-secondary favorite-application active" data-id="' + app.id + '"><i class="fas fa-star"></i></button>' : '<button class="btn-secondary favorite-application" data-id="' + app.id + '"><i class="far fa-star"></i></button>'}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        ${networkPaths.length > 0 ? `
          <div class="category-section">
            <h3 class="category-title"><i class="fas fa-network-wired"></i> Netzwerkpfade</h3>
            <div class="tools-grid">
              ${networkPaths.map(netPath => `
                <div class="tool-item draggable-tool" data-id="${netPath.id}" data-type="network" draggable="true">
                  <div class="tool-header">
                    <h4 class="tool-name">${escapeHtml(netPath.name || 'Unbenannter Netzwerkpfad')}</h4>
                    <div class="tool-actions">
                      <button class="btn-icon edit-network-path" title="Netzwerkpfad bearbeiten">
                        <i class="fas fa-edit"></i>
                      </button>
                      <button class="btn-icon delete-network-path" title="Netzwerkpfad entfernen">
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                  <div class="tool-body">
                    <div class="tool-info">
                      <div class="tool-path">${escapeHtml(netPath.path || 'Kein Pfad')}</div>
                      ${netPath.tags && netPath.tags.length > 0 ? `<div class="tool-tags">Tags: ${netPath.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
                    </div>
                    <div class="tool-buttons">
                      <button class="btn-primary open-network-path" data-id="${netPath.id}">Öffnen</button>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        ${links.length > 0 ? `
          <div class="category-section">
            <h3 class="category-title"><i class="fas fa-link"></i> Links</h3>
            <div class="tools-grid">
              ${links.map(link => `
                <div class="tool-item draggable-tool" data-id="${link.id}" data-type="link" draggable="true">
                  <div class="tool-header">
                    <h4 class="tool-name">${escapeHtml(link.name || 'Unbenannter Link')}</h4>
                    <div class="tool-actions">
                      <button class="btn-icon edit-link" title="Link bearbeiten">
                        <i class="fas fa-edit"></i>
                      </button>
                      <button class="btn-icon delete-link" title="Link entfernen">
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                  <div class="tool-body">
                    <div class="tool-info">
                      <div class="tool-path">${escapeHtml(link.path || 'Keine URL')}</div>
                      ${link.tags && link.tags.length > 0 ? `<div class="tool-tags">Tags: ${link.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
                    </div>
                    <div class="tool-buttons">
                      <button class="btn-primary open-link" data-id="${link.id}">Öffnen</button>
                      ${link.favorite ? '<button class="btn-secondary favorite-link active" data-id="' + link.id + '"><i class="fas fa-star"></i></button>' : '<button class="btn-secondary favorite-link" data-id="' + link.id + '"><i class="far fa-star"></i></button>'}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        `
      }
    </div>
  `;
  
  // Set up event handlers for all tool types
  setupWorksetEventHandlers();
  setupApplicationEventHandlers();
  setupNetworkPathEventHandlers();
  setupLinkEventHandlers();
  setupDragAndDropEventHandlers();
}

// Function to render applications
function renderApplications(applications) {
  console.log("Rendering applications:", applications);
  
  content.innerHTML = `
    <div class="module-header">
      <h2><i class="fas fa-desktop"></i> Anwendungen</h2>
      <div class="module-actions">
        <button id="add-application-btn" class="btn btn-primary">
          <i class="fas fa-plus"></i> Anwendung hinzufügen
        </button>
      </div>
    </div>
    <div id="applications-container">
      ${applications.length === 0 ? 
        `<div class="empty-state">
          <i class="fas fa-desktop fa-3x mb-3"></i>
          <h3>Keine Anwendungen vorhanden</h3>
          <p>Fügen Sie Anwendungen hinzu, um sie schnell zu starten.</p>
        </div>` :
        `<div class="tools-grid">
          ${applications.map(app => `
            <div class="tool-item" data-id="${app.id}">
              <div class="tool-header">
                <h3 class="tool-name">${escapeHtml(app.name || 'Unbenannte Anwendung')}</h3>
                <div class="tool-actions">
                  <button class="btn-icon toggle-autostart ${app.autostart ? 'active' : ''}" title="${app.autostart ? 'Autostart deaktivieren' : 'Autostart aktivieren'}">
                    <i class="fas fa-${app.autostart ? 'toggle-on' : 'toggle-off'}"></i>
                  </button>
                  <button class="btn-icon toggle-admin ${app.admin ? 'active' : ''}" title="${app.admin ? 'Admin-Modus deaktivieren' : 'Als Administrator starten'}">
                    <i class="fas fa-${app.admin ? 'user-shield' : 'user'}"></i>
                  </button>
                  <button class="btn-icon edit-application" title="Anwendung bearbeiten">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="btn-icon delete-application" title="Anwendung entfernen">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
              <div class="tool-body">
                <div class="tool-info">
                  <div class="tool-path">${escapeHtml(app.path || 'Kein Pfad')}</div>
                  ${app.args ? `<div class="tool-args">Args: ${escapeHtml(app.args)}</div>` : ''}
                  ${app.tags && app.tags.length > 0 ? `<div class="tool-tags">Tags: ${app.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
                </div>
                <div class="tool-buttons">
                  <button class="btn-primary start-application" data-id="${app.id}">Starten</button>
                  ${app.favorite ? '<button class="btn-secondary favorite-application active" data-id="' + app.id + '"><i class="fas fa-star"></i></button>' : '<button class="btn-secondary favorite-application" data-id="' + app.id + '"><i class="far fa-star"></i></button>'}
                </div>
              </div>
            </div>
          `).join('')}
        </div>`
      }
    </div>
  `;
  
  // Set up event handlers for application actions
  setupApplicationEventHandlers();
}

// Function to render network paths
function renderNetworkPaths(networkPaths) {
  console.log("Rendering network paths:", networkPaths);
  
  content.innerHTML = `
    <div class="module-header">
      <h2><i class="fas fa-network-wired"></i> Netzwerkpfade</h2>
      <div class="module-actions">
        <button id="add-network-path-btn" class="btn btn-primary">
          <i class="fas fa-plus"></i> Netzwerkpfad hinzufügen
        </button>
      </div>
    </div>
    <div id="network-paths-container">
      ${networkPaths.length === 0 ? 
        `<div class="empty-state">
          <i class="fas fa-network-wired fa-3x mb-3"></i>
          <h3>Keine Netzwerkpfade vorhanden</h3>
          <p>Fügen Sie Netzwerkpfade hinzu, um auf freigegebene Ressourcen zuzugreifen.</p>
        </div>` :
        `<div class="tools-grid">
          ${networkPaths.map(netPath => `
            <div class="tool-item" data-id="${netPath.id}">
              <div class="tool-header">
                <h3 class="tool-name">${escapeHtml(netPath.name || 'Unbenannter Netzwerkpfad')}</h3>
                <div class="tool-actions">
                  <button class="btn-icon edit-network-path" title="Netzwerkpfad bearbeiten">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="btn-icon delete-network-path" title="Netzwerkpfad entfernen">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
              <div class="tool-body">
                <div class="tool-info">
                  <div class="tool-path">${escapeHtml(netPath.path || 'Kein Pfad')}</div>
                  ${netPath.tags && netPath.tags.length > 0 ? `<div class="tool-tags">Tags: ${netPath.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
                </div>
                <div class="tool-buttons">
                  <button class="btn-primary open-network-path" data-id="${netPath.id}">Öffnen</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>`
      }
    </div>
  `;
  
  // Set up event handlers for network path actions
  setupNetworkPathEventHandlers();
}

// Function to render links
function renderLinks(links) {
  console.log("Rendering links:", links);
  
  content.innerHTML = `
    <div class="module-header">
      <h2><i class="fas fa-link"></i> Links</h2>
      <div class="module-actions">
        <button id="add-link-btn" class="btn btn-primary">
          <i class="fas fa-plus"></i> Link hinzufügen
        </button>
      </div>
    </div>
    <div id="links-container">
      ${links.length === 0 ? 
        `<div class="empty-state">
          <i class="fas fa-link fa-3x mb-3"></i>
          <h3>Keine Links vorhanden</h3>
          <p>Fügen Sie Links hinzu, um schnell auf wichtige Webseiten zuzugreifen.</p>
        </div>` :
        `<div class="tools-grid">
          ${links.map(link => `
            <div class="tool-item" data-id="${link.id}">
              <div class="tool-header">
                <h3 class="tool-name">${escapeHtml(link.name || 'Unbenannter Link')}</h3>
                <div class="tool-actions">
                  <button class="btn-icon edit-link" title="Link bearbeiten">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="btn-icon delete-link" title="Link entfernen">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
              <div class="tool-body">
                <div class="tool-info">
                  <div class="tool-path">${escapeHtml(link.path || 'Keine URL')}</div>
                  ${link.tags && link.tags.length > 0 ? `<div class="tool-tags">Tags: ${link.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
                </div>
                <div class="tool-buttons">
                  <button class="btn-primary open-link" data-id="${link.id}">Öffnen</button>
                  ${link.favorite ? '<button class="btn-secondary favorite-link active" data-id="' + link.id + '"><i class="fas fa-star"></i></button>' : '<button class="btn-secondary favorite-link" data-id="' + link.id + '"><i class="far fa-star"></i></button>'}
                </div>
              </div>
            </div>
          `).join('')}
        </div>`
      }
    </div>
  `;
  
  // Set up event handlers for link actions
  setupLinkEventHandlers();
}

// Function to set up tool event handlers
function setupToolEventHandlers() {
  console.log("Setting up tool event handlers");
  
  // Start tool buttons - TODO: implement startTool function
  document.querySelectorAll('.start-tool').forEach(btn => {
    btn.addEventListener('click', function() {
      const toolId = parseInt(this.dataset.id);
      console.log("Start tool clicked:", toolId);
      // TODO: implement startTool function
    });
  });
  
  // Toggle autostart buttons
  document.querySelectorAll('.toggle-autostart').forEach(btn => {
    btn.addEventListener('click', function() {
      const toolId = parseInt(this.closest('.tool-item').dataset.id);
      const enable = !this.classList.contains('active');
      toggleToolAutostart(toolId, enable);
    });
  });
  
  // Toggle admin buttons
  document.querySelectorAll('.toggle-admin').forEach(btn => {
    btn.addEventListener('click', function() {
      const toolId = parseInt(this.closest('.tool-item').dataset.id);
      const enable = !this.classList.contains('active');
      toggleToolAdmin(toolId, enable);
    });
  });
  
  // Edit tool buttons - TODO: implement showEditToolDialog
  document.querySelectorAll('.edit-tool').forEach(btn => {
    btn.addEventListener('click', function() {
      const toolId = parseInt(this.closest('.tool-item').dataset.id);
      console.log("Edit tool clicked:", toolId);
      // TODO: implement showEditToolDialog
    });
  });
  
  // Delete tool buttons - TODO: implement deleteTool
  document.querySelectorAll('.delete-tool').forEach(btn => {
    btn.addEventListener('click', function() {
      const toolId = parseInt(this.closest('.tool-item').dataset.id);
      console.log("Delete tool clicked:", toolId);
      // TODO: implement deleteTool
    });
  });
  
  // Favorite tool buttons - TODO: implement toggleToolFavorite
  document.querySelectorAll('.favorite-tool').forEach(btn => {
    btn.addEventListener('click', function() {
      const toolId = parseInt(this.dataset.id);
      console.log("Favorite tool clicked:", toolId);
      // TODO: implement toggleToolFavorite
    });
  });
  
  // Add tool button - TODO: implement showAddToolDialog
  const addToolBtn = document.getElementById('add-tool-btn');
  if (addToolBtn) {
    addToolBtn.addEventListener('click', function() {
      console.log("Add tool clicked");
      // TODO: implement showAddToolDialog
    });
  }
}

// Function to set up workset event handlers
function setupWorksetEventHandlers() {
  console.log("Setting up workset event handlers");
  
  // Open workset buttons
  document.querySelectorAll('.open-workset').forEach(btn => {
    btn.addEventListener('click', function() {
      const worksetId = parseInt(this.dataset.id);
      console.log("Open workset clicked:", worksetId);
      // TODO: implement open workset functionality
    });
  });
  
  // Toggle autostart buttons
  document.querySelectorAll('.toggle-autostart').forEach(btn => {
    btn.addEventListener('click', function() {
      const worksetId = parseInt(this.closest('.tool-item').dataset.id);
      const enable = !this.classList.contains('active');
      // TODO: implement toggle workset autostart
      console.log("Toggle workset autostart:", worksetId, enable);
    });
  });
  
  // Edit workset buttons - disabled as per user request
  document.querySelectorAll('.edit-workset').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      // Do nothing - edit functionality disabled
      console.log("Edit workset disabled by user request");
    });
  });
  
  // Delete workset buttons
  document.querySelectorAll('.delete-workset').forEach(btn => {
    btn.addEventListener('click', function() {
      const worksetId = parseInt(this.closest('.tool-item').dataset.id);
      console.log("Delete workset clicked:", worksetId);
      // TODO: implement deleteWorkset
    });
  });
  
  // Remove tool from workspace buttons
  document.querySelectorAll('.remove-tool-from-workspace').forEach(btn => {
    btn.addEventListener('click', async function() {
      const workspaceId = parseInt(this.dataset.workspaceId);
      const toolId = parseInt(this.dataset.toolId);
      
      try {
        const response = await fetch(`/api/workspace/${workspaceId}/remove-tool`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tool_id: toolId
          })
        });
        
        if (response.ok) {
          alert('Tool aus Workspace entfernt!');
          // Reload tools to show updated state
          loadTools();
        } else {
          const error = await response.json();
          alert('Fehler beim Entfernen des Tools: ' + (error.error || 'Unbekannter Fehler'));
        }
      } catch (error) {
        console.error('Error removing tool from workspace:', error);
        alert('Fehler beim Entfernen des Tools aus dem Workspace');
      }
    });
  });
  
  // Remove category from workspace buttons
  document.querySelectorAll('.remove-category-from-workspace').forEach(btn => {
    btn.addEventListener('click', async function() {
      const workspaceId = parseInt(this.dataset.workspaceId);
      const category = this.dataset.category;
      
      if (!confirm(`Möchten Sie wirklich alle Tools der Kategorie "${category === 'executable' ? 'Anwendungen' : category === 'network' ? 'Netzwerkpfad' : 'Links'}" aus diesem Workspace entfernen?`)) {
        return;
      }
      
      try {
        const response = await fetch(`/api/workspace/${workspaceId}/remove-category`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            category: category
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          alert(result.message);
          // Reload tools to show updated state
          loadTools();
        } else {
          const error = await response.json();
          alert('Fehler beim Entfernen der Kategorie: ' + (error.error || 'Unbekannter Fehler'));
        }
      } catch (error) {
        console.error('Error removing category from workspace:', error);
        alert('Fehler beim Entfernen der Kategorie aus dem Workspace');
      }
    });
  });
  
  // Add workset button
  const addWorksetBtn = document.getElementById('add-workset-btn');
  if (addWorksetBtn) {
    addWorksetBtn.addEventListener('click', function() {
      console.log("Add workset clicked");
      // TODO: implement showAddWorksetDialog
    });
  }
}

// Modal für das Bearbeiten eines Worksets anzeigen
function showEditWorksetDialog(worksetId) {
    // Workset-Daten laden
    fetch(`/api/tools`)
        .then(response => response.json())
        .then(tools => {
            const workset = tools.find(t => t.id === worksetId && t.type === 'workspace');
            if (!workset) {
                alert('Workset nicht gefunden');
                return;
            }

            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Workset bearbeiten</h3>
                        <button class="close-button">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="edit-workset-form">
                            <div class="form-group">
                                <label for="workset-name">Name *</label>
                                <input type="text" id="workset-name" required class="form-control" value="${escapeHtml(workset.name || '')}" placeholder="Workset-Name eingeben">
                            </div>
                            <div class="form-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="workset-autostart" ${workset.autostart ? 'checked' : ''}>
                                    <span>Autostart aktivieren</span>
                                </label>
                            </div>
                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary cancel-btn">Abbrechen</button>
                                <button type="submit" class="btn btn-primary">Speichern</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Schließen-Buttons
            const closeBtn = modal.querySelector('.close-button');
            const cancelBtn = modal.querySelector('.cancel-btn');

            closeBtn.addEventListener('click', () => {
                modal.remove();
            });

            cancelBtn.addEventListener('click', () => {
                modal.remove();
            });

            // Formular-Submit
            const form = modal.querySelector('#edit-workset-form');
            form.addEventListener('submit', function(e) {
                e.preventDefault();

                const nameInput = document.getElementById('workset-name');
                const autostartInput = document.getElementById('workset-autostart');

                if (!nameInput.value.trim()) {
                    alert("Name ist ein Pflichtfeld");
                    return;
                }

                // Workset aktualisieren
                fetch(`/api/workspace/${worksetId}/update`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: nameInput.value.trim(),
                        autostart: autostartInput.checked
                    })
                })
                .then(response => response.json())
                .then(result => {
                    if (result.success) {
                        modal.remove();
                        loadTools(); // UI neu laden
                        alert('Workset erfolgreich aktualisiert');
                    } else {
                        alert('Fehler beim Aktualisieren: ' + (result.error || 'Unbekannter Fehler'));
                    }
                })
                .catch(error => {
                    console.error('Error updating workset:', error);
                    alert('Fehler beim Aktualisieren des Worksets');
                });
            });
        })
        .catch(error => {
            console.error('Error loading workset:', error);
            alert('Fehler beim Laden des Worksets');
        });
}

// Function to set up application event handlers
function setupApplicationEventHandlers() {
  console.log("Setting up application event handlers");
  
  // Similar to tool event handlers but for applications
  // TODO: implement application-specific handlers
}

// Function to set up network path event handlers
function setupNetworkPathEventHandlers() {
  console.log("Setting up network path event handlers");
  
  // TODO: implement network path handlers
}

// Function to set up link event handlers
function setupLinkEventHandlers() {
  console.log("Setting up link event handlers");
  
  // TODO: implement link handlers
}

// Function to load applications
async function loadApplications() {
  try {
    console.log("Loading applications...");
    const response = await fetch('/api/tools');
    if (!response.ok) {
      throw new Error("Fehler beim Laden der Tools: " + response.status);
    }
    const tools = await response.json();
    
    // Helper function to determine tool type based on path
    function getToolType(tool) {
      const path = tool.path || '';
      if (tool.type) return tool.type; // If type is already set, use it
      
      // Determine type based on path patterns
      if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('ftp://')) {
        return 'link';
      }
      if (path.startsWith('\\\\') || path.startsWith('//')) {
        return 'network';
      }
      if (path.toLowerCase().endsWith('.exe') || path.toLowerCase().endsWith('.bat') || path.toLowerCase().endsWith('.cmd')) {
        return 'executable';
      }
      // Default to executable for other paths
      return 'executable';
    }
    
    const applications = tools.filter(tool => getToolType(tool) === 'executable');
    renderApplications(applications);
  } catch (error) {
    console.error("Fehler beim Laden der Anwendungen:", error);
    content.innerHTML = `
      <div class="module-header">
        <h2><i class="fas fa-desktop"></i> Anwendungen</h2>
      </div>
      <div class="error-message">
        <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
        <h3>Fehler beim Laden der Anwendungen</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
}

// Function to setup drag and drop event handlers
function setupDragAndDropEventHandlers() {
  console.log("Setting up drag and drop event handlers");
  
  // Set up draggable tools
  document.querySelectorAll('.draggable-tool').forEach(tool => {
    tool.addEventListener('dragstart', function(e) {
      const toolId = this.getAttribute('data-id');
      const toolType = this.getAttribute('data-type');
      e.dataTransfer.setData('text/plain', JSON.stringify({ toolId: toolId, toolType: toolType }));
      e.dataTransfer.effectAllowed = 'copy';
      this.classList.add('dragging');
    });
    
    tool.addEventListener('dragend', function(e) {
      this.classList.remove('dragging');
    });
  });
  
  // Set up droppable workspaces
  document.querySelectorAll('.droppable-workspace').forEach(workspace => {
    workspace.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      this.classList.add('drag-over');
    });
    
    workspace.addEventListener('dragleave', function(e) {
      this.classList.remove('drag-over');
    });
    
    workspace.addEventListener('drop', async function(e) {
      e.preventDefault();
      this.classList.remove('drag-over');
      
      try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        const workspaceId = this.getAttribute('data-id');
        
        // Import tool into workspace
        const response = await fetch('/api/workspace-import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workspace_id: workspaceId,
            tool_id: data.toolId
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          alert('Tool erfolgreich zum Workspace hinzugefügt!');
          // Reload tools to show updated state
          loadTools();
        } else {
          const error = await response.json();
          alert('Fehler beim Hinzufügen des Tools: ' + (error.error || 'Unbekannter Fehler'));
        }
      } catch (error) {
        console.error('Error importing tool to workspace:', error);
        alert('Fehler beim Hinzufügen des Tools zum Workspace');
      }
    });
  });
}

// Function to load tools (called from renderModule)
async function loadTools() {
  try {
    console.log("Loading tools...");
    const response = await fetch('/api/tools');
    if (!response.ok) {
      throw new Error("Fehler beim Laden der Tools: " + response.status);
    }
    const tools = await response.json();
    
    // Helper function to determine tool type based on path
    function getToolType(tool) {
      const path = tool.path || '';
      if (tool.type) return tool.type; // If type is already set, use it
      
      // Determine type based on path patterns
      if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('ftp://')) {
        return 'link';
      }
      if (path.startsWith('\\\\') || path.startsWith('//')) {
        return 'network';
      }
      if (path.toLowerCase().endsWith('.exe') || path.toLowerCase().endsWith('.bat') || path.toLowerCase().endsWith('.cmd')) {
        return 'executable';
      }
      // Default to executable for other paths
      return 'executable';
    }
    
    // Load workspace contents for each workspace
    const workspaces = tools.filter(tool => getToolType(tool) === 'workspace');
    const workspaceContents = {};
    
    for (const workspace of workspaces) {
      try {
        const wsResponse = await fetch(`/api/workspace/${workspace.id}/tools`);
        if (wsResponse.ok) {
          const wsTools = await wsResponse.json();
          workspaceContents[workspace.id] = wsTools;
        } else {
          console.warn(`Failed to load tools for workspace ${workspace.id}`);
          workspaceContents[workspace.id] = [];
        }
      } catch (wsError) {
        console.warn(`Error loading tools for workspace ${workspace.id}:`, wsError);
        workspaceContents[workspace.id] = [];
      }
    }
    
    renderTools(tools, workspaceContents);
  } catch (error) {
    console.error("Fehler beim Laden der Tools:", error);
    content.innerHTML = `
      <div class="module-header">
        <h2><i class="fas fa-tools"></i> Tools</h2>
      </div>
      <div class="error-message">
        <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
        <h3>Fehler beim Laden der Tools</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
}

// Function to load worksets (all tools for combined view)
async function loadWorksets() {
  try {
    console.log("Loading worksets (all tools)...");
    const response = await fetch('/api/tools');
    if (!response.ok) {
      throw new Error("Fehler beim Laden der Tools: " + response.status);
    }
    const tools = await response.json();
    
    // Helper function to determine tool type based on path
    function getToolType(tool) {
      const path = tool.path || '';
      if (tool.type) return tool.type; // If type is already set, use it
      
      // Determine type based on path patterns
      if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('ftp://')) {
        return 'link';
      }
      if (path.startsWith('\\\\') || path.startsWith('//')) {
        return 'network';
      }
      if (path.toLowerCase().endsWith('.exe') || path.toLowerCase().endsWith('.bat') || path.toLowerCase().endsWith('.cmd')) {
        return 'executable';
      }
      // Default to executable for other paths
      return 'executable';
    }
    
    // Load workspace contents for each workspace
    const workspaces = tools.filter(tool => getToolType(tool) === 'workspace');
    const workspaceContents = {};
    
    for (const workspace of workspaces) {
      try {
        const contentResponse = await fetch(`/api/workspace/${workspace.id}/tools`);
        if (contentResponse.ok) {
          workspaceContents[workspace.id] = await contentResponse.json();
        } else {
          workspaceContents[workspace.id] = [];
        }
      } catch (error) {
        console.error(`Fehler beim Laden der Tools für Workspace ${workspace.id}:`, error);
        workspaceContents[workspace.id] = [];
      }
    }
    
    renderWorksets(tools, workspaceContents);
  } catch (error) {
    console.error("Fehler beim Laden der Worksets:", error);
    content.innerHTML = `
      <div class="module-header">
        <h2><i class="fas fa-layer-group"></i> Worksets</h2>
      </div>
      <div class="error-message">
        <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
        <h3>Fehler beim Laden der Worksets</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
}

// Function to show add printer dialog
function showPrinterAddDialog() {
  console.log("Showing add printer dialog");
  
  const modal = document.getElementById('printer-modal');
  const modalTitle = document.getElementById('printer-modal-title');
  const printerForm = document.getElementById('printer-form');
  
  // Set modal title and clear form
  modalTitle.textContent = 'Drucker hinzufügen';
  printerForm.reset();
  printerForm.setAttribute('data-mode', 'add');
  printerForm.removeAttribute('data-id');
  
  // Show modal
  modal.style.display = 'block';
}

// Function to show edit printer dialog
function showPrinterEditDialog(printerId) {
  console.log("Showing edit printer dialog for printer ID:", printerId);
  
  const modal = document.getElementById('printer-modal');
  const modalTitle = document.getElementById('printer-modal-title');
  const printerForm = document.getElementById('printer-form');
  
  // Find printer by ID
  const printer = printers.find(p => p.id === printerId);
  if (!printer) {
    showNotification('Drucker nicht gefunden.', 'error');
    return;
  }
  
  // Set modal title and populate form
  modalTitle.textContent = 'Drucker bearbeiten';
  document.getElementById('printer-name').value = printer.name;
  document.getElementById('printer-ip').value = printer.ip;
  document.getElementById('printer-location').value = printer.location;
  document.getElementById('printer-model').value = printer.model;
  document.getElementById('printer-driver').value = printer.driver || '';
  document.getElementById('printer-notes').value = printer.notes || '';
  
  // Set form mode and printer ID
  printerForm.setAttribute('data-mode', 'edit');
  printerForm.setAttribute('data-id', printerId);
  
  // Show modal
  modal.style.display = 'block';
}

// Function to save printer (add or edit)
function savePrinter(event) {
  event.preventDefault();
  console.log("Saving printer");
  
  const form = event.target;
  const mode = form.getAttribute('data-mode');
  
  const printerData = {
    name: document.getElementById('printer-name').value,
    ip: document.getElementById('printer-ip').value,
    location: document.getElementById('printer-location').value,
    model: document.getElementById('printer-model').value,
    driver: document.getElementById('printer-driver').value,
    notes: document.getElementById('printer-notes').value
  };
  
  if (mode === 'add') {
    // Add new printer
    printerData.id = generateUniqueId();
    
    fetch('/api/printers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(printerData)
    })
    .then(response => response.json())
    .then(data => {
      showNotification('Drucker erfolgreich hinzugefügt.', 'success');
      document.getElementById('printer-modal').style.display = 'none';
      loadPrinters();
    })
    .catch(error => {
      console.error('Error adding printer:', error);
      showNotification('Fehler beim Hinzufügen des Druckers.', 'error');
    });
  } else if (mode === 'edit') {
    // Edit existing printer
    const printerId = form.getAttribute('data-id');
    printerData.id = printerId;
    
    fetch("/api/printers/" + printerId, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(printerData)
    })
    .then(response => response.json())
    .then(data => {
      showNotification('Drucker erfolgreich aktualisiert.', 'success');
      document.getElementById('printer-modal').style.display = 'none';
      loadPrinters();
    })
    .catch(error => {
      console.error('Error updating printer:', error);
      showNotification('Fehler beim Aktualisieren des Druckers.', 'error');
    });
  }
}

// Function to delete printer
function deletePrinter(printerId) {
  console.log("Deleting printer with ID:", printerId);
  
  if (confirm('Sind Sie sicher, dass Sie diesen Drucker löschen möchten?')) {
    fetch("/api/printers/" + printerId, {
      method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
      showNotification('Drucker erfolgreich gelöscht.', 'success');
      loadPrinters();
    })
    .catch(error => {
      console.error('Error deleting printer:', error);
      showNotification('Fehler beim Löschen des Druckers.', 'error');
    });
  }
}

// Function to open printer web interface
function openPrinter(printerId) {
  console.log("Opening printer web interface for printer ID:", printerId);
  
  const printer = printers.find(p => p.id === printerId);
  if (!printer) {
    showNotification('Drucker nicht gefunden.', 'error');
    return;
  }
  
  // Open printer web interface in new tab
  window.open("http://" + printer.ip, '_blank');
}

// Function to install printer
function installPrinter(printerId) {
  console.log("Installing printer with ID:", printerId);
  
  const printer = printers.find(p => p.id === printerId);
  if (!printer) {
    showNotification('Drucker nicht gefunden.', 'error');
    return;
  }
  
  fetch("/api/printers/" + printerId + "/install", {
    method: 'POST'
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showNotification('Drucker-Installation gestartet. Bitte folgen Sie den Anweisungen.', 'success');
    } else {
      showNotification('Fehler bei der Drucker-Installation: ' + data.message, 'error');
    }
  })
  .catch(error => {
    console.error('Error installing printer:', error);
    showNotification('Fehler bei der Drucker-Installation.', 'error');
  });
}

// Template-Initialisierung
function initializeDefaultTemplates() {
  console.log("Initializing default templates");
  
  // Alle Vorlagen laden
  let templates = JSON.parse(localStorage.getItem('ticket-templates') || '[]');
  console.log("Current templates in localStorage:", templates);
  
  // Überprüfen, ob die fest verankerte "Anwenderunterstützung" Vorlage existiert
  let anwenderTemplate = templates.find(t => t.name === 'Anwenderunterstützung');
  
  const standardAnwenderContent = `(Bei Folgenden Vorlagen Bitte TEL sowie PKZ weglassen da bereits abgefragt wird)

Nur zusätzlich benötigte Informationen im Inhalts Fenster angeben, wie z.B.:

VDI:

Nutzer anhand Namen, Geburtsdatum legitimiert und ähnliche Dinge`;

  if (anwenderTemplate) {
    // Aktualisiere den Inhalt der bestehenden Vorlage, falls sich etwas geändert hat
    console.log("Updating existing Anwenderunterstützung template");
    anwenderTemplate.content = standardAnwenderContent;
    anwenderTemplate.isSystemTemplate = true; // Markiere als System-Vorlage
    anwenderTemplate.undeletable = true; // Markiere als nicht löschbar
  } else {
    // Erstelle die Standard "Anwenderunterstützung" Vorlage, falls sie nicht existiert
    console.log("Creating default Anwenderunterstützung template");
    anwenderTemplate = {
      id: 'system-anwender-' + Date.now(),
      name: 'Anwenderunterstützung',
      content: standardAnwenderContent,
      isSystemTemplate: true,
      undeletable: true,
      created_at: new Date().toISOString()
    };
    
    // Füge die System-Vorlage am Anfang hinzu
    templates.unshift(anwenderTemplate);
  }
  
  // Falls noch weitere Standard-Vorlagen benötigt werden
  if (templates.length === 1 && templates[0].name === 'Anwenderunterstützung') {
    console.log("Adding additional default template");
    
    // Erstelle VDI-Vorlage als Beispiel (diese ist löschbar)
    const vdiTemplate = {
      id: Date.now(),
      name: 'VDI-Support',
      content: `VDI-Problem:

Beschreibung:
- 

Lösungsansatz:
- 

Status: In Bearbeitung`,
      isSystemTemplate: false,
      undeletable: false,
      created_at: new Date().toISOString()
    };
    
    templates.push(vdiTemplate);
  }
  
  // Speichere die aktualisierten Vorlagen
  localStorage.setItem('ticket-templates', JSON.stringify(templates));
  console.log("Templates initialized:", templates);
}

// Global autostart flag to prevent multiple autostart attempts
let autostartExecuted = false;

// Function to refresh all tools with intelligent restart logic
async function refreshAllTools() {
    try {
        console.log("=== REFRESHING AUTOSTART TOOLS ===");
        
        const response = await fetch('/api/tools');
        if (!response.ok) {
            console.error("Failed to fetch tools for refresh");
            showNotification("Fehler beim Laden der Tools", "error");
            return;
        }
        
        const tools = await response.json();
        console.log("All tools loaded for refresh:", tools.length);
        
        // Helper function to determine tool type based on path
        function getToolType(tool) {
          const path = tool.path || '';
          if (tool.type) return tool.type; // If type is already set, use it
          
          // Determine type based on path patterns
          if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('ftp://')) {
            return 'link';
          }
          if (path.startsWith('\\\\') || path.startsWith('//')) {
            return 'network';
          }
          if (path.toLowerCase().endsWith('.exe') || path.toLowerCase().endsWith('.bat') || path.toLowerCase().endsWith('.cmd')) {
            return 'executable';
          }
          // Default to executable for other paths
          return 'executable';
        }
        
        // Filter tools to only include those with autostart enabled
        const autostartTools = tools.filter(tool => tool.autostart === true);
        console.log(`Found ${autostartTools.length} tools with autostart enabled`);
        
        if (autostartTools.length === 0) {
            showNotification("ℹ️ Keine Tools mit aktiviertem Autostart gefunden", "info");
            return;
        }
        
        let startedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;
        
        // Process each autostart tool
        for (const tool of autostartTools) {
            try {
                const isLink = getToolType(tool) === 'link' || (tool.path && tool.path.startsWith('http'));
                const isNetworkPath = tool.path && (tool.path.startsWith('\\\\') || /^[A-Z]:\\/.test(tool.path));
                
                // Links and network paths: always restart
                if (isLink || isNetworkPath) {
                    console.log(`🔄 Restarting autostart ${isLink ? 'link' : 'network path'}: ${tool.name}`);
                    
                    const response = await fetch('/api/start-tool', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            id: tool.id,
                            use_shortcut: false
                        })
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok && result.success) {
                        startedCount++;
                        console.log(`✅ Successfully restarted: ${tool.name}`);
                    } else {
                        failedCount++;
                        console.error(`❌ Failed to restart: ${tool.name}`, result);
                    }
                } else {
                    // Applications: check if running, only start if not running
                    const isRunning = await checkIfApplicationIsRunning(tool);
                    
                    if (isRunning) {
                        skippedCount++;
                        console.log(`⏩ Skipping ${tool.name} - already running`);
                    } else {
                        console.log(`🚀 Starting autostart application: ${tool.name}`);
                        
                        const response = await fetch('/api/start-tool', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                id: tool.id,
                                use_shortcut: false
                            })
                        });
                        
                        const result = await response.json();
                        
                        if (response.ok && result.success) {
                            startedCount++;
                            console.log(`✅ Successfully started: ${tool.name}`);
                        } else {
                            failedCount++;
                            console.error(`❌ Failed to start: ${tool.name}`, result);
                        }
                    }
                }
            } catch (error) {
                failedCount++;
                console.error(`❌ Error processing ${tool.name}:`, error);
            }
        }
        
        // Show comprehensive status notification
        let message = `🔄 Autostart-Refresh abgeschlossen: `;
        const parts = [];
        
        if (startedCount > 0) parts.push(`${startedCount} gestartet`);
        if (skippedCount > 0) parts.push(`${skippedCount} übersprungen (bereits laufend)`);
        if (failedCount > 0) parts.push(`${failedCount} fehlgeschlagen`);
        
        message += parts.join(', ') || 'Keine Aktionen erforderlich';
        
        showNotification(message, failedCount > 0 ? 'warning' : 'success', true);
        console.log("=== AUTOSTART REFRESH COMPLETED ===");
        
    } catch (error) {
        console.error("Error in refresh function:", error);
        showNotification(`Fehler beim Refresh: ${error.message}`, 'error');
    }
}

// Helper function to check if an application is running (simplified approach)
async function checkIfApplicationIsRunning(tool) {
    // For now, we'll use a simple heuristic based on the executable name
    // In a full implementation, you might want to check running processes via an API
    
    try {
        const fileName = tool.path.split(/[\\\/]/).pop(); // Get filename from path
        const exeName = fileName.replace(/\.[^/.]+$/, ""); // Remove extension
        
        // Simple check - if it's a well-known system app, assume it might be running
        const commonSystemApps = ['explorer', 'notepad', 'calc', 'mspaint'];
        const isSystemApp = commonSystemApps.some(app => 
            exeName.toLowerCase().includes(app.toLowerCase())
        );
        
        // For now, return false for all apps to allow starting
        // TODO: Implement actual process checking via backend API
        return false;
        
    } catch (error) {
        console.error("Error checking if application is running:", error);
        return false; // If we can't check, assume it's not running
    }
}

// Autostart Tools Function
async function startAutostartTools() {
    // Prevent multiple autostart executions
    if (autostartExecuted) {
        console.log("Autostart already executed, skipping...");
        return;
    }
    
    autostartExecuted = true;
    
    try {
        console.log("=== STARTING AUTOSTART TOOLS ===");
        
        const response = await fetch('/api/tools');
        if (!response.ok) {
            console.error("Failed to fetch tools for autostart");
            return;
        }
        
        const tools = await response.json();
        console.log("All tools loaded for autostart check:", tools.length);
        
        const autostartTools = tools.filter(tool => tool.autostart === true);
        console.log("Found autostart tools:", autostartTools.map(t => ({id: t.id, name: t.name, autostart: t.autostart})));
        
        if (autostartTools.length === 0) {
            console.log("No autostart tools found");
            return;
        }
        
        let startedCount = 0;
        let failedCount = 0;
        
        for (const tool of autostartTools) {
            try {
                console.log(`Auto-starting tool: ${tool.name} (ID: ${tool.id})`);
                
                // Use the correct API endpoint for starting tools
                const response = await fetch('/api/start-tool', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        id: tool.id,
                        use_shortcut: false // Direct launch for autostart
                    })
                });
                
                const result = await response.json();
                console.log(`API Response for ${tool.name}:`, result);
                
                if (response.ok && result.success) {
                    startedCount++;
                    console.log(`✅ Successfully started: ${tool.name}`);
                } else {
                    failedCount++;
                    console.error(`❌ Failed to start: ${tool.name}`, result);
                }
            } catch (error) {
                failedCount++;
                console.error(`❌ Error starting ${tool.name}:`, error);
            }
        }
        
        // Show success notification with large banner
        if (startedCount > 0) {
            const message = `🚀 ${startedCount} Tool${startedCount > 1 ? 's' : ''} erfolgreich gestartet${failedCount > 0 ? ` (${failedCount} fehlgeschlagen)` : ''}`;
            showNotification(message, 'success', true);
        }
        
    } catch (error) {
        console.error("Error in autostart function:", error);
    }
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function () {
  console.log('DOM fully loaded');

  initializeDefaultTemplates();

  const lastActiveTab = localStorage.getItem('activeTab') || 'tools';
  console.log('Loading last active tab:', lastActiveTab);
  loadModule(lastActiveTab);

  setTimeout(() => startAutostartTools(), 2000);

  const tabsEl = document.getElementById('tabs');
  if (tabsEl) {
    tabsEl.addEventListener('click', function (e) {
      if (e.target && e.target.tagName === 'BUTTON') {
        const moduleName = e.target.dataset.module;
        if (moduleName) loadModule(moduleName);
      }
    });
  }
});
*/