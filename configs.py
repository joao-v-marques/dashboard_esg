from routes.render_pages.render_home import bp_render_home
from routes.render_pages.render_login import bp_render_login

PREFIX = "/dashboard-esg"

def config_all(app):
    config_bps(app)

def config_bps(app):
    app.register_blueprint(bp_render_home, url_prefix=PREFIX)
    app.register_blueprint(bp_render_login, url_prefix=PREFIX)