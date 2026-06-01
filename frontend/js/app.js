// ============================================
// Main App Logic
// ============================================

let currentUser = null;
let projects = [];
let currentFilters = {};
let hideDone = false;

// ============================================
// Helpers — greeting & date formatting
// ============================================
function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Good night';
}

function getFirstName(email) {
  if (!email) return 'there';
  const local = email.split('@')[0];
  // Try to get first name from common patterns: first.last or first
  const parts = local.split(/[._-]/);
  return parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
}

function formatNavDate() {
  const d = new Date();
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

function formatDueDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  if (diff < 0 && diff > -7) return `${Math.abs(diff)} days ago`;
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

// ============================================
// Initialize App
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  const currentPage = window.location.pathname.split('/').pop();
  if (currentPage !== 'index.html' && currentPage !== '') return;
  
  try {
    // Check auth
    const client = await getClient();
    const { data: { user } } = await client.auth.getUser();
    
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    
    currentUser = user;
    
    // Display user email + navbar date
    document.getElementById('user-email').textContent = user.email;
    document.getElementById('nav-todays-date').textContent = formatNavDate();
    
    // Set greeting
    const firstName = getFirstName(user.email);
    const greeting = `${getGreeting()}, ${firstName}`;
    document.getElementById('page-greeting').textContent = greeting;
    
    // Setup logout
    document.getElementById('logout-btn').addEventListener('click', logout);
    
    // Load projects
    projects = await getProjects();
    populateProjectDropdowns();
    
    // Load tasks
    await loadTasks();
    
    // Setup filters
    setupFilters();
    
    // Setup modals
    setupTaskModal();
    setupProjectModal();
    
  } catch (error) {
    console.error('Init error:', error);
    alert('Error loading app. Please login again.');
    window.location.href = 'login.html';
  }
});

// Load and display tasks
async function loadTasks() {
  const taskList = document.getElementById('task-list');
  const emptyState = document.getElementById('empty-state');
  
  try {
    let tasks = await getTasks(currentFilters);
    
    if (tasks.length === 0) {
      taskList.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }
    
    // Check repeating task cycles — always check ALL tasks (ignore hideDone) so
    // done repeating tasks auto-reset even when hidden
    const allTasks = await getTasks({});
    await checkRepeatingTaskCycles(allTasks);
    // Reload after updates
    tasks = await getTasks(currentFilters);
    
    // Apply hide-done filter client-side
    if (hideDone) {
      tasks = tasks.filter(t => t.status !== 'done');
    } else {
      // When not hiding done, sort so done tasks float to the bottom
      const notDone = tasks.filter(t => t.status !== 'done');
      const done = tasks.filter(t => t.status === 'done');
      tasks = [...notDone, ...done];
    }
    
    if (tasks.length === 0) {
      taskList.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }
    
    emptyState.classList.add('hidden');
    taskList.innerHTML = tasks.map(task => renderTaskCard(task)).join('');
    
    // Update task count label — includes today's date
    const label = document.getElementById('task-count-label');
    if (label) {
      const today = new Date();
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const dateStr = `${months[today.getMonth()]} ${today.getDate()}`;
      const notDoneCount = tasks.filter(t => t.status !== 'done').length;
      if (notDoneCount === 0) {
        label.textContent = `All done · ${dateStr}`;
      } else {
        label.textContent = `${notDoneCount} pending · ${tasks.length} total · ${dateStr}`;
      }
    }
    
    // Setup tick handlers
    document.querySelectorAll('.task-tick').forEach(tick => {
      tick.addEventListener('change', () => toggleTaskDone(tick.dataset.id));
    });
    
    // Setup action handlers
    document.querySelectorAll('.task-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => editTask(btn.dataset.id));
    });
    
    document.querySelectorAll('.task-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteTaskConfirm(btn.dataset.id));
    });
    
    // Setup inline status editing
    document.querySelectorAll('.task-status-badge').forEach(badge => {
      badge.addEventListener('click', () => inlineEditStatus(badge));
    });
    
  } catch (error) {
    console.error('Load tasks error:', error);
  }
}

