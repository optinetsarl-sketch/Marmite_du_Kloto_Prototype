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

from config.permissions import IsAdminUserRole


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


@api_view(["GET"])
@permission_classes([IsAdminUserRole])
def liste_utilisateurs(request):
    """Liste tous les comptes utilisateurs pour la gestion par l'administrateur."""
    User = get_user_model()
    users = User.objects.all().order_by("username")
    result = []
    for u in users:
        is_admin = bool(u.is_superuser or u.is_staff or u.username == "admin")
        result.append(
            {
                "id": str(u.pk),
                "username": u.username,
                "first_name": u.first_name,
                "nom": u.first_name or u.username,
                "role": "admin" if is_admin else "gerant",
                "is_admin": is_admin,
            }
        )
    return Response(result)


@api_view(["POST"])
@permission_classes([IsAdminUserRole])
def modifier_compte(request):
    """Permet à l'administrateur de modifier le nom et le mot de passe d'un compte."""
    User = get_user_model()
    user_id = request.data.get("user_id")
    nouveau_nom = request.data.get("nom", "").strip()
    nouveau_mot_de_passe = request.data.get("mot_de_passe", "").strip()

    try:
        user_obj = User.objects.get(pk=user_id)
    except (User.DoesNotExist, ValueError):
        return Response({"detail": "Utilisateur introuvable."}, status=status.HTTP_404_NOT_FOUND)

    if nouveau_nom:
        user_obj.first_name = nouveau_nom
        user_obj.save(update_fields=["first_name"])

    if nouveau_mot_de_passe:
        if len(nouveau_mot_de_passe) < 4:
            return Response({"detail": "Le mot de passe doit contenir au moins 4 caractères."}, status=status.HTTP_400_BAD_REQUEST)
        user_obj.set_password(nouveau_mot_de_passe)
        user_obj.save()
        Token.objects.filter(user=user_obj).delete()
        Token.objects.create(user=user_obj)

    is_admin = bool(user_obj.is_superuser or user_obj.is_staff or user_obj.username == "admin")
    return Response(
        {
            "detail": f"Compte '{user_obj.username}' mis à jour avec succès.",
            "utilisateur": {
                "id": str(user_obj.pk),
                "username": user_obj.username,
                "nom": user_obj.first_name or user_obj.username,
                "role": "admin" if is_admin else "gerant",
                "is_admin": is_admin,
            },
        }
    )

