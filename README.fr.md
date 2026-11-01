<p align="center"><a href="README.md">Read in English</a></p>

<p align="center">
  <img src="assets/banner.png" alt="PixelDesk Mod : garde ton cache en vie, dans un petit bureau en pixel art">
</p>

<h3 align="center">Dépense moins de tokens dans Claude Code, et vois tout ce qu'il fait.</h3>

<p align="center">
  <img src="https://img.shields.io/badge/Claude_Code-mod-FFC857?style=flat-square&labelColor=2A2036" alt="Un mod pour Claude Code">
  <img src="https://img.shields.io/badge/th%C3%A8mes-6-E8643C?style=flat-square&labelColor=2A2036" alt="Six thèmes">
  <img src="https://img.shields.io/badge/licence-MIT-7FB069?style=flat-square&labelColor=2A2036" alt="Licence MIT">
  <img src="https://img.shields.io/badge/langue-FR_%2F_EN-9DB4FF?style=flat-square&labelColor=2A2036" alt="Français et anglais">
</p>

<p align="center">
  <a href="#installer"><b>Installer</b></a> &nbsp;·&nbsp;
  <a href="#fait-pour-économiser-des-tokens"><b>Économiser</b></a> &nbsp;·&nbsp;
  <a href="#ce-que-tu-as"><b>Fonctionnalités</b></a> &nbsp;·&nbsp;
  <a href="#six-pièces-une-commande"><b>Thèmes</b></a> &nbsp;·&nbsp;
  <a href="#commandes"><b>Commandes</b></a>
</p>

<p align="center">
  <img src="assets/demo.gif" alt="Une conversation avec la barre en direct au-dessus de la saisie, et la pièce à côté. Le même moment passe dans les six thèmes : le gardien apporte une bûche et le feu repart." width="880">
</p>

<p align="center"><sub>Une maquette, dessinée par le code du mod. La barre, la pièce et le gardien sont les vrais dessins.</sub></p>

PixelDesk Mod est un plugin gratuit pour l'application de bureau Claude.

Il garde ton cache en vie pendant ton absence, et te fait passer sur une conversation neuve avant que celle-ci soit pleine. Le tout dans un petit bureau en pixel art, à côté du chat.

C'est joli. Ce n'est pas le sujet. Le sujet, c'est d'arrêter de payer pour reconstruire la même conversation.

## Installer

**Dans l'application de bureau Claude, ouvre l'onglet Code et colle ceci dans la conversation :**

```
Install the PixelDesk Mod plugin. Run: claude plugin install pixeldesk --marketplace Mats-TH/pixeldesk-mod (if claude is not found, use the path in the CLAUDE_CODE_EXECPATH environment variable instead).
```

Utilise le bouton de copie : la ligne dépasse du cadre. Claude lance la commande pour toi. Autorise-la quand il te le demande.

Ouvre ensuite une nouvelle conversation dans l'onglet Code. C'est tout.

| Où tu es | Quoi faire |
| --- | --- |
| **Onglet Code de l'application** | Colle la ligne ci-dessus. Pas besoin de terminal. |
| **Une conversation normale** | Elle ne peut pas installer un mod. Un chat ne lance pas de commande sur ton ordinateur, et le mod vit dans l'onglet Code. Passe sur l'onglet Code, puis colle la ligne. |
| **Un terminal** | Lance la commande ci-dessous. |

<details>
<summary><b>Les autres façons d'installer</b></summary>

<br>

**Depuis n'importe quel terminal :**

```bash
claude plugin install pixeldesk --marketplace Mats-TH/pixeldesk-mod
```

**Avec les boutons de l'application :** clique sur **+** à côté de la zone de saisie, puis **Plugins**, puis **Add marketplace**. Colle `Mats-TH/pixeldesk-mod`, puis clique sur **Add plugin**.

**Depuis une session terminal ouverte :**

```
/plugin install pixeldesk --marketplace Mats-TH/pixeldesk-mod
```

Réponds `y` pour ajouter la marketplace, puis choisis une portée.

**Pour imposer une langue :**

```bash
claude plugin install pixeldesk --marketplace Mats-TH/pixeldesk-mod --config language=fr
```

Il te faut Git sur ta machine : le plugin est récupéré depuis GitHub.

</details>

## Fait pour économiser des tokens

**C'est ton cache qui rend le retour dans une conversation peu coûteux.**

