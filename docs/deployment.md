# Déploiement et mise à jour

L'application tourne sur une VM Azure, en conteneurs Docker. Toutes les
opérations passent par `./deploy.sh` à la racine du dépôt.

**URL** : <http://203.0.113.10/>

Trois conteneurs :

- `web` — nginx, sert le front React (`frontend/`) et reverse-proxy `/api`
  et `/health` vers l'API. C'est lui qui écoute sur le port 80.
- `app` — FastAPI + LangGraph, interne au réseau Docker (plus aucun port
  publié).
- `db` — PostgreSQL 16.

---

## Le cycle de développement en une ligne

```bash
./deploy.sh dev      # une seule fois : active le rechargement à chaud
# ... vous modifiez du code ...
./deploy.sh sync     # à chaque fois que vous voulez voir le résultat
```

En mode dev, le code source Python est monté dans le conteneur et
`uvicorn --reload` détecte les changements. `sync` ne fait que copier les
fichiers : pas de reconstruction d'image, pas de redémarrage de conteneur.

Le rechargement à chaud ne concerne que le backend. Pour itérer sur le front
React, travaillez en local avec Vite (`cd frontend && npm run dev`) ; un
`sync` reconstruit l'image `web` sur la VM quand `frontend/` a changé (no-op
sinon, grâce au cache Docker).

## Les deux modes

Le script bascule entre deux façons de faire tourner l'application. Le mode
courant est mémorisé sur la VM (fichier `.dev-mode`), `./deploy.sh status`
l'affiche.

| | **dev** | **prod** |
|---|---|---|
| Code source | monté depuis `/opt/refinement` | copié dans l'image Docker |
| Prise en compte d'un changement | rechargement auto d'uvicorn | reconstruction de l'image |
| Commande de mise à jour | `./deploy.sh sync` | `./deploy.sh deploy` |
| Pour | itérer vite | état stable, reproductible |

Passer de l'un à l'autre : `./deploy.sh dev` / `./deploy.sh prod`.

Le mode dev active `--reload`, qui consomme un peu de CPU à surveiller les
fichiers et fait redémarrer le worker à chaque écriture. Repassez en `prod`
quand vous laissez tourner l'outil pour d'autres personnes.

---

## Commandes

### Boucle quotidienne

```bash
./deploy.sh sync            # envoie le code et l'applique
./deploy.sh dev             # bascule en mode dev (rechargement à chaud)
./deploy.sh logs            # 80 dernières lignes de l'app
./deploy.sh logs 200        # 200 lignes
./deploy.sh logs db         # logs PostgreSQL
./deploy.sh logs web        # logs nginx (front)
./deploy.sh logs all        # tous les services
./deploy.sh logs -f         # suit en direct (nécessite SSH)
./deploy.sh status          # conteneurs, mode courant, disque, mémoire
```

### Déploiements complets

```bash
./deploy.sh deploy          # envoie, reconstruit l'image, redémarre (défaut)
./deploy.sh prod            # quitte le mode dev
./deploy.sh restart         # redémarre les conteneurs
./deploy.sh down            # arrête les conteneurs (la base est conservée)
```

Utilisez `deploy` plutôt que `sync` quand vous touchez à `requirements.txt`,
au `Dockerfile` ou au `docker-compose.yml` — ces fichiers ne sont pris en
compte qu'à la reconstruction.

### Configuration et accès

```bash
./deploy.sh env             # envoie .env.production vers le .env de la VM
./deploy.sh env mon.env     # envoie un autre fichier
./deploy.sh ssh             # ouvre un shell sur la VM
./deploy.sh health          # vérifie que l'app répond
```

### Maîtrise du coût

```bash
./deploy.sh stop            # désalloue la VM : la facturation CPU s'arrête
./deploy.sh start           # la redémarre (les conteneurs repartent seuls)
```

La VM coûte environ 30 €/mois si elle tourne en continu, sur les 50 € de crédit
mensuel de l'abonnement. `stop` pendant les nuits et week-ends divise à peu près
ce montant par trois. Le disque (~4 €/mois) et l'IP publique (~3 €/mois)
continuent d'être facturés même VM éteinte.

---

## Ce qui n'est jamais écrasé

Le `.env` de la VM contient la configuration de production, dont un
`SECRET_KEY` généré à l'installation. Il n'est **jamais** touché par `sync` ni
par `deploy` — la seule façon de le modifier est `./deploy.sh env`, qui garde en
plus une copie de l'ancien dans `.env.bak`.

Sont également exclus des envois : `*.db` (la base SQLite locale), `deploy.env`,
`__pycache__`, `.git`, `.venv`, `logs/`.

Le volume Docker `pgdata` porte la base PostgreSQL. Ni `down`, ni `deploy`, ni
`stop` ne l'effacent. Seul un `docker compose down -v` lancé à la main le
supprimerait.

À l'inverse, la synchronisation est un miroir : un fichier supprimé en local
disparaît de la VM au `sync` suivant.

