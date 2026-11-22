from django.contrib.auth.models import User
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils.text import slugify

# team member 
from django.contrib.auth.password_validation import validate_password
from rest_framework.exceptions import PermissionDenied

from rest_framework import permissions, status, serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import get_user_permissions

from core.models import Organization, OrganizationMembership
from core.tenant import (
    MultipleOrganizationsError,
    NoOrganizationError,
    get_current_organization,
    get_user_organizations,
)

from .models import UserProfile
from .serializers import (
    MeSerializer,
    OrganizationMembershipSerializer,
    OrganizationSelectionSerializer,
    RegistrationSerializer,
    TeamMemberCreateSerializer,
    TeamMemberUpdateSerializer,
    UserProfileSerializer,
    UserSerializer,
)


class RegisterView(APIView):
    """
    Public registration endpoint.

    Creates:
    - User
    - UserProfile
    - Organization
    - OrganizationMembership with Admin role

    The newly registered user becomes the administrator
    of the organization they created.
    """

    permission_classes = [permissions.AllowAny]

    @transaction.atomic
    def post(self, request):
        serializer = RegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data

        # Generate a unique organization slug.
        base_slug = slugify(data["business_name"])

        if not base_slug:
            base_slug = "organization"

        slug = base_slug
        counter = 2

        while Organization.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1

        # Create the user.
        user = User.objects.create_user(
            username=data["username"],
            email=data["email"],
            password=data["password"],
            first_name=data["first_name"],
            last_name=data["last_name"],
        )

        # Create the organization.
        organization = Organization.objects.create(
            name=data["business_name"],
            slug=slug,
            business_type=data.get("business_type", ""),
            phone=data.get("business_phone", ""),
            email=data.get("business_email", ""),
            address=data.get("address", ""),
            city=data.get("city", ""),
            country=data.get("country", "Kenya"),
            currency=data.get("currency", "KES"),
            timezone=data.get("timezone", "Africa/Nairobi"),
        )

        # Create the user's global profile.
        profile = UserProfile.objects.create(
            user=user,
            phone=data["phone"],
            active_organization=organization,
        )

        # Make the registering user the organization's Admin.
        membership = OrganizationMembership.objects.create(
            organization=organization,
            user=user,
            role="admin",
            is_active=True,
        )

        return Response(
            {
                "detail": "BuildOps account created successfully.",
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "email": user.email,
                },
                "organization": {
                    "id": organization.id,
                    "name": organization.name,
                    "slug": organization.slug,
                    "role": membership.role,
                },
            },
            status=status.HTTP_201_CREATED,
        )



class MeView(APIView):
    """
    Return the authenticated user's account and organization context.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile, _ = UserProfile.objects.get_or_create(
            user=request.user,
            defaults={
                "phone": "",
            },
        )

        memberships = (
            OrganizationMembership.objects.filter(
                user=request.user,
                is_active=True,
                organization__is_active=True,
            )
            .select_related("organization")
            .order_by("organization__name")
        )

        try:
            current_organization = get_current_organization(
                request.user
            )
        except (
            NoOrganizationError,
            MultipleOrganizationsError,
        ):
            current_organization = None

        serializer = MeSerializer(
            {
                "user": request.user,
                "profile": profile,
                "organizations": memberships,
                "current_organization": current_organization,
            },
            context={"request": request},
        )

        return Response(serializer.data)


class MyPermissionsView(APIView):
    """
    Return the authenticated user's effective BuildOps role
    and permissions for the frontend.

    Permissions come from OrganizationMembership through the
    centralized accounts.permissions module.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(
            get_user_permissions(request.user),
            status=status.HTTP_200_OK,
        )

    

