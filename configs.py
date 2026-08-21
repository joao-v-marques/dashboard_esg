from routes.render_pages.render_home import bp_render_home
from routes.render_pages.render_login import bp_render_login
from routes.render_pages.render_dashboard import bp_render_dashboard
from routes.render_pages.render_residuos import bp_render_residuos
from routes.render_pages.render_nips import bp_render_nips
from routes.render_pages.render_lawsuits import bp_render_lawsuits

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
from routes.subject_matters_controller import bp_subject_matters
from routes.proceeding_stages_controller import bp_proceeding_stages
from routes.lawsuit_status_controller import bp_lawsuit_status
from routes.loss_probabilities_controller import bp_loss_probabilities
from routes.judging_bodies_controller import bp_judging_bodies
from routes.lawsuits_controller import bp_lawsuits
from routes.lawsuit_appeals_controller import bp_lawsuit_appeals

PREFIX = "/dashboard-esg"

def config_all(app):
    config_bps(app)

def config_bps(app):
    app.register_blueprint(bp_render_home, url_prefix=PREFIX)
    app.register_blueprint(bp_render_login, url_prefix=PREFIX)
    app.register_blueprint(bp_render_dashboard, url_prefix=PREFIX)
    app.register_blueprint(bp_render_residuos, url_prefix=PREFIX)
    app.register_blueprint(bp_render_nips, url_prefix=PREFIX)
    app.register_blueprint(bp_render_lawsuits, url_prefix=PREFIX)
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
    app.register_blueprint(bp_subject_matters, url_prefix=PREFIX)
    app.register_blueprint(bp_proceeding_stages, url_prefix=PREFIX)
    app.register_blueprint(bp_lawsuit_status, url_prefix=PREFIX)
    app.register_blueprint(bp_loss_probabilities, url_prefix=PREFIX)
    app.register_blueprint(bp_judging_bodies, url_prefix=PREFIX)
    app.register_blueprint(bp_lawsuits, url_prefix=PREFIX)
    app.register_blueprint(bp_lawsuit_appeals, url_prefix=PREFIX)