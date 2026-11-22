from django.urls import path

from .views import (
    MeView,
    MyOrganizationsView,
    MyProfileView,
    RegisterView,
    MyPermissionsView,
    TeamMemberDetailView,
    TeamMembersView,
)


urlpatterns = [
    path(
        "register/",
        RegisterView.as_view(),
        name="account-register",
    ),

    path(
        "me/",
        MeView.as_view(),
        name="account-me",
    ),

    path(
        "me/profile/",
        MyProfileView.as_view(),
        name="account-profile",
    ),

    path(
        "me/organizations/",
        MyOrganizationsView.as_view(),
        name="account-organizations",
    ),

    path(
        "me/permissions/",
        MyPermissionsView.as_view(),
        name="account-permissions",
    ),

    path(
        "team/",
        TeamMembersView.as_view(),
        name="team-members",
    ),

    path(
        "team/<int:membership_id>/",
        TeamMemberDetailView.as_view(),
        name="team-member-detail",
    ),
]