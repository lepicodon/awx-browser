// State
let allHosts = [];
let filteredHosts = [];
let currentOrgId = null;
let currentInventories = [];
let currentInventoryId = null;
let currentGroupId = null;

// Pagination State
let currentPage = 1;
let rowsPerPage = 25;

// Sort state
let currentSort = {
    col: 'name',
    asc: true
};

// Auth Check & Init
document.addEventListener('DOMContentLoaded', () => {
    // Only run dashboard logic on dashboard page
    const dashboardElement = document.getElementById('orgSelect');
    if (!dashboardElement) return;

    checkSession();
    loadOrganizations();
    setupEventListeners();

    // Theme Init
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-bs-theme', savedTheme);
    if (savedTheme === 'light') document.body.classList.add('light-mode');
    if (document.getElementById('themeIcon')) updateThemeIcon();
});

function setupEventListeners() {
    document.getElementById('orgSelect').addEventListener('change', (e) => {
        loadInventories(e.target.value);
    });

    document.getElementById('invSelect').addEventListener('change', (e) => {
        currentInventoryId = e.target.value;
        currentGroupId = null;
        loadGroups(currentInventoryId);
        loadHosts(currentInventoryId);
    });

    // Search filter
    document.getElementById('hostSearch').addEventListener('input', (e) => {
        filterHosts(e.target.value);
    });

    // Theme icon
    updateThemeIcon();
}

async function checkSession() {
    const resp = await fetch('/api/organizations');
    if (resp.status === 401) {
        window.location.href = '/';
    }
}

async function loadOrganizations() {
    const select = document.getElementById('orgSelect');
    try {
        const resp = await fetch('/api/organizations');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const data = await resp.json();

        select.innerHTML = '<option value="">Select Organization...</option>';
        if (data.results && data.results.length > 0) {
            data.results.forEach(org => {
                select.innerHTML += `<option value="${org.id}">${org.name}</option>`;
            });
        } else {
            select.innerHTML = '<option value="">No organizations found</option>';
        }
    } catch (e) {
        console.error("Failed to load organizations:", e);
        select.innerHTML = '<option value="">Error loading organizations</option>';
    }
}

async function loadInventories(orgId) {
    const select = document.getElementById('invSelect');
    select.innerHTML = '<option value="">Select Inventory...</option>';
    select.disabled = true;

    if (!orgId) return;

    const resp = await fetch(`/api/organizations/${orgId}/inventories`);
    const data = await resp.json();

    data.results.forEach(inv => {
        select.innerHTML += `<option value="${inv.id}">${inv.name}</option>`;
    });
    select.disabled = false;
}

async function loadGroups(invId) {
    const container = document.getElementById('groupTree');
    container.innerHTML = '<div class="text-center text-muted"><small>Loading groups...</small></div>';

    const resp = await fetch(`/api/inventories/${invId}/groups`);
    const data = await resp.json();

    let html = `
        <div class="group-item active" onclick="selectGroup(null, this)">
            <i class="bi bi-hdd-network"></i> All Hosts
        </div>
    `;

    html += buildGroupTree(data.results);
    container.innerHTML = html;
}

function buildGroupTree(groups, level = 0) {
    let html = '';
    groups.forEach(group => {
        const padding = level * 20 + 10;
        html += `
            <div class="group-item" onclick="selectGroup(${group.id}, this)" style="padding-left: ${padding}px" id="group-${group.id}">
                <i class="bi bi-folder"></i> ${group.name}
            </div>
            <div id="children-${group.id}" class="group-children collapse show"></div>
        `;
    });
    return html;
}

function selectGroup(groupId, element) {
    currentGroupId = groupId;
    document.querySelectorAll('.group-item').forEach(el => el.classList.remove('active', 'bg-primary', 'bg-opacity-10', 'border-start', 'border-3', 'border-primary'));
    element.classList.add('active', 'bg-primary', 'bg-opacity-10', 'border-start', 'border-3', 'border-primary');
    loadHosts(currentInventoryId, groupId);
}

