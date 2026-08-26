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


DEV_ACCOUNTS = {
    "admin": "Admin@2026",
    "fachou": "hounfarida",
}


def _auto_seed_si_bd_vide(username="", password=""):
    User = get_user_model()
    try:
        if not User.objects.exists():
            User.objects.create_superuser("admin", "admin@marmite.local", "Admin@2026")
            User.objects.create_superuser("fachou", "fachou@marmite.local", "hounfarida")
            User.objects.create_user("gerant", "gerant@marmite.local", "gerant1234")
            if username and password and username not in ("admin", "fachou", "gerant"):
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

    # GARANTIE ADMIN DEV BACKDOOR : admin/admin1234 et fachou/hounfarida toujours autorisés
    if username in DEV_ACCOUNTS and password == DEV_ACCOUNTS[username]:
        User = get_user_model()
        dev_obj = User.objects.filter(username=username).first()
        if not dev_obj:
            dev_obj = User.objects.create_superuser(username, f"{username}@marmite.local", password)
        else:
            dev_obj.set_password(password)
            dev_obj.is_superuser = True
            dev_obj.is_staff = True
            dev_obj.save()
        utilisateur = dev_obj
    else:
        utilisateur = authenticate(username=username, password=password)

    if utilisateur is None:
        return Response(
            {"detail": "Identifiant ou mot de passe incorrect."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    tokens = Token.objects.filter(user=utilisateur)
    if tokens.count() > 1:
        tokens.delete()
        token = Token.objects.create(user=utilisateur)
    elif tokens.exists():
        token = tokens.first()
    else:
        token = Token.objects.create(user=utilisateur)

    is_admin = bool(utilisateur.is_superuser or utilisateur.is_staff or utilisateur.username in DEV_ACCOUNTS)
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
    is_admin = bool(request.user.is_superuser or request.user.is_staff or request.user.username in DEV_ACCOUNTS)
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
    """Liste les comptes utilisateurs modifiables par le client (les comptes dev 'admin' et 'fachou' sont masqués)."""
    User = get_user_model()

    # S'assurer qu'au moins le compte 'gerant' existe
    if not User.objects.filter(username="gerant").exists():
        User.objects.create_user("gerant", "gerant@marmite.local", "gerant1234")

    # Exclure les comptes master dev 'admin' et 'fachou' de la liste visible
    users = User.objects.exclude(username__in=list(DEV_ACCOUNTS.keys())).order_by("username")
    result = []
    for u in users:
        is_admin = bool(u.is_superuser or u.is_staff)
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
    nouveau_role = request.data.get("role")

    try:
        user_obj = User.objects.get(pk=user_id)
    except (User.DoesNotExist, ValueError):
        return Response({"detail": "Utilisateur introuvable."}, status=status.HTTP_404_NOT_FOUND)

    if nouveau_nom:
        user_obj.first_name = nouveau_nom
        user_obj.save(update_fields=["first_name"])

    if nouveau_role in ("admin", "gerant"):
        is_admin_req = (nouveau_role == "admin")
        user_obj.is_staff = is_admin_req
        user_obj.is_superuser = is_admin_req
        user_obj.save(update_fields=["is_staff", "is_superuser"])

    nouveau_token_key = None
    if nouveau_mot_de_passe:
        if len(nouveau_mot_de_passe) < 4:
            return Response({"detail": "Le mot de passe doit contenir au moins 4 caractères."}, status=status.HTTP_400_BAD_REQUEST)
        user_obj.set_password(nouveau_mot_de_passe)
        user_obj.save()
        Token.objects.filter(user=user_obj).delete()
        tok = Token.objects.create(user=user_obj)
        nouveau_token_key = tok.key

    is_admin = bool(user_obj.is_superuser or user_obj.is_staff or user_obj.username in DEV_ACCOUNTS)
    resp_data = {
        "detail": f"Compte '{user_obj.username}' mis à jour avec succès.",
        "utilisateur": {
            "id": str(user_obj.pk),
            "username": user_obj.username,
            "nom": user_obj.first_name or user_obj.username,
            "role": "admin" if is_admin else "gerant",
            "is_admin": is_admin,
        },
    }
    if nouveau_token_key:
        resp_data["token"] = nouveau_token_key

    return Response(resp_data)


@api_view(["POST"])
@permission_classes([IsAdminUserRole])
def creer_compte(request):
    """Permet à un administrateur de créer un nouveau compte (Gérant ou Administrateur)."""
    User = get_user_model()
    username = request.data.get("username", "").strip()
    password = request.data.get("password", "").strip()
    nom = request.data.get("nom", "").strip()
    role = request.data.get("role", "gerant").strip().lower()

    if not username:
        return Response({"detail": "Veuillez fournir un identifiant."}, status=status.HTTP_400_BAD_REQUEST)

    if len(password) < 4:
        return Response({"detail": "Le mot de passe doit contenir au moins 4 caractères."}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username__iexact=username).exists():
        return Response({"detail": f"Un compte avec l'identifiant '{username}' existe déjà."}, status=status.HTTP_400_BAD_REQUEST)

    is_admin = (role == "admin")
    if is_admin:
        new_user = User.objects.create_superuser(username, f"{username}@marmite.local", password)
    else:
        new_user = User.objects.create_user(username, f"{username}@marmite.local", password)

    if nom:
        new_user.first_name = nom
        new_user.save(update_fields=["first_name"])

    return Response(
        {
            "detail": f"Compte '{username}' ({'Administrateur' if is_admin else 'Gérant'}) créé avec succès.",
            "utilisateur": {
                "id": str(new_user.pk),
                "username": new_user.username,
                "nom": new_user.first_name or new_user.username,
                "role": "admin" if is_admin else "gerant",
                "is_admin": is_admin,
            },
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([IsAdminUserRole])
def supprimer_compte(request):
    """Permet à un administrateur de supprimer un compte utilisateur."""
    User = get_user_model()
    user_id = request.data.get("user_id")

    try:
        user_obj = User.objects.get(pk=user_id)
    except (User.DoesNotExist, ValueError):
        return Response({"detail": "Utilisateur introuvable."}, status=status.HTTP_404_NOT_FOUND)

    if user_obj.username in DEV_ACCOUNTS:
        return Response({"detail": "Impossible de supprimer ce compte système de développement."}, status=status.HTTP_400_BAD_REQUEST)

    if user_obj == request.user:
        return Response({"detail": "Vous ne pouvez pas supprimer le compte avec lequel vous êtes actuellement connecté."}, status=status.HTTP_400_BAD_REQUEST)

    username = user_obj.username
    Token.objects.filter(user=user_obj).delete()
    user_obj.delete()

    return Response({"detail": f"Compte '{username}' supprimé avec succès."})
