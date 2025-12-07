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

// Utils
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

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
    setTheme(savedTheme);
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
                select.innerHTML += `<option value="${escapeHtml(org.id)}">${escapeHtml(org.name)}</option>`;
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
        select.innerHTML += `<option value="${escapeHtml(inv.id)}">${escapeHtml(inv.name)}</option>`;
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
            <div class="group-item" onclick="selectGroup(${escapeHtml(group.id)}, this)" style="padding-left: ${padding}px" id="group-${escapeHtml(group.id)}">
                <i class="bi bi-folder"></i> ${escapeHtml(group.name)}
            </div>
            <div id="children-${escapeHtml(group.id)}" class="group-children collapse show"></div>
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
// Data Fetching
async function loadHosts(inventoryId, groupId = null) {
    const tbody = document.getElementById('hostList') || document.getElementById('hostTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-5"><div class="spinner-border text-primary" role="status"></div><div class="mt-2 text-muted">Loading hosts...</div></td></tr>';

    currentInventoryId = inventoryId;
    currentGroupId = groupId;

    let url = `/api/hosts?inventory_id=${inventoryId}`;
    if (groupId) url += `&group_id=${groupId}`;

    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();

        allHosts = data.results || [];

        // Reset Sorting & Filtering & Pagination
        document.getElementById('hostSearch').value = '';
        currentSort.col = 'name';
        currentSort.asc = true;
        updateSortIcons();
        currentPage = 1;

        filterHosts('');
    } catch (e) {
        console.error("Load hosts failed", e);
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-danger">Failed to load hosts: ${e.message}</td></tr>`;
    }
}

