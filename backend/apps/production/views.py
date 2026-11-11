from typing import ClassVar

from rest_framework import mixins, status, viewsets
from rest_framework.response import Response

from common.constants import MANAGERS, Role
from common.permissions import RolePermission

from . import services
from .models import ProductionBatch, WasteDeclaration
from .serializers import (
    ProductionBatchCreateSerializer,
    ProductionBatchSerializer,
    ProductionBatchStaffSerializer,
    ProductionBatchUpdateSerializer,
    WasteDeclarationCreateSerializer,
    WasteDeclarationSerializer,
    WasteDeclarationStaffSerializer,
    WasteDeclarationUpdateSerializer,
)

KITCHEN_AND_MANAGERS = {Role.KITCHEN, *MANAGERS}


class ProductionBatchViewSet(viewsets.ModelViewSet):
    queryset = ProductionBatch.objects.all()
    permission_classes: ClassVar = [RolePermission]
    role_map: ClassVar = {
        "list": KITCHEN_AND_MANAGERS,
        "retrieve": KITCHEN_AND_MANAGERS,
        "create": MANAGERS,
        "update": MANAGERS,
        "partial_update": MANAGERS,
    }

    def get_serializer_class(self):
        if self.action == "create":
            return ProductionBatchCreateSerializer
        if self.action in {"update", "partial_update"}:
            return ProductionBatchUpdateSerializer
        if getattr(self.request.user, "role", None) in MANAGERS:
            return ProductionBatchSerializer
        return ProductionBatchStaffSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        batch = services.create_batch(**serializer.validated_data, actor=request.user)
        return Response(
            ProductionBatchSerializer(batch).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        batch = self.get_object()
        serializer = self.get_serializer(batch, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        batch = services.update_batch(
            batch_id=batch.pk,
            changes=serializer.validated_data,
            actor=request.user,
        )
        return Response(ProductionBatchSerializer(batch).data)


class WasteDeclarationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = WasteDeclaration.objects.select_related("batch", "created_by")
    permission_classes: ClassVar = [RolePermission]
    role_map: ClassVar = {
        "list": KITCHEN_AND_MANAGERS,
        "retrieve": KITCHEN_AND_MANAGERS,
        "create": KITCHEN_AND_MANAGERS,
        "update": MANAGERS,
        "partial_update": MANAGERS,
    }

    def get_serializer_class(self):
        if self.action == "create":
            return WasteDeclarationCreateSerializer
        if self.action in {"update", "partial_update"}:
            return WasteDeclarationUpdateSerializer
        if getattr(self.request.user, "role", None) in MANAGERS:
            return WasteDeclarationSerializer
        return WasteDeclarationStaffSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data.copy()
        batch = values.pop("batch")
        declaration = services.declare_waste(
            batch_id=batch.pk,
            **values,
            actor=request.user,
        )
        return Response(
            self._output_serializer(declaration).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        declaration = self.get_object()
        serializer = self.get_serializer(
            declaration, data=request.data, partial=partial
        )
        serializer.is_valid(raise_exception=True)
        declaration = services.update_waste_declaration(
            declaration_id=declaration.pk,
            changes=serializer.validated_data,
            actor=request.user,
        )
        return Response(self._output_serializer(declaration).data)

    def _output_serializer(self, instance):
        serializer_class = (
            WasteDeclarationSerializer
            if self.request.user.role in MANAGERS
            else WasteDeclarationStaffSerializer
        )
        return serializer_class(instance)
