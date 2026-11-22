"""
Centralized BuildOps authorization system.

This module is the single source of truth for:
- Organization membership authorization
- Role-based module access
- CRUD permissions
- Sales operational actions
- Aggregate/business intelligence restrictions
- Summary/total visibility flags
- Settings access
- Organization switching prohibition

IMPORTANT:
Backend permissions are the actual security boundary.
Frontend visibility must never be treated as authorization.
"""

from django.contrib.auth.models import User
from rest_framework.permissions import BasePermission


# ============================================================================
# BUILDOPS ROLES
# ============================================================================

ADMIN = "admin"
MANAGER = "manager"
SALES = "sales"
INVENTORY = "inventory"

BUILDOPS_ROLES = (
    ADMIN,
    MANAGER,
    SALES,
    INVENTORY,
)

TOTALS_ALLOWED_ROLES = {
    ADMIN,
    MANAGER,
}


# ============================================================================
# PERMISSION KEYS
# ============================================================================

# General CRUD actions
VIEW = "view"
CREATE = "create"
UPDATE = "update"
DELETE = "delete"

# Special operational actions
COMPLETE = "complete"
PAYMENT = "payment"
RETURN = "return"
APPROVE = "approve"
PAY = "pay"

# Purchase operational actions
ORDER = "order"
RECEIVE = "receive"
CANCEL = "cancel"

# Business intelligence
AGGREGATE = "aggregate"


# ============================================================================
# MODULES
# ============================================================================

DASHBOARD = "dashboard"
REPORTS = "reports"
AI = "ai"
PRODUCTS = "products"
INVENTORY_MODULE = "inventory"
SALES_MODULE = "sales"
PURCHASES = "purchases"
CUSTOMERS = "customers"
SUPPLIERS = "suppliers"
EXPENSES = "expenses"
SETTINGS = "settings"
TEAM = "team"


# ============================================================================
# CENTRAL ROLE PERMISSION MATRIX
# ============================================================================

ROLE_PERMISSIONS = {
    ADMIN: {
        DASHBOARD: {
            VIEW,
        },
        REPORTS: {
            VIEW,
        },
        AI: {
            VIEW,
            CREATE,
            UPDATE,
            DELETE,
        },
        PRODUCTS: {
            VIEW,
            CREATE,
            UPDATE,
            DELETE,
        },
        INVENTORY_MODULE: {
            VIEW,
            CREATE,
            UPDATE,
            DELETE,
        },
        SALES_MODULE: {
            VIEW,
            CREATE,
            UPDATE,
            DELETE,
            COMPLETE,
            PAYMENT,
            RETURN,
            AGGREGATE,
        },
        PURCHASES: {
            VIEW,
            CREATE,
            UPDATE,
            DELETE,
            ORDER,
            RECEIVE,
            PAYMENT,
            CANCEL,
        },
        CUSTOMERS: {
            VIEW,
            CREATE,
            UPDATE,
            DELETE,
        },
        SUPPLIERS: {
            VIEW,
            CREATE,
            UPDATE,
            DELETE,
        },
        EXPENSES: {
            VIEW,
            CREATE,
            UPDATE,
            DELETE,
            APPROVE,
            PAY,
            CANCEL,
        },
        SETTINGS: {
            VIEW,
            UPDATE,
        },
        TEAM: {
            VIEW,
            CREATE,
            UPDATE,
            DELETE,
        },
    },

    MANAGER: {
        AI: {
            VIEW,
            CREATE,
            UPDATE,
            DELETE,
        },
        PRODUCTS: {
            VIEW,
            CREATE,
            UPDATE,
            DELETE,
        },
        INVENTORY_MODULE: {
            VIEW,
            CREATE,
            UPDATE,
            DELETE,
        },
        SALES_MODULE: {
            VIEW,
            CREATE,
            UPDATE,
            DELETE,
            COMPLETE,
            PAYMENT,
            RETURN,
        },
        PURCHASES: {
            VIEW,
            CREATE,
            UPDATE,
            DELETE,
        },
        CUSTOMERS: {
            VIEW,
            CREATE,
            UPDATE,
            DELETE,
        },
        SUPPLIERS: {
            VIEW,
            CREATE,
            UPDATE,
            DELETE,
        },
        EXPENSES: {
            VIEW,
            CREATE,
            UPDATE,
            DELETE,
        },
        SETTINGS: {
            VIEW,
        },
    },

    SALES: {
        PRODUCTS: {
            VIEW,
        },
        INVENTORY_MODULE: {
            VIEW,
        },
        SALES_MODULE: {
            VIEW,
            CREATE,
            UPDATE,
            DELETE,
            COMPLETE,
            PAYMENT,
            RETURN,
        },
        CUSTOMERS: {
            VIEW,
            CREATE,
            UPDATE,
            DELETE,
        },
        SETTINGS: {
            VIEW,
        },
    },

    INVENTORY: {
        PRODUCTS: {
            VIEW,
        },
        INVENTORY_MODULE: {
            VIEW,
        },
        CUSTOMERS: {
            VIEW,
        },
        SETTINGS: {
            VIEW,
        },
    },
}


