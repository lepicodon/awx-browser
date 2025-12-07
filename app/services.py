import requests
from flask import session

class AWXService:
    def __init__(self, base_url, token=None, username=None, password=None):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.session.verify = False  # Ignore self-signed certs handling for internal tools
        
        if token:
            self.session.headers.update({'Authorization': f'Bearer {token}'})
        elif username and password:
            self.session.auth = (username, password)

    def check_connection(self):
        """Validates credentials by hitting the /api/v2/me endpoint."""
        try:
            response = self.session.get(f"{self.base_url}/api/v2/me/")
            if response.status_code == 200:
                return True, response.json()
            else:
                return False, f"Connection failed: {response.status_code}"
        except Exception as e:
            return False, str(e)
            
    def _get_all_pages(self, url, params=None):
        results = []
        params = params or {}
        first_page = True
        while url:
            try:
                # Handle relative URLs which AWX sometimes returns
                if not url.startswith('http'):
                    url = f"{self.base_url}{url}"
                
                response = self.session.get(url, params=params)
                
                if first_page and response.status_code != 200:
                    # If the very first call fails, propagate the error
                    response.raise_for_status()
                elif response.status_code != 200:
                    # If subsequent pages fail, just stop
                    break

                data = response.json()
                results.extend(data.get('results', []))
                
                # Setup next page
                url = data.get('next')
                params = None # Params only needed for first request
                first_page = False
            except Exception as e:
                if first_page:
                    raise e
                break
        return results

    def get_organizations(self):
        return self._get_all_pages(f"{self.base_url}/api/v2/organizations/")

    def get_inventories(self, org_id):
        return self._get_all_pages(f"{self.base_url}/api/v2/organizations/{org_id}/inventories/")

    def get_root_groups(self, inventory_id):
        return self._get_all_pages(f"{self.base_url}/api/v2/inventories/{inventory_id}/root_groups/")
    
    def get_group_children(self, group_id):
        return self._get_all_pages(f"{self.base_url}/api/v2/groups/{group_id}/children/")

    def get_hosts(self, inventory_id, group_id=None):
        if group_id:
             return self._get_all_pages(f"{self.base_url}/api/v2/groups/{group_id}/all_hosts/")
        else:
             return self._get_all_pages(f"{self.base_url}/api/v2/inventories/{inventory_id}/hosts/")

    def get_host_details(self, host_id):
        response = self.session.get(f"{self.base_url}/api/v2/hosts/{host_id}/")
        if response.status_code == 200:
            return response.json()
        return None

    def get_host_jobs(self, host_id):
        # Using job_host_summaries to find jobs related to this host
        # Or /api/v2/hosts/{id}/job_events/ ? No, summaries is better for high level list 'last job' type stuff
        # actually /api/v2/hosts/{id}/job_host_summaries/ returns the list of jobs this host was part of.
        return self._get_all_pages(f"{self.base_url}/api/v2/hosts/{host_id}/job_host_summaries/")

    def get_host_facts(self, host_id):
        response = self.session.get(f"{self.base_url}/api/v2/hosts/{host_id}/ansible_facts/")
        if response.status_code == 200:
            return response.json()
        return {} # Return empty dict if no facts or error (or raise?) Let's return empty for now to avoid crash
