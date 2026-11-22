from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.utils.text import slugify

from rest_framework import serializers

from core.models import Organization, OrganizationMembership
from .models import UserProfile

from accounts.permissions import get_user_permissions

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
        ]
        read_only_fields = fields


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = [
            "phone",
            "employee_id",
            "department",
            "active_organization",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "active_organization",
            "created_at",
            "updated_at",
        ]


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "slug",
            "business_type",
            "phone",
            "email",
            "address",
            "city",
            "country",
            "currency",
            "timezone",
            "is_active",
        ]
        read_only_fields = fields


class OrganizationMembershipSerializer(serializers.ModelSerializer):
    organization = OrganizationSerializer(read_only=True)

    class Meta:
        model = OrganizationMembership
        fields = [
            "id",
            "organization",
            "role",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class MeSerializer(serializers.Serializer):
    user = UserSerializer(read_only=True)
    profile = UserProfileSerializer(read_only=True)
    organizations = OrganizationMembershipSerializer(
        many=True,
        read_only=True,
    )
    current_organization = OrganizationSerializer(
        read_only=True,
        allow_null=True,
    )
    role = serializers.SerializerMethodField()
    can_view_totals = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    def _get_perms_payload(self):
        cache_attr = "_cached_perms_payload"
        if not hasattr(self, cache_attr):
            request = self.context.get("request")
            user = getattr(request, "user", None)
            setattr(self, cache_attr, get_user_permissions(user))
        return getattr(self, cache_attr)

    def get_role(self, obj):
        return self._get_perms_payload()["role"]

    def get_can_view_totals(self, obj):
        return self._get_perms_payload()["can_view_totals"]

    def get_permissions(self, obj):
        return self._get_perms_payload()["permissions"]


class OrganizationSelectionSerializer(serializers.Serializer):
    organization_id = serializers.PrimaryKeyRelatedField(
        queryset=Organization.objects.filter(is_active=True),
        source="organization",
    )

    def validate_organization(self, organization):
        user = self.context["request"].user

        membership_exists = OrganizationMembership.objects.filter(
            user=user,
            organization=organization,
            is_active=True,
            organization__is_active=True,
        ).exists()

        if not membership_exists:
            raise serializers.ValidationError(
                "You do not have an active membership in this organization."
            )

        return organization


class RegistrationSerializer(serializers.Serializer):
    """
    Public registration serializer.

    Creates the first BuildOps administrator for a new organization.
    """

    # Organization information
    business_name = serializers.CharField(
        max_length=200,
    )
    business_type = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
    )
    business_phone = serializers.CharField(
        max_length=30,
        required=False,
        allow_blank=True,
    )
    business_email = serializers.EmailField(
        required=False,
        allow_blank=True,
    )
    address = serializers.CharField(
        required=False,
        allow_blank=True,
    )
    city = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
    )
    country = serializers.CharField(
        max_length=100,
        default="Kenya",
    )
    currency = serializers.CharField(
        max_length=10,
        default="KES",
    )
    timezone = serializers.CharField(
        max_length=50,
        default="Africa/Nairobi",
    )

    # First administrator information
    first_name = serializers.CharField(
        max_length=150,
    )
    last_name = serializers.CharField(
        max_length=150,
    )
    username = serializers.CharField(
        max_length=150,
    )
    email = serializers.EmailField()
    phone = serializers.CharField(
        max_length=20,
    )
    password = serializers.CharField(
        write_only=True,
        min_length=8,
    )
    confirm_password = serializers.CharField(
        write_only=True,
    )

    def validate_business_name(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Business name is required."
            )

        if Organization.objects.filter(name__iexact=value).exists():
            raise serializers.ValidationError(
                "A business with this name already exists."
            )

        return value

    def validate_username(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Username is required."
            )

        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError(
                "This username is already in use."
            )

        return value

    def validate_email(self, value):
        value = value.strip().lower()

        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )

        return value

    def validate_phone(self, value):
        value = value.strip()

        if UserProfile.objects.filter(phone=value).exists():
            raise serializers.ValidationError(
                "This phone number is already associated with an account."
            )

        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {
                    "confirm_password": "Passwords do not match."
                }
            )

        return attrs

    def validate_slug(self, slug):
        return slug

    def create(self, validated_data):
        raise NotImplementedError(
            "Registration is created by RegisterView."
        )


class MyProfileSerializer(UserProfileSerializer):
    pass



class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
        ]
        read_only_fields = [
            "id",
            "username",
        ]

# {*/ Team member serializer /*}

class TeamMemberSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)

    user = UserSerializer(read_only=True)
    profile = UserProfileSerializer(read_only=True)

    role = serializers.CharField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)

    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)


class TeamMemberCreateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20)

    employee_id = serializers.CharField(
        max_length=30,
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    department = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
    )

    role = serializers.ChoiceField(
        choices=[
            ("admin", "Admin"),
            ("manager", "Manager"),
            ("sales", "Sales"),
            ("inventory", "Inventory"),
        ]
    )

    password = serializers.CharField(
        write_only=True,
        min_length=8,
    )

    confirm_password = serializers.CharField(
        write_only=True,
    )

    def validate_username(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Username is required."
            )

        if User.objects.filter(
            username__iexact=value
        ).exists():
            raise serializers.ValidationError(
                "This username is already in use."
            )

        return value

    def validate_email(self, value):
        value = value.strip().lower()

        if User.objects.filter(
            email__iexact=value
        ).exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )

        return value

    def validate_phone(self, value):
        value = value.strip()

        if UserProfile.objects.filter(
            phone=value
        ).exists():
            raise serializers.ValidationError(
                "This phone number is already associated with an account."
            )

        return value

    def validate_employee_id(self, value):
        if value is None:
            return None

        value = value.strip()

        if not value:
            return None

        if UserProfile.objects.filter(
            employee_id=value
        ).exists():
            raise serializers.ValidationError(
                "This employee ID is already in use."
            )

        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {
                    "confirm_password": "Passwords do not match."
                }
            )

        return attrs


class TeamMemberUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(
        max_length=150,
        required=False,
    )

    last_name = serializers.CharField(
        max_length=150,
        required=False,
    )

    email = serializers.EmailField(
        required=False,
    )

    phone = serializers.CharField(
        max_length=20,
        required=False,
    )

    employee_id = serializers.CharField(
        max_length=30,
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    department = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
    )

    role = serializers.ChoiceField(
        choices=[
            ("admin", "Admin"),
            ("manager", "Manager"),
            ("sales", "Sales"),
            ("inventory", "Inventory"),
        ],
        required=False,
    )

    is_active = serializers.BooleanField(
        required=False,
    )

    def validate_email(self, value):
        return value.strip().lower()

    def validate_phone(self, value):
        return value.strip()

    def validate_employee_id(self, value):
        if value is None:
            return None

        value = value.strip()

        return value or None