class MyOrganizationsView(APIView):
    """
    Return all active organizations accessible to the user.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        memberships = (
            OrganizationMembership.objects.filter(
                user=request.user,
                is_active=True,
                organization__is_active=True,
            )
            .select_related("organization")
            .order_by("organization__name")
        )

        serializer = OrganizationMembershipSerializer(
            memberships,
            many=True,
        )

        return Response(serializer.data)


class SelectOrganizationView(APIView):
    """
    Select the active organization for the authenticated user.

    The organization ID is accepted only as a selection request.
    Membership is verified server-side before saving it.
    """

    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        serializer = OrganizationSelectionSerializer(
            data=request.data,
            context={"request": request},
        )

        serializer.is_valid(raise_exception=True)

        organization = serializer.validated_data["organization"]

        profile, _ = UserProfile.objects.get_or_create(
            user=request.user,
            defaults={
                "phone": "",
            },
        )

        profile.active_organization = organization

        profile.save(
            update_fields=[
                "active_organization",
                "updated_at",
            ]
        )

        return Response(
            {
                "detail": "Organization selected successfully.",
                "organization": {
                    "id": organization.id,
                    "name": organization.name,
                    "slug": organization.slug,
                },
            },
            status=status.HTTP_200_OK,
        )


class MyProfileView(APIView):
    """
    Read and update global user profile information.

    Organization role is intentionally not editable here.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get_profile(self, user):
        profile, _ = UserProfile.objects.get_or_create(
            user=user,
            defaults={
                "phone": "",
            },
        )

        return profile

    def get(self, request):
        profile = self.get_profile(request.user)

        return Response(
            UserProfileSerializer(profile).data
        )

    @transaction.atomic
    def patch(self, request):
        profile = self.get_profile(request.user)

        serializer = UserProfileSerializer(
            profile,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data)


class TeamMembersView(APIView):
    """
    Manage users belonging to the authenticated user's
    current organization.

    Only organization owners and admins may manage team members.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get_current_membership(self, user, organization):
        return OrganizationMembership.objects.filter(
            user=user,
            organization=organization,
            is_active=True,
            organization__is_active=True,
        ).first()

    def require_manager(self, request):
        organization = get_current_organization(request.user)

        membership = self.get_current_membership(
            request.user,
            organization,
        )

        if membership is None:
            raise PermissionDenied(
                "You do not have an active membership in this organization."
            )

        if membership.role not in ["owner", "admin"]:
            raise PermissionDenied(
                "Only organization owners and admins can manage team members."
            )

        return organization, membership

    def serialize_membership(self, membership):
        profile, _ = UserProfile.objects.get_or_create(
            user=membership.user,
            defaults={"phone": ""},
        )

        return {
            "id": membership.id,
            "user": UserSerializer(membership.user).data,
            "profile": UserProfileSerializer(profile).data,
            "role": membership.role,
            "is_active": membership.is_active,
            "created_at": membership.created_at,
            "updated_at": membership.updated_at,
        }

    def get(self, request):
        organization, _ = self.require_manager(request)

        memberships = (
            OrganizationMembership.objects
            .filter(
                organization=organization,
            )
            .select_related("user")
            .order_by(
                "-is_active",
                "user__first_name",
                "user__last_name",
                "user__username",
            )
        )

        return Response(
            [
                self.serialize_membership(membership)
                for membership in memberships
            ]
        )

    @transaction.atomic
    def post(self, request):
        organization, manager_membership = self.require_manager(
            request
        )

        serializer = TeamMemberCreateSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        requested_role = data["role"]

        # Admins cannot create other admins.
        if (
            manager_membership.role == "admin"
            and requested_role == "admin"
        ):
            raise PermissionDenied(
                "Only the organization owner can create another admin."
            )

        user = User.objects.create_user(
            username=data["username"],
            email=data["email"],
            password=data["password"],
            first_name=data["first_name"],
            last_name=data["last_name"],
        )

        profile = UserProfile.objects.create(
            user=user,
            phone=data["phone"],
            employee_id=data.get("employee_id"),
            department=data.get("department", ""),
            active_organization=organization,
        )

        membership = OrganizationMembership.objects.create(
            organization=organization,
            user=user,
            role=requested_role,
            is_active=True,
        )

        return Response(
            self.serialize_membership(membership),
            status=status.HTTP_201_CREATED,
        )


class TeamMemberDetailView(APIView):
    """
    Update or deactivate a team member belonging to
    the authenticated user's current organization.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get_current_membership(self, user, organization):
        return OrganizationMembership.objects.filter(
            user=user,
            organization=organization,
            is_active=True,
            organization__is_active=True,
        ).first()

    def require_manager(self, request):
        organization = get_current_organization(request.user)

        membership = self.get_current_membership(
            request.user,
            organization,
        )

        if membership is None:
            raise PermissionDenied(
                "You do not have an active membership in this organization."
            )

        if membership.role not in ["owner", "admin"]:
            raise PermissionDenied(
                "Only organization owners and admins can manage team members."
            )

        return organization, membership

    def get_target_membership(self, organization, membership_id):
        return get_object_or_404(
            OrganizationMembership.objects.select_related("user"),
            id=membership_id,
            organization=organization,
        )

    def serialize_membership(self, membership):
        profile, _ = UserProfile.objects.get_or_create(
            user=membership.user,
            defaults={"phone": ""},
        )

        return {
            "id": membership.id,
            "user": UserSerializer(membership.user).data,
            "profile": UserProfileSerializer(profile).data,
            "role": membership.role,
            "is_active": membership.is_active,
            "created_at": membership.created_at,
            "updated_at": membership.updated_at,
        }

    @transaction.atomic
    def patch(self, request, membership_id):
        organization, manager_membership = self.require_manager(
            request
        )

        target = self.get_target_membership(
            organization,
            membership_id,
        )

        # Nobody can modify the owner through team management.
        if target.role == "owner":
            raise PermissionDenied(
                "The organization owner cannot be modified from team management."
            )

        
