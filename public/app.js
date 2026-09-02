let configData = null;
let savedPassword = null;

// Initialize on load
document.addEventListener("DOMContentLoaded", () => {
    savedPassword = sessionStorage.getItem("adminPassword");
    if (savedPassword) {
        loadConfig();
    }
});

function toggleCalSuboptions(checkboxId, optionsId) {
    const isChecked = document.getElementById(checkboxId).checked;
    const optionsDiv = document.getElementById(optionsId);
    if (isChecked) {
        optionsDiv.classList.add("active");
    } else {
        optionsDiv.classList.remove("active");
    }
}

async function login() {
    const pwdInput = document.getElementById("password-input").value;
    if (!pwdInput) return;

    savedPassword = pwdInput;
    const success = await loadConfig();

    if (success) {
        sessionStorage.setItem("adminPassword", savedPassword);
        document.getElementById("login-error").innerText = "";
    } else {
        document.getElementById("login-error").innerText = "Incorrect password.";
        savedPassword = null;
        sessionStorage.removeItem("adminPassword");
    }
}

function logout() {
    savedPassword = null;
    sessionStorage.removeItem("adminPassword");
    configData = null;
    document.getElementById("password-input").value = "";

    document.getElementById("dashboard-container").classList.remove("active");
    document.getElementById("login-container").classList.add("active");
}

async function loadConfig() {
    try {
        const res = await fetch("/api/config", {
            headers: { "x-admin-password": savedPassword }
        });

        if (res.status === 401) {
            if (document.getElementById("dashboard-container").classList.contains("active")) {
                logout(); // Token expired or changed
            }
            return false;
        }

        if (!res.ok) throw new Error("Failed to fetch config");

        const data = await res.json();
        configData = data;
        populateForm(data.reminders);

        document.getElementById("login-container").classList.remove("active");
        document.getElementById("dashboard-container").classList.add("active");
        return true;

    } catch (err) {
        console.error(err);
        return false;
    }
}

function populateForm(reminders) {
    const container = document.getElementById("reminders-container");
    container.innerHTML = ""; // Clear existing
    reminders.forEach((r, index) => {
        container.appendChild(createReminderCard(r, index));
    });
}

function createReminderCard(r, index) {
    const div = document.createElement("div");
    div.className = "card reminder-card";
    div.dataset.index = index;

    const time = r.time || "09:00";
    const msg = r.message || "";
    const medChecked = r.includeMedicineReminder !== false ? "checked" : "";
    const weatherChecked = r.includeWeather === true ? "checked" : "";
    const calChecked = r.includeCalendarReminder === true ? "checked" : "";
    const calDays = r.includeCalendarReminderDays || 4;
    const pastChecked = r.excludePastCalendarEvents !== false ? "checked" : "";
    const todayChecked = r.excludeTodayCalendarEvents === true ? "checked" : "";

    const calActive = r.includeCalendarReminder === true ? "active" : "";

    // Days of week logic
    const daysArr = r.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]; // Default to all days if undefined
    const daysLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let daysHtml = '<div class="days-container">';
    for (let d = 0; d < 7; d++) {
        const checked = daysArr.includes(d) ? "checked" : "";
        daysHtml += `
            <label class="day-checkbox">
                <input type="checkbox" class="r-day" value="${d}" ${checked}>
                <span>${daysLabels[d]}</span>
            </label>
        `;
    }
    daysHtml += '</div>';

    div.innerHTML = `
      <div class="card-header">
        <h2>🗓️ Routine ${index + 1}</h2>
        <div class="header-right" style="display: flex; gap: 8px; align-items: center;">
          <div class="time-picker">
            <input type="time" class="r-time" required>
          </div>
          <button type="button" class="logout-btn" style="color: var(--danger); border-color: var(--danger);" onclick="removeReminder(${index})">Delete</button>
        </div>
      </div>

      <div class="form-group">
        <label>Active Days</label>
        ${daysHtml}
      </div>
      
      <div class="form-group">
        <label>Message Text</label>
        <textarea class="r-msg" rows="3" required></textarea>
      </div>

      <div class="switches">
        <label class="switch-row">
          <span class="switch-label">Send Reminder</span>
          <label class="switch">
            <input type="checkbox" class="r-med" ${medChecked}>
            <span class="slider round"></span>
          </label>
        </label>

        <label class="switch-row">
          <span class="switch-label">Attach Daily Weather</span>
          <label class="switch">
            <input type="checkbox" class="r-weather" ${weatherChecked}>
            <span class="slider round"></span>
          </label>
        </label>

        <label class="switch-row">
          <span class="switch-label">Attach Calendar Events</span>
          <label class="switch">
            <input type="checkbox" class="r-cal" id="cal-${index}" onchange="toggleCalSuboptions('cal-${index}', 'cal-opt-${index}')" ${calChecked}>
            <span class="slider round"></span>
          </label>
        </label>
      </div>

      <div id="cal-opt-${index}" class="sub-options ${calActive}">
        <div class="form-group row">
          <label>Days to fetch:</label>
          <input type="number" class="r-cal-days" min="1" max="14" value="${calDays}">
        </div>
        <label class="checkbox-label">
          <input type="checkbox" class="r-cal-ex-past" ${pastChecked}> Exclude past events
        </label>
        <label class="checkbox-label">
          <input type="checkbox" class="r-cal-ex-today" ${todayChecked}> Exclude all today's events
        </label>
      </div>
    `;
    div.querySelector(".r-time").value = time;
    div.querySelector(".r-msg").value = msg;
    return div;
}

