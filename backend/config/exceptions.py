"""Gestionnaire d'exceptions DRF partagé.

Sans lui, supprimer un objet encore référencé (un produit déjà vendu, une table
avec une commande…) remontait une ProtectedError non gérée, donc une 500. On la
convertit en 409 avec un message lisible par le caissier.
"""

from django.db.models import ProtectedError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def gestionnaire(exc, context):
    if isinstance(exc, ProtectedError):
        return Response(
            {
                "detail": (
                    "Suppression impossible : cet élément est utilisé dans des "
                    "enregistrements existants (ventes, commandes ou mouvements). "
                    "Désactivez-le plutôt que de le supprimer."
                )
            },
            status=status.HTTP_409_CONFLICT,
        )
    return exception_handler(exc, context)
