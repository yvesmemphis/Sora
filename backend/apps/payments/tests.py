from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.accounts.factories import UserFactory
from apps.orders.models import Order, OrderStatusHistory
from common.constants import OrderStatus, Role
from common.exceptions import DomainError

from .models import Payment, Refund
from .services import net_paid, refund_payment, register_payment

pytestmark = pytest.mark.django_db


def make_order(*, owner=None, total="10.00", status=OrderStatus.SERVED):
    return Order.objects.create(
        created_by=owner,
        total=Decimal(total),
        status=status,
    )


def test_payment_rejects_overpayment_and_settles_served_order():
    waiter = UserFactory(role=Role.WAITER)
    order = make_order(owner=waiter)

    with pytest.raises(DomainError) as error:
        register_payment(
            order=order,
            amount="10.01",
            payment_method="espece",
            user=waiter,
        )
    assert error.value.code == "overpayment"

    payment = register_payment(
        order=order,
        amount="10.00",
        payment_method="espece",
        user=waiter,
    )

    order.refresh_from_db()
    assert payment.status == "CONFIRMED"
    assert order.status == OrderStatus.COMPLETED
    assert OrderStatusHistory.objects.filter(
        order=order,
        from_status=OrderStatus.SERVED,
        to_status=OrderStatus.COMPLETED,
    ).exists()


def test_net_paid_only_subtracts_completed_refunds():
    order = make_order()
    payment = Payment.objects.create(
        order=order,
        amount=Decimal("10.00"),
        status="CONFIRMED",
        payment_method="card",
    )
    refund = Refund.objects.create(
        payment=payment,
        amount=Decimal("3.00"),
        reason="Test",
        status="PROCESSING",
    )

    assert net_paid(order) == Decimal("10.00")
    refund.status = "COMPLETED"
    refund.save(update_fields=["status"])
    assert net_paid(order) == Decimal("7.00")


def test_refund_amount_is_reserved_and_cannot_exceed_payment():
    manager = UserFactory(role=Role.MANAGER)
    payment = Payment.objects.create(
        order=make_order(),
        amount=Decimal("10.00"),
        status="CONFIRMED",
        payment_method="card",
    )
    refund_payment(payment=payment, amount="7.00", user=manager, reason="Demande")

    with pytest.raises(DomainError) as error:
        refund_payment(
            payment=payment,
            amount="4.00",
            user=manager,
            reason="Deuxième demande",
        )
    assert error.value.code == "refund_limit_exceeded"


def test_kitchen_cannot_list_or_create_payments():
    client = APIClient()
    client.force_authenticate(UserFactory(role=Role.KITCHEN))
    order = make_order()

    response = client.get(f"/api/v1/orders/{order.pk}/payments/")

    assert response.status_code == 403


def test_waiter_payment_response_does_not_expose_amount_or_card_data():
    waiter = UserFactory(role=Role.WAITER)
    client = APIClient()
    client.force_authenticate(waiter)
    order = make_order(owner=waiter)

    response = client.post(
        f"/api/v1/orders/{order.pk}/payments/",
        {"amount": "10.00", "payment_method": "espece"},
        format="json",
    )

    assert response.status_code == 201
    assert "amount" not in response.json()
    assert "card_last_four" not in response.json()


def test_manager_refund_request_and_processing_are_audited():
    manager = UserFactory(role=Role.MANAGER)
    payment = Payment.objects.create(
        order=make_order(total="10.00"),
        amount=Decimal("10.00"),
        status="CONFIRMED",
        payment_method="card",
    )
    client = APIClient()
    client.force_authenticate(manager)

    created = client.post(
        f"/api/v1/payments/{payment.pk}/refunds/",
        {"amount": "10.00", "reason": "Commande annulée"},
        format="json",
    )

    assert created.status_code == 201
    refund_id = created.json()["id"]
    assert created.json()["status"] == "PROCESSING"
    processed = client.post(
        f"/api/v1/refunds/{refund_id}/process/",
        {"status": "COMPLETED"},
        format="json",
    )

    assert processed.status_code == 200
    payment.refresh_from_db()
    assert payment.status == "REFUNDED"
    assert net_paid(payment.order) == Decimal("0.00")


def test_waiter_cannot_request_refund():
    waiter = UserFactory(role=Role.WAITER)
    payment = Payment.objects.create(
        order=make_order(owner=waiter),
        amount=Decimal("10.00"),
        status="CONFIRMED",
        payment_method="card",
    )
    client = APIClient()
    client.force_authenticate(waiter)

    response = client.post(
        f"/api/v1/payments/{payment.pk}/refunds/",
        {"reason": "Request"},
        format="json",
    )

    assert response.status_code == 403