function addReminder() {
    if (!configData) return;
    configData.reminders.push({
        time: "12:00",
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        message: "請輸入新提醒內容...",
        includeMedicineReminder: true,
        includeWeather: false,
        includeCalendarReminder: false,
        includeCalendarReminderDays: 4,
        excludePastCalendarEvents: true,
        excludeTodayCalendarEvents: false
    });
    populateForm(configData.reminders);
}

function removeReminder(index) {
    if (!configData) return;
    if (configData.reminders.length <= 1) {
        alert("You must have at least one routine.");
        return;
    }
    const confirmDelete = confirm("Are you sure you want to delete this routine?");
    if (confirmDelete) {
        configData.reminders.splice(index, 1);
        populateForm(configData.reminders);
    }
}

async function saveConfig(event) {
    event.preventDefault();
    const btn = document.getElementById("save-btn");
    const statusLabel = document.getElementById("save-status");

    btn.innerText = "Saving...";
    btn.disabled = true;

    const cards = document.querySelectorAll(".reminder-card");
    const newReminders = [];

    cards.forEach((card) => {
        // Extract selected days
        const dayCheckboxes = card.querySelectorAll(".r-day");
        const daysOfWeek = [];
        dayCheckboxes.forEach(cb => {
            if (cb.checked) {
                daysOfWeek.push(parseInt(cb.value, 10));
            }
        });

        newReminders.push({
            time: card.querySelector(".r-time").value,
            daysOfWeek: daysOfWeek,
            message: card.querySelector(".r-msg").value,
            includeMedicineReminder: card.querySelector(".r-med").checked,
            includeWeather: card.querySelector(".r-weather").checked,
            includeCalendarReminder: card.querySelector(".r-cal").checked,
            includeCalendarReminderDays: parseInt(card.querySelector(".r-cal-days").value),
            excludePastCalendarEvents: card.querySelector(".r-cal-ex-past").checked,
            excludeTodayCalendarEvents: document.querySelector(".r-cal-ex-today") ? card.querySelector(".r-cal-ex-today").checked : false
        });
    });

    const payload = { reminders: newReminders };

    try {
        const res = await fetch("/api/config", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-admin-password": savedPassword
            },
            body: JSON.stringify(payload)
        });

        if (res.status === 401) {
            logout();
            return;
        }

        if (!res.ok) throw new Error("Save failed");

        configData.reminders = newReminders;

        statusLabel.innerText = "✅ Saved Successfully!";
        setTimeout(() => { statusLabel.innerText = ""; }, 3000);

    } catch (err) {
        console.error(err);
        alert("Failed to save configuration.");
    } finally {
        btn.innerText = "Save Changes";
        btn.disabled = false;
    }
}

