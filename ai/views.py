import logging

from django.conf import settings

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.tenant import (
    MultipleOrganizationsError,
    NoOrganizationError,
)

from ai.providers.openai_provider import OpenAIProvider
from ai.serializers import (
    AIQuestionSerializer,
    AIResponseSerializer,
)
from ai.services import AIService


logger = logging.getLogger(__name__)


class AIAskView(APIView):
    """
    Authenticated, organization-scoped BuildOps AI endpoint.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AIQuestionSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        question = serializer.validated_data["question"]

        try:
            provider = OpenAIProvider()

            service = AIService(
                provider=provider
            )

            organization = service.get_organization(
                request.user
            )

            answer = service.answer(
                question=question,
                context={},
                user=request.user,
                organization=organization,
            )

            response_data = {
                "question": question,
                "answer": answer,
                "model": (
                    getattr(settings, "GROQ_MODEL", "")
                    or getattr(settings, "OPENAI_MODEL", "")
                    or "openai/gpt-oss-20b"
                ),
            }

            response_serializer = AIResponseSerializer(
                response_data
            )

            return Response(
                response_serializer.data,
                status=status.HTTP_200_OK,
            )

        except (
            NoOrganizationError,
            MultipleOrganizationsError,
        ) as exc:
            return Response(
                {
                    "detail": str(exc)
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        except PermissionError as exc:
            return Response(
                {
                    "detail": str(exc)
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        except ValueError as exc:
            return Response(
                {
                    "detail": str(exc)
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        except RuntimeError as exc:
            logger.exception(
                "BuildOps AI request failed."
            )

            return Response(
                {
                    "detail": str(exc)
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )