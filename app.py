from flask import Flask

from routes.dynamo import dynamo_bp


app = Flask(__name__)
app.register_blueprint(dynamo_bp, url_prefix="/api")


if __name__ == "__main__":
    app.run()
