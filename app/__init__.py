from flask import Flask
from flask_session import Session
from flask_wtf.csrf import CSRFProtect

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'dev-secret-key-change-this'
    
    # Security Config
    app.config['SESSION_TYPE'] = 'filesystem'
    app.config['SESSION_PERMANENT'] = False
    app.config['SESSION_USE_SIGNER'] = True
    Session(app)
    CSRFProtect(app)
    
    from app.routes import main_bp
    app.register_blueprint(main_bp)
    
    return app
