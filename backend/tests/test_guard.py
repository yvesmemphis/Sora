def iter_views(patterns):
    for pattern in patterns:
        if hasattr(pattern, "url_patterns"):
            yield from iter_views(pattern.url_patterns)
            continue
        view_class = getattr(pattern.callback, "cls", None) or getattr(
            pattern.callback, "view_class", None
        )
        if view_class:
            yield view_class


def test_every_app_view_is_protected_or_explicitly_public():
    from apps.core.views import SettingsViewSet
    from common.permissions import RolePermission
    from config.urls import urlpatterns

    for view_class in iter_views(urlpatterns):
        if not view_class.__module__.startswith("apps."):
            continue
        protected = RolePermission in getattr(view_class, "permission_classes", [])
        explicitly_public = getattr(view_class, "public", False)
        authentication_view = getattr(view_class, "auth_view", False)
        assert protected or explicitly_public or authentication_view, (
            f"{view_class.__name__} n'est pas protégée"
        )

    assert SettingsViewSet in list(iter_views(urlpatterns))
