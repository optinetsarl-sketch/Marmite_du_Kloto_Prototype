"""Authentification mono-utilisateur.

L'application n'a qu'un compte (le responsable). Pas de rôles, pas de matrice de
droits : on garde seulement l'écran de connexion, pour qu'un client ou un
passant ne puisse pas ouvrir la caisse depuis la tablette laissée sur le comptoir.
"""

from django.conf import settings
from django.contrib.auth import authenticate
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["POST"])
@permission_classes([AllowAny])
def connexion(request):
    utilisateur = authenticate(
        username=request.data.get("username", ""),
        password=request.data.get("password", ""),
    )
    if utilisateur is None:
        return Response(
            {"detail": "Identifiant ou mot de passe incorrect."},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    token, _ = Token.objects.get_or_create(user=utilisateur)
    return Response(
        {
            "token": token.key,
            "utilisateur": {"id": utilisateur.pk, "nom": utilisateur.get_full_name() or utilisateur.username},
            "etablissement": settings.ETABLISSEMENT,
        }
    )


@api_view(["GET"])
def moi(request):
    """Permet au frontend de vérifier au démarrage qu'un token stocké est encore valide."""
    return Response(
        {
            "utilisateur": {
                "id": request.user.pk,
                "nom": request.user.get_full_name() or request.user.username,
            },
            "etablissement": settings.ETABLISSEMENT,
        }
    )
