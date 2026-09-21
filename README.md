# Alternance Auto-Hunter (Projet CDA)

Système automatisé de recherche d'alternance en Conception et Développement d'Applications : agrégation d'offres multi-sources, notation par IA selon un profil, notification des offres pertinentes.

## Fonctionnement

Le projet se décompose en trois parties complémentaires.

**1. Collecte (Node.js)** — `node src/index.js`

- Interroge trois sources : l'API partenaire France Travail (OAuth2), l'API Algolia publique de Welcome to the Jungle, et l'API La Bonne Alternance (data.apprentissage.beta.gouv.fr).
- Normalise les réponses vers un format d'offre commun, afin que le reste du programme n'ait pas à connaître la structure propre à chaque site.
- Trie sur le type de contrat réel (alternance ou CDI) à partir des champs structurés de chaque source, plutôt que sur la présence de mots-clés dans le texte.
- Restreint la recherche à la métropole du candidat, avec repli sur les offres en télétravail intégral.
- Enregistre le résultat en base MySQL, avec déduplication sur l'identifiant de la source.

**2. Analyse et notification (n8n)** — workflow `Alternance.json`

- Récupère en base les offres non encore analysées.
- Soumet chaque offre à Google Gemini avec le profil du candidat et des règles de notation éliminatoires (zone géographique, type de contrat réel, niveau exigé).
- Enregistre la note sur 20 et le commentaire de l'IA en base.
- Envoie une notification Telegram et prépare un brouillon Gmail pour les offres dépassant le seuil de pertinence.
- Le profil candidat n'est pas stocké dans le workflow exporté : il est lu en base (table `candidate_profile`, voir *Installation*), un mécanisme plus fiable que les variables d'environnement sur les versions récentes de n8n (voir note ci-dessous).

**3. Consultation (Express)** — `Dashboard/api`

- Objectif : garder un contrôle humain sur le tri fait par l'IA. Le candidat doit pouvoir retrouver les offres stockées en base — analysées ou encore en attente — sans repasser par le terminal MySQL, pour repérer une offre mal notée et décider de postuler quand même.
- État actuel : API REST minimale (architecture MVC), un seul endpoint `GET /api/offers` qui liste toutes les offres. Pas encore d'interface web ni de filtrage — c'est la brique de données du futur tableau de bord, dont la forme reste à définir.

## Stack technique

- **Collecte** : Node.js (Axios, Winston, MySQL2)
- **API** : Express
- **Base de données** : MySQL
- **Orchestration** : n8n
- **Analyse** : API Google Gemini

## Structure

```
src/
  services/
    franceTravail.js     Authentification OAuth2 et recherche d'offres
    wttj.js               Recherche via l'API Algolia de Welcome to the Jungle
    laBonneAlternance.js  Recherche via l'API La Bonne Alternance
  models/
    database.js           Pool de connexions MySQL
    jobModel.js            Insertion et déduplication des offres
  geo.js                  Filtrage géographique (métropole lilloise / télétravail intégral)
  logger.js                Journalisation centralisée (Winston)
  index.js                 Point d'entrée : collecte, filtrage, sauvegarde
Dashboard/api/
  index.js                 Point d'entrée Express
  routes/                  Déclaration des routes
  controllers/             Logique des requêtes HTTP
  model/                   Accès aux données (MySQL)
scripts/                  Scripts SQL d'initialisation et de migration
Alternance.json           Export du workflow n8n (générique, sans donnée personnelle)
```

## Installation

1. `npm install` puis `npm install --prefix Dashboard/api`
2. Créer un fichier `.env` à la racine contenant les variables attendues :
   - Sources d'offres : `FT_CLIENT_ID`, `FT_CLIENT_SECRET`, `FT_SCOPE`, `FT_COMMUNE_CODE` (code commune INSEE, ex. `59350` pour Lille), `LBA_API_KEY`
   - Zone de recherche : `SEARCH_LATITUDE`, `SEARCH_LONGITUDE`, `SEARCH_RADIUS_KM` (utilisées par WTTJ, La Bonne Alternance, et comme rayon pour France Travail)
   - Base de données : `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`
   - API de consultation : `SERVER_PORT`
   - Workflow n8n : `GEMINI_API_KEY` (enregistrée dans les *Credentials* n8n, en authentification par en-tête `x-goog-api-key`)
3. Initialiser la base : `mysql -u root -p < scripts/init_db.sql`
4. Renseigner votre profil candidat (lu par le workflow n8n) en insérant votre propre ligne dans la table `candidate_profile` :
   ```sql
   INSERT INTO candidate_profile (profil, telegram_chat_id)
   VALUES ('Voici mon profil : ...', '123456789');
   ```
   `telegram_chat_id` s'obtient en écrivant à votre bot Telegram puis en consultant `https://api.telegram.org/bot<TOKEN>/getUpdates`.
5. Lancer la collecte : `node src/index.js`
6. Lancer n8n : `npx n8n start`, puis ouvrir `http://localhost:5678` et importer `Alternance.json`.

   Le profil et le chat ID sont lus via une requête SQL (node "Profil candidat"), plutôt que via une variable d'environnement : sur les versions récentes de n8n, l'exécution des nodes Code/expression est isolée dans un « Task Runner » qui n'a accès ni à `$env` ([bug connu](https://github.com/n8n-io/n8n/issues/29603)) ni à `process.env`, et la fonctionnalité Variables ($vars) est réservée au plan Enterprise. La base de données reste accessible sans restriction, d'où ce choix.
7. Lancer l'API de consultation : `npm start --prefix Dashboard/api`

## Limites connues

- Les identifiants Algolia de Welcome to the Jungle sont publics mais susceptibles d'être modifiés par le site. En cas d'échec de cette source, relever les nouvelles valeurs sur `https://www.welcometothejungle.com/api/env`.
- Le filtre géographique repose sur la ville déclarée dans l'offre, qui n'est pas toujours renseignée avec précision.
- La liste des communes autorisées dans [src/geo.js](src/geo.js) (`COMMUNES_METROPOLE_LILLOISE`) est propre à la métropole lilloise. Pour cibler une autre métropole, cette liste doit être remplacée manuellement — contrairement aux coordonnées de recherche (`SEARCH_LATITUDE`/`SEARCH_LONGITUDE`/`SEARCH_RADIUS_KM`), elle n'est pas paramétrable via `.env`.

---
*Projet réalisé dans le cadre de la montée en compétences vers le titre Concepteur Développeur d'Applications.*
