from django.db import models


class Livreur(models.Model):
    nom = models.CharField(max_length=60, unique=True)
    telephone = models.CharField(max_length=25, blank=True)
    actif = models.BooleanField(default=True)

    class Meta:
        ordering = ["nom"]

    def __str__(self):
        return self.nom