// ==========================================
// BP Logger Logic
// ==========================================
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    event.currentTarget.classList.add('active');
    document.getElementById('tab-' + tabId).classList.add('active');

    if (tabId === 'bp-logs') {
        // En-CA generates YYYY-MM-DD format perfectly
        const taipeiDate = new Date().toLocaleString("en-CA", { timeZone: "Asia/Taipei" }).split(',')[0].trim();
        document.getElementById('bp-date').value = taipeiDate;
        loadBpLogs();
    }

    if (tabId === 'oneoff') {
        // Pre-fill datetime-local with current Taipei time (rounded to next hour)
        const now = new Date();
        const taipeiStr = now.toLocaleString("en-CA", {
            timeZone: "Asia/Taipei",
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit", hour12: false
        }).replace(", ", "T");
        document.getElementById('oneoff-datetime').value = taipeiStr;
        loadOneOffReminders();
    }
}

async function loadBpLogs() {
    try {
        const res = await fetch("/api/bp", {
            headers: { "x-admin-password": savedPassword }
        });
        if (!res.ok) throw new Error("Failed to fetch BP logs");
        const data = await res.json();
        renderBpTable(data.logs);
    } catch (err) {
        console.error("Error loading BP logs:", err);
    }
}

function renderBpTable(logs) {
    const tbody = document.getElementById("bp-table-body");
    tbody.innerHTML = "";
    if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:gray">No logs found</td></tr>`;
        return;
    }
    
    logs.forEach(log => {
        const tr = document.createElement("tr");
        
        const dateTd = document.createElement("td");
        dateTd.innerText = log.date;
        
        const sysDiaTd = document.createElement("td");
        const sysDisplay = log.sys == null ? "-" : String(log.sys);
        const diaDisplay = log.dia == null ? "-" : String(log.dia);
        sysDiaTd.innerText = `${sysDisplay} / ${diaDisplay}`;
        
        // Emphasize abnormal readings based on prompt threshold (> 130 Sys)
        if (log.sys >= 130 || log.dia >= 85) {
            sysDiaTd.style.color = "var(--danger)";
            sysDiaTd.style.fontWeight = "bold";
        } else {
            sysDiaTd.style.color = "var(--primary)";
        }
        
        const hrTd = document.createElement("td");
        hrTd.innerText = log.hr || "-";
        
        const weightTd = document.createElement("td");
        weightTd.innerText = log.weight || "-";
        
        const actionTd = document.createElement("td");
        const delBtn = document.createElement("button");
        delBtn.innerText = "Delete";
        delBtn.className = "delete-btn";
        delBtn.onclick = () => deleteBpLog(log.id);
        actionTd.appendChild(delBtn);
        
        tr.appendChild(dateTd);
        tr.appendChild(sysDiaTd);
        tr.appendChild(hrTd);
        tr.appendChild(weightTd);
        tr.appendChild(actionTd);
        
        tbody.appendChild(tr);
    });
}

async function submitBpLog(e) {
    e.preventDefault();
    const btn = document.querySelector("#bp-form .save-btn");
    btn.innerText = "Saving...";
    btn.disabled = true;

    const date = document.getElementById("bp-date").value;
    const sys = document.getElementById("bp-sys").value;
    const dia = document.getElementById("bp-dia").value;
    const hr = document.getElementById("bp-hr").value;
    const weight = document.getElementById("bp-weight").value;
    
    try {
        const res = await fetch("/api/bp", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-admin-password": savedPassword
            },
            body: JSON.stringify({ date, sys, dia, hr, weight })
        });
        if (!res.ok) throw new Error("Failed to save BP log");
        
        // Reset everything except date
        document.getElementById("bp-sys").value = "";
        document.getElementById("bp-dia").value = "";
        document.getElementById("bp-hr").value = "";
        document.getElementById("bp-weight").value = "";
        
        loadBpLogs();
    } catch (err) {
        console.error(err);
        alert("Failed to save log");
    } finally {
        btn.innerText = "Save BP Log";
        btn.disabled = false;
    }
}

async function deleteBpLog(id) {
    if (!confirm("Are you sure you want to delete this log?")) return;
    try {
        const res = await fetch(`/api/bp/${id}`, {
            method: "DELETE",
            headers: { "x-admin-password": savedPassword }
        });
        if (!res.ok) throw new Error("Failed to delete log");
        loadBpLogs();
    } catch (err) {
        console.error(err);
        alert("Failed to delete log");
    }
}

