// ============================================
// Main App Logic
// ============================================

let currentUser = null;
let projects = [];
let currentFilters = {};

// Initialize app
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
    
    // Display user email
    document.getElementById('user-email').textContent = user.email;
    
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
    const tasks = await getTasks(currentFilters);
    
    if (tasks.length === 0) {
      taskList.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }
    
    emptyState.classList.add('hidden');
    taskList.innerHTML = tasks.map(task => renderTaskCard(task)).join('');
    
    // Setup action handlers
    document.querySelectorAll('.task-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => editTask(btn.dataset.id));
    });
    
    document.querySelectorAll('.task-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteTaskConfirm(btn.dataset.id));
    });
    
    document.querySelectorAll('.task-complete-btn').forEach(btn => {
      btn.addEventListener('click', () => completeTask(btn.dataset.id));
    });
    
  } catch (error) {
    console.error('Load tasks error:', error);
  }
}

// Render task card HTML
function renderTaskCard(task) {
  const project = projects.find(p => p.id === task.project_id);
  const dueDateClass = isOverdue(task.due_date) ? 'overdue' : (isToday(task.due_date) ? 'today' : '');
  const repeatBadge = getRepeatBadge(task);
  
  return `
    <div class="task-card priority-${task.priority}${task.status === 'done' ? ' done' : ''}">
      <div class="task-main">
        <div class="task-title">${escapeHtml(task.title)}</div>
        ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
        <div class="task-meta">
          ${project ? `<span class="badge badge-project" style="border-left: 3px solid ${project.color}">${escapeHtml(project.name)}</span>` : ''}
          ${task.due_date ? `<span class="task-due ${dueDateClass}">📅 ${formatDate(task.due_date)}</span>` : ''}
          <span class="badge badge-priority-${task.priority}">${task.priority}</span>
          <span class="badge badge-status">${escapeHtml(getStatusDisplay(task))}</span>
          ${repeatBadge}
        </div>
      </div>
      <div class="task-actions">
        ${task.status !== 'done' ? `<button class="task-complete-btn" data-id="${task.id}" title="Complete">✓</button>` : ''}
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
    'daily': '🔁 Daily',
    'weekdays': '🔁 Weekdays',
    'weekly': '🔁 Weekly',
    'monthly': '🔁 Monthly'
  };
  
  let extra = '';
  if (task.repeat_type === 'weekly' && task.repeat_days) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = task.repeat_days.map(d => dayNames[d]).join(', ');
    extra = ` (${days})`;
  } else if (task.repeat_type === 'monthly' && task.repeat_days && task.repeat_days.length > 0) {
    extra = ` (${task.repeat_days[0]}th)`;
  }
  
  return `<span class="badge" style="background:rgba(99,102,241,0.2);color:#a0a0c0;">${repeatLabels[task.repeat_type]}${extra}</span>`;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// Filters
// ============================================
function setupFilters() {
  document.getElementById('filter-project').addEventListener('change', (e) => {
    currentFilters.project = e.target.value;
    loadTasks();
  });
  
  document.getElementById('filter-status').addEventListener('change', (e) => {
    currentFilters.status = e.target.value;
    loadTasks();
  });
  
  document.getElementById('filter-priority').addEventListener('change', (e) => {
    currentFilters.priority = e.target.value;
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
  
  // Status change handler for custom status
  document.getElementById('task-status').addEventListener('change', (e) => {
    const customGroup = document.getElementById('custom-status-group');
    if (e.target.value === 'custom') {
      customGroup.classList.remove('hidden');
    } else {
      customGroup.classList.add('hidden');
    }
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
}

function openTaskModal(taskId = null) {
  const modal = document.getElementById('task-modal');
  const form = document.getElementById('task-form');
  const modalTitle = document.getElementById('modal-title');
  
  form.reset();
  document.getElementById('task-id').value = '';
  document.getElementById('custom-status-group').classList.add('hidden');
  document.getElementById('repeat-days-group').classList.add('hidden');
  document.getElementById('task-repeat').value = 'none';
  
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
    document.getElementById('task-status').value = task.status;
    
    if (task.status === 'custom') {
      document.getElementById('custom-status-group').classList.remove('hidden');
      document.getElementById('task-custom-status').value = task.custom_status || '';
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
  const status = document.getElementById('task-status').value;
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
    status: status,
    custom_status: status === 'custom' ? document.getElementById('task-custom-status').value : null,
    repeat_type: repeatType,
    repeat_days: repeatDays
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

// Complete task and create next repeat if needed
async function completeTask(taskId) {
  try {
    const task = await getTask(taskId);
    
    if (task.repeat_type && task.repeat_type !== 'none') {
      // Create next repeat task
      const nextDueDate = calculateNextDueDate(task.due_date, task.repeat_type, task.repeat_days);
      
      await updateTask(taskId, {
        status: 'done',
        due_date: task.due_date // Keep original due date
      });
      
      // Create new task with next due date
      await createTask({
        title: task.title,
        description: task.description,
        project_id: task.project_id,
        due_date: nextDueDate,
        priority: task.priority,
        status: 'not_started',
        repeat_type: task.repeat_type,
        repeat_days: task.repeat_days
      });
    } else {
      // Simple completion
      await updateTask(taskId, { status: 'done' });
    }
    
    // Auto-show Done filter for non-repeating tasks
    if (!task.repeat_type || task.repeat_type === 'none') {
      document.getElementById('filter-status').value = 'done';
      currentFilters.status = 'done';
    }
    
    await loadTasks();
  } catch (error) {
    console.error('Complete task error:', error);
    alert('Error completing task');
  }
}

// Calculate next due date based on repeat type
function calculateNextDueDate(currentDueDate, repeatType, repeatDays) {
  const date = currentDueDate ? new Date(currentDueDate) : new Date();
  date.setHours(0, 0, 0, 0);
  
  switch (repeatType) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekdays':
      do {
        date.setDate(date.getDate() + 1);
      } while (date.getDay() === 0 || date.getDay() === 6); // Skip weekends
      break;
    case 'weekly':
      if (repeatDays && repeatDays.length > 0) {
        // Find next day in the week that matches
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
        // Handle months with fewer days
        const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        date.setDate(Math.min(targetDay, lastDayOfMonth));
      } else {
        date.setMonth(date.getMonth() + 1);
      }
      break;
  }
  
  return date.toISOString().split('T')[0];
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
}

async function loadProjectList() {
  const listEl = document.getElementById('project-list');
  
  // Reload projects from DB
  projects = await getProjects();
  
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
    return `
      <div class="project-item" data-id="${p.id}">
        <div class="project-info">
          <div class="project-color-dot" style="background:${p.color}"></div>
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
}

async function saveProject() {
  const projectId = document.getElementById('project-id').value;
  const projectData = {
    name: document.getElementById('project-name').value,
    color: document.getElementById('project-color').value
  };
  
  try {
    if (projectId) {
      await updateProject(projectId, projectData);
    } else {
      await createProject(projectData);
    }
    
    // Reload projects and dropdowns
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