// Render task card HTML — horizontal layout:
// [TICK] | [PRIORITY DOT] [TITLE + DESCRIPTION] | [PROJECT LOGO] | [ACTIONS]
function renderTaskCard(task) {
  const project = projects.find(p => p.id === task.project_id);
  const isDone = task.status === 'done';
  const doneClass = isDone ? ' done' : '';

  // Build meta line — items separated by middot
  const metaParts = [];
  if (task.status) {
    metaParts.push(`<span class="task-meta-item"><span class="meta-label">Status:</span> <span class="meta-value${isDone ? ' meta-value-done' : ''}">${escapeHtml(task.status)}</span></span>`);
  }
  if (task.due_date) {
    const d = new Date(task.due_date + 'T00:00:00');
    const today = new Date(); today.setHours(0,0,0,0);
    const diff = Math.round((d - today) / 86400000);
    const dueClass = diff === 0 ? 'due-today' : (diff < 0 ? 'due-overdue' : '');
    metaParts.push(`<span class="task-meta-item"><span class="meta-label">Due:</span> <span class="${dueClass}">${formatDueDate(task.due_date)}</span></span>`);
  }
  // Show "Next: ..." for done repeating tasks so the user knows when the
  // current cycle will reset.
  if (isDone && task.repeat_type && task.repeat_type !== 'none' && task.next_due_date) {
    metaParts.push(`<span class="task-meta-item"><span class="meta-label">Next:</span> <span class="meta-value-done">${formatDueDate(task.next_due_date)}</span></span>`);
  }
  // Effort
  const effortLabel = (task.priority || 'medium').charAt(0).toUpperCase() + (task.priority || 'medium').slice(1);
  metaParts.push(`<span class="priority-text ${task.priority || 'medium'}">Effort: ${effortLabel}</span>`);
  // Repeat badge
  const repeatBadge = getRepeatBadge(task);
  if (repeatBadge) metaParts.push(repeatBadge);

  const metaLine = metaParts.length > 0
    ? `<div class="task-meta-line">${metaParts.join('<span class="task-meta-item"><span class="meta-sep">·</span></span>')}</div>`
    : '';

  // Priority dot
  const priorityDot = `<span class="task-priority-dot ${task.priority || 'medium'}"></span>`;

  // Project logo
  const projectLogoHtml = (project && project.image_url)
    ? `<img src="${escapeHtml(project.image_url)}" class="task-project-logo" alt="${escapeHtml(project.name)}" title="${escapeHtml(project.name)}">`
    : '';

  return `
    <div class="task-card priority-${task.priority || 'medium'}${doneClass}">
      <div class="task-tick-wrap">
        <input type="checkbox" class="task-tick" id="tick-${task.id}" data-id="${task.id}" ${isDone ? 'checked' : ''}>
      </div>
      ${priorityDot}
      <div class="task-main">
        <div class="task-title-row">
          <span class="task-title">${escapeHtml(task.title)}</span>
        </div>
        ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
        ${metaLine}
        ${renderTaskLinks(task.links) ? `<div class="task-links-row">${renderTaskLinks(task.links)}</div>` : ''}
      </div>
      ${projectLogoHtml}
      <div class="task-actions">
        <button class="task-edit-btn" data-id="${task.id}" title="Edit">✏️</button>
        <button class="task-delete-btn" data-id="${task.id}" title="Delete">🗑️</button>
      </div>
    </div>
  `;
}

