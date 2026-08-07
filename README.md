# La Marmite du Kloto — application de gestion

Bar-Resto · Avedji, non loin de la Côte d'Or · +228 91 04 27 02

Django REST côté API, React côté écrans, **gestion par deux rôles d'utilisateurs** (Administrateur & Gérant).
`Marmite_du_Kloto_Prototype.html` reste la maquette de référence : c'est elle qui fixe
la grammaire visuelle, on la garde jusqu'à ce que tous les écrans soient portés.

## Comptes et Accès par Défaut

- **👑 Administrateur (Responsable)** : `admin` / `marmite2026`
  - Accès complet : Chiffre d'Affaires (CA), Rapports financiers, Clôture de caisse, Dépenses, Édition du Catalogue, Ajustements & Inventaires de Stock, Historique financier.
- **👤 Gérant / Caisse (Personnel)** : `gerant` / `marmite2026`
  - Accès opérationnel : Ventes & Caisse, Plan de Salle (Tables), Poste Cuisine, Livraisons, Consultation du stock, Graphiques d'activité (volume d'articles et top plats) et Historique des opérations (sans données monétaires FCFA). Masquage complet du Chiffre d'Affaires et blocage des saisies d'inventaire.

*À changer avant toute mise en service (`manage.py changepassword <compte>`).*

## Démarrer sur Windows (PowerShell)

```powershell
# 1. API Backend (depuis le dossier backend)
cd backend
..\.venv\Scripts\python.exe manage.py runserver 8050

# 2. Synchronisation MongoDB Atlas (optionnel en dev, depuis le dossier backend)
cd backend
..\.venv\Scripts\python.exe manage.py sync_atlas --loop

# 3. Écrans Frontend (depuis le dossier frontend)
cd frontend
npm run dev
```

## Installer depuis zéro

```bash
python3 -m venv .venv
.venv/bin/pip install django djangorestframework django-cors-headers django-filter python-dotenv Pillow
cd backend && ../.venv/bin/python manage.py migrate && ../.venv/bin/python manage.py seed_catalogue
../.venv/bin/python manage.py createsuperuser
cd ../frontend && npm install
```

`seed_catalogue` est idempotent : il charge 89 boissons, 13 plats, 30 tables et
3 livreurs, et peut être relancé sans créer de doublon.

## Tests

```bash
cd backend && ../.venv/bin/python manage.py test
```

## Repartir d'une base propre

`backend/db.sqlite3` contient les données des essais de développement (ventes fictives,
dépenses de test). Pour repartir à zéro sans toucher au catalogue :

```bash
cd backend
rm db.sqlite3
../.venv/bin/python manage.py migrate
../.venv/bin/python manage.py seed_catalogue
../.venv/bin/python manage.py createsuperuser
```

## Structure

| Dossier | Rôle |
|---|---|
| `backend/catalogue` | Catégories et produits (boissons **et** plats) |
| `backend/ventes` | Tables, commandes, lignes, paiements — `services.py` porte les règles métier |
| `backend/stock` | Mouvements de stock, fournisseurs |
| `backend/caisse` | Sessions de caisse, dépenses |
| `backend/livraison` | Livreurs et leurs comptes de fin de journée |
| `backend/rapports` | Agrégations de gestion, aucun modèle |
| `frontend/src/pages` | Un fichier par écran |
| `frontend/src/composants` | Modales et documents imprimables partagés |

Le catalogue se gère depuis l'application : l'écran **Catalogue** crée et modifie les
plats, les boissons, les **familles**, les catégories et les tables de la salle.
L'admin Django reste disponible pour les cas particuliers.

### Familles → catégories → produits

Une **famille** regroupe plusieurs catégories : *Alcools* rassemble Bière, Vin et
Wisky ; *Restauration* contient Cuisine. C'est un axe de classement d'affichage,
distinct du **rayon** (Bar/Cuisine) qui, lui, pilote le stock et l'envoi en cuisine.

- Onglet **Familles** : créer, renommer, ordonner ; chaque ligne indique combien de
  catégories elle contient.
- Onglet **Catégories** : une catégorie se relie à une famille (ou à aucune).
- Supprimer une famille **délie** ses catégories sans les perdre (`on_delete=SET_NULL`).

Côté API : `GET/POST /api/familles/`, et les produits se filtrent par famille via
`?categorie__famille=<id>`.

## Trois décisions structurantes

**Le stock n'est jamais stocké.** `Produit.stock` est la somme des `MouvementStock`.
Une réception, une vente, une casse écrivent chacune une ligne signée. On peut donc
toujours répondre à « d'où vient ce chiffre ? », ce qu'un compteur décrémenté ne permet pas.

**Les prix sont figés à la vente.** `LigneCommande` copie le libellé et le prix
unitaire. Renommer un produit ou changer son prix ne réécrit pas les tickets déjà émis.

