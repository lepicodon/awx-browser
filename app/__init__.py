from flask import Flask
from flask_session import Session
from flask_wtf.csrf import CSRFProtect
import os
import secrets

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY') or secrets.token_hex(32)
    
    # Security Config
    app.config['SESSION_TYPE'] = 'filesystem'
    app.config['SESSION_PERMANENT'] = False
    app.config['SESSION_USE_SIGNER'] = True
    Session(app)
    CSRFProtect(app)
    
    from app.routes import main_bp
    app.register_blueprint(main_bp)
    
    return app