// Get repeat badge HTML
function getRepeatBadge(task) {
  if (!task.repeat_type || task.repeat_type === 'none') return '';
  
  const repeatLabels = {
    'daily': '↻ Daily',
    'weekdays': '↻ Weekdays',
    'weekly': '↻ Weekly',
    'monthly': '↻ Monthly'
  };
  
  let extra = '';
  if (task.repeat_type === 'weekly' && task.repeat_days) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = task.repeat_days.map(d => dayNames[d]).join(', ');
    extra = ` (${days})`;
  } else if (task.repeat_type === 'monthly' && task.repeat_days && task.repeat_days.length > 0) {
    extra = ` (${task.repeat_days[0]}th)`;
  }
  
  return `<span class="badge badge-repeat">${repeatLabels[task.repeat_type]}${extra}</span>`;
}

// Render clickable link badges on task card
function renderTaskLinks(links) {
  if (!links || !Array.isArray(links) || links.length === 0) return '';
  return links.map(link => {
    const safeUrl = escapeHtml(link.url);
    const safeName = escapeHtml(link.name || link.url);
    return `<a href="${safeUrl}" target="_blank" rel="noopener" class="task-link" title="${safeUrl}">${safeName} ↗</a>`;
  }).join(' ');
}

// Add a single link input row to the modal
function addLinkRow(url = '', name = '') {
  const container = document.getElementById('task-links-list');
  const row = document.createElement('div');
  row.className = 'link-row';
  row.innerHTML = `
    <input type="url" class="link-url-input" placeholder="https://..." value="${escapeHtml(url)}">
    <input type="text" class="link-name-input" placeholder="Link name" value="${escapeHtml(name)}">
    <button type="button" class="link-remove-btn" title="Remove link">×</button>
  `;
  row.querySelector('.link-remove-btn').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

// Collect links from modal
function collectLinksFromModal() {
  const rows = document.querySelectorAll('.link-row');
  const links = [];
  rows.forEach(row => {
    const urlInput = row.querySelector('.link-url-input');
    const nameInput = row.querySelector('.link-name-input');
    const url = urlInput.value.trim();
    const linkName = nameInput.value.trim();
    if (url) {
      links.push({ url, name: linkName || url });
    }
  });
  return links.length > 0 ? links : null;
}

// Upload project image to Supabase Storage
async function uploadProjectImage(file, projectName) {
  const client = await getClient();
  const ext = file.name.split('.').pop();
  const path = `${projectName}_${Date.now()}.${ext}`;
  
  const { data, error } = await client.storage
    .from('project-images')
    .upload(path, file, { upsert: true });
  
  if (error) throw error;
  
  const { data: urlData } = client.storage
    .from('project-images')
    .getPublicUrl(path);
  
  return urlData.publicUrl;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Inline status edit
async function inlineEditStatus(badgeEl) {
  const taskId = badgeEl.dataset.id;
  const currentStatus = badgeEl.textContent === '+ status' ? '' : badgeEl.textContent;
  
  // Replace badge with input
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentStatus;
  input.className = 'status-inline-input';
  input.placeholder = 'Status...';
  input.maxLength = 100;
  
  badgeEl.replaceWith(input);
  input.focus();
  input.select();
  
  const save = async () => {
    const newStatus = input.value.trim() || null;
    try {
      await updateTask(taskId, { status: newStatus });
      await loadTasks();
    } catch (err) {
      console.error('Status update error:', err);
    }
  };
  
  input.addEventListener('blur', save);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { loadTasks(); }
  });
}

// ============================================
// Filters
// ============================================
function setupFilters() {
  document.getElementById('filter-project').addEventListener('change', (e) => {
    currentFilters.project = e.target.value;
    loadTasks();
  });
  
  document.getElementById('filter-priority').addEventListener('change', (e) => {
    currentFilters.priority = e.target.value;
    loadTasks();
  });
  
  document.getElementById('filter-hide-done').addEventListener('change', (e) => {
    hideDone = e.target.checked;
    loadTasks();
  });
}