Claude garde ta conversation dans un cache, pendant 5 minutes ou 1 heure. Tant qu'il vit, la relire coûte [une fraction du prix normal](https://platform.claude.com/docs/en/about-claude/pricing#prompt-caching).

Une fois expiré, ton message suivant paie pour tout relire et tout réécrire. Sur une longue conversation, ça se sent.

**PixelDesk Mod surveille cette horloge pour toi.**

45 secondes avant que le cache refroidisse, il envoie une ligne, `Answer only: ok`. Claude relit la conversation depuis le cache, et l'horloge repart.

Quand tu reviens, ton cache est encore là.

**Il évite aussi aux conversations de devenir chères.**

Plus la conversation est pleine, plus chaque message a de choses à lire. Donc à 80 % du contexte, PixelDesk Mod compacte, puis te fait passer sur une conversation neuve, briefing déjà lu.

> **Pour être franc.** Les relances consomment des tokens, et elles comptent dans tes limites. Elles sont rentables si tu reviens. Sinon, elles ont été dépensées pour rien.
>
> L'économie dépend de la taille de ta conversation et de ta façon de travailler. Elle n'a pas été mesurée, donc aucun chiffre ici.
>
> **Tu n'en veux pas ? `/pixeldesk fire off`.** Une commande, et les relances s'arrêtent partout.

## Ce que tu as

<table>
  <tr>
    <td width="33%" valign="top">
      <img src="assets/feature-cache.png" alt="Le poêle et le gardien qui apporte une bûche">
      <br><b>Un cache qui reste en vie</b>
      <br>Des relances automatiques, juste avant qu'il refroidisse. Le feu montre le temps restant, et un gardien apporte une bûche.
    </td>
    <td width="33%" valign="top">
      <img src="assets/feature-move.png" alt="Un tas de cendre plein, et une plaque qui dit que le briefing est prêt">
      <br><b>Une conversation neuve, toute seule</b>
      <br>La cendre montre le remplissage. Quand elle est pleine, le mod compacte, puis change avec un briefing.
    </td>
    <td width="33%" valign="top">
      <img src="assets/feature-band.png" alt="La barre au-dessus de la saisie, avec le plan et les deux limites">
      <br><b>Tes limites, toujours sous les yeux</b>
      <br>Une barre au-dessus de la saisie avec ton plan et tes limites 5 h et hebdo, en direct.
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <img src="assets/feature-agents.png" alt="Des bureaux avec le patron et deux agents au travail">
      <br><b>Un bureau par agent</b>
      <br>Chaque sous-agent a son bureau, en direct. Survole-le pour lire ce qu'il fait. La conversation principale est le Patron, celles qu'elle lance sont des Managers.
    </td>
    <td width="33%" valign="top">
      <img src="assets/feature-plan.png" alt="Le plan sur un tableau, dans le thème Base spatiale">
      <br><b>Un plan qu'on peut suivre</b>
      <br>Claude annonce ses étapes, et elles restent au mur. Survole une étape pour son détail et qui s'en charge.
    </td>
    <td width="33%" valign="top">
      <img src="assets/feature-floor.png" alt="Un plan d'étage avec quatre conversations, en camps dans une forêt">
      <br><b>Un plan d'étage</b>
      <br>Une conversation qui en pilote d'autres les voit toutes d'un coup d'œil, une pièce pour chacune.
    </td>
  </tr>
</table>

### Tout seul

Rien à régler. Une fois installé, ça tourne.

<table>
  <tr>
    <td><b>Relances</b></td>
    <td>Avant que le cache refroidisse, seulement quand ça vaut le coup. Plafonds plus bas.</td>
  </tr>
  <tr>
    <td><b>Compactage</b></td>
    <td>À 80 % du contexte, deux fois par défaut. Ceux de Claude Code comptent aussi.</td>
  </tr>
  <tr>
    <td><b>Nouvelle conversation</b></td>
    <td>Dans le même dossier, worktree compris, avec son premier message déjà envoyé.</td>
  </tr>
  <tr>
    <td><b>Attente des agents</b></td>
    <td>Les agents finissent d'abord, pour que leurs résultats arrivent dans le briefing.</td>
  </tr>
  <tr>
    <td><b>Tes notes</b></td>
    <td>Fichiers, décisions et demandes sont gardés avant chaque compactage : un briefing ne résume jamais un résumé.</td>
  </tr>
</table>

Tu préfères décider ? Choisis **Manuel** dans les réglages. Rien ne bouge tant que tu ne cliques pas.

### Et les petits détails

