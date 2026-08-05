import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from ventes.models import Commande
from livraison.models import Livreur

print("=== Livreurs ===")
for l in Livreur.objects.all():
    print(f"  {l.nom} | actif={l.actif}")

print("\n=== Commandes livraison ===")
for c in Commande.objects.filter(type='livraison'):
    print(f"  client={c.client_nom} | statut={c.statut} | livreur_id={c.livreur_id}")