// ============================================
// Task Modal
// ============================================
function setupTaskModal() {
  // Add task button
  document.getElementById('add-task-btn').addEventListener('click', () => {
    openTaskModal();
  });
  
  // Repeat type change handler
  document.getElementById('task-repeat').addEventListener('change', (e) => {
    const repeatDaysGroup = document.getElementById('repeat-days-group');
    const repeatDaysCheckboxes = document.getElementById('repeat-days-checkboxes');
    const repeatDayOfMonth = document.getElementById('repeat-day-of-month');
    const repeatDaysLabel = document.getElementById('repeat-days-label');
    
    if (e.target.value === 'weekly') {
      repeatDaysGroup.classList.remove('hidden');
      repeatDaysCheckboxes.style.display = 'flex';
      repeatDayOfMonth.style.display = 'none';
      repeatDaysLabel.textContent = 'Repeat on:';
    } else if (e.target.value === 'monthly') {
      repeatDaysGroup.classList.remove('hidden');
      repeatDaysCheckboxes.style.display = 'none';
      repeatDayOfMonth.style.display = 'block';
      repeatDaysLabel.textContent = 'Day of month:';
    } else {
      repeatDaysGroup.classList.add('hidden');
    }
  });
  
  // Form submit
  document.getElementById('task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveTask();
  });
  
  // Add link button
  document.getElementById('add-link-btn').addEventListener('click', () => addLinkRow());
}

function openTaskModal(taskId = null) {
  const modal = document.getElementById('task-modal');
  const form = document.getElementById('task-form');
  const modalTitle = document.getElementById('modal-title');
  
  form.reset();
  document.getElementById('task-id').value = '';
  document.getElementById('repeat-days-group').classList.add('hidden');
  document.getElementById('task-repeat').value = 'none';
  document.getElementById('task-links-list').innerHTML = '';
  
  populateProjectDropdowns();
  
  if (taskId) {
    modalTitle.textContent = 'Edit Task';
    loadTaskForEdit(taskId);
  } else {
    modalTitle.textContent = 'Add Task';
  }
  
  modal.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('task-modal').classList.add('hidden');
}

async function loadTaskForEdit(taskId) {
  try {
    const task = await getTask(taskId);
    
    document.getElementById('task-id').value = task.id;
    document.getElementById('task-title').value = task.title;
    document.getElementById('task-description').value = task.description || '';
    document.getElementById('task-project').value = task.project_id || '';
    document.getElementById('task-due-date').value = task.due_date || '';
    document.getElementById('task-priority').value = task.priority || 'medium';
    document.getElementById('task-status').value = task.status || '';
    
    // Load links
    document.getElementById('task-links-list').innerHTML = '';
    if (task.links && Array.isArray(task.links) && task.links.length > 0) {
      task.links.forEach(link => addLinkRow(link.url || '', link.name || ''));
    }
    
    // Load repeat fields
    const repeatType = task.repeat_type || 'none';
    document.getElementById('task-repeat').value = repeatType;
    
    if (repeatType === 'weekly' && task.repeat_days) {
      document.getElementById('repeat-days-group').classList.remove('hidden');
      document.getElementById('repeat-days-checkboxes').style.display = 'flex';
      document.getElementById('repeat-day-of-month').style.display = 'none';
      task.repeat_days.forEach(day => {
        const checkbox = document.querySelector(`.repeat-day[value="${day}"]`);
        if (checkbox) checkbox.checked = true;
      });
    } else if (repeatType === 'monthly' && task.repeat_days && task.repeat_days.length > 0) {
      document.getElementById('repeat-days-group').classList.remove('hidden');
      document.getElementById('repeat-days-checkboxes').style.display = 'none';
      document.getElementById('repeat-day-of-month').style.display = 'block';
      document.getElementById('repeat-day-of-month').value = task.repeat_days[0];
    }
  } catch (error) {
    console.error('Load task error:', error);
    alert('Error loading task');
  }
}

async function editTask(taskId) {
  openTaskModal(taskId);
}

