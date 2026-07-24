from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from caisse.views import DepenseViewSet, SessionCaisseViewSet
from catalogue.views import CategorieViewSet, FamilleViewSet, ProduitViewSet
from livraison.views import LivreurViewSet
from rapports import views as rapports
from stock.views import FournisseurViewSet, MouvementStockViewSet
from ventes.views import CommandeViewSet, LigneCommandeViewSet, TableRestoViewSet

from . import auth

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
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
