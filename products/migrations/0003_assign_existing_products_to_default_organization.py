from django.db import migrations


def assign_existing_products_to_default_organization(
    apps,
    schema_editor,
):
    Organization = apps.get_model(
        "core",
        "Organization",
    )

    Category = apps.get_model(
        "products",
        "Category",
    )

    Brand = apps.get_model(
        "products",
        "Brand",
    )

    Product = apps.get_model(
        "products",
        "Product",
    )

    organization = Organization.objects.filter(
        slug="buildops-default"
    ).first()

    if organization is None:
        raise RuntimeError(
            "BuildOps default organization was not found."
        )

    Category.objects.filter(
        organization__isnull=True
    ).update(
        organization=organization
    )

    Brand.objects.filter(
        organization__isnull=True
    ).update(
        organization=organization
    )

    Product.objects.filter(
        organization__isnull=True
    ).update(
        organization=organization
    )


def reverse_assign_existing_products(
    apps,
    schema_editor,
):
    Category = apps.get_model(
        "products",
        "Category",
    )

    Brand = apps.get_model(
        "products",
        "Brand",
    )

    Product = apps.get_model(
        "products",
        "Product",
    )

    Category.objects.update(
        organization=None
    )

    Brand.objects.update(
        organization=None
    )

    Product.objects.update(
        organization=None
    )


class Migration(migrations.Migration):

    dependencies = [
        (
            "products",
            "0002_brand_organization_category_organization_and_more",
        ),
        (
            "core",
            "0005_create_initial_organization",
        ),
    ]

    operations = [
        migrations.RunPython(
            assign_existing_products_to_default_organization,
            reverse_assign_existing_products,
        ),
    ]