async function saveTask() {
  const taskId = document.getElementById('task-id').value;
  const repeatType = document.getElementById('task-repeat').value;
  
  let repeatDays = null;
  if (repeatType === 'weekly') {
    repeatDays = Array.from(document.querySelectorAll('.repeat-day:checked')).map(cb => parseInt(cb.value));
  } else if (repeatType === 'monthly') {
    const dayOfMonth = parseInt(document.getElementById('repeat-day-of-month').value);
    if (dayOfMonth) repeatDays = [dayOfMonth];
  }
  
  const taskData = {
    title: document.getElementById('task-title').value,
    description: document.getElementById('task-description').value || null,
    project_id: document.getElementById('task-project').value || null,
    due_date: document.getElementById('task-due-date').value || null,
    priority: document.getElementById('task-priority').value,
    status: document.getElementById('task-status').value || null,
    repeat_type: repeatType,
    repeat_days: repeatDays,
    next_due_date: null,
    links: collectLinksFromModal()
  };
  
  try {
    if (taskId) {
      await updateTask(taskId, taskData);
    } else {
      await createTask(taskData);
    }
    
    closeModal();
    await loadTasks();
  } catch (error) {
    console.error('Save task error:', error);
    alert('Error saving task');
  }
}

// Toggle task done/undone via tick checkbox
async function toggleTaskDone(taskId) {
  try {
    const task = await getTask(taskId);
    const isCurrentlyDone = task.status === 'done';
    
    if (!isCurrentlyDone && task.repeat_type && task.repeat_type !== 'none') {
      // Repeating task: mark done and store next cycle date.
      // For weekday/weekday-like repeats, ignore due_date entirely — the repeat
      // schedule is self-contained. Use today as the base for computing next occurrence.
      // For other repeat types, keep using due_date if set (to preserve user's intent).
      const isWeekdayLike = task.repeat_type === 'weekdays';
      // Use local date string (en-CA format = YYYY-MM-DD in local timezone) instead of
      // toISOString() which converts to UTC and can be off by a day in GMT+8
      const toLocalDateString = (d) => {
        const dd = d || new Date();
        const year = dd.getFullYear();
        const month = String(dd.getMonth() + 1).padStart(2, '0');
        const day = String(dd.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      const baseDate = isWeekdayLike
        ? toLocalDateString()
        : (task.due_date || toLocalDateString());
      const nextDueDate = calculateNextDueDate(baseDate, task.repeat_type, task.repeat_days);
      await updateTask(taskId, {
        status: 'done',
        due_date: isWeekdayLike ? null : (task.due_date || baseDate),
        next_due_date: nextDueDate
      });
    } else if (!isCurrentlyDone) {
      // Simple non-repeating task: mark done
      await updateTask(taskId, { status: 'done' });
    } else {
      // Toggle back to not done
      await updateTask(taskId, { status: 'not_started', next_due_date: null });
    }
    
    await loadTasks();
  } catch (error) {
    console.error('Toggle done error:', error);
    alert('Error updating task');
  }
}

// Check if any repeating done tasks have reached their next due date
// If so, auto-reset them to not_started and advance the due date
async function checkRepeatingTaskCycles(tasks) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const updates = [];
  
  for (const task of tasks) {
    if (task.repeat_type && task.repeat_type !== 'none' &&
        task.status === 'done' && task.next_due_date) {
      // Parse next_due_date in local timezone (not UTC)
      const [ny, nm, nd] = task.next_due_date.split('-').map(Number);
      const nextDate = new Date(ny, nm - 1, nd);
      nextDate.setHours(0, 0, 0, 0);
      const nextDateValid = !isNaN(nextDate.getTime());
      // Reset when today >= next_due_date.
      // For weekday/weekday-like repeats, due_date may be null — that's fine,
      // next_due_date alone is the authoritative cycle trigger.
      const shouldReset = nextDateValid && (today >= nextDate);
      if (shouldReset) {
        // New cycle has arrived — reset task.
        // Use next_due_date as base (not due_date, which may be null for weekday tasks).
        const newDueDate = calculateNextDueDate(task.next_due_date, task.repeat_type, task.repeat_days);
        const newNextDueDate = calculateNextDueDate(newDueDate, task.repeat_type, task.repeat_days);
        updates.push(updateTask(task.id, {
          status: 'not_started',
          due_date: newDueDate,
          next_due_date: newNextDueDate
        }));
      }
    }
  }
  
  if (updates.length > 0) {
    await Promise.all(updates);
  }
}

async function deleteTaskConfirm(taskId) {
  if (!confirm('Delete this task?')) return;
  
  try {
    await deleteTask(taskId);
    await loadTasks();
  } catch (error) {
    console.error('Delete task error:', error);
    alert('Error deleting task');
  }
}

// Calculate next due date based on repeat type
function calculateNextDueDate(currentDueDate, repeatType, repeatDays) {
  // Parse date string in local timezone (not UTC)
  let date;
  if (currentDueDate) {
    const [year, month, day] = currentDueDate.split('-').map(Number);
    date = new Date(year, month - 1, day);
  } else {
    date = new Date();
  }
  date.setHours(0, 0, 0, 0);
  
  switch (repeatType) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekdays':
      do {
        date.setDate(date.getDate() + 1);
      } while (date.getDay() === 0 || date.getDay() === 6);
      break;
    case 'weekly':
      if (repeatDays && repeatDays.length > 0) {
        const currentDay = date.getDay();
        const sortedDays = [...repeatDays].sort((a, b) => a - b);
        let nextDay = sortedDays.find(d => d > currentDay);
        if (nextDay === undefined) {
          nextDay = sortedDays[0] + 7;
        }
        date.setDate(date.getDate() + (nextDay - currentDay));
      } else {
        date.setDate(date.getDate() + 7);
      }
      break;
    case 'monthly':
      if (repeatDays && repeatDays.length > 0) {
        const targetDay = repeatDays[0];
        date.setMonth(date.getMonth() + 1);
        const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        date.setDate(Math.min(targetDay, lastDayOfMonth));
      } else {
        date.setMonth(date.getMonth() + 1);
      }
      break;
  }
  
  // Return local date string (YYYY-MM-DD)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============================================
// Project Dropdowns
// ============================================
function populateProjectDropdowns() {
  const taskProject = document.getElementById('task-project');
  const filterProject = document.getElementById('filter-project');
  
  const projectOptions = projects.map(p => 
    `<option value="${p.id}">${escapeHtml(p.name)}</option>`
  ).join('');
  
  if (taskProject) {
    taskProject.innerHTML = `<option value="">No Project</option>${projectOptions}`;
  }
  if (filterProject) {
    filterProject.innerHTML = `<option value="">All Projects</option>${projectOptions}`;
  }
}

// ============================================
// Project Modal
// ============================================
let projectTaskCounts = {};

function setupProjectModal() {
  document.getElementById('manage-projects-btn').addEventListener('click', openProjectModal);
  document.getElementById('cancel-project-btn').addEventListener('click', () => resetProjectForm());
  document.getElementById('project-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveProject();
  });
  
  // Project image upload
  const imageInput = document.getElementById('project-image-input');
  const imageBtn = document.getElementById('project-image-btn');
  const imagePreview = document.getElementById('project-image-preview');
  
  imageBtn.addEventListener('click', () => imageInput.click());
  imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    window.currentProjectImageFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      imagePreview.innerHTML = `<img src="${ev.target.result}" class="project-logo-preview">`;
    };
    reader.readAsDataURL(file);
  });
}

