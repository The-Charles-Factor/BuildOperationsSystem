from django.db import migrations


def assign_existing_inventory_to_default_organization(apps, schema_editor):
    Organization = apps.get_model("core", "Organization")
    InventoryItem = apps.get_model("inventory", "InventoryItem")
    StockMovement = apps.get_model("inventory", "StockMovement")

    organization = Organization.objects.filter(
        slug="buildops-default"
    ).first()

    if organization is None:
        raise RuntimeError(
            "BuildOps default organization was not found."
        )

    InventoryItem.objects.filter(
        organization__isnull=True
    ).update(
        organization=organization
    )

    StockMovement.objects.filter(
        organization__isnull=True
    ).update(
        organization=organization
    )


def reverse_assign_existing_inventory(apps, schema_editor):
    InventoryItem = apps.get_model("inventory", "InventoryItem")
    StockMovement = apps.get_model("inventory", "StockMovement")

    InventoryItem.objects.update(organization=None)
    StockMovement.objects.update(organization=None)


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0004_alter_inventoryitem_options_and_more"),
        ("core", "0005_create_initial_organization"),
    ]

    operations = [
        migrations.RunPython(
            assign_existing_inventory_to_default_organization,
            reverse_assign_existing_inventory,
        ),
    ] 