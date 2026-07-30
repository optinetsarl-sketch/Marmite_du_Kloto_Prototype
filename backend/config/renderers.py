"""Renderer JSON personnalisé qui injecte MongoJSONEncoder."""

from rest_framework.renderers import JSONRenderer as BaseJSONRenderer

from .encoders import MongoJSONEncoder


class MongoJSONRenderer(BaseJSONRenderer):
    """Remplace l'encodeur DRF par défaut pour gérer ObjectId, Decimal128…"""

    encoder_class = MongoJSONEncoder
