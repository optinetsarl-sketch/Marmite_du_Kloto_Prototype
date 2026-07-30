"""Utilitaires pour la gestion des dates et plages horaires dans MongoDB.

django-mongodb-backend ne supporte pas TruncDate (ex: champ__date ou champ__date__range)
avec un fuseau horaire défini. On convertit donc les dates en plages de datetime
conscientes du fuseau horaire (du début à la fin de la journée).
"""

import datetime
from django.utils import timezone


def date_range(debut, fin=None):
    """Renvoie un tuple (start_dt, end_dt) pour filtrer un DateTimeField avec __range."""
    if isinstance(debut, str):
        debut = datetime.date.fromisoformat(debut)
    elif isinstance(debut, datetime.datetime):
        debut = debut.date()
    if fin is None:
        fin = debut
    elif isinstance(fin, str):
        fin = datetime.date.fromisoformat(fin)
    elif isinstance(fin, datetime.datetime):
        fin = fin.date()
    start_dt = timezone.make_aware(datetime.datetime.combine(debut, datetime.time.min))
    end_dt = timezone.make_aware(datetime.datetime.combine(fin, datetime.time.max))
    return start_dt, end_dt
