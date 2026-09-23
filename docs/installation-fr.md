# Installer Jev dans Codex ou Claude

Ce serveur ajoute **`jev_evaluate`** pour les questions typées et **`jev_classify`** pour classer un lot dans des catégories définies. Il transmet les preuves à TypeSafe, puis renvoie des choix, des probabilités et des notes. Le serveur est open source sous licence MIT ; l'API TypeSafe a ses propres conditions et tarifs. L'abonnement à ton agent ne fournit pas cette clé API.

L'agent peut appeler Jev de lui-même lorsqu'il doit juger le sens d'un texte avec des catégories ou une grille claires. Il cherche d'abord les faits, donne les preuves brutes à Jev, prévoit une option « aucune » et revoit les cas incertains. Il garde les calculs exacts et l'explication finale. Un lot `jev_classify` lance une évaluation ; appeler `jev_evaluate` pour chaque élément lance une évaluation par élément. Les réponses HTTP 429/5xx peuvent être rejouées ; le nombre réel de tentatives est renvoyé.

## Le plus simple : donne cette demande à ton agent

> Installe le serveur MCP https://github.com/MattiooFR/mcp-server-jev pour mon client actuel. Lis le README et docs/installation-fr.md. Vérifie Node.js 22 minimum et Git, puis installe les dépendances avec npm ci --ignore-scripts. Préserve tous mes serveurs MCP existants. Utilise des chemins absolus vers Node, le fichier de clé et src/cli.mjs. Prépare un fichier privé de clé hors du dépôt : je le remplirai moi-même, sans coller la clé dans cette conversation. N'affiche jamais son contenu. Configure le serveur jev, puis indique quelle application redémarrer. Après mon redémarrage, appelle réellement jev_evaluate sur un ticket fictif et montre les trois types de réponses, le modèle et la latence. Si tu ne peux pas modifier ma configuration, donne-moi le bloc exact à ajouter.

L'agent doit avoir accès à ton ordinateur et à sa configuration locale. Ce serveur stdio ne peut pas être ajouté tel quel au site claude.ai depuis un navigateur.

## 1. Préparer la clé et les outils

