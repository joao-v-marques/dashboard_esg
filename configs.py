from routes.render_pages.render_home import bp_render_home
from routes.render_pages.render_login import bp_render_login
from routes.render_pages.render_dashboard import bp_render_dashboard
from routes.render_pages.render_residuos import bp_render_residuos
from routes.render_pages.render_nips import bp_render_nips

from routes.auth_controller import bp_auth
from routes.unit_controller import bp_unit
from routes.waste_records_controller import bp_waste_records
from routes.waste_types_controller import bp_waste_types
from routes.waste_dashboard_controller import bp_waste_dashboard
from routes.cooperados_dashboard_controller import bp_cooperados_dashboard
from routes.nip_dashboard_controller import bp_nip_dashboard
from routes.nips_controller import bp_nips
from routes.nip_nature_controller import bp_nip_natures
from routes.nip_status_controller import bp_nip_status

PREFIX = "/dashboard-esg"

def config_all(app):
    config_bps(app)

def config_bps(app):
    app.register_blueprint(bp_render_home, url_prefix=PREFIX)
    app.register_blueprint(bp_render_login, url_prefix=PREFIX)
    app.register_blueprint(bp_render_dashboard, url_prefix=PREFIX)
    app.register_blueprint(bp_render_residuos, url_prefix=PREFIX)
    app.register_blueprint(bp_render_nips, url_prefix=PREFIX)
    app.register_blueprint(bp_auth, url_prefix=PREFIX)
    app.register_blueprint(bp_unit, url_prefix=PREFIX)
    app.register_blueprint(bp_waste_records, url_prefix=PREFIX)
    app.register_blueprint(bp_waste_types, url_prefix=PREFIX)
    app.register_blueprint(bp_waste_dashboard, url_prefix=PREFIX)
    app.register_blueprint(bp_cooperados_dashboard, url_prefix=PREFIX)
    app.register_blueprint(bp_nip_dashboard, url_prefix=PREFIX)
    app.register_blueprint(bp_nips, url_prefix=PREFIX)
    app.register_blueprint(bp_nip_natures, url_prefix=PREFIX)
    app.register_blueprint(bp_nip_status, url_prefix=PREFIX)