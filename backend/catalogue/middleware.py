import json
from datetime import datetime
from django.utils import timezone
from django.http import JsonResponse
from catalogue.models import Configuration

# La date limite : Samedi 29 Août 2026 à 12h00
TARGET_DATE = datetime(2026, 8, 29, 12, 0, 0)
SECRET_KEY = "KLOTO-PAY-2026"

class LicenseMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Ne pas bloquer la route d'activation elle-même, l'authentification, ni les requêtes statiques
        if request.path.startswith('/api/activate-license/') or request.path.startswith('/api/auth/') or request.path.startswith('/static/'):
            return self.get_response(request)

        # Si on n'est pas sur une API, on laisse passer
        if not request.path.startswith('/api/'):
            return self.get_response(request)

        # Vérifier si on est déjà activé
        try:
            config = Configuration.objects.filter(cle='is_activated').first()
            if config and config.valeur == 'true':
                return self.get_response(request)
        except Exception:
            pass

        # Vérifier l'heure de l'ordinateur
        now = datetime.now()
        is_expired = now >= TARGET_DATE

        # Anti-triche : si l'ordinateur est avant la date cible, on vérifie si la dernière vente est APRÈS la date cible
        if not is_expired:
            try:
                from ventes.models import Commande
                last_vente = Commande.objects.order_by('-ouverte_le').first()
                if last_vente and last_vente.ouverte_le:
                    if last_vente.ouverte_le.replace(tzinfo=None) >= TARGET_DATE:
                        is_expired = True
            except Exception:
                pass

        if is_expired:
            return JsonResponse({'error': 'Licence expirée'}, status=402)

        return self.get_response(request)
