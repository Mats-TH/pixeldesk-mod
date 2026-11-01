<p align="center"><a href="README.md">Read in English</a></p>

<p align="center">
  <img src="assets/banner.png" alt="PixelDesk Mod : une interface pixel art pour suivre tes agents Claude">
</p>

<h3 align="center">Une interface pixel art pour suivre tes agents Claude en direct.</h3>

<p align="center">Agents, plan et limites à l'écran. Un cache gardé en vie pour dépenser moins de tokens.</p>

<p align="center">
  <img src="https://img.shields.io/badge/Claude_Code-mod-FFC857?style=flat-square&labelColor=2A2036" alt="Un mod pour Claude Code">
  <img src="https://img.shields.io/badge/th%C3%A8mes-6-E8643C?style=flat-square&labelColor=2A2036" alt="Six thèmes">
  <img src="https://img.shields.io/badge/licence-MIT-7FB069?style=flat-square&labelColor=2A2036" alt="Licence MIT">
  <img src="https://img.shields.io/badge/langue-FR_%2F_EN-9DB4FF?style=flat-square&labelColor=2A2036" alt="Français et anglais">
</p>

<p align="center">
  <a href="#comment-installer-pixeldesk-mod"><b>Installer</b></a> &nbsp;·&nbsp;
  <a href="#ce-que-pixeldesk-mod-affiche-à-lécran"><b>L'interface</b></a> &nbsp;·&nbsp;
  <a href="#la-vue-globale--toutes-tes-conversations-dun-coup-dœil"><b>La vue globale</b></a> &nbsp;·&nbsp;
  <a href="#fait-pour-téconomiser-des-tokens"><b>Économiser des tokens</b></a> &nbsp;·&nbsp;
  <a href="#6-thèmes-disponibles-pour-ton-pixeldesk"><b>Les thèmes</b></a> &nbsp;·&nbsp;
  <a href="#commandes"><b>Commandes</b></a>
</p>

<p align="center">
  <img src="assets/hero.png" alt="Les six thèmes de PixelDesk Mod en colonnes obliques : Cosy, Japonais, Nature, Futuriste, Geek et Base, chacun avec son décor, son feu et un bureau" width="880">
</p>

<p align="center"><sub>Les six thèmes réunis dans un montage, à partir des vrais dessins du mod.</sub></p>

PixelDesk Mod ajoute à Claude Code une interface en pixel art, sous la forme d'un petit bureau.

Chaque agent a son bureau, ton plan est au mur, tes limites restent visibles. Tout s'affiche en direct, à côté de ta conversation.

L'interface n'est que la partie visible. Le mod garde aussi ton cache en vie et change de conversation au bon moment, pour réduire ta consommation de tokens.

Gratuit et open source, sous licence MIT.

## Comment installer PixelDesk Mod

**Dans l'application de bureau Claude, ouvre l'onglet Code et colle cette ligne dans la conversation :**

```
Install the PixelDesk Mod plugin. Run: claude plugin install pixeldesk --marketplace Mats-TH/pixeldesk-mod (if claude is not found, use the path in the CLAUDE_CODE_EXECPATH environment variable instead).
```

Utilise le bouton de copie, car la ligne dépasse du cadre. Claude lance l'installation pour toi : autorise-la quand il te le demande.

Ouvre ensuite une nouvelle conversation dans l'onglet Code. Le mod est actif.

| Où tu es | Quoi faire |
| --- | --- |
| **Dans l'onglet Code** | Colle la ligne ci-dessus. Pas besoin de terminal. |
| **Dans une conversation normale** | Passe par l'onglet Code. Une conversation peut répondre que le plugin est installé, mais cela n'atteint pas l'onglet Code, où tourne le mod. Va dans l'onglet Code, puis colle la ligne. |
| **Dans un terminal** | Lance la commande donnée dans le bloc ci-dessous. |

<details>
<summary><b>Les autres façons d'installer</b></summary>

<br>

**Depuis n'importe quel terminal :**

```bash
claude plugin install pixeldesk --marketplace Mats-TH/pixeldesk-mod
```

**Avec les boutons de l'application :** clique sur **+** à côté de la zone de saisie, puis **Plugins**, puis **Add marketplace**. Colle `Mats-TH/pixeldesk-mod`, puis clique sur **Add plugin**.

