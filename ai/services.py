import logging
from django.utils import timezone

from core.tenant import (
    get_current_organization,
)

from ai.providers.base import AIProvider
from ai.tools.registry import (
    can_use_tool,
    get_tool,
    get_tools_for_user,
)

logger = logging.getLogger(__name__)

MAX_QUESTION_LENGTH = 4000


class AIService:
    """
    Application-level service for BuildOps AI operations.

    Tenancy is resolved by the application from the authenticated
    user's organization membership. The AI model never selects
    the organization.
    """

    def __init__(
        self,
        provider: AIProvider | None = None,
    ):
        if provider is None:
            from ai.providers.openai_provider import OpenAIProvider

            provider = OpenAIProvider()

        self.provider = provider

    def get_organization(self, user):
        if user is None or not user.is_authenticated:
            raise PermissionError(
                "An authenticated user is required."
            )

        return get_current_organization(user)

    def available_tools(
        self,
        user=None,
        organization=None,
    ):
        if user is None:
            return []

        if organization is None:
            organization = self.get_organization(user)

        return get_tools_for_user(
            user,
            organization,
        )

    def execute_tool(
        self,
        tool_name,
        parameters=None,
        user=None,
        organization=None,
    ):
        """
        Execute a registered AI intelligence tool.

        The organization is resolved by the application and
        injected into the tool. It can never be supplied by
        the AI model or API client.
        """

        if user is None or not user.is_authenticated:
            raise PermissionError(
                "An authenticated user is required."
            )

        if organization is None:
            organization = self.get_organization(user)

        clean_parameters = {
            k: v
            for k, v in dict(parameters or {}).items()
            if k not in {"organization", "organization_id", "user"}
            and not isinstance(v, bool)
        }

        tool = get_tool(tool_name)

        if not can_use_tool(
            user,
            organization,
            tool_name,
        ):
            raise PermissionError(
                f"You do not have permission to use "
                f"the '{tool_name}' tool."
            )

        try:
            return tool["function"](
                organization=organization,
                **clean_parameters,
            )
        except AttributeError as exc:
            if "resolve_expression" in str(exc):
                logger.exception(
                    "Invalid ORM expression in AI tool '%s' for org %s",
                    tool_name,
                    organization.id,
                )
                raise RuntimeError(
                    f"Query expression error while running '{tool_name}'."
                ) from exc
            raise

    def build_context(
        self,
        user=None,
        organization=None,
        context=None,
    ):
        """
        Build trusted application context.

        Organization information comes from the authenticated
        user's membership, never from the user's question.
        """

        extra_context = dict(context or {})

        if user is not None:
            if organization is None:
                organization = self.get_organization(user)

        now = timezone.localtime()

        business_context = {
            "country": "Kenya",
            "currency": "KES",
            "currency_symbol": "KSh",
            "timezone": "Africa/Nairobi",
            "current_date": now.date().isoformat(),
            "current_datetime": now.isoformat(),
        }

        if organization is not None:
            business_context["organization"] = {
                "id": organization.id,
                "name": organization.name,
                "slug": organization.slug,
                "business_type": organization.business_type,
                "city": organization.city,
                "country": organization.country,
                "currency": organization.currency,
                "timezone": organization.timezone,
            }

        if user is not None:
            business_context["authenticated_user"] = {
                "id": user.id,
                "username": user.username,
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser,
                "groups": list(
                    user.groups.values_list(
                        "name",
                        flat=True,
                    )
                ),
            }

        business_context.update(extra_context)

        return business_context

    def answer(
        self,
        question: str,
        context=None,
        user=None,
        organization=None,
    ):
        """
        Process a user's AI question within the current organization.
        """

        if self.provider is None:
            raise RuntimeError(
                "No AI provider has been configured."
            )

        if user is None or not user.is_authenticated:
            raise PermissionError(
                "An authenticated user is required."
            )

        if organization is None:
            organization = self.get_organization(user)

        if not isinstance(question, str):
            raise ValueError(
                "Question must be a string."
            )

        question = question.strip()

        if not question:
            raise ValueError(
                "A non-empty question is required."
            )

        if len(question) > MAX_QUESTION_LENGTH:
            raise ValueError(
                "The question is too long. "
                f"Maximum length is {MAX_QUESTION_LENGTH} characters."
            )

        built_context = self.build_context(
            user=user,
            organization=organization,
            context=context,
        )

        return self.provider.generate(
            question=question,
            context=built_context,
            user=user,
            organization=organization,
        )