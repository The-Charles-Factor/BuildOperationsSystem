from django.urls import path

from ai.views import AIAskView


app_name = "ai"


urlpatterns = [
    path(
        "ask/",
        AIAskView.as_view(),
        name="ai-ask",
    ),
]