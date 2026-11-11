from django.db import IntegrityError
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_handler


class DomainError(Exception):
    def __init__(self, code, message, status_code=409, details=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


def api_exception_handler(exc, context):
    if isinstance(exc, DomainError):
        return Response(
            {"code": exc.code, "message": exc.message, "details": exc.details},
            status=exc.status_code,
        )
    if isinstance(exc, IntegrityError):
        return Response(
            {
                "code": "conflict",
                "message": "Conflit de données.",
                "details": None,
            },
            status=409,
        )

    response = drf_handler(exc, context)
    if response is None:
        return None

    is_validation_error = isinstance(exc, ValidationError)
    response.data = {
        "code": (
            "validation_error"
            if is_validation_error
            else getattr(exc, "default_code", "error")
        ),
        "message": (
            "Données invalides."
            if is_validation_error
            else str(getattr(exc, "detail", "Erreur."))
        ),
        "details": response.data if is_validation_error else None,
    }
    return response
