from routes.render_pages.render_home import bp_render_home
from routes.render_pages.render_login import bp_render_login
from routes.render_pages.render_dashboard import bp_render_dashboard

from routes.auth_controller import bp_auth
from routes.unit_controller import bp_unit
from routes.waste_records_controller import bp_waste_records
from routes.waste_types_controller import bp_waste_types

PREFIX = "/dashboard-esg"

def config_all(app):
    config_bps(app)

def config_bps(app):
    app.register_blueprint(bp_render_home, url_prefix=PREFIX)
    app.register_blueprint(bp_render_login, url_prefix=PREFIX)
    app.register_blueprint(bp_render_dashboard, url_prefix=PREFIX)
    app.register_blueprint(bp_auth, url_prefix=PREFIX)
    app.register_blueprint(bp_unit, url_prefix=PREFIX)
    app.register_blueprint(bp_waste_records, url_prefix=PREFIX)
    app.register_blueprint(bp_waste_types, url_prefix=PREFIX)