from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.shortcuts import render
from django.http import HttpResponse
from rest_framework.routers import DefaultRouter

from caisse.views import DepenseViewSet, SessionCaisseViewSet
from catalogue.views import CategorieViewSet, FamilleViewSet, ProduitViewSet
from livraison.views import LivreurViewSet
from rapports import views as rapports
from stock.views import FournisseurViewSet, MouvementStockViewSet
from ventes.views import CommandeViewSet, LigneCommandeViewSet, TableRestoViewSet

from . import auth

from pathlib import Path
import sys
from django.views.static import serve

def get_frontend_dist():
    dist = settings.BASE_DIR / "frontend_dist"
    if not dist.exists() and getattr(sys, "frozen", False):
        dist = Path(sys.executable).parent / "_internal" / "backend" / "frontend_dist"
    return dist

def assets_view(request, path):
    dist = get_frontend_dist()
    return serve(request, path, document_root=dist / "assets")

def spa_view(request):
    dist = get_frontend_dist()
    rel_path = request.path.lstrip("/")
    if rel_path:
        requested_file = dist / rel_path
        if requested_file.is_file():
            return serve(request, rel_path, document_root=dist)
    index_file = dist / "index.html"
    if index_file.exists():
        return HttpResponse(index_file.read_text(encoding="utf-8"), content_type="text/html; charset=utf-8")
    try:
        return render(request, "index.html")
    except Exception:
        return HttpResponse("<h1>La Marmite du Kloto — Serveur actif</h1><p>Le frontend n'est pas encore compile. En dev, utilisez Vite sur http://localhost:5173.</p>")

router = DefaultRouter()
router.register("familles", FamilleViewSet)
router.register("categories", CategorieViewSet)
router.register("produits", ProduitViewSet)
router.register("tables", TableRestoViewSet)
router.register("commandes", CommandeViewSet)
router.register("lignes", LigneCommandeViewSet)
router.register("mouvements-stock", MouvementStockViewSet)
router.register("fournisseurs", FournisseurViewSet)
router.register("depenses", DepenseViewSet)
router.register("sessions-caisse", SessionCaisseViewSet)
router.register("livreurs", LivreurViewSet)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
    path("api/auth/login/", auth.connexion),
    path("api/auth/moi/", auth.moi),
    path("api/rapports/tableau-de-bord/", rapports.tableau_de_bord),
    path("api/rapports/bar/", rapports.rapport_bar),
    path("api/rapports/cuisine/", rapports.rapport_cuisine),
    path("api/rapports/livraisons/", rapports.rapport_livraisons),
    path("api/rapports/depenses/", rapports.rapport_depenses),
    path("api/rapports/revenus/", rapports.rapport_revenus),
    path("api/rapports/produits/", rapports.rapport_produits),
    path("api/rapports/cloture/", rapports.rapport_cloture),
    path("api/rapports/historique/", rapports.historique),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

urlpatterns += [
    re_path(r"^assets/(?P<path>.*)$", assets_view),
    re_path(r"^.*$", spa_view),
]

