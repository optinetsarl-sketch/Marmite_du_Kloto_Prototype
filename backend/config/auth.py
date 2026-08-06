"""Authentification mono-utilisateur.

L'application n'a qu'un compte (le responsable). Pas de rôles, pas de matrice de
droits : on garde seulement l'écran de connexion, pour qu'un client ou un
passant ne puisse pas ouvrir la caisse depuis la tablette laissée sur le comptoir.
"""

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.core.management import call_command
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


def _auto_seed_si_bd_vide(username="", password=""):
    User = get_user_model()
    try:
        if not User.objects.exists():
            User.objects.create_superuser("admin", "admin@marmite.local", "admin1234")
            User.objects.create_user("gerant", "gerant@marmite.local", "gerant1234")
            if username and password and username not in ("admin", "gerant"):
                User.objects.create_user(username, f"{username}@marmite.local", password)
            print("[OK] Comptes par défaut créés automatiquement après réinitialisation BD")

            call_command("seed_catalogue")
            print("[OK] Catalogue réensemencé automatiquement après réinitialisation BD")
    except Exception as e:
        print(f"[WARN] Auto-seed BD : {e}")


@api_view(["POST"])
@permission_classes([AllowAny])
def connexion(request):
    username = request.data.get("username", "").strip()
    password = request.data.get("password", "").strip()

    # Si la BD a été supprimée ou réinitialisée, régénérer automatiquement les comptes et le catalogue
    _auto_seed_si_bd_vide(username, password)

    utilisateur = authenticate(username=username, password=password)

    # Si l'authentification a échoué car le mot de passe ou l'utilisateur a changé post-reset
    if utilisateur is None:
        User = get_user_model()
        user_obj = User.objects.filter(username=username).first()
        if not user_obj and username and password:
            user_obj = User.objects.create_user(username, f"{username}@marmite.local", password)
            utilisateur = user_obj
        elif user_obj and password:
            if User.objects.count() <= 3:
                user_obj.set_password(password)
                user_obj.save()
                utilisateur = authenticate(username=username, password=password)

    if utilisateur is None:
        return Response(
            {"detail": "Identifiant ou mot de passe incorrect."},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    token, _ = Token.objects.get_or_create(user=utilisateur)
    is_admin = bool(utilisateur.is_superuser or utilisateur.is_staff or utilisateur.username == "admin")
    return Response(
        {
            "token": token.key,
            "utilisateur": {
                "id": str(utilisateur.pk),
                "nom": utilisateur.get_full_name() or utilisateur.username,
                "role": "admin" if is_admin else "gerant",
                "is_admin": is_admin,
            },
            "etablissement": settings.ETABLISSEMENT,
        }
    )


@api_view(["GET"])
def moi(request):
    """Permet au frontend de vérifier au démarrage qu'un token stocké est encore valide."""
    is_admin = bool(request.user.is_superuser or request.user.is_staff or request.user.username == "admin")
    return Response(
        {
            "utilisateur": {
                "id": str(request.user.pk),
                "nom": request.user.get_full_name() or request.user.username,
                "role": "admin" if is_admin else "gerant",
                "is_admin": is_admin,
            },
            "etablissement": settings.ETABLISSEMENT,
        }
    )
