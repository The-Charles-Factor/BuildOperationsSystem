from django.db import migrations


def create_initial_organization(apps, schema_editor):
    Organization = apps.get_model(
        "core",
        "Organization",
    )
    OrganizationMembership = apps.get_model(
        "core",
        "OrganizationMembership",
    )
    User = apps.get_model(
        "auth",
        "User",
    )

    # The default organization must always exist, including in
    # fresh test databases where no users exist yet.
    organization, _ = Organization.objects.get_or_create(
        slug="buildops-default",
        defaults={
            "name": "BuildOps Default Business",
            "business_type": "General Business",
            "country": "Kenya",
            "currency": "KES",
            "timezone": "Africa/Nairobi",
        },
    )

    # In an existing installation, attach the first superuser
    # to the default organization as its owner.
    user = (
        User.objects
        .filter(is_superuser=True)
        .order_by("id")
        .first()
    )

    if user is not None:
        OrganizationMembership.objects.get_or_create(
            organization=organization,
            user=user,
            defaults={
                "role": "owner",
                "is_active": True,
            },
        )


def reverse_initial_organization(apps, schema_editor):
    Organization = apps.get_model(
        "core",
        "Organization",
    )

    Organization.objects.filter(
        slug="buildops-default"
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        (
            "core",
            "0004_organization_organizationmembership_and_more",
        ),
    ]

    operations = [
        migrations.RunPython(
            create_initial_organization,
            reverse_initial_organization,
        ),
    ]