- **Survole le feu** pour le temps restant, les relances et le pourcentage exact.
- **Des bureaux rangés.** Les bureaux finis partent seuls, à la fin du plan ou un par un.
- **Les tokens et le coût** au mur de chaque pièce.
- **Un panneau de réglages** derrière le bouton sur le mur, pour tout.
- **Un crabe.** Il vit là. Il fait la sieste.
- **Français et anglais.** Toute l'interface parle les deux, et choisit toute seule.
- **Une version terminal.** Une barre en texte et une liste d'agents. Les relances y tournent aussi.

<p align="center">
  <img src="assets/panel.png" alt="La carte de la cheminée à côté de la pièce, avec le gardien au poêle" width="880">
</p>

## Six pièces, une commande

<p align="center">
  <img src="assets/themes.png" alt="Les six thèmes : Cosy, Japonais, Nature, Futuriste, Geek et jeu, Base spatiale" width="880">
</p>

**Cosy, Japonais, Nature, Futuriste, Geek et jeu, Base spatiale.** Chacun a ses meubles, son poêle et son plan d'étage.

Choisis-en un dans les réglages, ou tape :

```
/pixeldesk theme nature
```

Les noms sont `cosy`, `japonais`, `nature`, `futuriste`, `geek` et `base`.

## Commandes

| Commande | Ce qu'elle fait |
| --- | --- |
| `/pixeldesk` | Ouvre le panneau. |
| `/pixeldesk theme <nom>` | Change la pièce. |
| `/pixeldesk fire off` | Arrête les relances, dans toutes les conversations. `on` les relance. |
| `/pixeldesk fire` | Dit où en sont les relances. |
| `/pixeldesk move` | Écrit un briefing maintenant, ou dès que le travail en cours est fini. |
| `/pixeldesk compact` | Compacte maintenant, une fois le tour fini. |

<details>
<summary><b>Toutes les commandes</b></summary>

<br>

| Commande | Ce qu'elle fait |
| --- | --- |
| `/pixeldesk` | Ouvre le panneau, et cesse de le masquer s'il l'était. |
| `/pixeldesk hide` | Ferme le panneau dans toutes les conversations et l'empêche de s'ouvrir seul. La barre reste. Le suivi, les relances et le changement automatique continuent. |
| `/pixeldesk show` | Ouvre le panneau ici et le laisse de nouveau s'ouvrir seul. |
| `/pixeldesk theme` | Dit le thème actuel et les noms. |
| `/pixeldesk theme <nom>` | Change le thème, dans toutes les conversations. |
| `/pixeldesk departure` | Dit quand partent les bureaux finis. |
| `/pixeldesk departure plan` | Les bureaux finis restent jusqu'à la fin du plan, puis partent ensemble. C'est le réglage par défaut. |
| `/pixeldesk departure each` | Chaque bureau part 30 secondes après la fin de son agent. |
| `/pixeldesk fire` | Dit où en sont les relances : actives ou non, temps restant, combien, et pourquoi elles se sont arrêtées. |
| `/pixeldesk fire on` | Active les relances dans toutes les conversations. C'est le réglage par défaut. |
| `/pixeldesk fire off` | Coupe les relances dans toutes les conversations, et rien d'autre. Le feu suit simplement le cache. |
| `/pixeldesk move` | Écrit un briefing maintenant, ou dès que le travail en cours est fini. Clique sur `Nouvelle conversation` quand il est prêt. |
| `/pixeldesk compact` | Compacte maintenant, comme le mode Automatique, une fois le tour fini. Ça compte pour le curseur. |

Pour retirer aussi la barre, désactive le plugin avec `/plugin`.

</details>

## Bon à savoir

<details>
<summary><b>Ce que coûtent les relances, et leurs limites</b></summary>

<br>

**Chaque relance envoie une ligne, `Answer only: ok`, par-dessus ton contexte en cache. Elle consomme des tokens et compte dans tes limites.**

Une conversation plus grosse a plus à relire. Chaque relance est écrite dans `~/.claude/pixeldesk/logs/pixeldesk.log`, avec les tokens lus et écrits.

