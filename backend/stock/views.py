from django.db import transaction
from django.utils import timezone
from catalogue.models import Produit
from config.permissions import IsAdminUserRole
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from .models import Fournisseur, LigneInventaire, MouvementStock, SessionInventaire
from .serializers import (
    FournisseurSerializer,
    InventaireSerializer,
    LigneInventaireSerializer,
    MouvementStockSerializer,
    ReceptionSerializer,
    SessionInventaireListSerializer,
    SessionInventaireSerializer,
    SortieSerializer,
)


class FournisseurViewSet(viewsets.ModelViewSet):
    queryset = Fournisseur.objects.all()
    serializer_class = FournisseurSerializer
    search_fields = ["nom"]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAdminUserRole()]
        return super().get_permissions()


class MouvementStockViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MouvementStock.objects.select_related("produit", "fournisseur").order_by("-cree_le", "-id")
    serializer_class = MouvementStockSerializer
    filterset_fields = ["produit", "motif"]

    @action(detail=False, methods=["post"], permission_classes=[IsAdminUserRole])
    @transaction.atomic
    def reception(self, request):
        entree = ReceptionSerializer(data=request.data)
        entree.is_valid(raise_exception=True)
        donnees = entree.validated_data

        fournisseur_nom = donnees.get("fournisseur")
        fournisseur = None
        if fournisseur_nom and isinstance(fournisseur_nom, str) and fournisseur_nom.strip():
            fournisseur, _ = Fournisseur.objects.get_or_create(nom=fournisseur_nom.strip())

        produit = donnees["produit"]
        prix = donnees.get("prix_unitaire")
        if donnees.get("maj_prix_vente") and prix:
            produit.prix_standard = prix
            produit.save(update_fields=["prix_standard"])

        mouvement = MouvementStock.objects.create(
            produit=produit,
            motif=MouvementStock.MOTIF_RECEPTION,
            quantite=donnees["quantite"],
            prix_unitaire=prix,
            fournisseur=fournisseur,
        )
        return Response(
            MouvementStockSerializer(mouvement).data, status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=["post"], permission_classes=[IsAdminUserRole])
    def inventaire(self, request):
        entree = InventaireSerializer(data=request.data)
        entree.is_valid(raise_exception=True)
        produit = entree.validated_data["produit"]
        ecart = entree.validated_data["stock_reel"] - MouvementStock.stock_de(produit)
        if ecart == 0:
            return Response(
                {"detail": "Le stock compté correspond déjà au stock théorique.", "ecart": 0}
            )
        mouvement = MouvementStock.objects.create(
            produit=produit,
            motif=MouvementStock.MOTIF_INVENTAIRE,
            quantite=ecart,
            commentaire=entree.validated_data["commentaire"],
        )
        return Response(
            MouvementStockSerializer(mouvement).data, status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=["post"], permission_classes=[IsAdminUserRole])
    def sortie(self, request):
        entree = SortieSerializer(data=request.data)
        entree.is_valid(raise_exception=True)
        donnees = entree.validated_data
        mouvement = MouvementStock.objects.create(
            produit=donnees["produit"],
            motif=donnees["motif"],
            quantite=-donnees["quantite"],
            commentaire=donnees["commentaire"],
        )
        return Response(
            MouvementStockSerializer(mouvement).data, status=status.HTTP_201_CREATED
        )


