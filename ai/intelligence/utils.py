from datetime import date


MAX_LIMIT = 100


def validate_date_range(date_from=None, date_to=None):
    if date_from and not isinstance(date_from, date):
        date_from = date.fromisoformat(str(date_from))

    if date_to and not isinstance(date_to, date):
        date_to = date.fromisoformat(str(date_to))

    if date_from and date_to and date_from > date_to:
        raise ValueError(
            "date_from cannot be later than date_to."
        )

    return date_from, date_to


def validate_limit(limit, default=10):
    if limit is None:
        return default

    limit = int(limit)

    if limit < 1:
        raise ValueError(
            "limit must be greater than zero."
        )

    return min(limit, MAX_LIMIT)