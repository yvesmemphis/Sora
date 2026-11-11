from rest_framework.permissions import BasePermission


class RolePermission(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        role_map = getattr(view, "role_map", {})
        allowed_roles = role_map.get(
            getattr(view, "action", None), role_map.get("*", set())
        )
        return request.user.is_active and request.user.role in allowed_roles
