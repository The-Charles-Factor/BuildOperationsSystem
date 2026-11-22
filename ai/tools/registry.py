from core.tenant import get_user_membership

from ai.intelligence.customer_insights import (
    get_customer_insights,
)
from ai.intelligence.customers import (
    get_customer_receivables,
)
from ai.intelligence.expenses import (
    get_expenses_summary,
)
from ai.intelligence.inventory import (
    get_inventory_overview,
    get_inventory_risk,
)
from ai.intelligence.products import (
    get_product_profitability,
)
from ai.intelligence.returns import (
    get_returns_analysis,
)
from ai.intelligence.sales import (
    get_sales_performance,
    get_top_selling_products,
)
from ai.intelligence.suppliers import (
    get_supplier_payables,
)

from ai.intelligence.purchases import (
    get_purchases_overview,
)


ROLE_ACCESS = {
    "sales": {
        "sales_performance",
        "top_selling_products",
        "product_profitability",
        "returns_analysis",
        "customer_receivables",
        "customer_insights",
    },
    "inventory": {
        "top_selling_products",
        "product_profitability",
        "inventory_overview",
        "inventory_risk",
        "returns_analysis",
        "supplier_payables",
    },
    "manager": {
        "sales_performance",
        "top_selling_products",
        "product_profitability",
        "returns_analysis",
        "expenses_summary",
        "inventory_overview",
        "inventory_risk",
        "customer_receivables",
        "customer_insights",
        "supplier_payables",
    },
    "admin": {
        "sales_performance",
        "top_selling_products",
        "product_profitability",
        "returns_analysis",
        "expenses_summary",
        "inventory_overview",
        "inventory_risk",
        "customer_receivables",
        "customer_insights",
        "supplier_payables",
    },
    "owner": {
        "sales_performance",
        "top_selling_products",
        "product_profitability",
        "returns_analysis",
        "expenses_summary",
        "inventory_overview",
        "inventory_risk",
        "customer_receivables",
        "customer_insights",
        "supplier_payables",
    },
}


def get_membership(user, organization):
    if not user or not user.is_authenticated:
        return None

    return get_user_membership(
        user,
        organization,
    )


def can_use_tool(user, organization, tool_name):
    membership = get_membership(
        user,
        organization,
    )

    if membership is None:
        return False

    allowed_tools = ROLE_ACCESS.get(
        membership.role,
        set(),
    )

    return tool_name in allowed_tools


def can_view_sales(user, organization):
    return can_use_tool(
        user,
        organization,
        "sales_performance",
    )


def can_view_products(user, organization):
    return (
        can_use_tool(
            user,
            organization,
            "top_selling_products",
        )
        or can_use_tool(
            user,
            organization,
            "product_profitability",
        )
    )


def can_view_inventory(user, organization):
    return can_use_tool(
        user,
        organization,
        "inventory_overview",
    )


def can_view_customers(user, organization):
    return (
        can_use_tool(
            user,
            organization,
            "customer_receivables",
        )
        or can_use_tool(
            user,
            organization,
            "customer_insights",
        )
    )


def can_view_suppliers(user, organization):
    return can_use_tool(
        user,
        organization,
        "supplier_payables",
    )


TOOLS = {
    "sales_performance": {
        "description": (
            "Returns completed sales count, revenue, amount collected, "
            "and outstanding customer receivables for a date range."
        ),
        "function": get_sales_performance,
    },
    "top_selling_products": {
        "description": (
            "Returns products ranked by quantity sold and sales value "
            "for completed sales."
        ),
        "function": get_top_selling_products,
    },
    "product_profitability": {
        "description": (
            "Calculates product revenue, cost of goods sold, gross profit, "
            "and gross margin using completed sales and current product cost."
        ),
        "function": get_product_profitability,
    },
    "returns_analysis": {
        "description": (
            "Returns customer return counts by status, total refunded value, "
            "common return reasons, and most-returned products."
        ),
        "function": get_returns_analysis,
    },
    "expenses_summary": {
        "description": (
            "Returns business expense totals by status, category, "
            "payment method, and recent expense records."
        ),
        "function": get_expenses_summary,
    },
    "inventory_overview": {
        "description": (
            "Returns inventory item count, total quantity, inventory value, "
            "low-stock count, and out-of-stock count."
        ),
        "function": get_inventory_overview,
    },
    "inventory_risk": {
        "description": (
            "Returns each active inventory item and classifies its stock "
            "condition as healthy, low_stock, or out_of_stock."
        ),
        "function": get_inventory_risk,
    },
    "customer_receivables": {
        "description": (
            "Returns customers with outstanding receivables "
            "from completed sales."
        ),
        "function": get_customer_receivables,
    },
    "customer_insights": {
        "description": (
            "Returns customer counts by status and type, top customers by "
            "completed purchase value, credit limits, and balances."
        ),
        "function": get_customer_insights,
    },
    "supplier_payables": {
        "description": (
            "Returns suppliers with outstanding purchase payables."
        ),
        "function": get_supplier_payables,
    },

    "purchases_overview": {
        "description": (
            "Returns purchase order totals by status and payment status, "
            "ordered vs. received quantities, top suppliers, and recent POs."
        ),
        "function": get_purchases_overview,
    },
}


