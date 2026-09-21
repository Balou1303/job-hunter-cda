-- Ajout du type de contrat normalise sur les offres.
--
-- Jusqu'ici le tri reposait sur la presence des mots « alternance », « apprenti » ou
-- « professionnalisation » dans le texte de l'offre. Ce critere produit des faux positifs :
-- une offre exigeant « une premiere experience en alternance » est un poste classique.
--
-- Les deux sources exposent le type de contrat de maniere fiable :
--   France Travail       booleen `alternance` et champ `typeContrat`
--   Welcome to the Jungle facette `contract_type` (APPRENTICESHIP, FULL_TIME, INTERNSHIP)
--
-- Valeurs stockees : 'ALTERNANCE', 'CDI', 'AUTRE'.

USE alternance;

ALTER TABLE job_offers
    ADD COLUMN contract_type VARCHAR(20) DEFAULT NULL AFTER location;

-- Les offres deja en base ont ete collectees sous le filtre alternance strict.
UPDATE job_offers SET contract_type = 'ALTERNANCE' WHERE contract_type IS NULL;
