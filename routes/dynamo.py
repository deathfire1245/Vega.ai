import boto3
from flask import Blueprint, jsonify, request


dynamo_bp = Blueprint("dynamo", __name__)


@dynamo_bp.route("/dynamo/campaign", methods=["POST"])
def create_campaign():
    try:
        item = request.get_json()
        table = boto3.resource("dynamodb", region_name="eu-north-1").Table("vega-campaigns")
        table.put_item(Item=item)
        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