def get_tool(name):
    try:
        return TOOLS[name]
    except KeyError as exc:
        raise ValueError(
            f"Unknown AI tool: {name}"
        ) from exc


def list_tools():
    return [
        {
            "name": name,
            "description": tool["description"],
        }
        for name, tool in TOOLS.items()
    ]


def get_tools_for_user(
    user,
    organization,
):
    return [
        {
            "name": name,
            "description": tool["description"],
        }
        for name, tool in TOOLS.items()
        if can_use_tool(
            user,
            organization,
            name,
        )
    ]


def get_openai_tools(
    user=None,
    organization=None,
):
    if user is None or organization is None:
        return []

    allowed = {
        name: tool
        for name, tool in TOOLS.items()
        if can_use_tool(
            user,
            organization,
            name,
        )
    }

    date_properties = {
        "date_from": {
            "type": ["string", "null"],
            "description": (
                "Start date in YYYY-MM-DD format, or null "
                "for no start date."
            ),
        },
        "date_to": {
            "type": ["string", "null"],
            "description": (
                "End date in YYYY-MM-DD format, or null "
                "for no end date."
            ),
        },
    }

    limit_property = {
        "type": ["integer", "null"],
        "description": (
            "Maximum number of results, or null "
            "to use the default."
        ),
    }

    schemas = {
        "sales_performance": {
            "properties": date_properties,
            "required": [
                "date_from",
                "date_to",
            ],
        },
        "top_selling_products": {
            "properties": {
                **date_properties,
                "limit": limit_property,
            },
            "required": [
                "date_from",
                "date_to",
                "limit",
            ],
        },
        "product_profitability": {
            "properties": {
                **date_properties,
                "limit": limit_property,
            },
            "required": [
                "date_from",
                "date_to",
                "limit",
            ],
        },
        "returns_analysis": {
            "properties": {
                **date_properties,
                "limit": limit_property,
            },
            "required": [
                "date_from",
                "date_to",
                "limit",
            ],
        },
        "expenses_summary": {
            "properties": {
                **date_properties,
                "limit": limit_property,
            },
            "required": [
                "date_from",
                "date_to",
                "limit",
            ],
        },
        "inventory_overview": {
            "properties": {},
            "required": [],
        },
        "inventory_risk": {
            "properties": {},
            "required": [],
        },
        "customer_receivables": {
            "properties": {
                **date_properties,
                "limit": limit_property,
            },
            "required": [
                "date_from",
                "date_to",
                "limit",
            ],
        },
        "customer_insights": {
            "properties": {
                **date_properties,
                "limit": limit_property,
            },
            "required": [
                "date_from",
                "date_to",
                "limit",
            ],
        },
        "supplier_payables": {
            "properties": {
                **date_properties,
                "limit": limit_property,
            },
            "required": [
                "date_from",
                "date_to",
                "limit",
            ],
        },
    }

    tools = []

    for name, tool in allowed.items():
        schema = schemas[name]

        tools.append(
            {
                "type": "function",
                "function": {
                    "name": name,
                    "description": tool["description"],
                    "parameters": {
                        "type": "object",
                        "properties": schema["properties"],
                        "required": schema["required"],
                        "additionalProperties": False,
                    },
                },
            }
        )

    return tools