// ==========================================
// One-Off Reminders Logic
// ==========================================
async function loadOneOffReminders() {
    try {
        const res = await fetch("/api/oneoff", {
            headers: { "x-admin-password": savedPassword }
        });
        if (!res.ok) throw new Error("Failed to fetch one-off reminders");
        const data = await res.json();
        renderOneOffList(data.reminders);
    } catch (err) {
        console.error("Error loading one-off reminders:", err);
    }
}

function renderOneOffList(reminders) {
    const container = document.getElementById("oneoff-list");
    
    if (!reminders || reminders.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 24px 0;">No upcoming one-off reminders</p>`;
        return;
    }

    container.innerHTML = "";
    reminders.forEach(r => {
        const item = document.createElement("div");
        item.className = "oneoff-item";

        // Format the datetime nicely
        const dt = new Date(r.datetime);
        const dateStr = dt.toLocaleDateString("en-US", { 
            timeZone: "Asia/Taipei", 
            weekday: "short", month: "short", day: "numeric", year: "numeric" 
        });
        const timeStr = dt.toLocaleTimeString("en-US", { 
            timeZone: "Asia/Taipei", 
            hour: "2-digit", minute: "2-digit" 
        });

        // Calculate relative time
        const now = new Date();
        const diffMs = dt - now;
        let relativeStr = "";
        if (diffMs <= 0) {
            relativeStr = "⏳ Sending soon...";
        } else {
            const diffMins = Math.floor(diffMs / 60000);
            if (diffMins < 60) {
                relativeStr = `in ${diffMins} min`;
            } else if (diffMins < 1440) {
                const hrs = Math.floor(diffMins / 60);
                relativeStr = `in ${hrs} hour${hrs > 1 ? "s" : ""}`;
            } else {
                const days = Math.floor(diffMins / 1440);
                relativeStr = `in ${days} day${days > 1 ? "s" : ""}`;
            }
        }

        const content = document.createElement("div");
        content.className = "oneoff-item-content";
        const timeRow = document.createElement("div");
        timeRow.className = "oneoff-item-time";
        const dateLabel = document.createElement("span");
        dateLabel.className = "oneoff-date";
        dateLabel.textContent = `📅 ${dateStr} ${timeStr}`;
        const relativeLabel = document.createElement("span");
        relativeLabel.className = "oneoff-relative";
        relativeLabel.textContent = relativeStr;
        const messageLabel = document.createElement("div");
        messageLabel.className = "oneoff-item-msg";
        messageLabel.textContent = r.message;
        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-btn";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => deleteOneOffReminder(r.id));

        timeRow.append(dateLabel, relativeLabel);
        content.append(timeRow, messageLabel);
        item.append(content, deleteButton);

        container.appendChild(item);
    });
}

async function submitOneOffReminder(e) {
    e.preventDefault();
    const btn = document.getElementById("oneoff-submit-btn");
    btn.innerText = "Adding...";
    btn.disabled = true;

    const datetime = document.getElementById("oneoff-datetime").value;
    const message = document.getElementById("oneoff-message").value;

    // Validate that the time is in the future
    if (new Date(datetime) <= new Date()) {
        alert("Please select a future date and time.");
        btn.innerText = "Add Reminder";
        btn.disabled = false;
        return;
    }

    try {
        const res = await fetch("/api/oneoff", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-admin-password": savedPassword
            },
            body: JSON.stringify({ datetime, message })
        });
        if (res.status === 401) { logout(); return; }
        if (!res.ok) throw new Error("Failed to save one-off reminder");

        // Clear form and reload list
        document.getElementById("oneoff-message").value = "";
        loadOneOffReminders();
    } catch (err) {
        console.error(err);
        alert("Failed to save reminder.");
    } finally {
        btn.innerText = "Add Reminder";
        btn.disabled = false;
    }
}

async function deleteOneOffReminder(id) {
    if (!confirm("Are you sure you want to delete this reminder?")) return;
    try {
        const res = await fetch(`/api/oneoff/${id}`, {
            method: "DELETE",
            headers: { "x-admin-password": savedPassword }
        });
        if (!res.ok) throw new Error("Failed to delete reminder");
        loadOneOffReminders();
    } catch (err) {
        console.error(err);
        alert("Failed to delete reminder");
    }
}