#! | Only an admin (or legacy owner) can manage team members. |
        if manager_membership.role not in {"admin", "owner"}:
            raise PermissionDenied(
                "Only administrators can manage team members."
            )

        serializer = TeamMemberUpdateSerializer(
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data

        requested_role = data.get(
            "role",
            target.role,
        )
        requested_active = data.get(
            "is_active",
            target.is_active,
        )

        # Prevent an admin from deactivating their own membership.
        if target.user_id == request.user.id and requested_active is False:
            raise PermissionDenied(
                "You cannot deactivate your own administrator account."
            )

        # Prevent removing the last active administrator from the organization.
        if (
            target.role in {"admin", "owner"}
            and (requested_role not in {"admin", "owner"} or requested_active is False)
        ):
            has_other_admin = (
                OrganizationMembership.objects.filter(
                    organization=target.organization,
                    role__in=["admin", "owner"],
                    is_active=True,
                )
                .exclude(id=target.id)
                .exists()
            )
            if not has_other_admin:
                raise PermissionDenied(
                    "At least one active administrator must remain in the organization."
                )

            
        user = target.user

        if "first_name" in data:
            user.first_name = data["first_name"]

        if "last_name" in data:
            user.last_name = data["last_name"]

        if "email" in data:
            email_exists = User.objects.filter(
                email__iexact=data["email"]
            ).exclude(
                id=user.id
            ).exists()

            if email_exists:
                raise serializers.ValidationError(
                    {
                        "email": "This email is already in use."
                    }
                )

            user.email = data["email"]

        user.save()

        profile, _ = UserProfile.objects.get_or_create(
            user=user,
            defaults={"phone": ""},
        )

        if "phone" in data:
            phone_exists = UserProfile.objects.filter(
                phone=data["phone"]
            ).exclude(
                user=user
            ).exists()

            if phone_exists:
                raise serializers.ValidationError(
                    {
                        "phone": "This phone number is already associated with another account."
                    }
                )

            profile.phone = data["phone"]

        if "employee_id" in data:
            employee_id = data["employee_id"]

            if employee_id:
                employee_id_exists = UserProfile.objects.filter(
                    employee_id=employee_id
                ).exclude(
                    user=user
                ).exists()

                if employee_id_exists:
                    raise serializers.ValidationError(
                        {
                            "employee_id": "This employee ID is already in use."
                        }
                    )

            profile.employee_id = employee_id

        if "department" in data:
            profile.department = data["department"]

        profile.active_organization = organization

        profile.save()

        if "role" in data:
            target.role = requested_role

        if "is_active" in data:
            target.is_active = data["is_active"]

        target.save()

        return Response(
            self.serialize_membership(target),
            status=status.HTTP_200_OK,
        )