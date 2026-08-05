from django.utils import timezone
from utils.dates import date_range
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from catalogue.models import Categorie

from . import services
from .models import Commande, LigneCommande, TableResto
from .serializers import (
    AjoutLigneSerializer,
    CommandeSerializer,
    EncaissementSerializer,
    LigneCommandeSerializer,
    SynchronisationSerializer,
    TableRestoSerializer,
)


class TableRestoViewSet(viewsets.ModelViewSet):
    queryset = TableResto.objects.all()
    serializer_class = TableRestoSerializer
    filterset_fields = ["active"]

    @action(detail=True, methods=["post"])
    def ardoise(self, request, pk=None):
        """Renvoie l'ardoise ouverte de la table, ou l'ouvre si elle est libre.

        En un seul appel : deux serveurs qui touchent la même table à la même
        seconde ne doivent pas créer deux commandes concurrentes.
        """
        table = self.get_object()
        commande = table.commande_ouverte
        if commande is None:
            commande = Commande.objects.create(
                table=table,
                type=Commande.TYPE_PLACE,
                couverts=request.data.get("couverts") or table.couverts_defaut,
            )
        return Response(CommandeSerializer(commande).data)


class CommandeViewSet(viewsets.ModelViewSet):
    queryset = Commande.objects.select_related("table", "livreur").prefetch_related(
        "lignes__produit", "paiements"
    )
    serializer_class = CommandeSerializer
    filterset_fields = ["statut", "type", "origine", "table", "livreur"]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.query_params.get("ouvertes") == "1":
            queryset = queryset.filter(statut__in=Commande.STATUTS_OUVERTS)
        if self.request.query_params.get("pour_cuisine") == "1":
            # Le poste cuisine ne voit que les commandes qui lui donnent du travail :
            # une tournée de bières n'a rien à y faire.
            queryset = queryset.filter(
                statut__in=[Commande.STATUT_EN_CUISINE, Commande.STATUT_PRETE],
                lignes__produit__categorie__rayon=Categorie.RAYON_CUISINE,
            ).distinct()
        if self.request.query_params.get("a_livrer") == "1":
            queryset = queryset.filter(
                type=Commande.TYPE_LIVRAISON,
                statut__in=[
                    Commande.STATUT_OUVERTE,
                    Commande.STATUT_EN_CUISINE,
                    Commande.STATUT_PRETE,
                    Commande.STATUT_EN_ROUTE,
                    Commande.STATUT_LIVREE,
                ],
            )
        if self.request.query_params.get("historique_cuisine") == "1":
            queryset = queryset.filter(
                statut=Commande.STATUT_PAYEE,
                lignes__produit__categorie__rayon=Categorie.RAYON_CUISINE,
            ).distinct()
            date_param = self.request.query_params.get("date")
            if self.request.query_params.get("aujourdhui") == "1":
                queryset = queryset.filter(cloturee_le__range=date_range(timezone.localdate()))
            elif date_param:
                from datetime import date as date_type
                try:
                    from datetime import datetime
                    jour = datetime.strptime(date_param, "%Y-%m-%d").date()
                    queryset = queryset.filter(cloturee_le__range=date_range(jour))
                except ValueError:
                    pass  # date invalide → on renvoie tout
            return queryset.order_by("-cloturee_le")
        if self.request.query_params.get("historique_emporter") == "1":
            queryset = queryset.filter(
                type=Commande.TYPE_EMPORTER,
                statut=Commande.STATUT_PAYEE,
            )
            date_param = self.request.query_params.get("date")
            if self.request.query_params.get("aujourdhui") == "1":
                queryset = queryset.filter(cloturee_le__range=date_range(timezone.localdate()))
            elif date_param:
                try:
                    from datetime import datetime
                    jour = datetime.strptime(date_param, "%Y-%m-%d").date()
                    queryset = queryset.filter(cloturee_le__range=date_range(jour))
                except ValueError:
                    pass
            return queryset.order_by("-cloturee_le")
        return queryset.order_by("-ouverte_le", "-id")

    @action(detail=True, methods=["post"])
    def lignes(self, request, pk=None):
        commande = self.get_object()
        entree = AjoutLigneSerializer(data=request.data)
        entree.is_valid(raise_exception=True)
        ligne = services.ajouter_ligne(commande, **entree.validated_data)
        return Response(LigneCommandeSerializer(ligne).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def synchroniser(self, request, pk=None):
        """Valide le panier : la commande adopte exactement les lignes envoyées."""
        commande = self.get_object()
        entree = SynchronisationSerializer(data=request.data)
        entree.is_valid(raise_exception=True)
        services.synchroniser_lignes(commande, entree.validated_data["lignes"])
        commande = self.get_queryset().get(pk=commande.pk)
        return Response(CommandeSerializer(commande).data)

    @action(detail=True, methods=["post"])
    def annuler(self, request, pk=None):
        commande = self.get_object()
        commande = services.annuler(commande)
        return Response(CommandeSerializer(commande).data)

    @action(detail=True, methods=["post"])
    def encaisser(self, request, pk=None):
        commande = self.get_object()
        entree = EncaissementSerializer(data=request.data)
        entree.is_valid(raise_exception=True)
        commande = services.encaisser(commande, entree.validated_data["paiements"])
        # get_object() a préchargé les paiements alors qu'il n'y en avait aucun.
        # Sans relecture, le reçu s'imprimerait sans sa ligne de règlement.
        commande = self.get_queryset().get(pk=commande.pk)
        donnees = CommandeSerializer(commande).data
        donnees["monnaie_a_rendre"] = services.monnaie_a_rendre(commande)
        return Response(donnees)

    @action(detail=False, methods=["post"])
    def encaisser_tout(self, request):
        """Encaisser plusieurs commandes à la fois (livraison, emporter ou sélection spécifique)."""
        livreur_id = request.data.get("livreur_id")
        commande_ids = request.data.get("commande_ids")
        mode_paiement = request.data.get("mode", "especes")
        type_cmd = request.data.get("type")

        queryset = Commande.objects.exclude(statut__in=[Commande.STATUT_PAYEE, Commande.STATUT_ANNULEE])

        if commande_ids:
            queryset = queryset.filter(pk__in=commande_ids)
        else:
            if type_cmd:
                queryset = queryset.filter(type=type_cmd)
            else:
                queryset = queryset.filter(type=Commande.TYPE_LIVRAISON)

            if livreur_id:
                if str(livreur_id) in ["__sans__", "sans_attribution", "0", "None"]:
                    queryset = queryset.filter(livreur__isnull=True)
                else:
                    queryset = queryset.filter(livreur_id=livreur_id)

        commandes = list(queryset)
        encaissees = []
        montant_total = 0

        for cmd in commandes:
            if cmd.statut == Commande.STATUT_PAYEE or not cmd.lignes.exists():
                continue
            total = cmd.total
            if total <= 0:
                continue
            paiements = [{"mode": mode_paiement, "montant": total, "montant_recu": total}]
            services.encaisser(cmd, paiements)
            encaissees.append(cmd.pk)
            montant_total += total

        return Response({
            "nb_encaissees": len(encaissees),
            "montant_total": montant_total,
            "commandes_ids": encaissees,
        })

    @action(detail=True, methods=["post"])
    def envoyer_en_cuisine(self, request, pk=None):
        commande = self.get_object()
        commande.statut = Commande.STATUT_EN_CUISINE
        commande.save(update_fields=["statut"])
        return Response(CommandeSerializer(commande).data)

    @action(detail=True, methods=["post"])
    def demander_addition(self, request, pk=None):
        """Le client réclame l'addition : la table passe « à encaisser ».
        Sans toucher au statut, qui suit la cuisine et la livraison."""
        commande = self.get_object()
        commande.addition_demandee = request.data.get("demandee", True)
        commande.save(update_fields=["addition_demandee"])
        return Response(CommandeSerializer(commande).data)

    @action(detail=True, methods=["post"])
    def changer_statut(self, request, pk=None):
        commande = self.get_object()
        statuts_valides = dict(Commande.STATUTS)
        nouveau = request.data.get("statut")
        if nouveau not in statuts_valides:
            return Response(
                {"statut": f"Statut inconnu. Valeurs possibles : {', '.join(statuts_valides)}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        commande.statut = nouveau
        update_fields = ["statut"]
        # Quand on confie la commande à un livreur, on enregistre son identifiant
        if nouveau == Commande.STATUT_EN_ROUTE:
            livreur_id = request.data.get("livreur_id")
            if livreur_id:
                commande.livreur_id = livreur_id
                update_fields.append("livreur")
        commande.save(update_fields=update_fields)
        return Response(CommandeSerializer(commande).data)


class LigneCommandeViewSet(viewsets.ModelViewSet):
    """Sert surtout à corriger une quantité ou retirer une ligne d'une ardoise."""

    queryset = LigneCommande.objects.select_related("produit", "commande")
    serializer_class = LigneCommandeSerializer
    filterset_fields = ["commande"]

    def _refuser_si_close(self, ligne):
        if ligne.commande.statut in (Commande.STATUT_PAYEE, Commande.STATUT_ANNULEE):
            raise ValidationError(
                "Cette commande est close : son ticket est déjà émis, ses lignes ne "
                "peuvent plus changer."
            )

    def perform_update(self, serializer):
        self._refuser_si_close(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._refuser_si_close(instance)
        instance.delete()
