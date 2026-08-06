from rest_framework.permissions import BasePermission

class IsAdminUserRole(BasePermission):
    """
    Permission DRF exigeant que l'utilisateur soit un administrateur (is_superuser, is_staff, ou username == 'admin').
    """
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (request.user.is_superuser or request.user.is_staff or request.user.username == "admin")
        )
