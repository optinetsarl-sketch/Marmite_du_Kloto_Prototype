from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Depense, SessionCaisse
from .serializers import ClotureSerializer, DepenseSerializer, SessionCaisseSerializer


class DepenseViewSet(viewsets.ModelViewSet):
    queryset = Depense.objects.all()
    serializer_class = DepenseSerializer
    filterset_fields = ["categorie", "mode", "session"]

    def get_queryset(self):
        # On n'affiche que les dépenses actives (non supprimées) dans les listes normales, les plus récentes en haut
        return Depense.objects.filter(supprime_le__isnull=True).order_by("-cree_le", "-id")

    def destroy(self, request, *args, **kwargs):
        """Soft-delete : on marque supprime_le plutôt que d'effacer la ligne.
        La dépense reste visible dans l'historique avec le statut 'Supprimée'."""
        depense = self.get_object()
        depense.supprime_le = timezone.now()
        depense.supprime_par = getattr(request.user, 'username', '') or 'inconnu'
        depense.save(update_fields=["supprime_le", "supprime_par"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class SessionCaisseViewSet(viewsets.ModelViewSet):
    queryset = SessionCaisse.objects.prefetch_related("depenses").order_by("-ouverte_le", "-id")
    serializer_class = SessionCaisseSerializer

    def create(self, request, *args, **kwargs):
        if SessionCaisse.courante():
            return Response(
                {"detail": "Une session de caisse est déjà ouverte. Clôturez-la d'abord."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().create(request, *args, **kwargs)

    @action(detail=False, methods=["get"])
    def courante(self, request):
        session = SessionCaisse.courante()
        if session is None:
            return Response({"detail": "Aucune caisse ouverte."}, status=status.HTTP_404_NOT_FOUND)
        return Response(SessionCaisseSerializer(session).data)

    @action(detail=True, methods=["post"])
    def cloturer(self, request, pk=None):
        session = self.get_object()
        if session.fermee_le:
            return Response(
                {"detail": "Cette session est déjà clôturée."}, status=status.HTTP_400_BAD_REQUEST
            )

        # RÈGLE DE SÉCURITÉ COMPTABLE :
        # Empêcher la clôture de la caisse s'il reste des commandes non encaissées en livraison ou à emporter
        from ventes.models import Commande
        n_livraison = Commande.objects.filter(
            type=Commande.TYPE_LIVRAISON
        ).exclude(statut__in=[Commande.STATUT_PAYEE, Commande.STATUT_ANNULEE]).count()

        n_emporter = Commande.objects.filter(
            type=Commande.TYPE_EMPORTER
        ).exclude(statut__in=[Commande.STATUT_PAYEE, Commande.STATUT_ANNULEE]).count()

        if n_livraison > 0 or n_emporter > 0:
            details = []
            if n_livraison > 0:
                details.append(f"{n_livraison} livraison(s)")
            if n_emporter > 0:
                details.append(f"{n_emporter} commande(s) à emporter")
            msg = f"Impossible de clôturer la caisse : il reste {' et '.join(details)} non encaissée(s). Veuillez effectuer tous les encaissements avant de clôturer la journée."
            return Response({"detail": msg}, status=status.HTTP_400_BAD_REQUEST)

        entree = ClotureSerializer(data=request.data)
        entree.is_valid(raise_exception=True)
        session.montant_reel = entree.validated_data["montant_reel"]
        session.commentaire_cloture = entree.validated_data["commentaire"]
        session.fermee_le = timezone.now()
        session.save(update_fields=["montant_reel", "commentaire_cloture", "fermee_le"])
        return Response(SessionCaisseSerializer(session).data)
