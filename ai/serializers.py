from rest_framework import serializers


class AIQuestionSerializer(serializers.Serializer):
    """
    Validate incoming BuildOps AI questions.
    """

    question = serializers.CharField(
        min_length=1,
        max_length=4000,
        trim_whitespace=True,
        required=True,
        allow_blank=False,
    )


class AIResponseSerializer(serializers.Serializer):
    """
    Serialize a successful BuildOps AI response.
    """

    question = serializers.CharField(
        read_only=True,
    )

    answer = serializers.CharField(
        read_only=True,
    )

    model = serializers.CharField(
        read_only=True,
    )