1. Ouvre [la console TypeSafe](https://console.typesafe.ai/) et récupère une clé API depuis ton compte.
2. Vérifie les conditions et le quota dans cette console. Le tutoriel ne promet aucun crédit gratuit.
3. Installe [Node.js](https://nodejs.org/) 22 ou plus récent et [Git](https://git-scm.com/).

Dans un terminal :

```sh
node --version
git --version
git clone https://github.com/MattiooFR/mcp-server-jev.git
cd mcp-server-jev
npm ci --ignore-scripts
npm test
```

Le paquet **n'est pas publié sur npm**. N'exécute pas un nom ressemblant trouvé dans le registre. Le dépôt ci-dessus et ses releases sont les sources de ce projet indépendant de TypeSafe.

### macOS et Linux

Crée le fichier privé hors du dépôt, puis ouvre-le dans ton éditeur local :

```sh
mkdir -p ~/.config/jev-mcp
chmod 700 ~/.config/jev-mcp
touch ~/.config/jev-mcp/credentials.env
chmod 600 ~/.config/jev-mcp/credentials.env
nano ~/.config/jev-mcp/credentials.env
```

Le fichier doit contenir cette ligne, avec ta vraie clé à la place de l'exemple :

```dotenv
TYPESAFE_API_KEY=ta_cle_typesafe
```

Garde cette clé hors des captures, de Git et de la conversation. Tu peux utiliser ton éditeur habituel à la place de nano. Il faut enregistrer en texte brut.

### Windows

Avec PowerShell, crée un fichier `credentials.env` dans un dossier privé de ton profil utilisateur, hors du dépôt. Ouvre-le avec le Bloc-notes et ajoute la même ligne. Vérifie qu'il ne s'appelle pas `credentials.env.txt`. Limite ses droits à ton compte via les propriétés de sécurité Windows. Les exemples Windows ci-dessous sont fournis à titre de configuration ; nos appels réels ont été effectués sur macOS.

## 2. Brancher ton client

Remplace chaque chemin d'exemple par le chemin **absolu** de ton ordinateur. `~` n'est pas développé automatiquement dans les arguments MCP. Sur macOS/Linux, `command -v node` donne le chemin de Node et `pwd` le dossier actuel. Sur PowerShell, utilise `(Get-Command node).Source` et `(Get-Location).Path`.

### Codex

Ajoute ce bloc à `~/.codex/config.toml`, en conservant les autres blocs :

```toml
[mcp_servers.jev]
command = "/chemin/absolu/vers/node"
args = ["--env-file=/chemin/absolu/credentials.env", "/chemin/absolu/mcp-server-jev/src/cli.mjs"]
tool_timeout_sec = 120
```

Tu peux aussi enregistrer la commande avec le CLI :

```sh
codex mcp add jev -- /chemin/absolu/vers/node --env-file=/chemin/absolu/credentials.env /chemin/absolu/mcp-server-jev/src/cli.mjs
codex mcp list
```

Ferme puis rouvre la session Codex concernée. Le CLI et l'application peuvent nécessiter un redémarrage distinct. Le statut d'authentification `unsupported` est normal pour ce serveur local : la clé est lue par Node, il n'y a pas de connexion OAuth MCP à effectuer. La preuve du fonctionnement reste un appel réussi.

### Claude Code

Dans un terminal :

```sh
claude mcp add --scope user jev -- /chemin/absolu/vers/node --env-file=/chemin/absolu/credentials.env /chemin/absolu/mcp-server-jev/src/cli.mjs
claude mcp get jev
```

Le scope `user` rend l'outil accessible dans tes projets. Quitte et relance Claude Code pour que la session découvre le serveur. Dans la session, `/mcp` permet de vérifier les outils disponibles. Autorise l'appel de Jev si Claude te le demande.

### Claude Desktop

Ouvre la configuration des serveurs locaux dans les réglages développeur. Ajoute `jev` à l'objet `mcpServers`, sans supprimer tes autres serveurs :

```json
{
  "mcpServers": {
    "jev": {
      "command": "/chemin/absolu/vers/node",
      "args": [
        "--env-file=/chemin/absolu/credentials.env",
        "/chemin/absolu/mcp-server-jev/src/cli.mjs"
      ]
    }
  }
}
```

Sur Windows, les chemins JSON doivent doubler leurs antislashs, par exemple `C:\\Program Files\\nodejs\\node.exe`. `C:/Users/TON_COMPTE/...` est une autre forme pour les chemins de fichiers dans les arguments Node.

Quitte complètement Claude Desktop, puis rouvre-le. Notre configuration Desktop a été vérifiée, mais le test de conversation publié a été réalisé dans Claude Code, pas dans Desktop.

## 3. Faire un vrai appel

Colle ce message dans une nouvelle conversation :

> Utilise réellement jev_evaluate sur ce ticket fictif : « Une commande, deux débits de 49 euros. Je demande le remboursement du doublon. » Classe le service entre facturation, technique et commercial. Évalue séparément si un remboursement est explicitement demandé. Note enfin l'urgence sur trois niveaux : aucune activité bloquée, échéance explicite, activité bloquée sans recours. Montre les valeurs exactes renvoyées, le modèle et la latence du tool.

Vérifie qu'un appel à **`jev_evaluate`** apparaît dans la trace de ton agent. Une réponse rédigée par Claude ou Codex sans appel d'outil ne valide pas l'installation. La classification attendue est `facturation`, mais les valeurs probabilistes peuvent varier.

## 4. Rejouer les huit cas du tutoriel

Les données sont fictives et consultables dans `examples/tutorial/cases.json`. Les attentes sont écrites avant les appels. Le test conserve aussi les écarts, sans les masquer.

```sh
node --env-file=/chemin/absolu/credentials.env scripts/tutorial-tests.mjs /chemin/absolu/mes-resultats.json
```

Cette commande fait **10 appels payants ou décomptés du quota** : huit scénarios, dont le lot de 60 questions est exécuté trois fois au total. Elle évalue 228 questions. Les 24 tests de `npm test`, eux, sont hors ligne.

Le script et les résultats se trouvent sur la branche principale du dépôt. Ils ne sont pas inclus dans l'archive npm de la release 0.1.0. Clone le dépôt pour les rejouer.

## Si ça bloque

| Symptôme | À vérifier |
| --- | --- |
| Node introuvable dans l'application | Utilise son chemin absolu, pas seulement `node`. |
| Le fichier de clé manque | Vérifie le chemin après `--env-file=` et le vrai nom du fichier. |
| Clé absente ou refusée | Vérifie la variable `TYPESAFE_API_KEY` et la validité de la clé dans la console. Ne partage pas sa valeur. |
| L'outil n'apparaît pas | Redémarre la session, vérifie le bon scope et les erreurs du client MCP. |
| Jev ne lit pas l'URL donnée | Ton agent doit récupérer la page puis transmettre son texte dans `state`. |
| Limite de débit ou de contexte | Réduis le lot et attends le délai indiqué. Un document tronqué silencieusement peut fausser la décision. |
| L'agent répond sans Jev | Demande explicitement l'appel au tool, puis ouvre sa trace. |

Les contenus envoyés sont transmis à TypeSafe. Le dépôt fournit un connecteur local, pas un modèle exécuté hors ligne. Les durées mesurées du tool n'incluent pas tout le temps de réflexion et de rédaction de ton agent.
