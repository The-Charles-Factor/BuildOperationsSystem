from django.db import migrations


def assign_existing_suppliers_to_default_organization(apps, schema_editor):
    Organization = apps.get_model("core", "Organization")
    Supplier = apps.get_model("suppliers", "Supplier")

    organization = Organization.objects.filter(
        slug="buildops-default"
    ).first()

    if organization is None:
        raise RuntimeError(
            "BuildOps default organization was not found."
        )

    Supplier.objects.filter(
        organization__isnull=True
    ).update(
        organization=organization
    )


def reverse_assign_existing_suppliers(apps, schema_editor):
    Supplier = apps.get_model("suppliers", "Supplier")

    Supplier.objects.update(
        organization=None
    )


class Migration(migrations.Migration):

    dependencies = [
        (
            "suppliers",
            "0002_alter_supplier_options_supplier_organization_and_more",
        ),
        (
            "core",
            "0005_create_initial_organization",
        ),
    ]

    operations = [
        migrations.RunPython(
            assign_existing_suppliers_to_default_organization,
            reverse_assign_existing_suppliers,
        ),
    ]