// Data Fetching
async function loadHosts(inventoryId, groupId = null) {
    const list = document.getElementById('hostTableBody'); // Make sure HTML ID matches
    // Note: Template has 'hostTable' with 'hostList' tbody. Let's fix that selector or assume 'hostList'
    // Actually template says <tbody id="hostList">. I should use hostList.
    // Wait, the previous main.js used "hostTableBody". I need to be consistent with what I wrote in dashboard.html.
    // Dashboard HTML edit: <tbody id="hostList" class="border-top-0">

    // Let's use getElementById('hostList')
    const tbody = document.getElementById('hostList') || document.getElementById('hostTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5"><div class="spinner-border text-primary" role="status"></div><div class="mt-2 text-muted">Loading hosts...</div></td></tr>';

    currentInventoryId = inventoryId;
    currentGroupId = groupId;

    let url = `/api/hosts?inventory_id=${inventoryId}`;
    if (groupId) url += `&group_id=${groupId}`;

    const resp = await fetch(url);
    const data = await resp.json();

    allHosts = data.results;

    // Reset Sorting & Filtering & Pagination
    document.getElementById('hostSearch').value = '';
    currentSort.col = 'name';
    currentSort.asc = true;
    updateSortIcons();
    currentPage = 1;

    filterHosts('');
}

function filterHosts(query) {
    query = query.toLowerCase();
    filteredHosts = allHosts.filter(h =>
        h.name.toLowerCase().includes(query) ||
        (h.description && h.description.toLowerCase().includes(query))
    );
    currentPage = 1; // Reset to page 1 on filter
    applySort(); // Sorts and renders
}

function sortHosts(col) {
    if (currentSort.col === col) {
        currentSort.asc = !currentSort.asc;
    } else {
        currentSort.col = col;
        currentSort.asc = true;
    }
    updateSortIcons();
    applySort();
}

function updateSortIcons() {
    document.querySelectorAll('.sort-icon').forEach(icon => {
        icon.className = 'bi ms-1 opacity-25 sort-icon bi-filter'; // Reset
        icon.parentElement.classList.remove('text-primary');
    });

    const activeHeader = document.querySelector(`.sort-col[data-sort="${currentSort.col}"]`);
    if (activeHeader) {
        activeHeader.classList.add('text-primary');
        const icon = activeHeader.querySelector('.sort-icon');
        if (icon) {
            icon.classList.remove('opacity-25', 'bi-filter');
            icon.classList.add(currentSort.asc ? 'bi-sort-alpha-down' : 'bi-sort-alpha-up');
            icon.classList.add('opacity-100');
        }
    }
}

function applySort() {
    filteredHosts.sort((a, b) => {
        let valA, valB;
        if (currentSort.col === 'name') {
            valA = a.name.toLowerCase();
            valB = b.name.toLowerCase();
        } else if (currentSort.col === 'description') {
            valA = (a.description || '').toLowerCase();
            valB = (b.description || '').toLowerCase();
        } else if (currentSort.col === 'enabled') {
            valA = a.enabled;
            valB = b.enabled;
        } else if (currentSort.col === 'created') { // Last Job / Created
            // Using Last Job ID/Status as proxy? Or Created date? 
            // Header says "Last Job". Let's use last job ID (newest first)
            valA = a.summary_fields.last_job ? a.summary_fields.last_job.id : 0;
            valB = b.summary_fields.last_job ? b.summary_fields.last_job.id : 0;
        }

        if (valA < valB) return currentSort.asc ? -1 : 1;
        if (valA > valB) return currentSort.asc ? 1 : -1;
        return 0;
    });
    renderHosts();
}

// Pagination State (Functions)

function changePageSize(size) {
    if (size === 'all') {
        rowsPerPage = 'all';
    } else {
        rowsPerPage = parseInt(size);
    }
    currentPage = 1;
    renderHosts();
}

function changePage(delta) {
    if (rowsPerPage === 'all') return; // No pagination in 'all' mode

    const maxPage = Math.ceil(filteredHosts.length / rowsPerPage);
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= maxPage) {
        currentPage = newPage;
        renderHosts();
    }
}

function renderPagination() {
    const total = filteredHosts.length;
    const showingText = document.getElementById('paginationInfo'); // Changed from 'showingText' to 'paginationInfo'
    const prevBtn = document.getElementById('prevPage'); // Changed from 'prevBtn' to 'prevPage'
    const nextBtn = document.getElementById('nextPage'); // Changed from 'nextBtn' to 'nextPage'

    if (!showingText || !prevBtn || !nextBtn) return;

    if (rowsPerPage === 'all') {
        showingText.innerText = `Showing 1-${total} of ${total}`;
        prevBtn.classList.add('disabled');
        nextBtn.classList.add('disabled');
        return;
    }

    const start = (currentPage - 1) * rowsPerPage + 1;
    let end = currentPage * rowsPerPage;
    if (end > total) end = total;

    if (total === 0) {
        showingText.innerText = 'Showing 0-0 of 0';
        prevBtn.classList.add('disabled');
        nextBtn.classList.add('disabled');
    } else {
        showingText.innerText = `Showing ${start}-${end} of ${total}`;

        // Prev Button
        if (currentPage === 1) prevBtn.classList.add('disabled');
        else prevBtn.classList.remove('disabled');

        // Next Button
        const maxPage = Math.ceil(total / rowsPerPage);
        if (currentPage === maxPage) nextBtn.classList.add('disabled');
        else nextBtn.classList.remove('disabled');
    }
}

