from abc import ABC, abstractmethod


class AIProvider(ABC):
    """
    Abstract interface for BuildOps AI providers.

    Any provider connected to BuildOps must accept:
    - the user's question
    - trusted BuildOps context
    - the authenticated user

    It must return a natural-language answer.
    """

    @abstractmethod
    def generate(
        self,
        question: str,
        context: dict,
        user=None,
    ) -> str:
        """
        Generate an AI response using the supplied
        question and BuildOps context.
        """
        raise NotImplementedError