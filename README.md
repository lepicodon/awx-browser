# AWX Browser

[logo]: app/static/img/logo.png "AWX Browser Logo"

A modern, premium-designed web interface for visualizing and interacting with your [Ansible AWX](https://github.com/ansible/awx) or Red Hat Ansible Automation Platform inventories.

## ✨ Features

- **Modern UI**: A sleek, dark-themed interface built with Bootstrap 5 and Glassmorphism design principles. Includes a Light/Dark mode toggle.
- **Hierarchical Browsing**: Easily navigate through Organizations, Inventories, and Groups.
- **Host Management**:
    - View host status, description, and last job execution results.
    - Client-side sorting and filtering for quick access.
    - Detailed Host inspection modal with **JSON/YAML** variable toggle.
- **Exports**: Download your filtered host lists as **CSV**, **Excel (.xlsx)**, or view as an **HTML Report**.
- **Secure Authentication**: Connect using your AWX Credentials (AD/LDAP supported) or a Personal Access Token.

## 🚀 Getting Started

### Prerequisites

- Python 3.8+
- Access to a running AWX/Tower instance

### Installation (Local)

1. **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/awx-browser.git
    cd awx-browser
    ```

2. **Create a virtual environment**:
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```

3. **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

4. **Run the application**:
    ```bash
    python app.py
    ```

5. **Open your browser**:
   Navigate to `http://localhost:5000`.

### 🐳 Installation (Docker)
## deployments

This application is container-ready.

### Docker
1. **Build the image**:
    ```bash
    docker build -t awx-browser .
    ```

2. **Run the container**:
    ```bash
    docker run -p 5000:5000 awx-browser
    ```

### Kubernetes
1. Build the image:
   ```bash
   docker build -t awx-browser:latest .
   # Push to your registry if deploying to a remote cluster
   # docker tag awx-browser:latest myregistry/awx-browser:latest
   # docker push myregistry/awx-browser:latest
   ```

2. Edit `kubernetes.yaml` to set your `AWX_BASE_URL` and image name.

3. Apply the manifest:
   ```bash
   kubectl apply -f kubernetes.yaml
   ```

4. Forward the port (for local testing):
   ```bash
   kubectl port-forward svc/awx-browser 8080:80
   ```
   Access at `http://localhost:8080`.

## 🛠 Tech Stack

- **Backend**: Flask (Python)
- **Frontend**: Bootstrap 5, Vanilla JS, Glassmorphism CSS
- **Data Attributes**: `requests`, `pyyaml`, `openpyxl`

## 📸 Screenshots

*(Add screenshots of the Dashboard and Host Details modal here)*

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