class SessionInventaireViewSet(viewsets.ModelViewSet):
    queryset = SessionInventaire.objects.all().order_by("-date", "-cree_le")

    def get_serializer_class(self):
        if self.action == "list":
            return SessionInventaireListSerializer
        return SessionInventaireSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy", "valider", "annuler", "sauvegarder_brouillon"]:
            return [IsAdminUserRole()]
        return super().get_permissions()

    @action(detail=False, methods=["get"])
    def brouillon_en_cours(self, request):
        """Vérifie s'il existe une session en brouillon non terminée."""
        brouillon = SessionInventaire.objects.filter(statut=SessionInventaire.STATUT_BROUILLON).first()
        if not brouillon:
            return Response({"brouillon": None})
        return Response({"brouillon": SessionInventaireSerializer(brouillon).data})

    def create(self, request, *args, **kwargs):
        """Démarrer une nouvelle session d'inventaire officiel.

        Vérifie d'abord qu'aucun brouillon n'est en cours.
        Initialise toutes les lignes pour tous les produits gérant le stock.
        """
        brouillon_existant = SessionInventaire.objects.filter(statut=SessionInventaire.STATUT_BROUILLON).first()
        if brouillon_existant:
            return Response(
                {"detail": "Une session d'inventaire est déjà en cours d'exécution.", "brouillon_id": brouillon_existant.id},
                status=status.HTTP_400_BAD_REQUEST
            )

        date_inventaire = request.data.get("date") or timezone.now().strftime("%Y-%m-%d")
        motif = request.data.get("motif") or f"Inventaire du {date_inventaire}"

        with transaction.atomic():
            session = SessionInventaire.objects.create(
                date=date_inventaire,
                motif=motif,
                statut=SessionInventaire.STATUT_BROUILLON
            )

            # Charger les stocks actuels de tous les produits gérant le stock
            stocks = MouvementStock.stocks_par_produit()
            produits = Produit.objects.filter(gere_stock=True, actif=True).select_related("categorie")

            lignes = [
                LigneInventaire(
                    session=session,
                    produit=p,
                    stock_theorique=stocks.get(p.pk, 0),
                    stock_physique=None
                )
                for p in produits
            ]
            LigneInventaire.objects.bulk_create(lignes)

        return Response(SessionInventaireSerializer(session).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def sauvegarder_brouillon(self, request, pk=None):
        """Sauvegarde progressive des comptages physiques sans valider."""
        session = self.get_object()
        if session.statut != SessionInventaire.STATUT_BROUILLON:
            return Response({"detail": "Impossible de modifier une session qui n'est plus en brouillon."}, status=status.HTTP_400_BAD_REQUEST)

        saisies = request.data.get("saisies", [])
        # Format attendu: list of { ligne_id/produit_id, stock_physique }
        with transaction.atomic():
            for el in saisies:
                valeur = el.get("stock_physique")
                valeur_int = int(valeur) if valeur is not None and str(valeur).strip() != "" else None
                if el.get("ligne_id"):
                    LigneInventaire.objects.filter(id=el["ligne_id"], session=session).update(stock_physique=valeur_int)
                elif el.get("produit_id"):
                    LigneInventaire.objects.filter(produit_id=el["produit_id"], session=session).update(stock_physique=valeur_int)

        session.refresh_from_db()
        return Response(SessionInventaireSerializer(session).data)

    @action(detail=True, methods=["post"])
    def valider(self, request, pk=None):
        """Validation finale et définitive de l'inventaire.

        Applique tous les écarts en MouvementStock de façon atomique.
        """
        session = self.get_object()
        if session.statut != SessionInventaire.STATUT_BROUILLON:
            return Response({"detail": "Seule une session en brouillon peut être validée."}, status=status.HTTP_400_BAD_REQUEST)

        # Mettre à jour les éventuelles dernières saisies passées avec la requête
        saisies = request.data.get("saisies", [])
        if saisies:
            with transaction.atomic():
                for el in saisies:
                    valeur = el.get("stock_physique")
                    valeur_int = int(valeur) if valeur is not None and str(valeur).strip() != "" else None
                    if el.get("ligne_id"):
                        LigneInventaire.objects.filter(id=el["ligne_id"], session=session).update(stock_physique=valeur_int)
                    elif el.get("produit_id"):
                        LigneInventaire.objects.filter(produit_id=el["produit_id"], session=session).update(stock_physique=valeur_int)

        session.refresh_from_db()
        try:
            session.valider()
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(SessionInventaireSerializer(session).data)

    @action(detail=True, methods=["post"])
    def annuler(self, request, pk=None):
        """Annule ou abandonne une session d'inventaire sans modifier le stock."""
        session = self.get_object()
        if session.statut == SessionInventaire.STATUT_VALIDE:
            return Response({"detail": "Impossible d'annuler une session déjà validée."}, status=status.HTTP_400_BAD_REQUEST)

        session.statut = SessionInventaire.STATUT_ANNULE
        session.save(update_fields=["statut"])
        return Response(SessionInventaireSerializer(session).data)


@api_view(["GET"])
def alertes_stock(request):
    """Renvoie les alertes de stock (bas/rupture), accessible aux administrateurs et gérants."""
    stocks = MouvementStock.stocks_par_produit()
    alertes = []
    for produit in Produit.objects.filter(gere_stock=True, actif=True):
        niveau = stocks.get(produit.pk, 0)
        if niveau <= produit.seuil_alerte:
            alertes.append(
                {
                    "produit": produit.nom,
                    "stock": niveau,
                    "etat": "rupture" if niveau <= 0 else "bas",
                }
            )
    alertes.sort(key=lambda ligne: ligne["stock"])
    return Response({"alertes_stock": alertes[:15]})
