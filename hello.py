from flask import Flask, render_template


def create_app() -> Flask:
    app = Flask(__name__, static_folder="static", template_folder="templates")


    @app.route("/")
    def landing() -> str:
        return render_template("index.html")


    return app


if __name__ == "__main__":
    create_app().run(debug=True, host="0.0.0.0", port=8000)
