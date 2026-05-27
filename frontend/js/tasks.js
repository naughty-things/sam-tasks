// ============================================
// Task Functions
// ============================================

const TASKS_PER_PAGE = 50;

// Get all tasks for current user
async function getTasks(filters = {}) {
  const client = await getClient();
  const { data: { user } } = await client.auth.getUser();
  
  let query = client.from('tasks').select('*').eq('user_id', user.id);
  
  if (filters.project) {
    query = query.eq('project_id', filters.project);
  }
  if (filters.status) {
    if (filters.status === 'custom') {
      query = query.not('status', 'in', '(not_started,in_progress,waiting,done)');
    } else {
      query = query.eq('status', filters.status);
    }
  }
  if (filters.priority) {
    query = query.eq('priority', filters.priority);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false }).limit(TASKS_PER_PAGE);
  
  if (error) throw error;
  return data || [];
}

// Create task
async function createTask(taskData) {
  const client = await getClient();
  const { data: { user } } = await client.auth.getUser();
  
  const { data, error } = await client.from('tasks').insert({
    ...taskData,
    user_id: user.id
  }).select();
  
  if (error) throw error;
  return data[0];
}

// Update task
async function updateTask(taskId, taskData) {
  const client = await getClient();
  
  const { data, error } = await client
    .from('tasks')
    .update(taskData)
    .eq('id', taskId)
    .select();
  
  if (error) throw error;
  return data[0];
}

// Delete task
async function deleteTask(taskId) {
  const client = await getClient();
  
  const { error } = await client.from('tasks').delete().eq('id', taskId);
  
  if (error) throw error;
}

// Get task by ID
async function getTask(taskId) {
  const client = await getClient();
  
  const { data, error } = await client.from('tasks').select('*').eq('id', taskId).single();
  
  if (error) throw error;
  return data;
}

// ============================================
// Project Functions
// ============================================

// Get all projects
async function getProjects() {
  const client = await getClient();
  const { data: { user } } = await client.auth.getUser();
  
  const { data, error } = await client
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('name');
  
  if (error) throw error;
  return data || [];
}

// Create project
async function createProject(projectData) {
  const client = await getClient();
  const { data: { user } } = await client.auth.getUser();
  
  const { data, error } = await client.from('projects').insert({
    ...projectData,
    user_id: user.id
  }).select();
  
  if (error) throw error;
  return data[0];
}

// Update project
async function updateProject(projectId, projectData) {
  const client = await getClient();
  
  const { data, error } = await client
    .from('projects')
    .update(projectData)
    .eq('id', projectId)
    .select();
  
  if (error) throw error;
  return data[0];
}

// Delete project
async function deleteProject(projectId) {
  const client = await getClient();
  
  const { error } = await client.from('projects').delete().eq('id', projectId);
  
  if (error) throw error;
}

// ============================================
// Helper Functions
// ============================================

// Format date for display
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const taskDate = new Date(dateStr);
  taskDate.setHours(0, 0, 0, 0);
  
  if (taskDate.getTime() === today.getTime()) return 'Today';
  if (taskDate.getTime() === tomorrow.getTime()) return 'Tomorrow';
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Check if date is overdue
function isOverdue(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(dateStr);
  return dueDate < today;
}

// Check if date is today
function isToday(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(dateStr);
  return dueDate.getTime() === today.getTime();
}

// Get status display text
function getStatusDisplay(task) {
  if (task.status === 'custom' && task.custom_status) {
    return task.custom_status;
  }
  
  const statusMap = {
    'not_started': 'Not Started',
    'in_progress': 'In Progress',
    'waiting': 'Waiting',
    'done': 'Done'
  };
  
  return statusMap[task.status] || task.status;
}
