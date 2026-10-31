[Read in English](README.md)

![PixelDesk](assets/banner.png)

**Tes agents Claude Code au travail, dans un petit bureau en pixel art.**

Pensé pour l'application de bureau Claude. C'est là que tu profites de la barre pixel, de la pièce en direct et du plan d'étage.

![PixelDesk dans l'application de bureau : une conversation avec la barre juste au-dessus de la saisie, et la pièce à côté, où le gardien nourrit le feu](assets/bar.gif)

La barre vit dans ta conversation, juste au-dessus de la saisie. La pièce s'ouvre à côté.

## Installer dans l'application de bureau

Colle ceci dans n'importe quel terminal :

```
claude plugin install pixeldesk --marketplace Mats-TH/pixeldesk-mod
```

Ouvre ensuite une nouvelle conversation dans l'onglet **Code** de l'application de bureau Claude. C'est tout.

Pas de commande `claude` sur ta machine ? Passe par l'application. Clique sur **+** à côté de la zone de saisie, puis **Plugins**, puis **Add marketplace**. Colle ceci, puis clique sur **Add plugin** :

```
Mats-TH/pixeldesk-mod
```

## À quoi ça sert

Pendant que tu attends, Claude Code abat beaucoup de travail. PixelDesk te le montre.

Ton plan, tes limites d'usage et chaque sous-agent restent à l'écran, en direct, juste à côté du chat.

Il garde aussi ton cache au chaud, et te passe sur une conversation neuve avant que l'ancienne soit pleine.

À savoir : la relance du cache est automatique et active par défaut. Elle consomme des tokens. `/pixeldesk fire off` la coupe.

## Fonctionnalités

- **Barre en pixel art.** 80 px au-dessus de la saisie : ton plan, sa progression, tes limites 5 h et hebdo.
- **Un bureau par sous-agent.** Chaque agent s'installe dans la pièce, en direct. Survole un bureau pour lire sa carte.
- **Ton bureau Manager.** La conversation a son propre bureau, en tête de pièce. Elle travaille pendant un tour et fait la sieste entre deux.
- **Des bureaux bien rangés.** Les bureaux finis partent tout seuls. Choisis quand avec le bouton réglages, sur le mur.
- **Plan d'étage.** Une conversation qui en pilote d'autres les voit toutes d'un coup d'œil, une pièce pour chacune.
- **Outil de plan.** Claude annonce ses étapes avec un outil `plan`, et la barre suit.
- **Une cheminée pour ton cache.** Le feu montre si ton cache est chaud. Un gardien entre avec une bûche pour l'entretenir.
- **La cendre qui s'entasse.** Le tas devant le feu montre le remplissage de la conversation.
- **Changement de conversation automatique.** PixelDesk compacte, puis change tout seul, passation déjà lue.
- **Français et anglais.** Toute l'interface parle les deux.

![La pièce PixelDesk avec le gardien à la cheminée, à côté de la carte de la cheminée](assets/panel.png)

## La cheminée

### Ton cache reste au chaud

Claude garde ta conversation dans un cache, pendant 5 minutes ou 1 heure. Une fois froid, ton message suivant paie pour tout relire.

PixelDesk surveille cette horloge. 45 secondes avant que le cache refroidisse, il envoie une relance, et l'horloge repart.

Une relance, c'est une ligne fixe, `Answer only: ok`, en plus du contexte en cache. Rien d'autre.

Le feu baisse avec le temps restant : plein, moyen, faible, braises, éteint. Après chaque relance, le gardien apporte une bûche et le feu repart à plein.

PixelDesk ne relance jamais un cache que son horloge dit froid. Ce serait le plus cher, pour rien. Si une relance le trouve froid malgré tout, les relances s'arrêtent jusqu'à ton prochain tour.

C'est actif par défaut, et ça consomme des tokens. Lis [Bon à savoir](#bon-à-savoir) pour les plafonds et l'arrêt.

### La cendre montre le remplissage

La cendre s'entasse devant le feu à mesure que la conversation se remplit. Le tas est plein à 80 % du contexte. C'est le moment de changer.

Survole la cheminée pour ouvrir sa carte : ce qu'est le cache, le temps restant, les relances, son état, le pourcentage exact et les compactages.

### Une conversation neuve, toute seule

Quand la cendre est pleine, PixelDesk attend la fin du tour. Puis il compacte, ou il change de conversation.

En mode Automatique, un curseur décide. Tu le trouves dans le panneau des réglages, derrière le bouton sur le mur :

- **0.** Il change de conversation tout de suite.
- **1, 2 ou 3.** Il compacte ce nombre de fois, puis il change. La valeur par défaut est 2.
- **Toujours.** Il compacte seulement, et ne change jamais.

Les compactages faits par Claude Code comptent aussi. Avant chaque compactage, PixelDesk note les fichiers, décisions et demandes qu'il trouve : la passation finale ne résume donc jamais un résumé.

**Il attend tes agents.** Les agents et les conversations de l'étage finissent d'abord, pour que leurs résultats entrent dans la passation. Pressé ? `Changer maintenant` reste disponible.

**Il ouvre dans le même dossier.** La nouvelle conversation démarre dans le dossier exact de la session, worktree compris, message déjà envoyé.

**Il a besoin de la commande `claude`.** Sans elle, ou sous Linux, le texte est prêt dans la nouvelle conversation et tu appuies sur Entrée.

Tu préfères décider ? Passe en mode **Manuel** dans le panneau des réglages. PixelDesk ne compacte plus et ne change plus tout seul. Un bouton `Changer` apparaît sur la cheminée une fois la cendre pleine, et rien ne bouge avant ton clic. Une fois la passation prête, clique sur `Nouvelle conversation`.

## Dans le terminal

PixelDesk tourne aussi dans une session terminal, en version texte plus simple : une barre en caractères et la liste des agents. Le pixel art reste dans l'application de bureau.

Les relances du cache y tournent aussi, sans la cheminée. `/pixeldesk fire off` y marche pareil.

Pas de mur à cliquer dans le terminal. Pour passer en Manuel, mets `"briefingMode": "manual"` dans `~/.claude/pixeldesk/settings.json`.

Pour l'installer depuis une session terminal ouverte :

```
/plugin install pixeldesk --marketplace Mats-TH/pixeldesk-mod
```

Réponds `y` pour ajouter la marketplace, puis choisis un scope.

## Utilisation

Rien à régler. Une fois installé, PixelDesk tourne tout seul.

La barre est toujours là. Le panneau s'ouvre avec la session dans l'application de bureau, et avec ton premier agent dans le terminal.

| Commande | Ce qu'elle fait |
| --- | --- |
| `/pixeldesk` | Ouvre le panneau, et lève le masquage s'il y en avait un. |
| `/pixeldesk hide` | Ferme le panneau dans toutes les conversations et l'empêche de s'ouvrir tout seul. La barre reste. Le suivi, les relances et le changement automatique continuent. |
| `/pixeldesk show` | Ouvre le panneau ici et le laisse de nouveau s'ouvrir tout seul. |
| `/pixeldesk departure` | Te dit quand partent les bureaux finis. |
| `/pixeldesk departure plan` | Les bureaux finis restent jusqu'à la fin du plan, puis partent ensemble. C'est le réglage par défaut. |
| `/pixeldesk departure each` | Chaque bureau part 30 secondes après la fin de son agent. |
| `/pixeldesk fire` | Te dit où en sont les relances : en marche ou coupées, temps restant, combien, et pourquoi elles se sont arrêtées. |
| `/pixeldesk fire on` | Met les relances en marche dans toutes les conversations. C'est le réglage par défaut. |
| `/pixeldesk fire off` | Coupe les relances dans toutes les conversations, et rien d'autre. Le feu suit alors simplement le cache. |
| `/pixeldesk move` | Écrit une passation tout de suite, ou dès que les travaux en cours sont finis. Clique sur `Nouvelle conversation` quand elle est prête. |
| `/pixeldesk compact` | Compacte tout de suite, comme le mode Automatique, une fois le tour fini. Il compte dans le curseur. |

Pour retirer aussi la barre, désactive le plugin avec `/plugin`.

Dans l'application de bureau, le bouton sur le mur de la pièce ouvre le panneau des réglages. Tout est là :

- **Bureaux.** Quand partent les bureaux finis.
- **Cache.** L'interrupteur des relances.
- **Passation.** Automatique ou Manuel, et le curseur en mode Automatique.

Ton choix vaut pour toutes les conversations.

## Langue

PixelDesk choisit sa langue tout seul. Il suit le réglage `language` de Claude Code, puis la langue de ton système, et se rabat sur l'anglais.

Pour en imposer une, utilise l'option `language` : `auto` (par défaut), `fr` ou `en`. Change-la dans les options du plugin, ou fixe-la à l'installation :

```
claude plugin install pixeldesk --marketplace Mats-TH/pixeldesk-mod --config language=fr
```

## Bon à savoir

### La relance automatique est active par défaut

**Chaque relance envoie une ligne, `Answer only: ok`, en plus de ton contexte en cache. Ça consomme des tokens, et ça compte dans tes limites.**

Plus la conversation est grosse, plus il y a à relire. Chaque relance est notée dans `~/.claude/pixeldesk/logs/pixeldesk.log`, avec les tokens lus et écrits.

- **Conversation inactive.** 30 relances ou 2 h au plus une fois la conversation au repos, puis le feu s'éteint.
- **Conversation au travail.** Tant qu'un tour, un agent ou une conversation de l'étage tourne, elle reste chaude, sans plafond.
- **Étapes du plan.** Une étape en cours ne compte comme travail que 15 minutes après la dernière activité. Ensuite, les plafonds d'inactivité s'appliquent.
- **Plusieurs conversations.** Chacune compte de son côté. Il n'y a pas de plafond commun, donc elles s'additionnent.
- **Durée du cache inconnue.** Aucune relance. Tes tours normaux prouvent la durée, gratuitement. Une très grosse conversation peut attendre un moment cette preuve.

**Pour arrêter les relances, tape `/pixeldesk fire off`.** Ça vaut pour toutes les conversations, et ça n'arrête que les relances.

**Pour arrêter le compactage et le changement automatiques, choisis Manuel.** C'est un réglage à part, dans le panneau des réglages.

`/pixeldesk hide` ferme seulement le panneau : les relances continuent. Trois échecs de suite les arrêtent jusqu'à ton prochain tour.

### Les passations

- **En clair.** Les passations sont écrites en clair dans `~/.claude/pixeldesk/briefings/`, un fichier par passation, avec les notes de compactage. Les 20 plus récents de chaque sorte sont gardés. Les formats de secrets connus sont retirés, mais relis un fichier avant de le partager.
- **Des tokens aussi.** Rédiger une passation, compacter et démarrer la nouvelle conversation comptent dans tes limites.
- **Cache froid.** Si le cache est déjà froid quand la cendre est pleine, PixelDesk te demande d'abord, avec le bouton `Changer`.

### Le reste

- **Limite connue.** Un plugin ne peut pas retirer la marge intérieure du panneau ni sa gouttière de défilement.
- **Testé sur** Claude Code 2.1.309, Windows. Il faut une version récente de Claude Code, qui charge les modules de hooks.
- **Tes fichiers.** PixelDesk écrit dans `~/.claude/pixeldesk/`. Une exception : sous Windows, si aucune langue n'est réglée nulle part, il demande une fois la langue du système à PowerShell et la garde dans le stockage des plugins de Claude Code.
- **Limites.** Les jauges affichent `--` tant que Claude Code n'a rien transmis.
- **Plan d'étage.** Sous Windows, il lit les liens entre conversations dans l'application de bureau. Ailleurs, il regroupe les conversations d'un même projet.
- **Consommation.** Pour tenir la barre à jour, PixelDesk ajoute une courte consigne au prompt de Claude et à celui de chaque sous-agent, plus un court rappel après certains appels d'outils. Panneau ouvert, les résumés en langage simple des bureaux viennent de petits appels à Haiku.

## Crédits

La police pixel est Jersey 10. Voir [CREDITS.md](CREDITS.md).

## Licence

MIT. Voir [LICENSE](LICENSE).

---

PixelDesk est un projet communautaire, non affilié à Anthropic et non approuvé par Anthropic. Claude et Claude Code sont des marques d'Anthropic.