**Les montants sont des entiers.** Le FCFA n'a pas de centimes : pas de `Decimal`,
pas d'arrondi à surveiller.

## Ce qui est fait

- Modèle de données complet (11 modèles), migrations, admin Django
- API REST : catalogue, tables, commandes, encaissement (dont **paiement mixte** et
  calcul de la monnaie), déstockage automatique, réceptions et sorties manuelles,
  dépenses, sessions de caisse, livreurs, 7 endpoints de rapports
- 67 tests couvrant le parcours de vente, les refus (plat sans prix, paiement
  incomplet, double encaissement, ligne modifiée après émission du ticket, dépense
  au-delà du tiroir, double clôture, suppression d'un élément encore référencé),
  le circuit de livraison, le stock, les familles et les agrégations
- **Les neuf écrans du prototype sont portés**, plus un écran Catalogue : connexion,
  Accueil, Ventes / Caisse, Plan de salle, Bar / Stock, Cuisine, Livraison, Catalogue,
  Dépenses, Rapports, Clôture du jour
- Six documents imprimables : reçu, addition, bon de cuisine, bon de livraison,
  rapport détaillé, feuille de clôture
- Interface utilisable sur ordinateur, tablette et téléphone

### Le panier se valide avant d'être attribué à la table

L'écran Ventes construit un **panier local** : tant qu'on ne clique pas sur
« Valider la commande », rien n'est écrit et la table reste libre. La validation
crée (ou retrouve) l'ardoise de la table, synchronise les lignes et envoie les plats
en cuisine.

Le panier reste **modifiable tant que ce n'est pas payé** : boutons −/+ sur chaque
ligne, retrait, ajout de boissons ou de plats, puis re-validation. La synchronisation
réconcilie (ajoute, retire, ajuste les quantités) sans réinitialiser l'état cuisine
des plats déjà envoyés. « Encaisser » et « Imprimer l'addition » valident d'abord
l'état courant du panier.

### Poste cuisine : préparation → terminé, sans retour

Le poste cuisine sépare visuellement, d'un trait, les repas **en préparation** de ceux
**terminés — prêts à servir**. « Marquer terminé » est définitif : un repas terminé ne
repasse pas en préparation. Un repas encore en préparation peut être **annulé**
(bouton rouge, avec confirmation) — ce qui libère la table et sort la commande de la
cuisine ; aucun stock n'est concerné, le bar n'étant déstocké qu'à l'encaissement.

### Un plat commandé part seul en cuisine

Ajouter un plat à n'importe quelle commande — table, à emporter, livraison — la fait
apparaître aussitôt sur le poste cuisine, sans qu'un serveur ait à y penser. Le
cuisinier bascule entre « en préparation » et « prêt à servir ». Un plat ajouté après
coup fait repasser la commande en préparation : c'est du travail neuf.

Les boissons ne déclenchent rien, elles ne passent pas par la cuisine.

### Cuisine et encaissement sont deux choses séparées

`Commande.statut` suit la cuisine et la livraison ; `Commande.addition_demandee` dit
que le client réclame l'addition. Les deux partageaient le statut « prête », si bien
qu'une table passait « à encaisser » dès qu'un plat sortait du feu, alors que le client
mangeait encore. Le plan de salle lit maintenant `addition_demandee`, et rien d'autre.

### Suppressions protégées

Un produit déjà vendu, une table avec une commande, une catégorie non vide ne peuvent
pas être supprimés — leur historique doit rester intact. La base les protège
(`on_delete=PROTECT`) ; un gestionnaire d'exception DRF
(`config/exceptions.py`) transforme le refus en **409** avec un message clair
(« désactivez-le plutôt »), au lieu de la 500 brute qu'une `ProtectedError` non
gérée aurait produite.

### Le stock ne s'écrase jamais

Trois opérations sur l'écran Bar : **réception** (entrée fournisseur), **casse / perte**
(sortie manuelle), **inventaire** (le magasinier saisit ce qu'il a compté). L'inventaire
n'écrase pas le stock — c'est impossible, il est calculé : il écrit l'écart entre le
compté et le théorique. L'historique reste donc lisible, et un inventaire conforme
n'écrit rien du tout.

### Responsive

Quatre largeurs vérifiées écran par écran — 1280, 820, 390 et 340 px :

- **ordinateur** — barre latérale, panneaux côte à côte, tableaux complets ;
- **tablette (≤ 1024 px)** — panneaux empilés, grilles fluides ;
- **téléphone (≤ 700 px)** — navigation en bandeau fixe en bas de l'écran, sous le
  pouce ; formulaires et modales en pleine largeur.

**Un tableau dense devient une liste de fiches.** Six colonnes et deux boutons dans
330 px, ça tronque quoi qu'on fasse : sous 700 px, chaque ligne des écrans Bar,
Catalogue, Livraison et Dépenses se replie en fiche, chaque valeur sous son intitulé,
les actions en pleine largeur. Il suffit d'ajouter la classe `cartes` au tableau et
`data-label` / `data-titre` / `data-actions` sur ses cellules.

Pour les longues listes — les 89 boissons du bar — la variante `compacte` resserre
les fiches et masque les champs secondaires (`data-secondaire`), qui restent visibles
sur tablette et ordinateur.

**Le ticket de vente reste au-dessus des produits.** En écran étroit il passe en tête
et se colle en haut : sinon il aurait fallu faire défiler 89 boissons pour voir le
total après chaque appui.

### Deux façons de compter, à ne pas confondre

Le rapport « Ventes bar » et la ligne « bar » du rapport des revenus donnent des
montants différents, et c'est voulu :

- **par produit** (rapports bar et cuisine) : tout ce qui est sorti, quel que soit
  le canal — c'est la vue qui sert au stock et au réassort ;
- **par source** (rapport des revenus, tableau de bord, clôture) : une livraison
  compte intégralement en « livraison », boissons comprises, pour que les trois
  sources s'additionnent exactement au chiffre d'affaires.

Chaque feuille porte la note qui l'explique, et
`RapportsTest.test_rapport_produit_couvre_tous_les_canaux` fige l'écart pour qu'il
ne devienne pas une dérive silencieuse.

### Les deux bons ne disent pas la même chose

Une commande WhatsApp est saisie une seule fois et produit deux documents distincts (§6).

- **Bon de cuisine** — *sans aucun prix*. Plats, quantités, notes. Les boissons en
  sont exclues : elles ne passent pas par la cuisine. Il sert à préparer, pas à facturer.
- **Bon de livraison** — avec les prix, le client, son téléphone, son adresse, le
  livreur, et le **montant à encaisser** mis en évidence.

Le prototype affichait les prix sur ses cartons de cuisine, ce que le cahier interdit.

### Le circuit d'une livraison

`Saisie → en cuisine → prête → en route → livrée → encaissée`. Une livraison ne se
paie pas au comptoir : l'écran de vente propose « Envoyer en cuisine » au lieu
d'« Encaisser », et l'argent rentre au retour du livreur.

Le tableau de fin de journée distingue **à remettre** (courses livrées dont l'argent
est encore dans la poche du livreur) de **déjà remis** (encaissé en espèces
aujourd'hui). Le mobile money ne figure dans aucune des deux colonnes — il arrive
directement sur le compte — mais compte dans les courses du jour, pour qu'un livreur
payé uniquement en TMoney ne disparaisse pas du tableau.

### La caisse ne peut pas être à découvert

Une dépense **en espèces** est refusée si elle dépasse ce que contient le tiroir
(fond initial + recettes espèces − dépenses espèces déjà passées). Les autres modes
— TMoney, Flooz, banque — ne sont pas plafonnés : ils ne sortent pas du tiroir.
Sans session de caisse ouverte, aucun plafond ne s'applique, faute de point de départ.

La règle vit dans `DepenseSerializer.validate` : elle vaut pour l'écran comme pour
tout appel direct à l'API.

### Addition ≠ reçu

Le prototype avait un bouton « Imprimer la facture & débarrasser » qui libérait la
table sans enregistrer de vente : la recette disparaissait. Les deux gestes sont
maintenant séparés.

- **Imprimer l'addition** présente le montant au client et passe la table en
  « à encaisser ». Rien n'est encaissé, rien n'est déstocké.
- **Encaisser** ouvre le choix du mode de paiement, calcule la monnaie, émet le
  reçu numéroté, déstocke le bar et libère la table.

Une boisson en rupture reste vendable — un écart d'inventaire ne doit jamais bloquer
une vente au comptoir. Le badge « Rupture » signale l'écart, le stock passe en négatif
et le rapport bar le rend visible.

## Ce qui reste

| Lot | Sujets |
|---|---|
| 7 | Journal des actions (§13), sauvegardes automatiques, mise en production |

Étape 1 et étape 2 du cahier des charges (§15) sont couvertes. Restent des sujets
d'exploitation, plus les deux points ouverts ci-dessous.

## Points ouverts

- **Catalogue** : le cahier des charges annonce 44 boissons, le prototype en contient 89
  (vins et whiskys ajoutés). Le seed charge les 89 — à confirmer avec le client, et à
  refléter dans l'annexe A.
- **Imprimante** : les reçus sont prévus en A4 navigateur, comme le prototype. Une
  imprimante thermique 80 mm (ESC/POS) changerait leur implémentation.
- **Hors-ligne** (§13 du cahier) : hors périmètre tant que l'application tourne sur un
  poste unique relié à son propre serveur. À rouvrir si des tablettes de service s'ajoutent.