function filterHosts(query) {
    if (!allHosts) allHosts = [];
    query = query.toLowerCase();
    try {
        filteredHosts = allHosts.filter(h =>
            (h.name && h.name.toLowerCase().includes(query)) ||
            (h.description && h.description.toLowerCase().includes(query))
        );
        currentPage = 1; // Reset to page 1 on filter
        applySort(); // Sorts and renders
    } catch (e) {
        console.error("Filter failed", e);
    }
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
    if (!filteredHosts) filteredHosts = [];
    filteredHosts.sort((a, b) => {
        let valA, valB;
        if (currentSort.col === 'name') {
            valA = (a.name || '').toLowerCase();
            valB = (b.name || '').toLowerCase();
        } else if (currentSort.col === 'description') {
            valA = (a.description || '').toLowerCase();
            valB = (b.description || '').toLowerCase();
        } else if (currentSort.col === 'enabled') {
            valA = a.enabled;
            valB = b.enabled;
        } else if (currentSort.col === 'created') {
            // Last Job ID as proxy
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

function changePage(action) {
    if (rowsPerPage === 'all') return; // No pagination in 'all' mode

    const delta = (action === 'next' || action === 1) ? 1 : -1;
    const maxPage = Math.ceil(filteredHosts.length / rowsPerPage);
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= maxPage) {
        currentPage = newPage;
        renderHosts();
    }
}

function renderPagination() {
    const total = filteredHosts.length;
    const showingText = document.getElementById('paginationInfo');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');

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

    try {
        // Pagination Slice
        let pageHosts = [];
        if (rowsPerPage === 'all') {
            pageHosts = filteredHosts || [];
        } else {
            const start = (currentPage - 1) * rowsPerPage;
            const end = start + rowsPerPage;
            pageHosts = (filteredHosts || []).slice(start, end);
        }

        if (pageHosts.length === 0) {
            list.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-muted">No hosts found</td></tr>';
            renderPagination();
            return;
        }

        list.innerHTML = pageHosts.map(host => {
            const statusColor = host.enabled ? 'success' : 'secondary';
            const lastJob = host.summary_fields && host.summary_fields.last_job ? host.summary_fields.last_job : null;
            const jobStatus = lastJob ? (lastJob.status === 'successful' ? 'success' : 'danger') : 'secondary';

            const lastJobText = lastJob ?
                `<span class="badge bg-${escapeHtml(jobStatus)} bg-opacity-10 text-${escapeHtml(jobStatus)}">
                    <i class="bi bi-circle-fill" style="font-size: 0.5em;"></i> ${escapeHtml(lastJob.id)} - ${escapeHtml(lastJob.status)}
                 </span>` : '<span class="text-muted text-xs">No jobs run</span>';

            return `
                <tr onclick="showHostDetails(${escapeHtml(host.id)})" style="cursor: pointer" class="align-middle">
                    <td class="ps-4">
                        <div class="d-flex align-items-center">
                            <span class="status-dot bg-${escapeHtml(statusColor)} me-2"></span>
                            <span class="fw-bold text-light">${escapeHtml(host.name || 'Unknown')}</span>
                        </div>
                    </td>
                    <td class="text-secondary small">${escapeHtml(host.description || '-')}</td>
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
    } catch (e) {
        console.error("Render hosts failed", e);
        list.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-danger">Error rendering hosts: ${e.message}</td></tr>`;
    }
}

// Host Details & Jobs
async function showHostDetails(hostId) {
    const modal = new bootstrap.Modal(document.getElementById('hostModal'));
    modal.show();

    // Reset tabs
    document.getElementById('details-tab').click();
    document.getElementById('hostDetailsContent').innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';
    document.getElementById('hostVariablesContent').innerHTML = '';
    document.getElementById('hostFactsContent').innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';
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
            <tr><td class="text-secondary" style="width: 150px">ID:</td><td>${escapeHtml(data.id)}</td></tr>
            <tr><td class="text-secondary">Name:</td><td>${escapeHtml(data.name)}</td></tr>
            <tr><td class="text-secondary">Description:</td><td>${escapeHtml(data.description || '-')}</td></tr>
            <tr><td class="text-secondary">Enabled:</td><td>
                <span class="badge bg-${data.enabled ? 'success' : 'secondary'} bg-opacity-10 text-${data.enabled ? 'success' : 'secondary'}">
                    ${data.enabled ? 'True' : 'False'}
                </span>
            </td></tr>
             <tr><td class="text-secondary">Created:</td><td>${escapeHtml(createdDate)}</td></tr>
             <tr><td class="text-secondary">Modified:</td><td>${escapeHtml(modifiedDate)}</td></tr>
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
        // JSON.stringify needs to be escaped for HTML context
        varsHtml = `<pre class="code-block p-3 rounded" style="max-height: 500px; overflow: auto;" id="varsOutput">${escapeHtml(jsonStr)}</pre>`;
    } catch (e) {
        varsHtml = `<div class="alert alert-warning">Could not parse variables: ${escapeHtml(e.message)}</div>`;
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
let currentHostFacts = null;
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

async function loadHostFacts() {
    if (!currentHostId) return;
    const container = document.getElementById('hostFactsContent');

    // Check if check already loaded? No, let's refresh every time or check if empty?
    // Let's refresh to be safe or simple check: if not spinner
    // For now, simple fetch.

    // Re-add spinner if needed (optional since showHostDetails did it, but switching tabs might not)
    // Actually showHostDetails resets it. But if I clicked Facts, then Jobs using the spinner, then back to Facts... 
    // Let's set spinner.
    container.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';

    try {
        const resp = await fetch(`/api/hosts/${currentHostId}/facts`);
        if (!resp.ok) throw new Error('Failed to load facts');

        const data = await resp.json();
        currentHostFacts = data; // Store for searching

        if (!data || Object.keys(data).length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-3">No facts collected for this host.</div>';
            return;
        }

        renderFactsTree(data);

    } catch (e) {
        container.innerHTML = `<div class="alert alert-danger">Error loading facts: ${e.message}</div>`;
    }
}

function renderFactsTree(data) {
    const container = document.getElementById('hostFactsContent');
    const jsonStr = JSON.stringify(currentHostFacts, null, 2); // Copy original full data
    const treeHtml = buildJsonTree(data);

    // If we are re-rendering (searching), preserve the input value
    const searchInput = document.getElementById('factsSearch');
    const minSearchVal = searchInput ? searchInput.value : '';

    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2 gap-2">
             <div class="input-group input-group-sm" style="max-width: 300px;">
                <span class="input-group-text bg-transparent border-secondary text-secondary"><i class="bi bi-search"></i></span>
                <input type="text" id="factsSearch" class="form-control bg-transparent border-secondary text-light" placeholder="Search facts..." value="${escapeHtml(minSearchVal)}" oninput="handleFactsSearch(this.value)">
             </div>
             <div class="d-flex gap-2">
                 <button class="btn btn-sm btn-outline-light" onclick="expandAllFacts()" title="Expand All">
                    <i class="bi bi-arrows-expand"></i>
                </button>
                 <button class="btn btn-sm btn-outline-light" onclick="collapseAllFacts()" title="Collapse All">
                    <i class="bi bi-arrows-collapse"></i>
                </button>
                 <button class="btn btn-sm btn-outline-light" onclick="copyToClipboard(this)" data-content='${jsonStr.replace(/'/g, "&#39;")}' title="Copy to Clipboard">
                    <i class="bi bi-clipboard"></i> Copy
                </button>
            </div>
        </div>
        <div class="code-block p-3 rounded" style="max-height: 600px; overflow: auto;">
            <div class="json-tree" id="factsTree">${treeHtml || '<div class="text-muted fst-italic">No matching facts found</div>'}</div>
        </div>
    `;

    // Restore focus if searching
    if (minSearchVal) {
        const newInput = document.getElementById('factsSearch');
        newInput.focus();
        // Move cursor to end
        const len = newInput.value.length;
        newInput.setSelectionRange(len, len);

        // Auto-expand results when searching
        expandAllFacts();
    }
}

let factsSearchTimeout = null;
function handleFactsSearch(query) {
    clearTimeout(factsSearchTimeout);
    factsSearchTimeout = setTimeout(() => {
        if (!query.trim()) {
            renderFactsTree(currentHostFacts);
            return;
        }
        const filtered = filterFactsData(currentHostFacts, query);
        renderFactsTree(filtered);
    }, 300);
}

function filterFactsData(data, query) {
    if (!data) return null;
    query = query.toLowerCase();

    // Helper to check if value is primitive and matches
    const isPrimitiveMatch = (val) => {
        return (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') &&
            String(val).toLowerCase().includes(query);
    };

    if (Array.isArray(data)) {
        const filtered = data.map(item => filterFactsData(item, query)).filter(item => item !== null);
        return filtered.length > 0 ? filtered : null;
    }

    if (typeof data === 'object' && data !== null) {
        const result = {};
        let hasMatch = false;

        for (const [key, value] of Object.entries(data)) {
            // Match Key
            if (key.toLowerCase().includes(query)) {
                result[key] = value; // Include full subtree if key matches
                hasMatch = true;
                continue;
            }

            // Match Value (Primitive)
            if (isPrimitiveMatch(value)) {
                result[key] = value;
                hasMatch = true;
                continue;
            }

            // Recurse for Objects/Arrays
            if (typeof value === 'object' && value !== null) {
                const filteredChild = filterFactsData(value, query);
                if (filteredChild !== null) {
                    result[key] = filteredChild;
                    hasMatch = true;
                }
            }
        }
        return hasMatch ? result : null;
    }

    // Top-level primitive check (shouldn't happen for Facts root, but good for completeness)
    return isPrimitiveMatch(data) ? data : null;
}

// JSON Tree Helpers
function buildJsonTree(data) {
    let html = '';
    if (typeof data === 'object' && data !== null) {
        const keys = Object.keys(data);

        keys.forEach((key) => {
            const value = data[key];
            const isObj = typeof value === 'object' && value !== null;
            const hasChildren = isObj && Object.keys(value).length > 0;

            html += `<div class="item">`;

            if (hasChildren) {
                html += `<span class="toggle bi bi-caret-right-fill" onclick="toggleJson(this)"></span>`;
            } else {
                html += `<span class="toggle" style="opacity:0; pointer-events:none; margin-right:4px;">&nbsp;</span>`;
            }

            html += `<span class="key">${escapeHtml(key)}:</span> `;

            if (isObj) {
                const count = Array.isArray(value) ? `[${value.length}]` : `{${Object.keys(value).length}}`;
                html += `<span class="text-muted text-xs ms-1">${count}</span>`;
                if (hasChildren) {
                    html += `<div class="nested">${buildJsonTree(value)}</div>`;
                } else {
                    html += `<span class="text-muted">{}</span>`;
                }
            } else {
                let type = typeof value;
                if (value === null) type = 'null';
                let displayVal = value;
                // Encode string values
                if (type === 'string') displayVal = `"${escapeHtml(value)}"`;

                html += `<span class="${type}">${displayVal}</span>`;
            }
            html += `</div>`;
        });
    }
    return html;
}

function toggleJson(el) {
    el.classList.toggle('down');
    el.parentElement.querySelector('.nested').classList.toggle('show');
}

function expandAllFacts() {
    document.querySelectorAll('#factsTree .nested').forEach(el => el.classList.add('show'));
    document.querySelectorAll('#factsTree .toggle').forEach(el => el.classList.add('down'));
}

function collapseAllFacts() {
    document.querySelectorAll('#factsTree .nested').forEach(el => el.classList.remove('show'));
    document.querySelectorAll('#factsTree .toggle').forEach(el => el.classList.remove('down'));
}

// Helper for copy (if not exists, I should add it, but I have copyVariables. Let's make a generic one or use specific)
// I'll add a generic one below or use a closure.
function copyToClipboard(btn) {
    const content = btn.getAttribute('data-content');
    navigator.clipboard.writeText(content).then(() => {
        const icon = btn.querySelector('i');
        icon.className = 'bi bi-check';
        setTimeout(() => icon.className = 'bi bi-clipboard', 2000);
    });
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

// Theme Management
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    updateThemeUI(theme);
}

function updateThemeUI(theme) {
    const icon = document.getElementById('currThemeIcon');
    const label = document.getElementById('currThemeLabel');
    if (!icon || !label) return;

    // Reset
    icon.className = '';

    switch (theme) {
        case 'light':
            icon.className = 'bi bi-sun-fill';
            label.innerText = 'Light';
            break;
        case 'nord':
            icon.className = 'bi bi-snow';
            label.innerText = 'Nord';
            break;
        case 'forest':
            icon.className = 'bi bi-tree-fill';
            label.innerText = 'Forest';
            break;
        case 'sunset':
            icon.className = 'bi bi-sunset-fill';
            label.innerText = 'Sunset';
            break;
        case 'cyberpunk':
            icon.className = 'bi bi-lightning-charge-fill';
            label.innerText = 'Cyberpunk';
            break;
        case 'dark':
        default:
            icon.className = 'bi bi-moon-stars-fill';
            label.innerText = 'Midnight';
            break;
    }
}

