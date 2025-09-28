// calendar.js - Kalender-Frontend für HelpTool


// Modal für Event-Erstellung anzeigen
function showCalendarEventModal(date) {
    const modal = document.getElementById('calendar-event-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.getElementById('event-title').value = '';
    document.getElementById('event-contact').value = '';
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
document.addEventListener('DOMContentLoaded', function() {
    const calendarEl = document.getElementById('fc-calendar');
    if (!calendarEl) return;

    // Events laden und Kalender initialisieren
    fetch('/api/termine')
        .then(response => response.json())
        .then(events => {
            // Platzhalter entfernen
            const placeholder = document.getElementById('calendar-placeholder');
            if (placeholder) placeholder.remove();

            // FullCalendar initialisieren
            const calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
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
            console.log('Kalender erfolgreich gerendert');
        })
        .catch(error => {
            console.error('Fehler beim Laden der Termine:', error);
            calendarEl.innerHTML = '<div style="color:red; text-align:center; padding:20px;">Fehler beim Laden der Termine</div>';
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
});