function renderHosts() {
    const list = document.getElementById('hostList') || document.getElementById('hostTableBody');
    if (!list) return;

    // Pagination Slice
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageHosts = filteredHosts.slice(start, end);

    if (pageHosts.length === 0) {
        list.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-muted">No hosts found</td></tr>';
        renderPagination();
        return;
    }

    list.innerHTML = pageHosts.map(host => {
        const statusColor = host.enabled ? 'success' : 'secondary';
        const jobStatus = host.summary_fields.last_job ? (host.summary_fields.last_job.status === 'successful' ? 'success' : 'danger') : 'secondary';
        const lastJobText = host.summary_fields.last_job ?
            `<span class="badge bg-${jobStatus} bg-opacity-10 text-${jobStatus}">
                <i class="bi bi-circle-fill" style="font-size: 0.5em;"></i> ${host.summary_fields.last_job.id} - ${host.summary_fields.last_job.status}
             </span>` : '<span class="text-muted text-xs">No jobs run</span>';

        return `
            <tr onclick="showHostDetails(${host.id})" style="cursor: pointer" class="align-middle">
                <td class="ps-4">
                    <div class="d-flex align-items-center">
                        <span class="status-dot bg-${statusColor} me-2"></span>
                        <span class="fw-bold text-light">${host.name}</span>
                    </div>
                </td>
                <td class="text-secondary small">${host.description || '-'}</td>
                <td>
                    <span class="badge bg-${host.enabled ? 'success' : 'secondary'} bg-opacity-10 text-${host.enabled ? 'success' : 'secondary'}">
                        ${host.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                </td>
                <td>${lastJobText}</td>
            </tr>
        `;
    }).join('');

    renderPagination();
}

// Host Details & Jobs
async function showHostDetails(hostId) {
    const modal = new bootstrap.Modal(document.getElementById('hostModal'));
    modal.show();

    // Reset tabs
    document.getElementById('details-tab').click();
    document.getElementById('hostDetailsContent').innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';
    document.getElementById('hostVariablesContent').innerHTML = '';
    document.getElementById('hostJobsContent').innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';
    currentHostId = hostId;

    const resp = await fetch(`/api/hosts/${hostId}`);
    const data = await resp.json();

    // 1. Details Tab
    const createdDate = data.created ? new Date(data.created).toLocaleString() : '-';
    const modifiedDate = data.modified ? new Date(data.modified).toLocaleString() : '-';

    const detailsHtml = `
        <h6 class="text-secondary text-uppercase text-xs tracking-wider mb-3">Configuration</h6>
        <table class="table table-borderless table-sm text-light">
            <tr><td class="text-secondary" style="width: 150px">ID:</td><td>${data.id}</td></tr>
            <tr><td class="text-secondary">Name:</td><td>${data.name}</td></tr>
            <tr><td class="text-secondary">Description:</td><td>${data.description || '-'}</td></tr>
            <tr><td class="text-secondary">Enabled:</td><td>
                <span class="badge bg-${data.enabled ? 'success' : 'secondary'} bg-opacity-10 text-${data.enabled ? 'success' : 'secondary'}">
                    ${data.enabled ? 'True' : 'False'}
                </span>
            </td></tr>
             <tr><td class="text-secondary">Created:</td><td>${createdDate}</td></tr>
             <tr><td class="text-secondary">Modified:</td><td>${modifiedDate}</td></tr>
        </table>
    `;
    document.getElementById('hostDetailsContent').innerHTML = detailsHtml;

    // 2. Variables Tab
    let varsObj = data.variables;
    if (typeof varsObj === 'string' && varsObj.trim().length > 0) {
        try { varsObj = jsyaml.load(varsObj); } catch (e) { }
    }
    if (varsObj === '') varsObj = {};

    let varsHtml = '';
    try {
        const jsonStr = JSON.stringify(varsObj, null, 2);
        varsHtml = `<pre class="code-block p-3 rounded" style="max-height: 500px; overflow: auto;" id="varsOutput">${jsonStr}</pre>`;
    } catch (e) {
        varsHtml = '<div class="alert alert-warning">Could not parse variables</div>';
    }

    const b64Vars = btoa(JSON.stringify(varsObj));

    const variablesHtml = `
         <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="text-secondary text-uppercase text-xs tracking-wider mb-0">Format</h6>
            <div class="d-flex align-items-center gap-2">
                <button class="btn btn-sm btn-outline-light" onclick="copyVariables(this)" title="Copy to Clipboard">
                    <i class="bi bi-clipboard"></i>
                </button>
                <div class="btn-group btn-group-sm">
                    <input type="radio" class="btn-check" name="format_${data.id}" id="json_${data.id}" autocomplete="off" checked onclick="toggleFormat('json', '${b64Vars}')">
                    <label class="btn btn-outline-secondary" for="json_${data.id}">JSON</label>
                    <input type="radio" class="btn-check" name="format_${data.id}" id="yaml_${data.id}" autocomplete="off" onclick="toggleFormat('yaml', '${b64Vars}')">
                    <label class="btn btn-outline-secondary" for="yaml_${data.id}">YAML</label>
                </div>
            </div>
        </div>
        ${varsHtml}
    `;
    document.getElementById('hostVariablesContent').innerHTML = variablesHtml;
}

