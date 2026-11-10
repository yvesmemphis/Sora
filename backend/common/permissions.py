from rest_framework.permissions import BasePermission


class RolePermission(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        allowed_roles = getattr(view, "role_map", {}).get(
            getattr(view, "action", None), set()
        )
        return request.user.is_active and request.user.role in allowed_roles