# ============================================================================
# ROLE RESOLUTION
# ============================================================================

def get_active_organization(user):
    """
    Return the user's currently active organization.

    Authorization is always evaluated against the active organization.
    The legacy UserProfile.role is deliberately ignored.
    """

    if not user or not user.is_authenticated:
        return None

    try:
        profile = user.profile
    except AttributeError:
        return None

    organization = profile.active_organization

    if organization is None:
        return None

    if not organization.is_active:
        return None

    return organization


def get_active_membership(user):
    """
    Return the user's active membership in their active organization.

    Returns None when:
- user is unauthenticated
- no UserProfile exists
- no active organization is selected
- organization is inactive
- user has no active membership
    """

    organization = get_active_organization(user)

    if organization is None:
        return None

    return (
        user.organization_memberships
        .filter(
            organization=organization,
            is_active=True,
        )
        .select_related("organization")
        .first()
    )


def get_user_role(user):
    """
    Return the effective BuildOps role for the current user.

    The role comes ONLY from OrganizationMembership.

    The internal 'owner' role is treated as an administrator for
    authorization purposes, while the normal BuildOps UI continues
    to expose only Admin, Manager, Sales and Inventory.
    """

    membership = get_active_membership(user)

    if membership is None:
        return None

    if membership.role == "owner":
        return ADMIN

    if membership.role in BUILDOPS_ROLES:
        return membership.role

    return None


# ============================================================================
# PERMISSION CHECKING
# ============================================================================

def has_permission(user, module, action=VIEW):
    """
    Check whether a user may perform an action on a BuildOps module.

    Example:

        has_permission(user, "products", "view")
        has_permission(user, "products", "create")
        has_permission(user, "sales", "payment")
    """

    role = get_user_role(user)

    if role is None:
        return False

    permissions = ROLE_PERMISSIONS.get(role, {})
    module_permissions = permissions.get(module, set())

    return action in module_permissions


def can_view(user, module):
    """Check whether a user can view a module."""

    return has_permission(user, module, VIEW)


def can_create(user, module):
    """Check whether a user can create records."""

    return has_permission(user, module, CREATE)


def can_update(user, module):
    """Check whether a user can update records."""

    return has_permission(user, module, UPDATE)


def can_delete(user, module):
    """Check whether a user can delete records."""

    return has_permission(user, module, DELETE)


def can_complete_sale(user):
    """Check whether a user can complete a sale."""

    return has_permission(user, SALES_MODULE, COMPLETE)


def can_process_payment(user):
    """Check whether a user can process a sale payment."""

    return has_permission(user, SALES_MODULE, PAYMENT)


def can_process_return(user):
    """Check whether a user can process a sale return."""

    return has_permission(user, SALES_MODULE, RETURN)


