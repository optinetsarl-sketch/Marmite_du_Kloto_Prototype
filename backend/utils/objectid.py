def to_str(value):
    """Return a string representation of a primary key (ObjectId or otherwise).
    If the value is already a string or an int, it will be converted to string as well.
    """
    return str(value)
