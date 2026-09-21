// Filtrage geographique des offres.
//
// Contrainte de fond : la recherche cible un usage sans vehicule personnel.
// Seuls deux cas sont exploitables, un poste dans la metropole lilloise accessible en transports
// en commun, ou un poste en teletravail integral. Tout le reste est ecarte avant l'analyse par l'IA,
// ce qui evite de consommer le quota de requetes pour des offres inexploitables.

// Les libelles de ville arrivent sous des formes tres variables selon la source :
//   France Travail        « 59 - Lille », « 59 - Marcq-en-Barœul », « 59 - SECLIN »
//   Welcome to the Jungle « Lille », « Villeneuve-D'ascq », « Paris-17e-Arrondissement »
//
// La comparaison se fait donc sur une forme reduite : minuscules, sans accents, sans ligature,
// sans apostrophes ni tirets ni espaces. « 59 - Marcq-en-Barœul » et « marcq en baroeul »
// donnent tous deux « marcqenbaroeul ».
function normaliserNomDeVille(libelle) {
    if (!libelle) {
        return '';
    }

    return libelle
        .replace(/^\s*\d{2,3}\s*-\s*/, '')   // retrait du prefixe departemental « 59 - »
        .toLowerCase()
        .replace(/œ/g, 'oe')                  // la ligature ne se decompose pas en NFD
        .replace(/æ/g, 'ae')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')      // retrait des accents
        .replace(/[^a-z0-9]/g, '');           // retrait des apostrophes, tirets et espaces
}

// Les 95 communes de la Metropole Europeenne de Lille.
// Lille inclut ses communes associees Hellemmes et Lomme, citees separement par certaines offres.
const COMMUNES_METROPOLE_LILLOISE = [
    'Allennes-les-Marais', 'Anstaing', 'Armentières', 'Aubers', 'Baisieux', 'Bauvin',
    'Beaucamps-Ligny', 'Bondues', 'Bousbecque', 'Bouvines', 'Capinghem', 'Carnin',
    'Chéreng', 'Comines', 'Croix', 'Deûlémont', 'Don', 'Emmerin', 'Englos',
    'Ennetières-en-Weppes', 'Erquinghem-le-Sec', 'Erquinghem-Lys', 'Escobecques',
    'Faches-Thumesnil', 'Forest-sur-Marque', 'Fournes-en-Weppes', 'Frelinghien', 'Fretin',
    'Fromelles', 'Gruson', 'Hallennes-lez-Haubourdin', 'Halluin', 'Hantay', 'Haubourdin',
    'Hellemmes', 'Hem', 'Herlies', 'Houplin-Ancoisne', 'Houplines', 'Illies',
    'La Bassée', "La Chapelle-d'Armentières", 'La Madeleine', 'Lambersart', 'Lannoy',
    'Le Maisnil', 'Leers', 'Lesquin', 'Lezennes', 'Lille', 'Linselles', 'Lomme',
    'Lompret', 'Loos', 'Lys-lez-Lannoy', 'Marcq-en-Barœul', 'Marquette-lez-Lille',
    'Marquillies', 'Mons-en-Barœul', 'Mouvaux', 'Neuville-en-Ferrain',
    'Noyelles-lès-Seclin', 'Pérenchies', 'Péronne-en-Mélantois', 'Prémesques',
    'Quesnoy-sur-Deûle', 'Radinghem-en-Weppes', 'Ronchin', 'Roncq', 'Roubaix',
    'Sailly-lez-Lannoy', 'Sainghin-en-Mélantois', 'Sainghin-en-Weppes',
    'Saint-André-lez-Lille', 'Salomé', 'Santes', 'Seclin', 'Sequedin', 'Templemars',
    'Toufflers', 'Tourcoing', 'Tressin', 'Vendeville', 'Verlinghem', "Villeneuve-d'Ascq",
    'Wambrechies', 'Warneton', 'Wasquehal', 'Wattignies', 'Wattrelos', 'Wavrin',
    'Wervicq-Sud', 'Wicres', 'Willems'
];

const VILLES_AUTORISEES = new Set(COMMUNES_METROPOLE_LILLOISE.map(normaliserNomDeVille));

// Le mot « teletravail » seul ne suffit pas : la plupart des offres proposent deux jours par semaine,
// ce qui impose malgre tout d'habiter a proximite. Seules les formulations designant un poste
// entierement a distance sont retenues.
const EXPRESSIONS_TELETRAVAIL_INTEGRAL = [
    /full\s*remote/,
    /100\s*%?\s*(?:de\s*)?(?:teletravail|remote|distanciel)/,
    /(?:teletravail|remote)\s*(?:a\s*)?100\s*%/,
    /teletravail\s*(?:total|integral|complet|permanent)/,
    /(?:entierement|totalement)\s*a\s*distance/,
    /poste\s*(?:100\s*%?\s*)?(?:en\s*)?distanciel/
];

// Le texte de l'offre est reduit comme les noms de ville, mais en conservant les espaces
// et le signe pourcent, necessaires aux expressions ci-dessus.
function normaliserTexteOffre(texte) {
    return (texte || '')
        .toLowerCase()
        .replace(/œ/g, 'oe')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9%]+/g, ' ');
}

function estEnTeletravailIntegral(jobOffer) {
    const texte = normaliserTexteOffre(`${jobOffer.title} ${jobOffer.description}`);
    return EXPRESSIONS_TELETRAVAIL_INTEGRAL.some(expression => expression.test(texte));
}

function estDansMetropoleLilloise(jobOffer) {
    return VILLES_AUTORISEES.has(normaliserNomDeVille(jobOffer.location));
}

// Une offre sans lieu renseigne est conservee : mieux vaut la soumettre a l'analyse que de perdre
// une opportunite sur une donnee manquante. Le prompt de notation applique alors la regle
// geographique a partir du texte.
function estGeographiquementAccessible(jobOffer) {
    if (!jobOffer.location) {
        return true;
    }

    return estDansMetropoleLilloise(jobOffer) || estEnTeletravailIntegral(jobOffer);
}

module.exports = {
    estGeographiquementAccessible,
    estDansMetropoleLilloise,
    estEnTeletravailIntegral,
    normaliserNomDeVille
};
