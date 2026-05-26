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
    
  } catch (error) {
    console.error('Load tasks error:', error);
  }
}

// Render task card HTML
function renderTaskCard(task) {
  const project = projects.find(p => p.id === task.project_id);
  const dueDateClass = isOverdue(task.due_date) ? 'overdue' : (isToday(task.due_date) ? 'today' : '');
  
  return `
    <div class="task-card priority-${task.priority}">
      <div class="task-main">
        <div class="task-title">${escapeHtml(task.title)}</div>
        ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
        <div class="task-meta">
          ${project ? `<span class="badge badge-project" style="border-left: 3px solid ${project.color}">${escapeHtml(project.name)}</span>` : ''}
          ${task.due_date ? `<span class="task-due ${dueDateClass}">📅 ${formatDate(task.due_date)}</span>` : ''}
          <span class="badge badge-priority-${task.priority}">${task.priority}</span>
          <span class="badge badge-status">${escapeHtml(getStatusDisplay(task))}</span>
        </div>
      </div>
      <div class="task-actions">
        <button class="task-edit-btn" data-id="${task.id}" title="Edit">✏️</button>
        <button class="task-delete-btn" data-id="${task.id}" title="Delete">🗑️</button>
      </div>
    </div>
  `;
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
  
  const taskData = {
    title: document.getElementById('task-title').value,
    description: document.getElementById('task-description').value || null,
    project_id: document.getElementById('task-project').value || null,
    due_date: document.getElementById('task-due-date').value || null,
    priority: document.getElementById('task-priority').value,
    status: status,
    custom_status: status === 'custom' ? document.getElementById('task-custom-status').value : null
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
// Project Modal (simplified - add from task modal)
// ============================================
function setupProjectModal() {
  // For now, projects are created inline
  // You can extend this if needed
}

// Close project modal
function closeProjectModal() {
  document.getElementById('project-modal').classList.add('hidden');
}