def can_view_sales_aggregates(user):
    """
    Check whether a user can see business-wide sales aggregates.

    Sales staff deliberately do NOT receive this permission.
    They can still see the individual transaction information
    necessary to perform their work.
    """

    return has_permission(user, SALES_MODULE, AGGREGATE)


def can_view_totals(user):
    """
    Check whether a user can see summary/total figures across modules.

    Only admin and manager roles receive summary total visibility;
    sales and inventory roles see operational rows without aggregate totals.
    """

    role = get_user_role(user)
    return role in TOTALS_ALLOWED_ROLES


# ============================================================================
# FRONTEND PERMISSION PAYLOAD
# ============================================================================

def get_user_permissions(user):
    """
    Return a frontend-friendly representation of the user's permissions.

    This allows the frontend to build navigation and action visibility
    from the backend's single source of truth.
    """

    role = get_user_role(user)

    if role is None:
        return {
            "role": None,
            "can_view_totals": False,
            "permissions": {},
        }

    role_permissions = ROLE_PERMISSIONS.get(role, {})

    permissions = {
        module: sorted(actions)
        for module, actions in role_permissions.items()
    }

    return {
        "role": role,
        "can_view_totals": role in TOTALS_ALLOWED_ROLES,
        "permissions": permissions,
    }


# ============================================================================
# DJANGO REST FRAMEWORK PERMISSION CLASS
# ============================================================================

class BuildOpsPermission(BasePermission):
    """
    Generic DRF permission class for BuildOps endpoints.

    A ViewSet can define:

        permission_resource = "products"

    and this class will automatically translate DRF actions:

        list/retrieve       -> view
        create              -> create
        update/partial      -> update
        destroy             -> delete

    Custom actions can define:

        permission_action = "complete"

    when required.
    """

    message = "You do not have permission to perform this action."

    ACTION_MAP = {
        # Standard CRUD
        "list": VIEW,
        "retrieve": VIEW,
        "create": CREATE,
        "update": UPDATE,
        "partial_update": UPDATE,
        "destroy": DELETE,

        # Sales workflows
        "complete": COMPLETE,
        "pay": PAYMENT,
        "return": RETURN,

        # Purchase workflows
        "order": ORDER,
        "receive": RECEIVE,
        "cancel": CANCEL,

        # Expense workflow actions
        "approve": APPROVE,

        "purchase_history": VIEW,
    }

    RESOURCE_ACTION_OVERRIDES = {
        (EXPENSES, "pay"): PAY,
        (SALES_MODULE, "pay"): PAYMENT,
    }

    def _resolve_action(self, view):
        explicit_action = getattr(view, "permission_action", None)
        if explicit_action is not None:
            return explicit_action

        drf_action = getattr(view, "action", None)
        resource = getattr(view, "permission_resource", None)

        if (resource, drf_action) in self.RESOURCE_ACTION_OVERRIDES:
            return self.RESOURCE_ACTION_OVERRIDES[(resource, drf_action)]

        return self.ACTION_MAP.get(drf_action)

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        resource = getattr(view, "permission_resource", None)

        if not resource:
            return False

        action = self._resolve_action(view)

        if action is None:
            return False

        return has_permission(
            user=user,
            module=resource,
            action=action,
        )


# ============================================================================
# SPECIALIZED SALES PERMISSION
# ============================================================================

class SalesOperationalPermission(BasePermission):
    """
    Permission class for custom Sales actions.

    ViewSets can specify:

        permission_action = "complete"
        permission_action = "payment"
        permission_action = "return"
    """

    message = "You do not have permission to perform this sales operation."

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        action = getattr(view, "permission_action", None)

        if action not in {
            COMPLETE,
            PAYMENT,
            RETURN,
        }:
            return False

        return has_permission(
            user=user,
            module=SALES_MODULE,
            action=action,
        )


# ============================================================================
# ORGANIZATION SWITCHING
# ============================================================================

def can_switch_organization(user):
    """
    Organization switching is intentionally disabled.

    BuildOps does not expose organization switching as a user
    capability, including for administrators.

    Users operate only inside their currently active organization.
    """

    return False