async function openProjectModal() {
  const modal = document.getElementById('project-modal');
  modal.classList.remove('hidden');
  resetProjectForm();
  projects = await getProjects();
  populateProjectDropdowns();
  await loadProjectList();
}

function closeProjectModal() {
  document.getElementById('project-modal').classList.add('hidden');
}

function resetProjectForm() {
  document.getElementById('project-form').reset();
  document.getElementById('project-id').value = '';
  document.getElementById('project-form-title').textContent = 'Add Project';
  document.getElementById('project-color').value = '#6366f1';
  document.getElementById('project-image-preview').innerHTML = '';
  window.currentProjectImageFile = null;
}

async function loadProjectList() {
  const listEl = document.getElementById('project-list');
  
  // Get task counts per project
  projectTaskCounts = {};
  const client = await getClient();
  const { data: { user } } = await client.auth.getUser();
  const { data: tasks } = await client.from('tasks').select('project_id').eq('user_id', user.id);
  
  tasks.forEach(t => {
    if (t.project_id) {
      projectTaskCounts[t.project_id] = (projectTaskCounts[t.project_id] || 0) + 1;
    }
  });
  
  if (projects.length === 0) {
    listEl.innerHTML = '<p style="color:#888;text-align:center;padding:20px;">No projects yet. Create your first one!</p>';
    return;
  }
  
  listEl.innerHTML = projects.map(p => {
    const taskCount = projectTaskCounts[p.id] || 0;
    const logoHtml = p.image_url
      ? `<img src="${escapeHtml(p.image_url)}" class="project-logo-img" alt="${escapeHtml(p.name)}">`
      : `<div class="project-color-dot" style="background:${p.color}"></div>`;
    return `
      <div class="project-item" data-id="${p.id}">
        <div class="project-info">
          ${logoHtml}
          <div class="project-details">
            <div class="project-name">${escapeHtml(p.name)}</div>
            <div class="project-stats">${taskCount} task${taskCount !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div class="project-actions">
          <button class="btn btn-small" onclick="editProject('${p.id}')">Edit</button>
          <button class="btn btn-small btn-danger" onclick="deleteProjectConfirm('${p.id}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

async function editProject(projectId) {
  const project = projects.find(p => p.id === projectId);
  if (!project) return;
  
  document.getElementById('project-id').value = project.id;
  document.getElementById('project-name').value = project.name;
  document.getElementById('project-color').value = project.color;
  document.getElementById('project-form-title').textContent = 'Edit Project';
  window.currentProjectImageFile = null;
  
  if (project.image_url) {
    document.getElementById('project-image-preview').innerHTML =
      `<img src="${escapeHtml(project.image_url)}" class="project-logo-preview">`;
  } else {
    document.getElementById('project-image-preview').innerHTML = '';
  }
}

async function saveProject() {
  const projectId = document.getElementById('project-id').value;
  const projectData = {
    name: document.getElementById('project-name').value,
    color: document.getElementById('project-color').value
  };
  
  // Upload image if selected
  if (window.currentProjectImageFile) {
    try {
      const imageUrl = await uploadProjectImage(window.currentProjectImageFile, projectId || projects.length.toString());
      projectData.image_url = imageUrl;
    } catch (err) {
      console.error('Image upload error:', err);
    }
  }
  
  try {
    if (projectId) {
      await updateProject(projectId, projectData);
    } else {
      await createProject(projectData);
    }
    
    projects = await getProjects();
    populateProjectDropdowns();
    await loadProjectList();
    resetProjectForm();
  } catch (error) {
    console.error('Save project error:', error);
    alert('Error saving project');
  }
}

async function deleteProjectConfirm(projectId) {
  const project = projects.find(p => p.id === projectId);
  if (!project) return;
  
  const taskCount = projectTaskCounts[projectId] || 0;
  const msg = taskCount > 0
    ? `Delete "${project.name}"? It has ${taskCount} task${taskCount !== 1 ? 's' : ''}. Tasks will NOT be deleted, just unlinked.`
    : `Delete "${project.name}"?`;
  
  if (!confirm(msg)) return;
  
  try {
    await deleteProject(projectId);
    projects = await getProjects();
    populateProjectDropdowns();
    await loadProjectList();
  } catch (error) {
    console.error('Delete project error:', error);
    alert('Error deleting project');
  }
}