**Depuis une session terminal déjà ouverte :**

```
/plugin install pixeldesk --marketplace Mats-TH/pixeldesk-mod
```

Réponds `y` pour ajouter la marketplace, puis choisis une portée.

**Pour imposer une langue dès l'installation :**

```bash
claude plugin install pixeldesk --marketplace Mats-TH/pixeldesk-mod --config language=fr
```

Il te faut Git sur ta machine : le plugin est récupéré depuis GitHub.

</details>

## Ce que PixelDesk Mod affiche à l'écran

<p align="center">
  <img src="assets/demo.gif" alt="Une conversation avec la barre en direct au-dessus de la saisie, et la pièce à côté. Le même moment passe dans les six thèmes : le gardien apporte une bûche et le feu repart." width="880">
</p>

<p align="center"><sub>Une maquette, dessinée par le code du mod. La barre, la pièce et le gardien sont les vrais dessins.</sub></p>

<table>
  <tr>
    <td width="33%" valign="top">
      <img src="assets/feature-agents.png" alt="Le Patron et deux agents à leurs bureaux">
      <br><b>Un bureau pour chaque agent</b>
      <br>Chaque sous-agent s'installe à son bureau, en direct. Survole-le pour lire ce qu'il fait. Ta conversation principale est le Patron.
    </td>
    <td width="33%" valign="top">
      <img src="assets/feature-plan.png" alt="Le plan affiché sur un tableau au mur">
      <br><b>Ton plan affiché au mur</b>
      <br>Claude annonce ses étapes, et tu suis où il en est. Survole une étape pour son détail et qui s'en charge.
    </td>
    <td width="33%" valign="top">
      <img src="assets/feature-band.png" alt="La barre au-dessus de la saisie, avec le plan et les deux limites">
      <br><b>Tes limites toujours visibles</b>
      <br>Une barre au-dessus de la saisie montre ta progression et tes limites de 5 heures et de la semaine.
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <img src="assets/feature-cache.png" alt="Le poêle et le gardien qui apporte une bûche">
      <br><b>Un feu qui montre ton cache</b>
      <br>Le feu baisse quand ton cache va expirer. Un gardien apporte une bûche pour le garder en vie.
    </td>
    <td width="33%" valign="top">
      <img src="assets/feature-move.png" alt="Le poêle, la cendre, et une plaque qui dit que le briefing est prêt">
      <br><b>Une cendre qui montre le remplissage</b>
      <br>Le tas grossit avec ta conversation. Quand il est plein, le mod prend le relais.
    </td>
    <td width="33%" valign="top">
      <img src="assets/feature-settings.png" alt="Le panneau de réglages ouvert dans la pièce">
      <br><b>Un panneau de réglages</b>
      <br>Le bouton sur le mur ouvre les Réglages : thème, relances, compactage.
    </td>
  </tr>
</table>

### Autres fonctionnalités

- **Une carte sur le feu.** Survole-le pour voir le temps restant et le remplissage exact.
- **Des bureaux qui se rangent seuls.** Les agents finis partent d'eux-mêmes.
- **Tokens et coût affichés** sur le mur de la pièce.
- **Un crabe** qui vit dans la pièce.
- **Français et anglais.** Le mod choisit tout seul.
- **Une version terminal.** Plus simple, en texte, sans le pixel art.

## La vue globale : toutes tes conversations d'un coup d'œil

<p align="center">
  <img src="assets/themes/cosy-floor.png" alt="La vue globale du thème Cosy : le Patron et ses quatre sous-conversations, chacune dans sa maison avec son nom et son état" width="880">
</p>

Dès que ta conversation principale en lance d'autres, PixelDesk Mod change d'interface.

La pièce laisse place à une vue globale, faite pour le Patron : toutes ses sous-conversations sur une seule image. Elle s'ouvre toute seule.

- **Une pièce par sous-conversation**, avec son nom et son Manager.
- **Son état, écrit dessous :** combien d'agents travaillent, ou si le Manager travaille.
- **Une conversation au repos s'assombrit**, pour repérer celles qui travaillent.
- **Ses tokens** affichés à côté de son nom.
- **La liste de toutes tes conversations** au mur du Patron, cochée au fil de l'eau.
- **Une carte au survol** pour lire où en est chacune.

## Fait pour t'économiser des tokens

