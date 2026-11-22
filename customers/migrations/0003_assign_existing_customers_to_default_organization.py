from django.db import migrations


def assign_existing_customers_to_default_organization(apps, schema_editor):
    Organization = apps.get_model("core", "Organization")
    Customer = apps.get_model("customers", "Customer")

    organization = Organization.objects.filter(
        slug="buildops-default"
    ).first()

    if organization is None:
        raise RuntimeError(
            "BuildOps default organization was not found."
        )

    Customer.objects.filter(
        organization__isnull=True
    ).update(
        organization=organization
    )


def reverse_assign_existing_customers(apps, schema_editor):
    Customer = apps.get_model("customers", "Customer")

    Customer.objects.update(
        organization=None
    )


class Migration(migrations.Migration):

    dependencies = [
        (
            "customers",
            "0002_customer_organization_alter_customer_tax_pin_and_more",
        ),
        (
            "core",
            "0005_create_initial_organization",
        ),
    ]

    operations = [
        migrations.RunPython(
            assign_existing_customers_to_default_organization,
            reverse_assign_existing_customers,
        ),
    ]