---

## Comment le script atteint la VM

Deux canaux, choisis automatiquement :

- **SSH** (`rsync` sur le port 22) — rapide, quelques secondes, permet de suivre
  les logs en direct ;
- **API Azure Run Command** — utilisée si le port 22 est injoignable. Le code
  est envoyé encodé dans l'appel d'API, ce qui passe partout où `az` fonctionne,
  mais compte environ une à deux minutes par synchronisation.

Le canal retenu est affiché à chaque exécution. Pour forcer :

```bash
DEPLOY_TRANSPORT=ssh ./deploy.sh sync
DEPLOY_TRANSPORT=az  ./deploy.sh sync
```

Si vous êtes sur un réseau qui laisse passer le port 22, SSH s'activera tout
seul et le cycle deviendra nettement plus court.

---

## Configuration du script

Les valeurs par défaut visent l'installation actuelle. Pour en changer sans
modifier `deploy.sh`, créez un fichier `deploy.env` à la racine (il est ignoré
par les envois) :

```bash
VM_IP=203.0.113.10
SSH_KEY=$HOME/.ssh/deploy_key
DEPLOY_TRANSPORT=ssh
```

| Variable | Défaut |
|---|---|
| `AZ_SUBSCRIPTION` | `00000000-0000-0000-0000-000000000000` (Visual Studio Professional) |
| `AZ_RESOURCE_GROUP` | `rg-example` |
| `AZ_VM_NAME` | `vm-example` |
| `AZ_VM_IP` | `203.0.113.10` |
| `AZ_VM_USER` | `azureuser` |
| `AZ_SSH_KEY` | `~/.ssh/deploy_key` |
| `AZ_REMOTE_DIR` | `/opt/refinement` |
| `DEPLOY_TRANSPORT` | `auto` |

Le script passe l'abonnement explicitement à chaque appel `az` : le tenant
l'entreprise réinitialise régulièrement l'abonnement actif du CLI vers un abonnement
d'entreprise, sur lequel ce compte n'a pas les droits.

---

## Infrastructure

| Ressource | Valeur |
|---|---|
| Abonnement | Abonnement Visual Studio Professional |
| Groupe de ressources | `rg-example` |
| Région | France Central |
| VM | `vm-example`, Standard_B2s (2 vCPU, 4 Go), Ubuntu 22.04 |
| Ports ouverts | 22 (SSH), 80 (nginx) |
| Répertoire applicatif | `/opt/refinement` |
| Conteneurs | `refinement-web-1` (nginx + front React), `refinement-app-1` (FastAPI), `refinement-db-1` (PostgreSQL 16) |

Accès SSH direct :

```bash
ssh -i ~/.ssh/deploy_key azureuser@203.0.113.10
```

---

## Dépannage

**La page ne se charge pas / timeout.** `./deploy.sh status` pour confirmer
que les conteneurs tournent, et `./deploy.sh health` qui teste depuis
l'intérieur de la VM (via nginx, donc toute la chaîne) — si celui-ci répond
200 alors que votre navigateur échoue, le blocage est sur votre réseau, pas
sur le serveur.

**`sync` ne change rien à ce qui s'affiche.** Confirmez le mode avec
`./deploy.sh status`. En mode prod, `sync` redémarre le conteneur mais le code
reste celui de l'image : il faut `./deploy.sh deploy`.

**Une dépendance ajoutée n'est pas trouvée.** `requirements.txt` n'est lu qu'à
la construction de l'image : `./deploy.sh deploy`.

**`AuthorizationFailed` sur une commande `az`.** L'abonnement actif du CLI a
été réinitialisé. `deploy.sh` s'en protège, mais pour vos commandes manuelles :

```bash
az account set --subscription 00000000-0000-0000-0000-000000000000
```

**`payload is …B, over the … Run Command budget`.** Le projet est devenu trop
volumineux pour le canal de secours. Passez par SSH
(`DEPLOY_TRANSPORT=ssh ./deploy.sh sync`), ou déployez depuis un dépôt Git
cloné sur la VM.

---

## Limites connues

- **Pas de HTTPS.** Le trafic circule en clair. Acceptable pour un outil interne
  de test ; à corriger (Caddy + Let's Encrypt, et un nom de domaine) avant tout
  usage réel, a fortiori avec un PAT Azure DevOps configuré.
- **Pas d'authentification.** N'importe qui connaissant l'IP atteint
  l'application et la page de configuration.
- **Schéma de base créé par `create_all()`**, pas par des migrations Alembic :
  un changement de modèle ne sera pas propagé à une base existante.
- **Mots de passe PostgreSQL par défaut** (`postgres`/`postgres`) — la base
  n'est pas exposée hors du réseau Docker, mais c'est à durcir en même temps que
  le reste.
- **Déploiement depuis le poste local**, pas depuis une CI : ce qui est envoyé
  est votre copie de travail, y compris les modifications non validées.