let currentHostId = null;
async function loadHostJobs() {
    if (!currentHostId) return;
    const container = document.getElementById('hostJobsContent');

    const resp = await fetch(`/api/hosts/${currentHostId}/jobs`);
    const data = await resp.json();

    if (!data.results || data.results.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-3">No job history found.</div>';
        return;
    }

    const jobs = data.results.sort((a, b) => b.id - a.id);

    const rows = jobs.map(item => {
        const jobDetail = item.summary_fields.job || {};
        const jobId = item.job || item.id;
        const jobName = jobDetail.name || 'Job ' + jobId;
        const status = jobDetail.status || item.status || 'unknown';
        const finished = jobDetail.finished || item.created || item.modified;
        const statusColor = status === 'successful' ? 'success' : (status === 'failed' ? 'danger' : 'warning');
        const finishedDate = finished ? new Date(finished).toLocaleString() : 'Running/Pending';

        return `
            <tr>
                <td><a href="#" class="text-decoration-none text-info">${jobId}</a></td>
                <td>${jobName}</td>
                <td><span class="badge bg-${statusColor} bg-opacity-10 text-${statusColor}">${status}</span></td>
                <td class="text-xs text-muted">${finishedDate}</td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <table class="table table-dark table-hover table-sm align-middle mt-2">
            <thead>
                <tr>
                    <th>Job ID</th><th>Workflow/Template</th><th>Status</th><th>Time</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

function copyVariables(btn) {
    const content = document.getElementById('varsOutput').innerText;
    navigator.clipboard.writeText(content).then(() => {
        const icon = btn.querySelector('i');
        icon.classList.replace('bi-clipboard', 'bi-check2');
        icon.classList.add('text-success');
        setTimeout(() => {
            icon.classList.replace('bi-check2', 'bi-clipboard');
            icon.classList.remove('text-success');
        }, 2000);
    });
}

function toggleFormat(fmt, b64data) {
    const data = JSON.parse(atob(b64data));
    const output = document.getElementById('varsOutput');
    if (fmt === 'yaml') {
        output.innerHTML = jsyaml.dump(data);
    } else {
        output.innerHTML = JSON.stringify(data, null, 2);
    }
}

function exportData(format) {
    if (!currentInventoryId) {
        alert("Please select an inventory first.");
        return;
    }
    let url = `/export?format=${format}&inventory_id=${currentInventoryId}`;
    if (currentGroupId) url += `&group_id=${currentGroupId}`;
    window.open(url, '_blank');
}

// Theme
function toggleTheme() {
    const isLight = document.body.classList.toggle('light-mode');
    document.documentElement.setAttribute('data-bs-theme', isLight ? 'light' : 'dark');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    updateThemeIcon();
}

function updateThemeIcon() {
    const icon = document.getElementById('themeIcon');
    if (!icon) return;
    if (document.body.classList.contains('light-mode')) {
        icon.classList.replace('bi-moon-stars-fill', 'bi-sun-fill');
    } else {
        icon.classList.replace('bi-sun-fill', 'bi-moon-stars-fill');
    }
}
