import os
from flask import Blueprint, render_template, request, redirect, url_for, flash, session
from app.services import AWXService

main_bp = Blueprint('main', __name__)

@main_bp.route('/', methods=['GET'])
def index():
    if 'auth_info' in session:
        return redirect(url_for('main.dashboard'))
    
    prev_url = session.get('last_url') or os.environ.get('AWX_BASE_URL', '')
    return render_template('login.html', prev_url=prev_url)

@main_bp.route('/login', methods=['POST'])
def login():
    awx_url = request.form.get('awx_url')
    auth_mode = request.form.get('auth_mode')
    
    token = request.form.get('token') if auth_mode == 'token' else None
    username = request.form.get('username') if auth_mode == 'credentials' else None
    password = request.form.get('password') if auth_mode == 'credentials' else None

    if not awx_url:
        flash('AWX URL is required', 'error')
        return redirect(url_for('main.index'))

    # Initialize Service
    service = AWXService(awx_url, token=token, username=username, password=password)
    success, result = service.check_connection()

    if success:
        session['auth_info'] = {
            'base_url': awx_url,
            'token': token,
            'username': username,
            'password': password, # Note: In production, consider encryption or not storing, but for this session-based tool it's typical.
            'auth_mode': auth_mode
        }
        session['last_url'] = awx_url
        return redirect(url_for('main.dashboard'))
    else:
        flash(f'Connection failed: {result}', 'error')
        return redirect(url_for('main.index'))

@main_bp.route('/dashboard')
def dashboard():
    if 'auth_info' not in session:
        return redirect(url_for('main.index'))
    return render_template('dashboard.html')

@main_bp.route('/api/organizations')
def get_organizations():
    if 'auth_info' not in session: return {'error': 'Unauthorized'}, 401
    service = _get_service()
    return {'results': service.get_organizations()}

@main_bp.route('/api/organizations/<int:org_id>/inventories')
def get_inventories(org_id):
    if 'auth_info' not in session: return {'error': 'Unauthorized'}, 401
    service = _get_service()
    return {'results': service.get_inventories(org_id)}

@main_bp.route('/api/inventories/<int:inv_id>/groups')
def get_groups(inv_id):
    if 'auth_info' not in session: return {'error': 'Unauthorized'}, 401
    service = _get_service()
    # We start with root groups
    return {'results': service.get_root_groups(inv_id)}

@main_bp.route('/api/groups/<int:group_id>/children')
def get_group_children(group_id):
    if 'auth_info' not in session: return {'error': 'Unauthorized'}, 401
    service = _get_service()
    return {'results': service.get_group_children(group_id)}

@main_bp.route('/api/hosts')
def get_hosts():
    if 'auth_info' not in session:
        return {'error': 'Unauthorized'}, 401
    
    inventory_id = request.args.get('inventory_id')
    group_id = request.args.get('group_id')
    
    # Input Validation
    if not inventory_id or not inventory_id.isdigit():
         return {'error': 'Invalid Inventory ID'}, 400
    if group_id and not group_id.isdigit():
         return {'error': 'Invalid Group ID'}, 400

    service = _get_service()
    hosts = service.get_hosts(inventory_id, group_id)
    return {'results': hosts}

@main_bp.route('/api/hosts/<int:host_id>')
def get_host_details(host_id):
    if 'auth_info' not in session: return {'error': 'Unauthorized'}, 401
    service = _get_service()
    host = service.get_host_details(host_id)
    return host

@main_bp.route('/api/hosts/<int:host_id>/jobs')
def get_host_jobs(host_id):
    if 'auth_info' not in session: return {'error': 'Unauthorized'}, 401
    service = _get_service()
    return {'results': service.get_host_jobs(host_id)}

@main_bp.route('/api/hosts/<int:host_id>/facts')
def get_host_facts(host_id):
    if 'auth_info' not in session: return {'error': 'Unauthorized'}, 401
    service = _get_service()
    return service.get_host_facts(host_id)

@main_bp.route('/logout')
def logout():
    session.pop('auth_info', None)
    return redirect(url_for('main.index'))

def _get_service():
    auth = session['auth_info']
    return AWXService(
        auth['base_url'], 
        token=auth['token'], 
        username=auth['username'], 
        password=auth['password']
    )
import csv
import io
from flask import Response, make_response
from openpyxl import Workbook

@main_bp.route('/export')
def export_hosts():
    if 'auth_info' not in session: return redirect(url_for('main.index'))
    
    fmt = request.args.get('format', 'csv')
    inv_id = request.args.get('inventory_id')
    group_id = request.args.get('group_id')
    
    if not inv_id:
        return "Inventory ID required", 400
        
    service = _get_service()
    hosts = service.get_hosts(inv_id, group_id)
    
    # Prepare data
    data = []
    headers = ['ID', 'Name', 'Description', 'Enabled', 'Last Job ID', 'Last Job Status']
    
    for host in hosts:
        last_job = host.get('summary_fields', {}).get('last_job', {})
        data.append({
            'ID': host['id'],
            'Name': host['name'],
            'Description': host.get('description', ''),
            'Enabled': host['enabled'],
            'Last Job ID': last_job.get('id', ''),
            'Last Job Status': last_job.get('status', 'N/A')
        })
        
    if fmt == 'csv':
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=headers)
        writer.writeheader()
        writer.writerows(data)
        
        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-disposition": "attachment; filename=hosts_export.csv"}
        )
        
    elif fmt == 'excel' or fmt == 'xlsx':
        wb = Workbook()
        ws = wb.active
        ws.append(headers)
        
        for row in data:
            ws.append([row[h] for h in headers])
            
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        return Response(
            output.getvalue(),
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-disposition": "attachment; filename=hosts_export.xlsx"}
        )
        
    elif fmt == 'html':
        # Simple HTML table render
        html_content = render_template('export_report.html', headers=headers, data=data) 
        return Response(html_content, mimetype="text/html")
        
    return "Invalid format", 400