- **Conversation inactive.** 30 relances ou 2 heures au plus une fois qu'elle se tait, puis le feu s'éteint.
- **Conversation au travail.** Tant qu'un tour, un agent ou une conversation de l'étage tourne, elle reste chaude, sans plafond.
- **Étapes de plan.** Une étape en cours ne compte comme du travail que 15 minutes après la dernière activité.
- **Plusieurs conversations.** Chacune compte pour elle-même. Il n'y a pas de plafond commun, elles s'additionnent.
- **Durée de cache inconnue.** Aucune relance. Tes tours normaux prouvent la durée, gratuitement.
- **Cache froid.** PixelDesk Mod ne relance jamais un cache que son horloge dit froid. Ce serait le plus cher, pour rien.
- **Échecs.** Trois de suite arrêtent les relances jusqu'à ton prochain tour.

`/pixeldesk hide` ferme seulement le panneau : les relances continuent.

</details>

<details>
<summary><b>Le changement automatique de conversation</b></summary>

<br>

Quand la cendre est pleine, PixelDesk Mod attend la fin du tour. Puis il compacte, ou il change de conversation.

En mode Automatique, un curseur décide, dans les réglages :

- **0.** Il change de conversation tout de suite.
- **1, 2 ou 3.** Il compacte autant de fois, puis change. La valeur par défaut est 2.
- **Toujours.** Il compacte seulement, et ne change jamais.

Pressé ? `Changer maintenant` reste disponible.

En mode Manuel, un bouton `Changer` apparaît sur la cheminée une fois la cendre pleine. Quand le briefing est prêt, clique sur `Nouvelle conversation`.

- **Des tokens aussi.** Écrire un briefing, compacter et démarrer la nouvelle conversation consomment tes limites.
- **Il lui faut la commande `claude`.** Sans elle, ou sous Linux, le texte attend dans la nouvelle conversation et tu appuies sur Entrée.
- **Cache froid.** Si le cache est déjà froid quand la cendre se remplit, PixelDesk Mod te demande d'abord.
- **En clair.** Les briefings sont écrits en clair dans `~/.claude/pixeldesk/briefings/`, avec les notes de compactage. Les 20 derniers de chaque sont gardés. Les formats de secrets connus sont retirés, mais relis un fichier avant de le partager.

</details>

<details>
<summary><b>La version terminal</b></summary>

<br>

PixelDesk Mod tourne aussi dans une session terminal, en version texte plus simple : une barre en caractères et une liste d'agents. Le pixel art reste dans l'application de bureau.

Les relances y tournent aussi, sans la cheminée. `/pixeldesk fire off` marche de la même façon.

Il n'y a pas de mur à cliquer dans le terminal. Pour passer en Manuel, mets `"briefingMode": "manual"` dans `~/.claude/pixeldesk/settings.json`.

</details>

<details>
<summary><b>Le reste</b></summary>

<br>

- **Testé** sous Windows seulement pour l'instant, avec Claude Code 2.1.309. Les retours macOS et Linux sont les bienvenus.
- **Langue.** Il suit le réglage `language` de Claude Code, puis la langue du système, et se rabat sur l'anglais. Pour en imposer une, utilise l'option `language` : `auto`, `fr` ou `en`.
- **Tes fichiers.** PixelDesk Mod écrit dans `~/.claude/pixeldesk/`. Une exception : sous Windows, quand aucune langue n'est réglée nulle part, il demande une fois la langue du système à PowerShell et la garde dans le stockage de plugin de Claude Code.
- **Limites.** Les jauges affichent `--` tant que Claude Code n'a pas donné de relevé.
- **Plan d'étage.** Sous Windows, il lit les liens entre conversations dans l'application de bureau. Ailleurs, il regroupe les conversations du même projet.
- **Patron et Manager.** Il n'y a qu'un Patron, la conversation principale. Les liens de l'application ne sont lus que sous Windows : ailleurs, une sous-conversation s'affiche aussi Patron.
- **Usage.** Pour garder la barre à jour, PixelDesk Mod ajoute une courte instruction au prompt de Claude et à celui de chaque sous-agent, plus un court rappel après certains appels d'outils. Tant que le panneau est ouvert, les résumés des bureaux en langage simple viennent de petits appels à Haiku.
- **Limite connue.** Un plugin ne peut pas retirer la marge intérieure du panneau ni sa gouttière de défilement.

</details>

## Crédits et licence

La police pixel est Jersey 10. Voir [CREDITS.md](CREDITS.md).

MIT. Voir [LICENSE](LICENSE). Gratuit, sans compte, sans télémétrie.

---

<sub>PixelDesk Mod est un projet communautaire. Il n'est ni affilié à Anthropic ni approuvé par Anthropic. Claude et Claude Code sont des marques d'Anthropic.</sub>