PixelDesk Mod agit sur deux choses : le cache, et la taille de ta conversation. Voici le cache.

### Qu'est-ce que le cache de Claude ?

À chaque message, Claude relit toute ta conversation. Pour limiter ce coût, il en garde une copie dans un cache.

Tant que ce cache est valide, la relecture coûte [une fraction du prix normal](https://platform.claude.com/docs/en/about-claude/pricing#prompt-caching). Une fois qu'il a expiré, ton message suivant doit tout relire au prix fort.

Plus la conversation est longue, plus l'écart est important.

### Cache de 5 minutes ou d'une heure : lequel as-tu ?

La durée dépend de ton compte, pas de l'endroit où tu travailles, selon [la documentation de Claude Code](https://code.claude.com/docs/en/prompt-caching) :

| Ton compte | Conversation principale | Sous-agents |
| --- | --- | --- |
| Abonnement Claude, dans ton quota inclus | 1 heure | 5 minutes |
| Abonnement Claude, en crédits d'usage | 5 minutes | 5 minutes |
| Clé API, Bedrock ou Vertex | 5 minutes | 5 minutes |

Chaque message relance ce délai. Le cache reste donc valide tant que tu travailles.

Il expire quand tu t'absentes : une pause, une réunion, un déjeuner.

### Comment PixelDesk Mod garde ton cache en vie

Le mod surveille le cache de ta conversation principale. Il détecte sa durée tout seul, sans réglage.

Juste avant l'expiration, il envoie à Claude une ligne très courte. Claude relit depuis le cache, et le délai repart de zéro. C'est une relance.

À ton retour, le cache est toujours valide, et ton message suivant coûte moins cher.

<p align="center">
  <img src="assets/panel.png" alt="La carte de la cheminée à côté de la pièce, avec le gardien au poêle" width="880">
</p>

### Ce que coûtent les relances

Une relance consomme aussi des tokens, et elle compte dans tes limites.

Elle est rentable si tu reviens. Sinon, elle a été dépensée pour rien. C'est pourquoi le mod s'arrête seul au bout d'un moment sur une conversation inactive.

L'économie dépend de la taille de ta conversation et de ta façon de travailler. Elle n'a pas été mesurée pour le public, donc aucun chiffre ici.

Les relances se désactivent dans les Réglages.

## Comment PixelDesk Mod évite de perdre ton contexte

Le contexte, c'est tout ce que Claude a en tête dans ta conversation. Sa taille est limitée.

Quand il se remplit, Claude Code compacte : il remplace les anciens messages par un résumé. Cela libère de la place, mais des détails disparaissent à chaque fois. Plus on compacte, plus le contexte s'appauvrit.

PixelDesk Mod change donc de conversation au bon moment, pour préserver ton contexte.

**Par défaut, le mod compacte deux fois, puis change de conversation :**

1. Ta conversation atteint 80 % de sa limite de contexte : le tas de cendre est plein.
2. Le mod compacte une première fois, et tu continues.
3. Elle revient à 80 % : il compacte une deuxième fois.
4. Elle revient encore à 80 % : il ouvre une nouvelle conversation, avec un briefing déjà lu.

Si Claude Code compacte de lui-même entre-temps, cela compte pour une des deux fois.

**C'est aussi une économie de tokens.** Une conversation neuve est courte, donc chaque message a moins à relire.

**Le contexte utile est conservé.** Avant chaque compactage, le mod note les fichiers, les décisions et tes demandes. Le briefing part de ces notes, pas d'un résumé de résumé.

**Le travail en cours n'est pas interrompu.** Le mod attend la fin du tour et la fin de tes agents. La nouvelle conversation s'ouvre dans le même dossier.

Ce comportement se change dans les Réglages.

## 6 thèmes disponibles pour ton PixelDesk

Chaque thème a son décor, ses bureaux, son poêle et sa vue globale.

Pour en changer, ouvre les Réglages et choisis-en un dans la colonne Thème.

Chaque thème est présenté en deux images : la pièce, puis la vue globale.

### Cosy

<p align="center">
  <img src="assets/themes/cosy-room.png" alt="La pièce, thème Cosy" width="400">
  <img src="assets/themes/cosy-floor.png" alt="La vue globale, thème Cosy" width="400">
</p>

### Japonais

<p align="center">
  <img src="assets/themes/japonais-room.png" alt="La pièce, thème Japonais" width="400">
  <img src="assets/themes/japonais-floor.png" alt="La vue globale, thème Japonais" width="400">
</p>

### Nature

<p align="center">
  <img src="assets/themes/nature-room.png" alt="La pièce, thème Nature" width="400">
  <img src="assets/themes/nature-floor.png" alt="La vue globale, thème Nature" width="400">
</p>

### Futuriste

<p align="center">
  <img src="assets/themes/futuriste-room.png" alt="La pièce, thème Futuriste" width="400">
  <img src="assets/themes/futuriste-floor.png" alt="La vue globale, thème Futuriste" width="400">
</p>

### Geek et jeu

<p align="center">
  <img src="assets/themes/geek-room.png" alt="La pièce, thème Geek et jeu" width="400">
  <img src="assets/themes/geek-floor.png" alt="La vue globale, thème Geek et jeu" width="400">
</p>

### Base spatiale

<p align="center">
  <img src="assets/themes/base-room.png" alt="La pièce, thème Base spatiale" width="400">
  <img src="assets/themes/base-floor.png" alt="La vue globale, thème Base spatiale" width="400">
</p>

## Tout se règle dans les Réglages

Les Réglages s'ouvrent avec le bouton sur le mur de la pièce. Ton choix vaut pour toutes tes conversations.

| Réglage | Ce que tu choisis |
| --- | --- |
| **Thème** | L'un des six thèmes. |
| **Départ des bureaux** | Les agents finis partent à la fin du plan, ou un par un. |
| **Cache** | Les relances, actives ou coupées. |
| **Briefing** | Automatique ou Manuel. |
| **Curseur du mode Automatique** | De 0 à 3 compactages avant de changer de conversation, ou Toujours pour compacter sans jamais changer. |

En mode Manuel, le mod ne compacte plus et ne change plus de conversation tout seul. Un bouton apparaît sur la cheminée, et rien ne bouge tant que tu ne cliques pas.

## À savoir avant d'installer

<details>
<summary><b>Les limites des relances</b></summary>

<br>

Une relance envoie une seule ligne, `Answer only: ok`, par-dessus ton contexte en cache. Une conversation plus grosse a plus à relire. Chaque relance est notée dans `~/.claude/pixeldesk/logs/pixeldesk.log`, avec les tokens lus et écrits.

- **Conversation inactive.** 30 relances ou 2 heures au plus, puis le feu s'éteint.
- **Conversation au travail.** Tant qu'un tour, un agent ou une sous-conversation tourne, pas de plafond.
- **Étape de plan en cours.** Elle ne compte comme du travail que 15 minutes après la dernière activité.
- **Plusieurs conversations.** Chacune compte pour elle-même, et elles s'additionnent.
- **Durée de cache inconnue.** Aucune relance tant que tes messages ne l'ont pas prouvée.
- **Cache déjà expiré.** Le mod ne le relance jamais : ce serait le plus cher, pour rien.
- **Échecs.** Trois de suite arrêtent les relances jusqu'à ton prochain message.

</details>

<details>
<summary><b>Le changement de conversation</b></summary>

<br>

- **Des tokens aussi.** Écrire un briefing, compacter et démarrer la nouvelle conversation consomment tes limites.
- **Il faut la commande `claude`.** Sans elle, ou sous Linux, le texte attend dans la nouvelle conversation et tu appuies sur Entrée.
- **Cache déjà expiré.** Le mod te demande avant de compacter ou de changer.
- **En clair sur ton disque.** Les briefings sont écrits dans `~/.claude/pixeldesk/briefings/`, avec les notes de compactage. Les 20 derniers sont gardés. Les formats de secrets connus sont retirés, mais relis un fichier avant de le partager.

</details>

<details>
<summary><b>La version terminal</b></summary>

<br>

Dans une session terminal, PixelDesk Mod s'affiche en texte : une barre en caractères et une liste d'agents. Le pixel art reste dans l'application de bureau.

Les relances y tournent aussi, sans la cheminée.

Il n'y a pas de mur à cliquer. Pour passer en Manuel, mets `"briefingMode": "manual"` dans `~/.claude/pixeldesk/settings.json`.

</details>

<details>
<summary><b>Compatibilité, fichiers et confidentialité</b></summary>

<br>

- **Testé** sous Windows seulement pour l'instant, avec Claude Code 2.1.309. Les retours macOS et Linux sont les bienvenus.
- **Patron et Manager.** Il n'y a qu'un Patron, ta conversation principale. Les conversations qu'elle lance sont des Managers. Les liens de l'application ne sont lus que sous Windows : ailleurs, une sous-conversation s'affiche aussi Patron.
- **Langue.** Le mod suit le réglage `language` de Claude Code, puis la langue du système, et se rabat sur l'anglais. Pour en imposer une, utilise l'option `language` du plugin : `auto`, `fr` ou `en`.
- **Tes fichiers.** Le mod écrit dans `~/.claude/pixeldesk/`. Une exception : sous Windows, quand aucune langue n'est réglée, il demande une fois la langue du système à PowerShell et la garde dans le stockage de plugin de Claude Code.
- **Limites.** Les jauges affichent `--` tant que Claude Code n'a pas donné de relevé.
- **Vue globale.** Sous Windows, il lit les liens entre conversations dans l'application. Ailleurs, il regroupe les conversations du même projet.
- **Consommation.** Pour garder la barre à jour, le mod ajoute une courte instruction au prompt de Claude et de chaque sous-agent, plus un court rappel après certains appels d'outils. Tant que le panneau est ouvert, les résumés des bureaux viennent de petits appels à Haiku.
- **Limite connue.** Un plugin ne peut pas retirer la marge intérieure du panneau ni sa gouttière de défilement.

</details>

## Commandes

| Commande | Ce qu'elle fait |
| --- | --- |
| `/pixeldesk` | Ouvre le panneau. |
| `/pixeldesk theme <nom>` | Change le thème : `cosy`, `japonais`, `nature`, `futuriste`, `geek` ou `base`. |
| `/pixeldesk fire off` | Coupe les relances, dans toutes les conversations. `on` les réactive. |
| `/pixeldesk fire` | Dit où en sont les relances. |
| `/pixeldesk move` | Écrit un briefing maintenant, ou dès que le travail en cours est fini. |
| `/pixeldesk compact` | Compacte maintenant, une fois le tour fini. |

<details>
<summary><b>Toutes les commandes</b></summary>

<br>

| Commande | Ce qu'elle fait |
| --- | --- |
| `/pixeldesk` | Ouvre le panneau, et cesse de le masquer s'il l'était. |
| `/pixeldesk hide` | Ferme le panneau partout et l'empêche de s'ouvrir seul. La barre, le suivi et les relances continuent. |
| `/pixeldesk show` | Ouvre le panneau ici et le laisse de nouveau s'ouvrir seul. |
| `/pixeldesk theme` | Dit le thème actuel et les noms disponibles. |
| `/pixeldesk theme <nom>` | Change le thème, dans toutes les conversations. |
| `/pixeldesk departure` | Dit quand partent les bureaux finis. |
| `/pixeldesk departure plan` | Les bureaux finis restent jusqu'à la fin du plan, puis partent ensemble. C'est le réglage par défaut. |
| `/pixeldesk departure each` | Chaque bureau part 30 secondes après la fin de son agent. |
| `/pixeldesk fire` | Dit où en sont les relances : actives ou non, temps restant, combien, et pourquoi elles se sont arrêtées. |
| `/pixeldesk fire on` | Active les relances dans toutes les conversations. C'est le réglage par défaut. |
| `/pixeldesk fire off` | Coupe les relances dans toutes les conversations, et rien d'autre. Le feu suit simplement le cache. |
| `/pixeldesk move` | Écrit un briefing maintenant, ou dès que le travail en cours est fini. Clique sur `Nouvelle conversation` quand il est prêt. |
| `/pixeldesk compact` | Compacte maintenant, comme le mode Automatique, une fois le tour fini. Cela compte pour le curseur. |

Pour retirer aussi la barre, désactive le plugin avec `/plugin`.

</details>

## Crédits et licence

La police pixel est Jersey 10. Voir [CREDITS.md](CREDITS.md).

MIT. Voir [LICENSE](LICENSE). Gratuit, sans compte, sans télémétrie.

---

<sub>PixelDesk Mod est un projet communautaire. Il n'est ni affilié à Anthropic ni approuvé par Anthropic. Claude et Claude Code sont des marques d'Anthropic.</sub>
