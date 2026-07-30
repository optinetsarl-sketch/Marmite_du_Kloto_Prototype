"""Encodeur JSON étendu pour sérialiser les types MongoDB (ObjectId, Decimal128…)."""

from bson import ObjectId, Decimal128
from rest_framework.utils.encoders import JSONEncoder as DRFJSONEncoder


class MongoJSONEncoder(DRFJSONEncoder):
    """Étend l'encodeur DRF pour gérer les types spécifiques à PyMongo."""

    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, Decimal128):
            return float(obj.to_decimal())
        return super().default(obj)
