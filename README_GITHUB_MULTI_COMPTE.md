# Résumé GitHub avec deux comptes

## Situation
Le problème venait du fait que le dépôt GitHub était accessible avec un compte, mais l’authentification SSH n’était pas encore correctement associée au bon compte.

## Vérification faite
Les tests SSH suivants ont bien fonctionné :

```bash
ssh -T git@github-compte1
ssh -T git@github-compte2
```

Résultat attendu :

```text
Hi optinetsarl-sketch! You've successfully authenticated, but GitHub does not provide shell access.
Hi SamsonWilson! You've successfully authenticated, but GitHub does not provide shell access.
```

## Configuration SSH utilisée
Les clés SSH suivantes ont été créées :

- ~/.ssh/id_ed25519_github_compte1
- ~/.ssh/id_ed25519_github_compte2

Le fichier ~/.ssh/config contient :

```bash
Host github-compte1
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_github_compte1

Host github-compte2
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_github_compte2
```

## Ajouter les clés publiques à GitHub
Afficher chaque clé publique :

```bash
cat ~/.ssh/id_ed25519_github_compte1.pub
cat ~/.ssh/id_ed25519_github_compte2.pub
```

Puis aller sur GitHub :
- Settings
- SSH and GPG keys
- New SSH key

## Charger les clés dans l’agent SSH
```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519_github_compte1
ssh-add ~/.ssh/id_ed25519_github_compte2
```

## Utiliser le bon compte pour un dépôt
Pour un dépôt lié au premier compte :

```bash
git remote set-url origin git@github-compte1:nom-utilisateur1/nom-repo.git
```

Pour un dépôt lié au deuxième compte :

```bash
git remote set-url origin git@github-compte2:nom-utilisateur2/nom-repo.git
```

## Pousser les changements
```bash
git push -u origin main
```

## Note importante
Si le dépôt appartient à une organisation ou à un autre compte, il faut aussi avoir les droits d’écriture sur ce dépôt.


# Build frontend
cd frontend
npm run build
# Build backend
cd ../backend
.\compile.bat
# Génération package client
cd ..
.\deploy-complete.ps1


# 1. Récupérer les dernières mises à jour du code
git pull origin main

# 2. Reconstruire le frontend React
cd frontend
npm run build

# 3. Recompiler l'exécutable Python silencieux
cd ../backend
.\compile.bat

# 4. Générer le dossier de déploiement et l'archive ZIP finale
cd ..
.\deploy-complete.ps1
